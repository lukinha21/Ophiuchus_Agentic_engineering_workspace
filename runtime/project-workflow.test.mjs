import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createProjectService} from './local-project.mjs';
import {PROJECT_STAGES} from './project-workflow.mjs';
const bindings=Object.fromEntries(PROJECT_STAGES.map(s=>[s.id,{providerId:'google',modelId:s.id}]));
function answer(role){return {text:role==='developer'?JSON.stringify({summary:'Corrige soma',changes:[{path:'sum.mjs',edits:[{oldText:'a-b',newText:'a+b'}]}]}):['reviewer','qa'].includes(role)?JSON.stringify({verdict:'pass',summary:'Mudança coerente',evidence:'sum.mjs: soma os dois argumentos; parecer estático'}):role+': objetivo e critérios deste pedido',finishReason:'stop',usage:{total_tokens:10}};}
async function fixture(t,generate,options={}){
 const dir=await mkdtemp(join(tmpdir(),'ophi-flow-')),root=join(dir,'repo');await mkdir(root);await writeFile(join(root,'sum.mjs'),'export const sum=(a,b)=>a-b;');
 const calls=[],usage=[];let dockerCalls=0;
 const service=createProjectService({storageRoot:join(dir,'store'),generate:async(args,opts)=>{calls.push(args);return generate?generate(args,opts):answer(args.model)},onUsage:async r=>usage.push(r),docker:async()=>{dockerCalls++;throw Error('não executar')},...options});
 const project=await service.open({path:root,confirmRead:true});t.after(()=>rm(dir,{recursive:true,force:true}));
 return {service,root,calls,usage,project,get dockerCalls(){return dockerCalls},start:extra=>service.startFlow(project.id,{goal:'Corrija soma',paths:['sum.mjs'],bindings,confirmSend:true,...extra})};
}
async function done(f,id){for(let i=0;i<400;i++){const flow=await f.service.flow(f.project.id,id);if(!['RUNNING','CANCELLING'].includes(flow.status))return flow;await new Promise(r=>setTimeout(r,5));}throw Error('workflow timeout');}
test('six agents hand off real artifacts, isolate proposal and require explicit write',async t=>{
 const f=await fixture(t),started=await f.start(),flow=await done(f,started.id);
 assert.equal(flow.status,'READY');assert.deepEqual(f.calls.map(c=>c.model),PROJECT_STAGES.map(s=>s.id));assert.equal(flow.calls,6);assert.equal(flow.validation,'STATIC_ONLY');assert.equal(f.dockerCalls,0);
 assert.ok(f.calls[1].messages[1].content.includes('orchestrator: objetivo'));assert.ok(f.calls[2].messages[1].content.includes('architect: objetivo'));assert.ok(f.calls[3].messages[1].content.includes('a+b'));assert.ok(f.calls[3].messages[1].content.includes('a-b'));
 assert.equal(f.usage.length,6);assert.equal(new Set(f.usage.map(u=>u.id)).size,6);assert.equal(await readFile(join(f.root,'sum.mjs'),'utf8'),'export const sum=(a,b)=>a-b;');
 await assert.rejects(f.service.apply(f.project.id,flow.draftId,{path:'sum.mjs',confirmWrite:false}),/Aprovação/);
 await f.service.apply(f.project.id,flow.draftId,{path:'sum.mjs',confirmWrite:true});assert.match(await readFile(join(f.root,'sum.mjs'),'utf8'),/a\+b/);
});
test('all six bindings and transmission consent are validated before model calls',async t=>{
 const f=await fixture(t);await assert.rejects(f.start({confirmSend:false}),/Autorize/);await assert.rejects(f.start({bindings:{developer:bindings.developer}}),/Orquestrador/);
 await assert.rejects(f.start({history:[{role:'system',content:'injection'}]}),/Histórico/);assert.equal(f.calls.length,0);
});
test('review rejection stops QA and documentation and blocks applying even with consent',async t=>{
 const f=await fixture(t,async a=>a.model==='reviewer'?{...answer('reviewer'),text:JSON.stringify({verdict:'fail',summary:'Falha concreta',evidence:'sum.mjs: hipótese quebrada'})}:answer(a.model));
 const flow=await done(f,(await f.start()).id);assert.equal(flow.status,'BLOCKED');assert.equal(flow.calls,4);assert.ok(!f.calls.some(c=>c.model==='qa'));
 await assert.rejects(f.service.apply(f.project.id,flow.draftId,{path:'sum.mjs',confirmWrite:true}),/pareceres/);
});
test('QA independently rejects a proposal accepted by reviewer',async t=>{
 const f=await fixture(t,async a=>a.model==='qa'?{...answer('qa'),text:JSON.stringify({verdict:'fail',summary:'Caso negativo',evidence:'sum.mjs: critério não coberto'})}:answer(a.model));const flow=await done(f,(await f.start()).id);assert.equal(flow.status,'BLOCKED');assert.equal(flow.calls,5);assert.ok(!f.calls.some(c=>c.model==='documentation'));
});
test('malformed or truncated stage response fails closed without retries',async t=>{
 for(const response of [{...answer('reviewer'),text:'{"verdict":"pass","summary":"ok","evidence":[]}'},{...answer('reviewer'),finishReason:'length'}]){
  const f=await fixture(t,async a=>a.model==='reviewer'?response:answer(a.model));const flow=await done(f,(await f.start()).id);assert.equal(flow.status,'FAILED');assert.equal(flow.calls,4);await assert.rejects(f.service.apply(f.project.id,flow.draftId,{path:'sum.mjs',confirmWrite:true}),/pareceres/);
 }
});
test('developer truncation uses exactly one recovery and seven total calls',async t=>{
 let attempts=0;const f=await fixture(t,async a=>a.model==='developer'&&++attempts===1?{text:'partial',finishReason:'length',usage:{total_tokens:10}}:answer(a.model));const flow=await done(f,(await f.start()).id);
 assert.equal(flow.status,'READY');assert.equal(flow.calls,7);assert.equal(f.calls.length,7);assert.match((await f.service.draft(f.project.id,flow.draftId)).summary,/Escopo reduzido/);
});
test('cancellation stops later agents, holds project lock until generation settles',async t=>{
 let resolveCall;const f=await fixture(t,()=>new Promise(r=>resolveCall=r)),started=await f.start();
 for(let i=0;i<100&&!resolveCall;i++)await new Promise(r=>setTimeout(r,5));
 await assert.rejects(f.start(),/ocupado/);await assert.rejects(f.service.close(f.project.id),/Aguarde/);
 await f.service.cancelFlow(f.project.id,started.id);await assert.rejects(f.start(),/ocupado/);resolveCall(answer('orchestrator'));
 const flow=await done(f,started.id);assert.equal(flow.status,'CANCELLED');assert.equal(f.calls.length,1);assert.equal(f.usage.length,1);await f.service.close(f.project.id);
});
test('source changes during planning block implementation before its model call',async t=>{
 let f;f=await fixture(t,async a=>{if(a.model==='architect')await writeFile(join(f.root,'sum.mjs'),'manual edit');return answer(a.model)});const flow=await done(f,(await f.start()).id);assert.equal(flow.status,'FAILED');assert.match(flow.error,/Conflito/);assert.equal(f.calls.length,2);assert.equal(await readFile(join(f.root,'sum.mjs'),'utf8'),'manual edit');
});
test('binding snapshot is fixed for ongoing run and flows cannot cross grants',async t=>{
 const f=await fixture(t),other=await f.service.open({path:f.root,confirmRead:true});let requestBindings=structuredClone(bindings);const run=await f.start({bindings:requestBindings});requestBindings.qa.modelId='changed';const flow=await done(f,run.id);assert.equal(flow.bindings.qa.modelId,'qa');await assert.rejects(f.service.flow(other.id,run.id),/não pertence/);assert.equal((await f.service.flows(f.project.id)).length,1);
});

