import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';
import {executeStage} from './executor.mjs';
const agents=['ORCHESTRATOR','DEVELOPER','REVIEWER','QA','DOCUMENTATION'].map(role=>({role,enabled:true,modelBinding:{providerId:'google',modelId:'fixture'}}));
const fixtures=[
 ['COBOL','cobol',[['prime.cob','01 LK-N PIC S9(9).'],['test_prime.cob','STOP RUN.']]],
 ['JavaScript','javascript',[['prime.mjs','export const prime=n=>n===2;'],['prime.test.mjs','// fixture transport only']]],
 ['Python','python',[['prime.py','def prime(n): return n == 2'],['test_prime.py','# fixture transport only']]],
 ['Java','java',[['Prime.java','class Prime {}'],['PrimeTest.java','class PrimeTest {}']]],
 ['Go','go',[['prime.go','package prime'],['prime_test.go','package prime']]],
 ['Rust','rust',[['Cargo.toml','[package]'],['src/lib.rs','fn prime() {}']]],
 ['C#','csharp',[['Prime.cs','class Prime {}'],['Prime.csproj','<Project />']]]
];
for(const [name,language,files] of fixtures)test(`${name}: transport, reviewer retry, QA and canonical static delivery`,async()=>{
 const r=createRun({id:'matrix-'+language,prompt:`Crie uma função de primalidade em ${name}`,agents});r.stage='implementation';
 const text=files.map(([path,content])=>'```'+language+' file:'+path+'\n'+content+'\n```').join('\n');
 await executeStage(r,{generate:async()=>({text,finishReason:'stop',usage:{total_tokens:10}})});assert.equal(r.stage,'review');
 await executeStage(r,{generate:async()=>({text:'Parecer em prosa, sem JSON',finishReason:'stop',usage:{total_tokens:7}})});
 assert.equal(r.stage,'review');assert.equal(r.corrections,0);assert.equal(r.artifacts.at(-1).text,'Parecer em prosa, sem JSON');
 await executeStage(r,{generate:async({messages})=>{assert.match(messages[1].content,/resposta anterior foi rejeitada/);return {text:JSON.stringify({verdict:'pass',kind:'code',summary:'Fixture de protocolo',evidence:'Não é validação funcional nem execução'}),finishReason:'stop'};}});assert.equal(r.stage,'qa');
 r.dockerValidation={status:'UNAVAILABLE'};
 await executeStage(r,{generate:async()=>({text:JSON.stringify({verdict:'pass',kind:'code',summary:'Fixture de protocolo',evidence:'Somente estática simulada'}),finishReason:'stop'})});
 r.status='RUNNING';r.stage='delivery';await executeStage(r,{generate:async()=>{throw Error('delivery must not call model');}});
 assert.equal(r.status,'SUCCESS');assert.equal(r.deliveryValidation.level,'STATIC_ONLY');assert.equal(r.artifacts.at(-1).usage.total_tokens,0);
});
test('implementation prose cannot masquerade as executed tests, regardless of language',async()=>{
 const r=createRun({id:'claims',prompt:'Python primalidade',agents});r.stage='implementation';
 await executeStage(r,{generate:async()=>({text:'```python file:prime.py\ndef prime(n): return True\n```\nTestes foram compilados e executados com sucesso.',finishReason:'stop'})});
 assert.equal(r.stage,'implementation');assert.equal(r.corrections,1);assert.deepEqual(r.testResults,undefined);assert.equal(r.artifacts.at(-1).integrity,'invalid');
});

test('format retry respects the autopilot call budget and retains token accounting',async()=>{
 const {driveAutopilot,autopilotStep,totalTokens}=await import('./autopilot.mjs');
 const r=createRun({id:'budget-json',prompt:'Python primalidade',agents});r.stage='review';let calls=0;
 await driveAutopilot(r,{maxSteps:5,maxCalls:1,maxTokens:1000},{step:(run,policy)=>autopilotStep(run,policy,{execute:x=>executeStage(x,{generate:async()=>{calls++;return {text:'invalid',usage:{total_tokens:11},finishReason:'stop'};}})})});
 assert.equal(calls,1);assert.equal(r.stage,'review');assert.equal(totalTokens(r),11);assert.equal(r.autoPilot.status,'PAUSED');assert.match(r.autoPilot.lastError,/Limite/);
});
