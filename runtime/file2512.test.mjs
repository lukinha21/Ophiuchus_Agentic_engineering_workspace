import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';
import {executeStage,sourceSnapshot} from './executor.mjs';
import {autopilotStep} from './autopilot.mjs';
const agents=['ORCHESTRATOR','DEVELOPER'].map(role=>({role,enabled:true,modelBinding:{providerId:'google',modelId:'test'}}));
function make(){const r=createRun({id:'file-plan-test',prompt:'Crie função em COBOL',agents});r.stage='implementation';r.artifacts.push({stage:'architecture',text:'Arquivos `routine.cob` e `test_routine.cob`.'});r.autoPilot={};return r;}
const file=(path,code)=>'```cobol file:'+path+'\n'+code+'\n```';
test('one file per call preserves source while retrying only failed test',async()=>{
 const r=make();let calls=0,writes=0;
 const texts=[file('routine.cob','01 LK-N PIC 9.\nGOBACK.'),file('test_routine.cob','PERFORM CHECK-CASE USING 7'),file('test_routine.cob','STOP RUN.')];
 const deps={execute:run=>executeStage(run,{generate:async({messages})=>{assert.match(messages[0].content,calls===0?/somente routine.cob/:/somente test_routine.cob/);if(calls>0)assert.match(messages[1].content,/01 LK-N/);return {text:texts[calls++],finishReason:'stop',usage:{total_tokens:10}};}}),apply:async(_id,files)=>{writes++;assert.equal(files.length,2);return files;}};
 await autopilotStep(r,{applyFiles:true},deps);assert.equal(r.stage,'implementation');assert.equal(r.corrections,0);assert.equal(writes,0);
 await autopilotStep(r,{applyFiles:true},deps);assert.equal(r.corrections,1);assert.equal(r.filePlan.accepted.length,1);assert.equal(writes,0);
 await autopilotStep(r,{applyFiles:true},deps);assert.equal(r.stage,'review');assert.equal(writes,1);
 const snap=await sourceSnapshot(r);assert.equal(snap.files.length,2);assert.match(snap.context,/01 LK-N/);assert.match(snap.context,/STOP RUN/);
});
test('truncation never concatenates a file-mode draft or discards accepted file',async()=>{
 const r=make();await executeStage(r,{generate:async()=>({text:file('routine.cob','GOBACK.'),finishReason:'stop'})});
 await executeStage(r,{generate:async()=>({text:'```cobol file:test_routine.cob\ntruncated',finishReason:'length'})});
 assert.equal(r.pendingDraft,null);assert.equal(r.filePlan.accepted.length,1);assert.equal(r.corrections,1);assert.equal(r.artifacts.at(-1).integrity,'invalid');
});
test('repeated identical file error blocks after two paid attempts',async()=>{
 const r=make();for(let i=0;i<2;i++)await executeStage(r,{generate:async()=>({text:'file:routine.cob\nmissing fences',finishReason:'stop'})});
 assert.equal(r.status,'BLOCKED');assert.equal(r.corrections,2);
});
test('file plan does not retain previous run paths or source',async()=>{
 const r=make();await executeStage(r,{generate:async()=>({text:file('routine.cob','GOBACK.'),finishReason:'stop'})});const next=createRun({id:'new-plan',prompt:'Python paridade',agents});assert.equal(next.filePlan,undefined);assert.deepEqual(next.artifacts,[]);
});
