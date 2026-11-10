/** Ophiuchus control-plane prototype. No LLM or tool execution is implied. */
export const STAGES = Object.freeze(['discovery','specification','architecture','implementation','review','qa','delivery']);
export const ROLES = Object.freeze({discovery:'orchestrator',specification:'architect',architecture:'architect',implementation:'developer',review:'reviewer',qa:'qa',delivery:'documentation'});
const MAX_CORRECTIONS = 5;
const MAX_PER_STAGE = 2;
export function createRun({id, prompt, agents}) {
  if (!id || !prompt?.trim()) throw new Error('id e prompt obrigatórios');
  if (!Array.isArray(agents) || !agents.some(a=>a.role==='ORCHESTRATOR' && a.enabled)) throw new Error('Orquestrador ativo obrigatório');
  return {id,prompt,createdAt:new Date().toISOString(),status:'RUNNING',stage:'discovery',corrections:0,correctionsByStage:{},configSnapshot:structuredClone(agents),history:[],events:[],artifacts:[],approval:null};
}
function emit(run,type,payload={}) {const event={id:`${run.id}:${run.events.length+1}`,at:new Date().toISOString(),type,stage:run.stage,...payload};run.events.push(event);return event;}
export function startRun(run) {emit(run,'run.started',{message:'Run iniciado com configuração congelada'});emit(run,'stage.started',{role:ROLES[run.stage]});return run;}
export function completeStage(run,{artifact=null}={}) {
  if(run.status!=='RUNNING') throw new Error('Run não está executando');
  if(artifact) run.artifacts.push({stage:run.stage,...artifact});
  emit(run,'stage.completed',{role:ROLES[run.stage]});run.history.push(run.stage);
  if(run.stage==='specification') {run.status='WAITING_APPROVAL';run.approval={kind:'specification_review',resume:'architecture'};emit(run,'approval.requested',{kind:run.approval.kind});return run;}
  if(run.stage==='qa') {run.status='WAITING_APPROVAL';run.approval={kind:'merge_approval',resume:'delivery'};emit(run,'approval.requested',{kind:run.approval.kind});return run;}
  const next=STAGES[STAGES.indexOf(run.stage)+1];
  if(!next){run.status='SUCCESS';emit(run,'run.completed');return run;}
  run.stage=next;emit(run,'handoff.created',{to:ROLES[next]});emit(run,'stage.started',{role:ROLES[next]});return run;
}
export function approve(run,accepted) {
 if(run.status!=='WAITING_APPROVAL'||!run.approval)throw new Error('Não existe aprovação pendente');
 const approval=run.approval;run.approval=null;
 if(!accepted){run.status='BLOCKED';emit(run,'approval.rejected',{kind:approval.kind});return run;}
 run.status='RUNNING';run.stage=approval.resume;emit(run,'approval.granted',{kind:approval.kind});emit(run,'handoff.created',{to:ROLES[run.stage]});emit(run,'stage.started',{role:ROLES[run.stage]});return run;
}
/** QA/review only report. Orchestrator selects the owner and reopens dependent stages. */
export function reportFailure(run,{kind,summary,origin=run.stage}={}) {
 if(run.status!=='RUNNING')throw new Error('Run não está executando');
 if(!['code','requirements','architecture'].includes(kind))throw new Error('Tipo de falha inválido');
 const target=kind==='code'?'implementation':kind==='requirements'?'specification':'architecture';
 const stageCorrections=(run.correctionsByStage[target]||0)+1;
 run.corrections++;run.correctionsByStage[target]=stageCorrections;
 emit(run,'validation.failed',{kind,summary:summary||'Falha sem descrição',origin,owner:ROLES[target],target});
 if(run.corrections>MAX_CORRECTIONS||stageCorrections>MAX_PER_STAGE){run.status='BLOCKED';emit(run,'run.blocked',{reason:'Limite de correções atingido; intervenção humana necessária'});return run;}
 run.stage=target;emit(run,'handoff.created',{to:ROLES[target],reason:'correction',from:origin});emit(run,'stage.started',{role:ROLES[target],retry:stageCorrections});return run;
}
export function cancel(run) {if(run.status==='SUCCESS'||run.status==='CANCELLED')return run;run.status='CANCELLED';emit(run,'run.cancelled');return run;}
