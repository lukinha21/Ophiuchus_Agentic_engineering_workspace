import test from 'node:test';import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';import {prepareFilePlan} from './file-plan.mjs';import {executeStage,sourceSnapshot} from './executor.mjs';
const agents=['ORCHESTRATOR','DEVELOPER'].map(role=>({role,enabled:true,modelBinding:{providerId:'fixture',modelId:'fixture'}}));
function run(prompt='Uma função em Java'){const r=createRun({id:'plan-regression',prompt,agents});r.stage='implementation';r.artifacts=[{stage:'architecture',text:'Serviço `src/PhraseNumberTransformer.java` e modelo `src/TransformationResult.java`.'}];return r}
test('architecture omitting Java tests receives a deterministic runnable-test slot before generation',()=>{
 const r=run();assert.deepEqual(prepareFilePlan(r).paths,['src/PhraseNumberTransformer.java','src/TransformationResult.java','src/PhraseNumberTransformerTest.java']);assert.equal(prepareFilePlan(r).paths.length,3);
});
test('existing test paths are retained and persisted partial plans are repaired without losing source',()=>{
 const r=run();r.filePlan={paths:['src/Thing.java'],accepted:[{path:'src/Thing.java',content:'class Thing {}'}],complete:false,failures:{}};const accepted=r.filePlan.accepted;prepareFilePlan(r);assert.deepEqual(r.filePlan.paths,['src/Thing.java','src/ThingTest.java']);assert.equal(r.filePlan.accepted,accepted);
 const t=run();t.artifacts[0].text='`Thing.java` e `tests/ContractTest.java`';assert.deepEqual(prepareFilePlan(t).paths,['Thing.java','tests/ContractTest.java']);
});
test('three ordered responses finish omitted-test Java plan without regenerating sources or consuming corrections',async()=>{
 const r=run(),paths=prepareFilePlan(r).paths,bodies=['public class PhraseNumberTransformer { public static int from(String s) { return s.length(); } }','public class TransformationResult {}','public class PhraseNumberTransformerTest { public static void main(String[] args) { if(PhraseNumberTransformer.from("abc")!=3) throw new AssertionError(); } }'];let calls=0;
 for(let i=0;i<3;i++)await executeStage(r,{generate:async({messages})=>{assert.ok(messages[0].content.includes('somente '+paths[calls]));if(calls===2)assert.match(messages[1].content,/s.length\(\)/);return {text:'```java file:'+paths[calls]+'\n'+bodies[calls++]+'\n```',finishReason:'stop',usage:{total_tokens:10}}}});
 assert.equal(calls,3);assert.equal(r.stage,'review');assert.equal(r.corrections,0);assert.equal(r.filePlan.complete,true);assert.deepEqual(r.artifacts.at(-1).fileProposals.map(p=>p.path),paths);assert.equal((await sourceSnapshot(r)).files.length,3);
});
test('a malformed queued test retries that test only, retaining accepted implementation',async()=>{
 const r=run();r.artifacts[0].text='`Thing.java`';const file=(p,c)=>'```java file:'+p+'\n'+c+'\n```';
 await executeStage(r,{generate:async()=>({text:file('Thing.java','public class Thing {}'),finishReason:'stop'})});
 await executeStage(r,{generate:async()=>({text:file('wrong.java','class Wrong {}'),finishReason:'stop'})});assert.equal(r.filePlan.accepted.length,1);assert.equal(r.corrections,1);
 await executeStage(r,{generate:async({messages})=>{assert.match(messages[0].content,/somente ThingTest.java/);return {text:file('ThingTest.java','public class ThingTest { public static void main(String[] args) {} }'),finishReason:'stop'}}});assert.equal(r.stage,'review');assert.equal(r.corrections,1);
});
test('mandatory COBOL test is also queued when omitted by architecture',()=>{
 const r=run('Função em COBOL');r.artifacts[0].text='`src/routine.cob`';assert.deepEqual(prepareFilePlan(r).paths,['src/routine.cob','src/test_routine.cob']);
});
