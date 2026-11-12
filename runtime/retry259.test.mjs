import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';
import {executeStage,buildMessages} from './executor.mjs';
import {autopilotStep} from './autopilot.mjs';
const agents=['ORCHESTRATOR','DEVELOPER'].map(role=>({role,enabled:true,modelBinding:{providerId:'google',modelId:'test'}}));
const make=()=>{const r=createRun({id:'retry259',prompt:'crie uma função em COBOL para dizer se um número é primo',agents});r.stage='implementation';r.autoPilot={qaVerified:false};return r;};
const valid='```cobol file:isprime.cob\nIDENTIFICATION DIVISION.\nPROGRAM-ID. isprime.\n```\n```cobol file:test_isprime.cob\nIDENTIFICATION DIVISION.\nPROGRAM-ID. test_isprime.\n```';
test('bad file transport costs one correction and next call receives exact rejection',async()=>{
 const r=make();let applied=0;const seen=[];
 const execute=run=>executeStage(run,{generate:async({messages})=>{seen.push(messages);return {text:seen.length===1?'file:isprime.cob\nGOBACK.':valid,finishReason:'stop'};}});
 const deps={execute,apply:async()=>{applied++;return [{path:'test_isprime.cob'}];}};
 await autopilotStep(r,{applyFiles:true},deps);
 assert.equal(r.corrections,1);assert.equal(r.stage,'implementation');assert.equal(applied,0);assert.equal(r.events.filter(e=>e.type==='validation.failed').length,1);
 await autopilotStep(r,{applyFiles:true},deps);
 assert.equal(r.corrections,1);assert.equal(r.stage,'review');assert.equal(applied,1);
 assert.match(seen[1][1].content,/Nenhum arquivo completo proposto/);
 assert.match(seen[1][1].content,/número é primo/);
 assert.match(seen[1][0].content,/```cobol file:</);
});
test('three invalid model replies block after three calls without secondary exception',async()=>{
 const r=make();let calls=0;
 for(let i=0;i<3;i++)await autopilotStep(r,{applyFiles:true},{execute:run=>executeStage(run,{generate:async()=>{calls++;return {text:'file:a.cob\nGOBACK.',finishReason:'stop'};}}),apply:async()=>{throw Error('must not write');}});
 assert.equal(calls,3);assert.equal(r.corrections,3);assert.equal(r.status,'BLOCKED');assert.equal(r.events.filter(e=>e.type==='validation.failed').length,3);
});
test('feedback only targets current stage and is scoped to this run',()=>{
 const r=make();r.events.push({type:'validation.failed',target:'architecture',summary:'other-stage-secret'});
 assert.doesNotMatch(buildMessages(r)[1].content,/other-stage-secret/);
 assert.doesNotMatch(buildMessages(make())[1].content,/ÚLTIMA REJEIÇÃO/);
});