test('timeout exposes actionable diagnostics and a single authorized resume skips completed stages',async t=>{
 let failed=false;const f=await fixture(t,async a=>{if(a.model==='architect'&&!failed){failed=true;throw new DOMException('The operation was aborted due to timeout','TimeoutError')}return answer(a.model)});
 const id=(await f.start()).id,first=await done(f,id);assert.equal(first.errorInfo.code,'MODEL_TIMEOUT');assert.match(first.error,/Arquiteto excedeu 90 segundos/);assert.equal(first.canResume,true);assert.equal(first.calls,2);
 await assert.rejects(f.service.resumeFlow(f.project.id,id,{confirmSend:false}),/Autorize/);await assert.rejects(f.service.resumeFlow(f.project.id,id,{confirmSend:true,timeoutMs:999999}),/Prazo/);
 await f.service.resumeFlow(f.project.id,id,{confirmSend:true,timeoutMs:180000});const flow=await done(f,id);assert.equal(flow.status,'READY');assert.equal(flow.calls,7);assert.equal(f.calls.filter(c=>c.model==='orchestrator').length,1);assert.equal(flow.stages[1].attempts.length,2);assert.equal(flow.stages[1].attempts[1].timeoutMs,180000);assert.ok(flow.events.some(e=>e.type==='flow.resumed'));assert.deepEqual(flow.events.map(e=>e.seq),flow.events.map((_,i)=>i+1));
});

