/** Ophiuchus control-plane prototype. No LLM or tool execution is implied. */
export const STAGES = Object.freeze(['discovery','specification','architecture','implementation','review','qa','delivery']);
export const ROLES = Object.freeze({discovery:'orchestrator',specification:'architect',architecture:'architect',implementation:'developer',review:'reviewer',qa:'qa',delivery:'documentation'});
// IDs match the visual task templates. Evidence is stage-level, not individual model/tool calls.
export const STAGE_SUBTASKS = Object.freeze({
 discovery:['sub-001','sub-002','sub-003'],
 specification:['sub-004','sub-005','sub-006'],
 architecture:['sub-007','sub-008','sub-009','sub-010'],
 implementation:['sub-011','sub-012','sub-013'],
 review:['sub-014','sub-015','sub-016'],
 qa:['sub-017','sub-018'],
 delivery:['sub-019']
});
function recordStageEvidence(run,stage,artifact){
 if(!artifact?.id || !artifact.text?.trim())return;
 run.subtasks??={};
 for(const id of STAGE_SUBTASKS[stage]||[]){
  const record={id,stage,status:'DOCUMENTED',artifactId:artifact.id,at:new Date().toISOString(),verification:'NOT_INDEPENDENTLY_VERIFIED'};
  run.subtasks[id]=record;
  emit(run,'subtask.evidence.linked',{stage,subtaskId:id,artifactId:artifact.id,summary:'Artefato da etapa associado; subtarefa não executada independentemente'});
 }
}
const MAX_CORRECTIONS = 5;
const MAX_PER_STAGE = 2;
export function createRun({id, prompt, agents}) {
  if (!id || !prompt?.trim()) throw new Error('id e prompt obrigatórios');
  if (!Array.isArray(agents) || !agents.some(a=>a.role==='ORCHESTRATOR' && a.enabled)) throw new Error('Orquestrador ativo obrigatório');
  return {id,prompt,createdAt:new Date().toISOString(),status:'RUNNING',stage:'discovery',corrections:0,correctionsByStage:{},configSnapshot:structuredClone(agents),history:[],events:[],artifacts:[],subtasks:{},approval:null};
}
export function emit(run,type,payload={}) {const event={id:`${run.id}:${run.events.length+1}`,at:new Date().toISOString(),type,stage:run.stage,...payload};run.events.push(event);return event;}
export function startRun(run) {emit(run,'run.started',{message:'Run iniciado com configuração congelada'});emit(run,'stage.started',{role:ROLES[run.stage]});return run;}
export function completeStage(run,{artifact=null}={}) {
  if(run.status!=='RUNNING') throw new Error('Run não está executando');
  if(artifact){run.artifacts.push({stage:run.stage,...artifact});recordStageEvidence(run,run.stage,artifact);}
  emit(run,'stage.completed',{role:ROLES[run.stage]});run.history.push(run.stage);
  if(run.stage==='specification') return checkpoint(run,'specification_review','architecture');
  if(run.stage==='qa') return checkpoint(run,'merge_approval','delivery');
  const next=STAGES[STAGES.indexOf(run.stage)+1];
  if(!next){run.status='SUCCESS';emit(run,'run.completed');return run;}
  run.stage=next;emit(run,'handoff.created',{to:ROLES[next]});emit(run,'stage.started',{role:ROLES[next]});return run;
}
function checkpoint(run,kind,resume){
 const autonomy=run.executionOptions?.autonomy||'supervised';
 const automatic=autonomy==='autonomous'||(autonomy==='semi'&&kind==='specification_review');
 // Only AI-produced, non-truncated artifacts qualify for automatic decisions.
 const current=run.artifacts.at(-1);
 const evidence=Boolean(current&&current.stage===run.stage&&current.text?.trim()&&current.integrity!=='incomplete'&&current.providerId!=='mock');
 if(automatic&&evidence){
  emit(run,'approval.auto',{kind,policy:autonomy,note:'Validação documental apenas; nenhum teste de código foi executado'});
  run.stage=resume;emit(run,'handoff.created',{to:ROLES[resume]});emit(run,'stage.started',{role:ROLES[resume]});return run;
 }
 run.status='WAITING_APPROVAL';run.approval={kind,resume};emit(run,'approval.requested',{kind,reason:automatic?'Evidência real insuficiente para aprovação automática':'Política supervisionada'});return run;
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
 for(const stage of STAGES.slice(STAGES.indexOf(target))){for(const id of STAGE_SUBTASKS[stage]||[]){if(run.subtasks?.[id]){delete run.subtasks[id];emit(run,'subtask.evidence.invalidated',{stage,subtaskId:id,summary:'Evidência anterior invalidada pela correção'});}}}
 if(run.corrections>MAX_CORRECTIONS||stageCorrections>MAX_PER_STAGE){run.status='BLOCKED';emit(run,'run.blocked',{reason:'Limite de correções atingido; intervenção humana necessária'});return run;}
 run.stage=target;emit(run,'handoff.created',{to:ROLES[target],reason:'correction',from:origin});emit(run,'stage.started',{role:ROLES[target],retry:stageCorrections});return run;
}
export function cancel(run) {if(run.status==='SUCCESS'||run.status==='CANCELLED')return run;run.status='CANCELLED';emit(run,'run.cancelled');return run;}
