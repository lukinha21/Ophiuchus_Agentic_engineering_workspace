/** Explicit, run-scoped autonomous execution. Fail closed on missing evidence. */
import {executeStage} from './executor.mjs';
import {approve,reportFailure,emit} from './orchestrator.mjs';
import {applyProposals,listWorkspace} from './workspace.mjs';
import {runWorkspaceTests,testFiles} from './test-runner.mjs';
import {stackContract,validateProposals} from './stack-contract.mjs';

export const DEFAULT_LIMITS=Object.freeze({maxSteps:18,maxCalls:18,maxTokens:60000});
export function createAutopilotPolicy(input={}){
 if(input.confirm!==true)throw Error('Autorização explícita necessária para iniciar o ciclo automático');
 const policy={applyFiles:input.applyFiles===true,runTests:input.runTests===true,autoApprovals:input.autoApprovals===true};
 if(!policy.applyFiles||!policy.runTests)throw Error('Autorize gravação de arquivos e execução de testes separadamente');
 const maxSteps=Number(input.maxSteps??DEFAULT_LIMITS.maxSteps);
 const maxCalls=Number(input.maxCalls??DEFAULT_LIMITS.maxCalls);
 const maxTokens=Number(input.maxTokens??DEFAULT_LIMITS.maxTokens);
 if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>30||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>30||!Number.isInteger(maxTokens)||maxTokens<1000||maxTokens>200000)throw Error('Limites de automação inválidos');
 return {...policy,maxSteps,maxCalls,maxTokens};
}
export function totalTokens(run){return (run.artifacts||[]).reduce((n,a)=>n+(a.usage?.total_tokens||0),0)+(run.pendingDraft?.usage?.total_tokens||0);}
export async function autopilotStep(run,policy,{execute=executeStage,apply=applyProposals,list=listWorkspace,test=runWorkspaceTests}={}){
 if(run.status==='WAITING_APPROVAL'){
  if(!policy.autoApprovals)return {stop:'Aguardando aprovação humana'};
  if(run.approval?.kind==='merge_approval' && (!run.autoPilot?.qaVerified||run.qaAssessment?.status!=='PASS'))return {stop:'Entrega bloqueada: QA sem testes reais aprovados'};
  if(run.approval?.kind==='specification_review'){const a=[...(run.artifacts||[])].reverse().find(x=>x.stage==='specification');if(!a?.text?.trim()||a.providerId==='mock'||a.integrity==='incomplete')return {stop:'Especificação sem evidência real: aprovação humana necessária'};}
  approve(run,true);emit(run,'autopilot.approval',{summary:'Checkpoint aprovado dentro da autorização da run'});return {};
 }
 if(run.status!=='RUNNING')return {stop:`Execução encerrada: ${run.status}`};
 if(run.stage==='qa'){
  if(!policy.runTests)return {stop:'Execução de testes não autorizada'};
  const files=await list(run.id);
  const contract=stackContract(run.prompt);
  if(!testFiles(files,contract).length)return {stop:'Nenhum teste real encontrado; QA não pode ser aprovado'};
  const result=await test(run.id,{contract});
  const report={id:`${run.id}:test:${(run.testResults||[]).length+1}`,at:new Date().toISOString(),...result};
  run.testResults??=[];run.testResults.push(report);
  emit(run,result.passed?'workspace.tests.passed':'workspace.tests.failed',{testResultId:report.id,summary:`Docker: ${result.tests.length} arquivo(s); ${result.passed?'aprovado':'falhou'}`});
  if(!result.passed){run.autoPilot.qaVerified=false;run.autoPilot.qaTestResultId=null;reportFailure(run,{kind:'code',origin:'qa',summary:`Testes reais falharam: ${result.output.slice(0,2000)}`});return {};}
  run.autoPilot.qaVerified=true;
  run.autoPilot.qaTestResultId=report.id;
  // The model's textual QA assessment is not a substitute for tests, but is kept as a separate stage.
 }
 if(run.stage==='implementation'){
  await execute(run);
  if(run.pendingDraft)return {stop:'Resposta incompleta: continuação necessária antes de gravar arquivos'};
  const artifact=[...(run.artifacts||[])].reverse().find(a=>a.stage==='implementation');
  const proposals=artifact?.fileProposals||[];
  const contract=stackContract(run.prompt);
  const check=validateProposals(proposals,contract);
  if(!check.ok){reportFailure(run,{kind:'code',origin:'implementation',summary:check.reason});return {};}
  if(!proposals.length)return {stop:'Desenvolvedor não propôs arquivos. Automação pausada sem gravação'};
  if(!policy.applyFiles)return {stop:'Gravação não autorizada'};
  const files=await apply(run.id,proposals);
  emit(run,'autopilot.files.applied',{summary:`${proposals.length} arquivo(s) gravado(s) por autorização prévia`,paths:proposals.map(p=>p.path)});
  if(!testFiles(files,contract).length)return {stop:'Implementação sem testes compatíveis com a linguagem; QA bloqueado'};
  run.autoPilot.qaVerified=false;
  run.autoPilot.qaTestResultId=null;
  run.qaAssessment=null;
  return {};
 }
 await execute(run);
 if(run.pendingDraft)return {stop:'Resposta incompleta: continue manualmente ou ajuste o limite na próxima run'};
 if(run.autoPilot?.qaVerified && run.qaAssessment?.status==='FAIL')run.autoPilot.qaVerified=false;
 return {};
}
export async function driveAutopilot(run,policy,{step=autopilotStep,persist=async()=>{},isStopped=()=>false}={}){
 run.autoPilot={...policy,status:'RUNNING',steps:0,calls:0,qaVerified:false,qaTestResultId:null,lastError:null};
 emit(run,'autopilot.started',{summary:'Automação autorizada com limites e execução Docker'});await persist();
 try{
  while(run.autoPilot.status==='RUNNING'){
   if(isStopped()){run.autoPilot.status='PAUSED';run.autoPilot.lastError='Pausado pelo usuário';break;}
   if(run.autoPilot.steps>=policy.maxSteps||run.autoPilot.calls>=policy.maxCalls||totalTokens(run)>=policy.maxTokens){run.autoPilot.status='PAUSED';run.autoPilot.lastError='Limite de etapas, chamadas ou tokens atingido';break;}
   const before=run.artifacts?.length||0;
   const result=await step(run,policy);
   run.autoPilot.steps++;
   if((run.artifacts?.length||0)>before||run.pendingDraft)run.autoPilot.calls++;
   await persist();
   if(result?.stop){run.autoPilot.status='PAUSED';run.autoPilot.lastError=result.stop;break;}
   if(run.status==='SUCCESS'){run.autoPilot.status='SUCCESS';break;}
   if(['BLOCKED','CANCELLED'].includes(run.status)){run.autoPilot.status='PAUSED';run.autoPilot.lastError=`Run ${run.status}`;break;}
  }
 }catch(e){run.autoPilot.status='PAUSED';run.autoPilot.lastError=e instanceof Error?e.message:String(e);}
 emit(run,'autopilot.stopped',{summary:run.autoPilot.lastError||run.autoPilot.status});await persist();return run;
}
