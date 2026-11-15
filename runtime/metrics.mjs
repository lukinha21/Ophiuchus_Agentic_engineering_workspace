/** Real usage from persisted runs. Missing usage is unknown, never fabricated. */
export function summarizeMetrics(runs,days=7,now=Date.now()){
 const since=now-({1:1,7:7,30:30}[days]||7)*86400000;
 const selected=Object.values(runs).filter(r=>Number.isFinite(Date.parse(r.createdAt))&&Date.parse(r.createdAt)>=since);
 const byModel=new Map(),byRun=[];const trend=new Map();
 let input=0,output=0,other=0,total=0,unknown=0,calls=0;
 for(const run of selected){let runTokens=0,runCalls=0;
  for(const a of [...(run.artifacts||[]),...(run.pendingDraft?[run.pendingDraft]:[])]){
   if(['mock','local'].includes(a.providerId)||a.reusedFrom)continue;
   const key=`${a.providerId||'unknown'} / ${a.model||'unknown'}`;
   const row=byModel.get(key)||{key,provider:a.providerId||'unknown',model:a.model||'unknown',input:0,output:0,total:0,other:0,calls:0,unknown:0,stages:{}};
   const i=Number(a.usage?.prompt_tokens)||0,o=Number(a.usage?.completion_tokens)||0,t=Number(a.usage?.total_tokens)||i+o;
   const extra=Math.max(0,t-i-o);row.total+=t;row.other+=extra;other+=extra;total+=t;row.input+=i;row.output+=o;row.calls++;row.stages[a.stage||'unknown']=(row.stages[a.stage||'unknown']||0)+t;
   if(!a.usage)row.unknown++;
   byModel.set(key,row);input+=i;output+=o;runTokens+=t;calls++;runCalls++;
   if(!a.usage)unknown++;
   const date=(a.at||run.createdAt).slice(0,10);trend.set(date,(trend.get(date)||0)+t);
  }
  byRun.push({id:run.workflowId||((run.type==='project-task'&&run.id.includes(':'))?run.id.split(':')[0]:run.id),date:run.createdAt,status:run.status,stage:run.stage,tokens:runTokens,calls:runCalls,tests:(run.testResults||[]).length,testsPassed:(run.testResults||[]).filter(t=>t.passed).length});
 }
 const grouped=new Map();for(const r of byRun){const old=grouped.get(r.id);if(old){old.tokens+=r.tokens;old.calls+=r.calls;old.tests+=r.tests;old.testsPassed+=r.testsPassed;if(r.date>old.date)old.date=r.date;}else grouped.set(r.id,{...r});}
 return {periodDays:days,total,other,runs:grouped.size,success:selected.filter(r=>r.status==='SUCCESS').length,blocked:selected.filter(r=>r.status==='BLOCKED').length,calls,input,output,unknownUsage:unknown,models:[...byModel.values()].sort((a,b)=>b.total-a.total),runsDetail:[...grouped.values()].sort((a,b)=>b.date.localeCompare(a.date)),trend:[...trend].sort(([a],[b])=>a.localeCompare(b)).map(([date,tokens])=>({date,tokens})),tests:selected.reduce((n,r)=>n+(r.testResults||[]).length,0),testsPassed:selected.reduce((n,r)=>n+(r.testResults||[]).filter(t=>t.passed).length,0)};
}
