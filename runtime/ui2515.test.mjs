import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {executeStage,buildMessages,interpretQA} from './executor.mjs';
import {createRun} from './orchestrator.mjs';
async function moduleFrom(path){const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {projectRun}=await moduleFrom('src/runtimeClient.ts');
const {readModelCatalog,saveModelCatalog}=await moduleFrom('src/modelCatalog.ts');
test('visual progress advances below 100 until runtime confirms stage, including reopened stage',()=>{
 const agents=[{id:'architect',role:'ARCHITECT',enabled:true}];const at='2026-11-11T20:00:00Z';const r={id:'progress',prompt:'test',stage:'architecture',status:'RUNNING',createdAt:at,configSnapshot:agents,history:['discovery','specification'],events:[{type:'stage.started',stage:'architecture',at}],artifacts:[]};
 const p=time=>projectRun(r,Date.parse(at)+time).tasks.find(t=>t.id==='task-003').progress;
 assert.equal(p(0),8);assert.ok(p(10000)>p(0));assert.ok(p(60000)>p(10000));assert.ok(p(3600000)<100);
 r.history.push('architecture');assert.ok(p(10000)<100);assert.equal(projectRun(r,Date.parse(at)+10000).states[0].status,'RUNNING');
 r.stage='implementation';assert.equal(p(10000),100);
});
test('model catalog stores identifiers only and survives component remount; corrupt data is ignored',()=>{
 const data=new Map();globalThis.sessionStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 saveModelCatalog({google:['model-a','model-b']});assert.deepEqual(readModelCatalog(),{google:['model-a','model-b']});
 data.set('ophiuchus.model-catalog.session.v1',JSON.stringify({google:['model-a'],credentials:{key:'secret'},invalid:[null]}));assert.deepEqual(readModelCatalog(),{google:['model-a']});
 data.set('ophiuchus.model-catalog.session.v1','bad-json');assert.deepEqual(readModelCatalog(),{});delete globalThis.sessionStorage;
});
test('review accepts useful nonempty string evidence arrays but never empty evidence',()=>{
 const obj={verdict:'pass',kind:'code',summary:'Checked',evidence:['src/a.mjs: valid export','tests/a.test.mjs: edge cases']};assert.match(interpretQA(JSON.stringify(obj)).evidence,/src\/a/);
 assert.throws(()=>interpretQA(JSON.stringify({...obj,evidence:[]})),/JSON válido/);
});
test('planning does not receive implementation file-generation instructions and omits redundant source without retry',async()=>{
 const agents=[{role:'ORCHESTRATOR',enabled:true},{role:'ARCHITECT',enabled:true,modelBinding:{providerId:'google',modelId:'test'}}];
 const run=createRun({id:'planning-no-source',prompt:'JavaScript task',agents});run.stage='specification';
 assert.doesNotMatch(buildMessages(run)[0].content,/Inclua código e pelo menos/);
 await executeStage(run,{generate:async()=>({text:'## Critérios\n- Preserve a entrada.\n```javascript\nexport function duplicated() {}\n```',finishReason:'stop',usage:{total_tokens:20}})});
 const a=run.artifacts.at(-1);assert.match(a.text,/Preserve/);assert.doesNotMatch(a.text,/export function/);assert.match(a.planningRaw,/export function/);assert.equal(run.corrections,0);
});
test('late provider response after cancel records cost without resurrecting run or proposing files',async()=>{
 const run=createRun({id:'late-cancel',prompt:'JavaScript tarefa',agents:[{role:'ORCHESTRATOR',enabled:true,modelBinding:{providerId:'google',modelId:'test'}}]});
 await executeStage(run,{generate:async()=>{run.status='CANCELLED';return {text:'old response',usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12},finishReason:'stop'};}});
 assert.equal(run.status,'CANCELLED');assert.equal(run.stage,'discovery');assert.equal(run.artifacts.at(-1).integrity,'cancelled');assert.equal(run.artifacts.at(-1).usage.total_tokens,12);assert.deepEqual(run.artifacts.at(-1).fileProposals,[]);
});

test('guide requests resolve locally even if the resend modifier precedes the object',async()=>{
 const result=await build({entryPoints:['src/intentRouter.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.md':'text'}});
 const {routeIntent}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const before=routeIntent('mande novamente o guia');
 assert.equal(before.kind,'local');
 assert.match(before.answer,/^# Guia do Ophiuchus/);
 assert.match(before.answer,/## 11\./);
 assert.deepEqual(routeIntent('mande o guia novamente'),before);
 assert.deepEqual(routeIntent('pode me mandar o guia de novo?'),before);
 assert.equal(routeIntent('mande novamente').kind,'clarify');
 assert.notEqual(routeIntent('mande novamente o guia do meu projeto').kind,'local');
});

test('follow-up intent uses meaning and context without starting an ambiguous engineering run',async()=>{
 const result=await build({entryPoints:['src/intentRouter.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.md':'text'}});
 const {routeIntent}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const ask=(prompt,turns=[],inProject=false)=>routeIntent(prompt,turns,new Date(),undefined,inProject);
 const response={role:'assistant',content:'Um parágrafo recente.'};
 for(const phrase of ['consegue mandar aquilo outra vez?','poderia me enviar novamente?','manda mais uma vez, por favor','reenvie a última resposta']){
  assert.equal(ask(phrase,[response]).answer,response.content,phrase);
  assert.equal(ask(phrase).kind,'clarify',phrase);
 }
 const guide={role:'assistant',content:'# Guia do Ophiuchus'};
 const proposal={role:'assistant',content:'Proposta de correção',draftId:'draft'};
 const ambiguity=ask('consegue mandar aquilo outra vez?',[guide,proposal]);
 assert.equal(ambiguity.kind,'clarify');
 assert.match(ambiguity.answer,/guia ou a proposta/);
 assert.deepEqual(ask('a proposta',[guide,proposal,{role:'assistant',content:ambiguity.answer}]),{kind:'local',answer:proposal.content,draftId:'draft'});
 assert.equal(ask('consegue mandar aquilo outra vez?',[{role:'user',content:'Uma pergunta'}]).kind,'clarify');
 for(const phrase of ['corrija o que pedi','implemente aquilo','arruma o código','uma ideia pra depois','consegue seguir por aí?']){
  assert.notEqual(ask(phrase).kind,'engineering',phrase);
 }
 assert.equal(ask('pode corrigir o cálculo em sum.mjs?').kind,'engineering');
 assert.equal(ask('corrige isso',[{role:'assistant',content:'Há um erro em sum.mjs.'}],true).kind,'engineering');
 assert.equal(ask('O que acontece quando alguém escreve crie um app?').kind,'direct');
});

test('creation without a named target asks before dispatch and offers safe completion options',async()=>{
 const result=await build({entryPoints:['src/intentRouter.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.md':'text'}});
 const {routeIntent,clarificationOptions}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 for(const prompt of ['crie um novo','crie uma nova','poderia criar outro?','crie uma nova funcionalidade','crie um arquivo chamado','crie um projeto para']){
  const route=routeIntent(prompt);
  assert.equal(route.kind,'clarify',prompt);
  const options=clarificationOptions(route.answer);
  assert.deepEqual(options.map(option=>option.label),['Novo projeto','Novo arquivo','Nova funcionalidade']);
  for(const option of options)assert.notEqual(routeIntent(option.prompt).kind,'engineering');
 }
 assert.equal(routeIntent('Crie um novo arquivo sum.mjs').kind,'engineering');
 assert.equal(routeIntent('Crie um novo projeto para calcular despesas').kind,'engineering');
});
