/** Explicit, run-scoped autonomous execution. Fail closed on missing evidence. */
import {executeStage} from './executor.mjs';
import {approve,reportFailure,emit,hasPassingDockerEvidence} from './orchestrator.mjs';
import {applyProposals,listWorkspace} from './workspace.mjs';
import {runWorkspaceTests,testFiles,classifyTestFailure,retryableInfrastructureFailure,dockerPreflight,cobolSyntaxCheck,dockerFailureReason} from './test-runner.mjs';
import {stackContract,validateProposals} from './stack-contract.mjs';

export const DEFAULT_LIMITS=Object.freeze({maxSteps:18,maxCalls:18,maxTokens:60000,maxDockerAttempts:3});
export function createAutopilotPolicy(input={}){
 if(input.confirm!==true)throw Error('Autorização explícita necessária para iniciar o ciclo automático');
 const policy={applyFiles:input.applyFiles===true,runTests:input.runTests===true,autoApprovals:input.autoApprovals===true};
 if(!policy.applyFiles||!policy.runTests)throw Error('Autorize gravação de arquivos e execução de testes separadamente');
 const maxSteps=Number(input.maxSteps??DEFAULT_LIMITS.maxSteps);
 const maxCalls=Number(input.maxCalls??DEFAULT_LIMITS.maxCalls);
 const maxTokens=Number(input.maxTokens??DEFAULT_LIMITS.maxTokens);
 const maxDockerAttempts=Number(input.maxDockerAttempts??DEFAULT_LIMITS.maxDockerAttempts);
 if(!Number.isInteger(maxDockerAttempts)||maxDockerAttempts<1||maxDockerAttempts>5)throw Error('Limite de tentativas Docker inválido');
 if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>30||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>30||!Number.isInteger(maxTokens)||maxTokens<1000||maxTokens>200000)throw Error('Limites de automação inválidos');
 return {...policy,maxSteps,maxCalls,maxTokens,maxDockerAttempts};
}
export function totalTokens(run){return (run.artifacts||[]).reduce((n,a)=>n+(a.usage?.total_tokens||0),0)+(run.pendingDraft?.usage?.total_tokens||0);}
export async function autopilotStep(run,policy,{execute=executeStage,apply=applyProposals,list=listWorkspace,test=runWorkspaceTests,preflight=dockerPreflight}={}){
 if(run.status==='WAITING_APPROVAL'){
  if(!policy.autoApprovals)return {stop:'Aguardando aprovação humana'};
  if(run.approval?.kind==='merge_approval' && (run.qaAssessment?.status!=='PASS'||(!hasPassingDockerEvidence(run) && run.dockerValidation?.status!=='UNAVAILABLE')))return {stop:'Entrega bloqueada: QA sem parecer favorável ou evidência de indisponibilidade do Docker'};
  if(run.approval?.kind==='specification_review'){const a=[...(run.artifacts||[])].reverse().find(x=>x.stage==='specification');if(!a?.text?.trim()||a.providerId==='mock'||a.integrity==='incomplete')return {stop:'Especificação sem evidência real: aprovação humana necessária'};}
  approve(run,true);emit(run,'autopilot.approval',{summary:'Checkpoint aprovado dentro da autorização da run'});return {};
 }
 if(run.status!=='RUNNING')return {stop:`Execução encerrada: ${run.status}`};
 if(run.stage==='qa'){
  if(!policy.runTests)return {stop:'Execução de testes não autorizada'};
  const files=await list(run.id);
  const contract=run.languageContract||stackContract(run.prompt);
  if(!testFiles(files,contract).length)return {stop:'Nenhum teste real encontrado; QA não pode ser aprovado'};
  // Infrastructure preflight is deterministic, local, and costs zero model tokens.
  // Test doubles in unit tests skip host-dependent probing unless explicitly injected.
  if(run.dockerValidation?.status!=='UNAVAILABLE' && !run.dockerValidation?.preflightChecked){
   const probe=(test===runWorkspaceTests||preflight!==dockerPreflight)?await preflight(contract):{ok:true,skipped:'injected test'};
   emit(run,'qa.docker.preflight',{summary:probe.ok?'Docker pré-verificado':(probe.reason||'Docker indisponível no pré-diagnóstico'),ok:probe.ok,image:probe.image,reason:probe.reason,command:probe.command,result:probe.ok?undefined:probe.result});
   if(!probe.ok){
    run.dockerValidation={status:'UNAVAILABLE',attempts:0,reason:probe.reason||'Pré-diagnóstico falhou sem justificativa',preflightChecked:true};
    run.autoPilot.qaVerified=false;run.autoPilot.qaTestResultId=null;
    emit(run,'qa.docker.unavailable',{attempts:0,reason:run.dockerValidation.reason,summary:'Pré-diagnóstico Docker falhou: '+run.dockerValidation.reason});
   }else run.dockerValidation={...run.dockerValidation,preflightChecked:true};
  }
  // Compile COBOL before paying for an AI QA opinion. If it fails, return to code correction.
  if(contract.language==='cobol' && run.dockerValidation?.status!=='UNAVAILABLE' && test===runWorkspaceTests){
   const syntax=await cobolSyntaxCheck(run.id);
   emit(run,'qa.cobol.syntax',{passed:syntax.passed,exitCode:syntax.exitCode,output:syntax.output,command:syntax.command,durationMs:syntax.durationMs});
   if(!syntax.passed){
    const classification=classifyTestFailure(syntax);
    if(classification==='infrastructure'){
     run.dockerValidation={status:'UNAVAILABLE',attempts:0,preflightChecked:true,reason:dockerFailureReason('Verificação de sintaxe COBOL',syntax)};
     emit(run,'qa.docker.unavailable',{attempts:0,reason:run.dockerValidation.reason,summary:run.dockerValidation.reason});
    }else{
     run.dockerValidation={status:'CODE_FAILED',attempts:0,preflightChecked:true};
     reportFailure(run,{kind:'code',origin:'qa',summary:`Compilação COBOL falhou: ${String(syntax.output||'').slice(0,3000)}`});
     return {};
    }
   }
  }
  // Infrastructure retries never consume AI calls or code-correction budget.
  if(run.dockerValidation?.status!=='UNAVAILABLE'){
   const maxAttempts=Math.max(1,Math.min(5,Number(policy.maxDockerAttempts||3)));
   for(let attempt=1;attempt<=maxAttempts;attempt++){
    let result;
    try{result=await test(run.id,{contract});}
    catch(error){result={passed:false,tests:testFiles(files,contract),output:String(error?.message||error)};}
    const classification=classifyTestFailure(result);
    const report={id:`${run.id}:test:${(run.testResults||[]).length+1}`,at:new Date().toISOString(),...result,classification,attempt};
    run.testResults??=[];run.testResults.push(report);
    emit(run,result.passed?'workspace.tests.passed':classification==='infrastructure'?'workspace.tests.infrastructure_failed':'workspace.tests.failed',{testResultId:report.id,classification,attempt,maxAttempts,summary:`Docker: ${classification} (tentativa ${attempt}/${maxAttempts})`,exitCode:result.exitCode,image:result.image,durationMs:result.durationMs,command:result.command,output:String(result.output||'').slice(0,64000)});
    if(result.passed){run.autoPilot.qaVerified=true;run.autoPilot.qaTestResultId=report.id;run.dockerValidation={status:'PASSED',attempts:attempt,testResultId:report.id};break;}
    run.autoPilot.qaVerified=false;run.autoPilot.qaTestResultId=null;
    if(classification==='code'){run.dockerValidation={status:'CODE_FAILED',attempts:attempt};reportFailure(run,{kind:'code',origin:'qa',summary:`Testes reais falharam: ${String(result.output||'').slice(0,2000)}`});return {};}
    if(attempt===maxAttempts || !retryableInfrastructureFailure(result)){
     run.dockerValidation={status:'UNAVAILABLE',attempts:attempt,reason:String(result.output||'').slice(0,2000)};
     emit(run,'qa.docker.unavailable',{attempts:attempt,reason:run.dockerValidation.reason,summary:'Docker indisponível: '+run.dockerValidation.reason});
     break;
    }
   }
  }
  // The model's textual QA assessment is not a substitute for tests, but is kept as a separate stage.
 }
 if(run.stage==='implementation'){
  const correctionsBefore=run.corrections;
  await execute(run);
  // Executor owns rejection accounting; never revalidate a rejected or stale artifact.
  if(run.status!=='RUNNING'||run.corrections!==correctionsBefore)return {};
  if(run.pendingDraft)return {stop:'Resposta incompleta: continuação necessária antes de gravar arquivos'};
  if(run.stage==='implementation'&&run.filePlan&&!run.filePlan.complete)return {};
  const artifact=[...(run.artifacts||[])].reverse().find(a=>a.stage==='implementation');
  const proposals=artifact?.fileProposals||[];
  const contract=run.languageContract||stackContract(run.prompt);
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
  run.dockerValidation=null;
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
   if((run.artifacts||[]).slice(before).some(a=>a.providerId!=='local'&&!a.reusedFrom)||run.pendingDraft)run.autoPilot.calls++;
   await persist();
   if(result?.stop){run.autoPilot.status='PAUSED';run.autoPilot.lastError=result.stop;break;}
   if(run.status==='SUCCESS'){run.autoPilot.status='SUCCESS';break;}
   if(['BLOCKED','CANCELLED'].includes(run.status)){run.autoPilot.status='PAUSED';run.autoPilot.lastError=`Run ${run.status}`;break;}
  }
 }catch(e){run.autoPilot.status='PAUSED';run.autoPilot.lastError=e instanceof Error?e.message:String(e);}
 emit(run,'autopilot.stopped',{summary:run.autoPilot.lastError||run.autoPilot.status});await persist();return run;
}
