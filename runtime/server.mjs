import productHelp from './product-help.json' with {type:'json'};
import {driveSequence} from './run-sequence.mjs';
import {prepareBrowser} from './browser-testing.mjs';
import {pickNativeFolder} from './native-folder.mjs';
import {createProjectService} from './local-project.mjs';
import {googleOAuthConfig,exchangeGoogleCode} from './google-oauth.mjs';
import {stackContract} from './stack-contract.mjs';
/** Local-only control-plane API. No credentials, tools, or provider calls. */
import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRun,startRun,completeStage,approve,reportFailure,cancel} from './orchestrator.mjs';
import {capabilities} from './model-capabilities.mjs';
import {generateText,listProviders,listModels} from './providers.mjs';
import {vaultStatus,unlockVault,lockVault,saveCredential,removeCredential,saveCustomEndpoint} from './vault.mjs';
import {executeStage} from './executor.mjs';
import {extractProposals,listWorkspace,readWorkspaceFile,applyProposals} from './workspace.mjs';
import {normalizeOptions,DEFAULT_OPTIONS} from './optimization.mjs';
import {runWorkspaceTests} from './test-runner.mjs';
import {lineDiff} from './line-diff.mjs';
import {summarizeMetrics} from './metrics.mjs';
import {createAutopilotPolicy,driveAutopilot} from './autopilot.mjs';
const PORT=Number(process.env.OPHIUCHUS_PORT||4317);
const DB=resolve(process.env.OPHIUCHUS_STATE_FILE||'./.ophiuchus-local/runs.json');
let runs={};
let browserPreparing=false;
let folderPickerBusy=false,folderPickerController=null;
const projects=createProjectService({onTest:async({draftId,projectId,workflowId,result})=>{
 if(result.passed===null)return;
 const run=runs[draftId]||(runs[draftId]={id:draftId,type:'project-task',projectId,workflowId,prompt:'Validação isolada do projeto',createdAt:result.at,status:'DOCUMENTED',artifacts:[],events:[]});
 run.testResults??=[];run.testResults.push({id:randomUUID(),...result});await save();
},onUsage:async report=>{
 runs[report.id]={id:report.id,type:'project-task',workflowId:report.workflowId||null,projectId:report.projectId,prompt:'Tarefa de projeto local',createdAt:report.at,status:'DOCUMENTED',stage:'project.'+report.mode,configSnapshot:[],history:[],events:[],artifacts:[{id:report.id+':response',stage:'project.'+report.mode,providerId:report.binding.providerId,model:report.binding.modelId,usage:report.usage,at:report.at,text:'Uso do modelo em projeto local; relatório e rascunho na sessão do projeto.',integrity:'unverified'}]};await save();
}});
const executing=new Set();
const testing=new Set();
const autopiloting=new Set();
const autoStops=new Set();
function scheduleSequence(run){
 if(executing.has(run.id)||testing.has(run.id)||autopiloting.has(run.id))throw Error('Operação já em andamento');
 executing.add(run.id);void driveSequence(run,{persist:save}).catch(()=>{}).finally(()=>executing.delete(run.id));
}
const BINDINGS=resolve(process.env.OPHIUCHUS_BINDINGS_FILE||'./.ophiuchus-local/bindings.json');
let bindings={};
const OPTIONS=resolve(process.env.OPHIUCHUS_OPTIONS_FILE||'./.ophiuchus-local/options.json');
let executionOptions={...DEFAULT_OPTIONS};
try{executionOptions=normalizeOptions(JSON.parse(await readFile(OPTIONS,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
const saveOptions=async()=>{await mkdir(dirname(OPTIONS),{recursive:true});await writeFile(OPTIONS,JSON.stringify(executionOptions,null,2),{mode:0o600});};
try{bindings=JSON.parse(await readFile(BINDINGS,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const saveBindings=async()=>{await mkdir(dirname(BINDINGS),{recursive:true});await writeFile(BINDINGS,JSON.stringify(bindings,null,2),{mode:0o600});};
try{runs=JSON.parse(await readFile(DB,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const run of Object.values(runs)){if(run.sequence?.status==='RUNNING'){run.sequence.status='PAUSED';run.sequence.error='Aplicativo reiniciado; autorize a retomada para continuar.';}if(run.autoPilot?.status==='RUNNING'){run.autoPilot.status='PAUSED';run.autoPilot.lastError='Servidor reiniciado; reinicie a automação com autorização';}}
let saving=Promise.resolve();
const save=()=>{const snapshot=JSON.stringify(runs,null,2);const pending=saving.catch(()=>{}).then(async()=>{await mkdir(dirname(DB),{recursive:true});const temporary=DB+'.'+randomUUID()+'.tmp';await writeFile(temporary,snapshot,{mode:0o600});await rename(temporary,DB);});saving=pending;return pending;};
const json=(res,code,value)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
const readBody=async(req)=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>1024*1024)throw Error('Payload grande demais');}return JSON.parse(text||'{}');};
export const server=http.createServer(async(req,res)=>{
 try{
  // Reject cross-site browser requests, including local-network origins.
  if(!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(req.headers.host||''))return json(res,403,{error:'Host local obrigatório'});
  const origin=req.headers.origin;
  if(origin && !/^http:\/\/(localhost|127\.0\.0\.1):(5173|4317)$/.test(origin))return json(res,403,{error:'Origem não autorizada'});
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,app:'ophiuchus'});
  if(req.method==='GET'&&url.pathname==='/desktop/status'&&process.env.OPHIUCHUS_DESKTOP==='1')return json(res,200,{active:projects.activeCount()+executing.size+testing.size+autopiloting.size,blocking:projects.blockingCount()+executing.size+testing.size+autopiloting.size+Number(browserPreparing)});
  if(req.method==='POST'&&url.pathname==='/testing/browser/prepare'){
   const body=await readBody(req);if(body.confirmDownload!==true)throw Error('Autorize o download do navegador Docker');
   if(browserPreparing)return json(res,409,{error:'Preparação já está em andamento'});browserPreparing=true;
   try{return json(res,200,await prepareBrowser())}finally{browserPreparing=false}
  }
  if(req.method==='GET'&&url.pathname==='/projects/picker')return json(res,200,{supported:process.platform==='win32',platform:process.platform});
  if(req.method==='POST'&&url.pathname==='/projects/picker/cancel'){folderPickerController?.abort();return json(res,200,{cancelled:true});}
  if(req.method==='POST'&&url.pathname==='/projects/pick'){
   const body=await readBody(req);if(body.confirmRead!==true)throw Error('A seleção deve autorizar leitura da pasta escolhida');
   if(folderPickerBusy)return json(res,409,{error:'O seletor de pasta já está aberto'});folderPickerBusy=true;folderPickerController=new AbortController();
   try{const path=await pickNativeFolder({signal:folderPickerController.signal});return path?json(res,201,await projects.open({path,confirmRead:true})):json(res,200,{cancelled:true});}
   catch(error){if(['PICKER_TIMEOUT','PICKER_UNAVAILABLE'].includes(error.code))return json(res,error.code==='PICKER_TIMEOUT'?408:503,{error:error.message,code:error.code});throw error;}
   finally{folderPickerBusy=false;folderPickerController=null;}
  }
  if(req.method==='POST'&&url.pathname==='/projects/open')return json(res,201,await projects.open(await readBody(req)));
  const stageMatch=url.pathname.match(/^\/projects\/([0-9a-f-]+)\/flows\/([0-9a-f-]+)\/stages\/([a-z]+)$/);
  if(stageMatch&&req.method==='GET')return json(res,200,await projects.flowDetails(stageMatch[1],stageMatch[2],stageMatch[3]));
  const flowMatch=url.pathname.match(/^\/projects\/([0-9a-f-]+)\/flows(?:\/([0-9a-f-]+)(?:\/(cancel|resume))?)?$/);
  if(flowMatch){
   const [,id,flowId,action]=flowMatch;
   if(req.method==='POST'&&!flowId)return json(res,202,await projects.startFlow(id,await readBody(req)));
   if(req.method==='GET'&&!action)return json(res,200,flowId?await projects.flow(id,flowId):await projects.flows(id));
   if(req.method==='POST'&&action==='resume')return json(res,202,await projects.resumeFlow(id,flowId,await readBody(req)));
   if(req.method==='POST'&&action==='cancel')return json(res,200,await projects.cancelFlow(id,flowId));
   return json(res,405,{error:'Ação do fluxo não permitida'});
  }
  const projectMatch=url.pathname.match(/^\/projects\/([0-9a-f-]+)(?:\/(tree|file|search|task|close|drafts)(?:\/([0-9a-f-]+)(?:\/(apply|undo|test|deliver))?)?)?$/);
  if(projectMatch){
   const [,id,action,draftId,draftAction]=projectMatch;
   if(req.method==='GET'&&!action)return json(res,200,await projects.info(id));
   if(req.method==='GET'&&action==='tree')return json(res,200,await projects.list(id));
   if(req.method==='GET'&&action==='file')return json(res,200,await projects.read(id,url.searchParams.get('path')));
   if(req.method==='GET'&&action==='search')return json(res,200,await projects.search(id,url.searchParams.get('q')));
   if(req.method==='POST'&&action==='close')return json(res,200,await projects.close(id));
   if(req.method==='POST'&&action==='task')return json(res,200,await projects.task(id,await readBody(req)));
   if(action==='drafts'&&draftId){
    if(req.method==='GET'&&!draftAction)return json(res,200,await projects.draft(id,draftId));
    if(req.method==='POST'&&['apply','undo','test','deliver'].includes(draftAction))return json(res,200,await projects[draftAction](id,draftId,await readBody(req)));
   }
   return json(res,405,{error:'Ação do projeto não permitida'});
  }
  if(req.method==='POST'&&url.pathname==='/chat/direct'){
   const body=await readBody(req);
   if(body.confirmSend!==true)throw Error('Autorize o envio da conversa ao modelo');
   if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>8000)throw Error('Pedido inválido');
   const binding=body.binding;
   if(typeof binding?.providerId!=='string'||typeof binding.modelId!=='string'||!binding.modelId.trim())throw Error('Configure um modelo para o chat');
   const history=Array.isArray(body.history)?body.history.slice(-6).filter(turn=>turn&&['user','assistant'].includes(turn.role)&&typeof turn.content==='string').map(({role,content})=>({role,content:content.slice(0,1800)})):[];
   if(binding.providerId==='mock')throw Error('Configure um provedor real para respostas de IA');
   const resolveIntent=body.resolveIntent===true;
   const result=await generateText({providerId:binding.providerId,model:binding.modelId,maxOutputTokens:resolveIntent?512:2048,messages:[
    {role:'system',content:resolveIntent?'Classifique a intenção da última mensagem usando apenas a conversa fornecida. Se for uma pergunta clara que pode ser respondida no chat, use kind answer e responda brevemente. Se o objetivo, a referência, o alvo ou a autorização de uma mudança forem ambíguos, use kind clarify e faça uma pergunta específica. Se o pedido exigir alteração ou execução, use kind clarify para confirmar o escopo. Nunca alegue ter iniciado execuções, enviado artefatos ou lido arquivos. Retorne somente JSON {"kind":"answer" ou "clarify","text":"resposta ou pergunta"}. Referência do produto: '+Object.values(productHelp).join('\n\n'):'Você responde como Ophiuchus, o assistente de engenharia de software deste aplicativo. Ophiuchus coordena agentes e seu modelo nesta chamada é '+binding.modelId+' ('+binding.providerId+'). Se perguntarem sua identidade, apresente-se como Ophiuchus e identifique o modelo quando solicitado. Responda diretamente à pergunta do usuário em linguagem natural. Você não pode acessar, alterar ou testar arquivos do usuário. Para perguntas sobre o Ophiuchus, use a referência do produto. Se a referência não cobrir um detalhe, diga que não consegue confirmá-lo. Referência: '+Object.values(productHelp).join('\n\n')},
    ...history,{role:'user',content:body.prompt}
   ]},{signal:AbortSignal.timeout(resolveIntent?20000:90000)});
   if(result.finishReason==='length'||!result.text?.trim())throw Error('O modelo não retornou uma resposta completa');
   if(resolveIntent){
    let resolution;
    try{resolution=JSON.parse(result.text)}catch{throw Error('Não foi possível interpretar o pedido')}
    if(!['answer','clarify'].includes(resolution?.kind)||typeof resolution.text!=='string'||!resolution.text.trim()||resolution.text.length>2000)throw Error('Não foi possível interpretar o pedido');
    return json(res,200,{answer:resolution.text.trim()});
   }
   return json(res,200,{answer:result.text});
  }
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'ophiuchus-control-plane',providerExecution:true});
  if(req.method==='GET'&&url.pathname==='/capabilities')return json(res,200,capabilities(url.searchParams.get('provider'),url.searchParams.get('model')||''));
  if(req.method==='GET'&&url.pathname==='/providers')return json(res,200,listProviders());
  if(req.method==='GET'&&url.pathname==='/vault')return json(res,200,await vaultStatus());
  if(req.method==='POST'&&url.pathname==='/vault/unlock'){const body=await readBody(req);return json(res,200,await unlockVault(body.password));}
  if(req.method==='POST'&&url.pathname==='/vault/lock'){lockVault();return json(res,200,await vaultStatus());}
  if(req.method==='PUT'&&url.pathname==='/vault/custom-endpoint'){const body=await readBody(req);await saveCustomEndpoint(body.baseUrl);return json(res,200,{ok:true});}
  const credentialMatch=url.pathname.match(/^\/vault\/credentials\/(openai|openrouter|google|anthropic|custom)$/);
  if(credentialMatch&&req.method==='PUT'){const body=await readBody(req);await saveCredential(credentialMatch[1],body.key);return json(res,200,{ok:true});}
  if(credentialMatch&&req.method==='DELETE'){await removeCredential(credentialMatch[1]);return json(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/oauth/openrouter/exchange'){
   if(!(await vaultStatus()).unlocked)return json(res,409,{error:'Desbloqueie o cofre antes de conectar OpenRouter'});
   const {code,verifier}=await readBody(req);
   if(typeof code!=='string'||code.length<8||code.length>2048||typeof verifier!=='string'||!/^[A-Za-z0-9_~-]{43,128}$/.test(verifier))return json(res,400,{error:'Código OAuth ou verificador PKCE inválido'});
   const response=await fetch('https://openrouter.ai/api/v1/auth/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,code_verifier:verifier,code_challenge_method:'S256'}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)return json(res,502,{error:`OpenRouter recusou a autorização (HTTP ${response.status}). Refaça a conexão.`});
   const data=await response.json();
   if(typeof data.key!=='string'||!data.key.startsWith('sk-or-'))throw Error('OpenRouter não retornou chave válida');
   await saveCredential('openrouter',data.key);
   return json(res,200,{ok:true,provider:'openrouter'});
  }
  if(req.method==='GET'&&url.pathname==='/oauth/google/config')return json(res,200,googleOAuthConfig());
  if(req.method==='POST'&&url.pathname==='/oauth/google/exchange'){
   if(!(await vaultStatus()).unlocked)return json(res,409,{error:'Desbloqueie o cofre antes de conectar Google'});
   return json(res,200,await exchangeGoogleCode(await readBody(req)));
  }
  if(req.method==='GET'&&url.pathname==='/execution-options')return json(res,200,executionOptions);
  if(req.method==='PUT'&&url.pathname==='/execution-options'){executionOptions=normalizeOptions(await readBody(req));await saveOptions();return json(res,200,executionOptions);}
  if(req.method==='GET'&&url.pathname==='/bindings')return json(res,200,bindings);
  if(req.method==='PUT'&&url.pathname==='/bindings'){const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Bindings inválidos');const next={};for(const [agentId,binding] of Object.entries(body)){if(!/^[a-z0-9_-]{1,64}$/i.test(agentId)||!binding||typeof binding!=='object'||typeof binding.providerId!=='string'||typeof binding.modelId!=='string'||binding.modelId.length>180||!binding.modelId.trim())throw Error('Binding inválido');if(!listProviders().some(p=>p.id===binding.providerId))throw Error('Provedor não suportado');next[agentId]={providerId:binding.providerId,modelId:binding.modelId};}bindings=next;await saveBindings();return json(res,200,bindings);}
  const modelMatch=url.pathname.match(/^\/providers\/([a-z0-9-]+)\/models$/);
  if(req.method==='GET'&&modelMatch){const models=await listModels(modelMatch[1],{signal:AbortSignal.timeout(12000)});return json(res,200,models);}
  if(req.method==='GET'&&url.pathname==='/metrics'){const days=Number(url.searchParams.get('days')||7);if(![1,7,30].includes(days))return json(res,400,{error:'Período inválido'});return json(res,200,summarizeMetrics(runs,days));}
  if(req.method==='GET'&&url.pathname==='/runs')return json(res,200,Object.values(runs).map(r=>({id:r.id,status:r.status,stage:r.stage,createdAt:r.createdAt})));
  if(req.method==='POST'&&url.pathname==='/runs'){
   const body=await readBody(req);const run=startRun(createRun({id:randomUUID(),prompt:body.prompt,agents:body.agents}));run.executionOptions={...executionOptions};runs[run.id]=run;run.sequence=body.confirmSend===true?{enabled:true,status:'PENDING',calls:0,steps:0,error:null}:undefined;await save();if(run.sequence?.enabled)scheduleSequence(run);return json(res,201,run);
  }
  const autoMatch=url.pathname.match(/^\/runs\/([\w-]+)\/autopilot\/(start|stop)$/);
  if(autoMatch){
   const run=runs[autoMatch[1]];if(!run)return json(res,404,{error:'Run não encontrada'});
   if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
   if(autoMatch[2]==='stop'){
    if(!autopiloting.has(run.id))return json(res,200,{status:run.autoPilot?.status||'IDLE'});
    autoStops.add(run.id);return json(res,202,{status:'STOPPING'});
   }
   if(run.status!=='RUNNING'&&run.status!=='WAITING_APPROVAL')return json(res,409,{error:'Run não pode iniciar automação neste estado'});
   if(autopiloting.has(run.id)||executing.has(run.id)||testing.has(run.id))return json(res,409,{error:'Operação já em andamento'});
   const policy=createAutopilotPolicy(await readBody(req));
   autopiloting.add(run.id);autoStops.delete(run.id);
   void driveAutopilot(run,policy,{persist:save,isStopped:()=>autoStops.has(run.id)}).finally(()=>{autopiloting.delete(run.id);autoStops.delete(run.id);});
   return json(res,202,{status:'STARTING'});
  }
  const workspaceMatch=url.pathname.match(/^\/runs\/([\w-]+)\/workspace(?:\/(apply|file|proposals|diff|test|edit))?$/);
  if(workspaceMatch){
   const run=runs[workspaceMatch[1]];if(!run)return json(res,404,{error:'Run não encontrada'});
   const action=workspaceMatch[2];
   if(req.method==='GET'&&!action)return json(res,200,{files:await listWorkspace(run.id)});
   if(req.method==='GET'&&action==='file')return json(res,200,await readWorkspaceFile(run.id,url.searchParams.get('path')));
   if(req.method==='GET'&&action==='proposals'){
    const artifact=[...(run.artifacts||[])].reverse().find(a=>a.stage==='implementation');
    return json(res,200,{artifactId:artifact?.id||null,files:artifact?.fileProposals||extractProposals(artifact?.text)});
   }
   if(req.method==='GET'&&action==='diff'){
    const artifact=[...(run.artifacts||[])].reverse().find(a=>a.stage==='implementation');
    const proposal=(artifact?.fileProposals||extractProposals(artifact?.text)).find(p=>p.path===url.searchParams.get('path'));
    if(!proposal)throw Error('Proposta não encontrada');
    let previous='';let exists=false;
    try{previous=(await readWorkspaceFile(run.id,proposal.path)).content;exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
    return json(res,200,{path:proposal.path,exists,before:previous,after:proposal.content,changed:!exists||previous!==proposal.content,...lineDiff(previous,proposal.content)});
   }
   if(req.method==='POST'&&action==='edit'){
    if(executing.has(run.id)||testing.has(run.id)||autopiloting.has(run.id))return json(res,409,{error:'Outra operação está em andamento'});
    const body=await readBody(req);
    if(body.confirm!==true)throw Error('Confirmação de gravação obrigatória');
    if(typeof body.path!=='string'||typeof body.content!=='string')throw Error('Arquivo inválido');
    const files=await applyProposals(run.id,[{path:body.path,content:body.content}]);
    run.events.push({id:`${run.id}:${run.events.length+1}`,at:new Date().toISOString(),type:'workspace.file.edited',stage:run.stage,summary:`Arquivo editado com autorização: ${body.path}`,path:body.path});
    await save();return json(res,200,{files});
   }
   if(req.method==='POST'&&action==='test'){
    if(executing.has(run.id)||testing.has(run.id)||autopiloting.has(run.id))return json(res,409,{error:'Outra operação está em andamento'});
    const body=await readBody(req);
    if(body.confirm!==true)return json(res,400,{error:'Confirmação explícita necessária para executar código não confiável'});
    testing.add(run.id);
    try{
     const result=await runWorkspaceTests(run.id,{contract:stackContract(run.prompt)});
     run.testResults??=[];
     const report={id:randomUUID(),at:new Date().toISOString(),...result};run.testResults.push(report);
     run.events.push({id:`${run.id}:${run.events.length+1}`,at:report.at,type:result.passed?'workspace.tests.passed':'workspace.tests.failed',stage:run.stage,summary:`${result.tests.length} arquivo(s) de teste; ${result.passed?'aprovado':'falhou'}`,testResultId:report.id});
     await save();return json(res,200,report);
    }finally{testing.delete(run.id);}
   }
   if(req.method==='POST'&&action==='apply'){
    if(executing.has(run.id)||testing.has(run.id)||autopiloting.has(run.id))return json(res,409,{error:'Aguarde a operação atual'});
    const body=await readBody(req);const artifact=run.artifacts?.find(a=>a.id===body.artifactId&&a.stage==='implementation');
    if(!artifact)throw Error('Artefato de implementação não encontrado');
    const proposals=artifact.fileProposals||extractProposals(artifact.text);
    if(!proposals.length)throw Error('Nenhum arquivo proposto neste artefato');
    if(!Array.isArray(body.paths)||!body.paths.length||body.paths.some(p=>typeof p!=='string')||new Set(body.paths).size!==body.paths.length)throw Error('Seleção inválida');
    const selected=body.paths.map(path=>{const found=proposals.find(p=>p.path===path);if(!found)throw Error('Arquivo não pertence ao artefato');return found;});
    const files=await applyProposals(run.id,selected);
    run.events.push({id:`${run.id}:${run.events.length+1}`,at:new Date().toISOString(),type:'workspace.files.applied',stage:run.stage,artifactId:artifact.id,summary:`${selected.length} arquivo(s) gravado(s) com aprovação explícita`,paths:body.paths});
    await save();return json(res,200,{files});
   }
   return json(res,405,{error:'Método não permitido'});
  }
  const match=url.pathname.match(/^\/runs\/([\w-]+)(?:\/(complete|approve|failure|cancel|events|execute|continue|discard-draft))?$/);
  if(!match)return json(res,404,{error:'Rota não encontrada'});
  const run=runs[match[1]];if(!run)return json(res,404,{error:'Run não encontrado'});
  if(req.method==='GET'&&match[2]==='events')return json(res,200,run.events);
  if(req.method==='GET'&&!match[2])return json(res,200,run);
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
  const body=await readBody(req);
  if(match[2]==='continue'){if(body.confirmSend!==true)throw Error('Autorize a retomada da equipe');if(run.status!=='RUNNING')throw Error('Esta execução não pode ser retomada');scheduleSequence(run);return json(res,202,run);}
  if(match[2]==='execute'){
   if(executing.has(run.id)||testing.has(run.id)||autopiloting.has(run.id))return json(res,409,{error:'Uma operação já está sendo executada'});
   executing.add(run.id);
   try{await executeStage(run);await save();return json(res,200,run);}
   finally{executing.delete(run.id);}
  }
  if(match[2]==='cancel'){autoStops.add(run.id);cancel(run);await save();return json(res,200,run);}
  if(executing.has(run.id)||testing.has(run.id)||autopiloting.has(run.id))return json(res,409,{error:'Aguarde a operação terminar'});
  switch(match[2]){
   case 'discard-draft':run.pendingDraft=null;break;
   case 'complete':if(run.pendingDraft)throw Error('Existe uma resposta incompleta. Continue ou descarte o rascunho antes de concluir manualmente.');completeStage(run,body);break;
   case 'approve':approve(run,body.accepted===true);break;
   case 'failure':reportFailure(run,body);break;
   case 'cancel':cancel(run);break;
   default:return json(res,404,{error:'Ação não encontrada'});
  }
  await save();if(match[2]==='approve'&&body.accepted===true&&run.sequence?.enabled&&run.status==='RUNNING')scheduleSequence(run);return json(res,200,run);
 }catch(error){json(res,400,{error:error.message});}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Ophiuchus control-plane: http://127.0.0.1:${PORT}`));

export async function shutdown(){folderPickerController?.abort();await projects.cancelAll();lockVault();await saving.catch(()=>{});await new Promise(resolve=>server.close(resolve));}
