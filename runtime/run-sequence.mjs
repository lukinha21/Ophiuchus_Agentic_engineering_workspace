import {executeStage} from './executor.mjs';
import {emit} from './orchestrator.mjs';
const MAX_CALLS=18,MAX_MS=480000;
/** Advances model work only. Checkpoints remain owned by the orchestrator's preference snapshot.
 * No workspace writes, Docker executions, approval bypasses or background restart retries. */
export async function driveSequence(run,{execute=executeStage,persist=async()=>{}}={}){
 const previous=run.sequence||{};
 run.sequence={...previous,enabled:true,status:'RUNNING',calls:previous.calls||0,steps:previous.steps||0,error:null};
 const started=Date.now();emit(run,'sequence.started',{summary:'Equipe em sequência; checkpoints seguem as preferências desta execução'});await persist();
 try{
  while(run.status==='RUNNING'){
   if(run.sequence.calls>=MAX_CALLS||run.sequence.steps>=30||Date.now()-started>=MAX_MS){run.sequence.error='Limite da execução atingido. Revise o histórico antes de iniciar outra execução.';break;}
   const tokens=(run.artifacts||[]).reduce((n,a)=>n+(a.usage?.total_tokens||0),0)+(run.pendingDraft?.usage?.total_tokens||0);
   if(tokens>=60000){run.sequence.error='Limite de 60.000 tokens informados atingido.';break;}
   const before={stage:run.stage,count:run.artifacts.length,corrections:run.corrections,accepted:run.filePlan?.accepted?.length||0};
   // A reservation includes failed requests, and survives explicit resumes.
   run.sequence.calls++;run.sequence.steps++;await persist();await execute(run);await persist();
   if(run.pendingDraft){run.sequence.error='Resposta incompleta. Revise o rascunho antes de autorizar a continuação.';break;}
   if(run.stage===before.stage&&run.artifacts.length===before.count&&run.corrections===before.corrections&&(run.filePlan?.accepted?.length||0)===before.accepted){run.sequence.error='Etapa sem avanço verificável; execução pausada.';break;}
  }
 }catch(error){run.sequence.error=String(error?.message||error)}
 run.sequence.status=run.status==='SUCCESS'?'COMPLETED':run.status==='WAITING_APPROVAL'?'WAITING_APPROVAL':run.status==='CANCELLED'?'CANCELLED':'PAUSED';
 emit(run,'sequence.stopped',{summary:run.sequence.error||run.sequence.status});await persist();return run;
}