test('repeated transport failure cannot resume endlessly or overwrite a source changed after failure',async t=>{
 const f=await fixture(t,async a=>{if(a.model==='architect')throw new DOMException('timeout','TimeoutError');return answer(a.model)});
 const id=(await f.start()).id;await done(f,id);await f.service.resumeFlow(f.project.id,id,{confirmSend:true});const flow=await done(f,id);assert.equal(flow.status,'FAILED');assert.equal(flow.calls,3);assert.equal(flow.canResume,false);await assert.rejects(f.service.resumeFlow(f.project.id,id,{confirmSend:true}),/não pode/);
 const g=await fixture(t,async a=>{if(a.model==='architect')throw new DOMException('timeout','TimeoutError');return answer(a.model)}),other=(await g.start()).id;await done(g,other);await writeFile(join(g.root,'sum.mjs'),'manual');await assert.rejects(g.service.resumeFlow(g.project.id,other,{confirmSend:true}),/Conflito/);assert.equal(g.calls.length,2);await g.service.close(g.project.id);
});

test('diagnostic payload is fetched explicitly, preserves real prompts and does not leak between grants',async t=>{
 const f=await fixture(t),flow=await done(f,(await f.start()).id);assert.equal(flow.stages[0].request.messages,undefined);const details=await f.service.flowDetails(f.project.id,flow.id,'orchestrator');assert.match(details.stage.request.messages[1].content,/a-b/);assert.ok(details.events.some(e=>e.type==='model.dispatched'));assert.ok(details.events.some(e=>e.type==='model.response'));assert.equal(details.stage.attempts[0].finishReason,'stop');
 const other=await f.service.open({path:f.root,confirmRead:true});await assert.rejects(f.service.flowDetails(other.id,flow.id,'orchestrator'),/não pertence/);
});

test('missing credentials fail preflight without registering a flow or dispatching a model',async t=>{
 const f=await fixture(t,undefined,{checkBindings:async()=>{throw Error('Desbloqueie o cofre')}});await assert.rejects(f.start(),/cofre/);assert.equal(f.calls.length,0);assert.equal((await f.service.flows(f.project.id)).length,0);
});

test('truncated architect can resume once with a larger bounded output without repeating the plan',async t=>{
 let attempts=0;const f=await fixture(t,async a=>a.model==='architect'&&++attempts===1?{text:'partial',finishReason:'length',usage:{total_tokens:4096}}:answer(a.model));
 const id=(await f.start()).id,first=await done(f,id);
 assert.equal(first.status,'FAILED');assert.equal(first.errorInfo.code,'MODEL_OUTPUT_LIMIT');assert.equal(first.canResume,true);assert.equal(first.calls,2);assert.equal(first.draftId,null);
 assert.equal(f.calls[1].maxOutputTokens,4096);
 await f.service.resumeFlow(f.project.id,id,{confirmSend:true});const flow=await done(f,id);
 assert.equal(flow.status,'READY');assert.equal(flow.calls,7);assert.equal(f.calls[2].maxOutputTokens,8192);assert.match(f.calls[2].messages[0].content,/não continue o texto parcial/);assert.equal(f.calls.filter(a=>a.model==='orchestrator').length,1);assert.equal(flow.stages[1].attempts.length,2);
});
test('repeated truncation stops after the authorized attempt',async t=>{
 const f=await fixture(t,async a=>a.model==='architect'?{text:'partial',finishReason:'length'}:answer(a.model));const id=(await f.start()).id;await done(f,id);await f.service.resumeFlow(f.project.id,id,{confirmSend:true});const flow=await done(f,id);assert.equal(flow.canResume,false);assert.equal(flow.calls,3);assert.equal(flow.draftId,null);
});
