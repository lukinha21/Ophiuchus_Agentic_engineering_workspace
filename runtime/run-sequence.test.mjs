import test from 'node:test';import assert from 'node:assert/strict';
import {createRun,startRun,completeStage,approve,cancel} from './orchestrator.mjs';
import {driveSequence} from './run-sequence.mjs';
const fixture=autonomy=>{const r=startRun(createRun({id:'sequence-fixture',prompt:'Uma função JavaScript',agents:[{enabled:true,role:'ORCHESTRATOR',modelBinding:{providerId:'fixture',modelId:'fixture'}}]}));r.executionOptions={autonomy};return r};
const execute=async r=>{if(r.stage==='qa')r.qaAssessment={status:'PASS'};completeStage(r,{artifact:{id:r.stage,text:'Parecer registrado',providerId:'fixture',integrity:'complete'}})};
test('supervised advances automatically between checkpoints and resumes without repeating completed stages',async()=>{
 const run=fixture('supervised'),seen=[];const step=async r=>{seen.push(r.stage);await execute(r)};
 await driveSequence(run,{execute:step});assert.deepEqual(seen,['discovery','specification']);assert.equal(run.approval.kind,'specification_review');assert.equal(run.sequence.status,'WAITING_APPROVAL');
 approve(run,true);await driveSequence(run,{execute:step});assert.deepEqual(seen,['discovery','specification','architecture','implementation','review','qa']);assert.equal(run.approval.kind,'merge_approval');
 approve(run,true);await driveSequence(run,{execute:step});assert.equal(run.status,'SUCCESS');assert.equal(run.sequence.status,'COMPLETED');assert.equal(run.sequence.calls,7);
});
test('semi and autonomous follow preference gates; autonomous cannot fake missing Docker evidence',async()=>{
 for(const level of ['semi','autonomous']){const r=fixture(level);await driveSequence(r,{execute});assert.equal(r.approval.kind,'merge_approval');assert.equal(r.sequence.calls,6);assert.equal(r.dockerValidation,undefined);assert.equal(r.deliveryValidation,undefined)}
 const r=fixture('autonomous');r.autoPilot={qaVerified:true,qaTestResultId:'docker-proof'};r.dockerValidation={status:'PASSED',testResultId:'docker-proof'};r.testResults=[{id:'docker-proof',passed:true}];await driveSequence(r,{execute});assert.equal(r.status,'SUCCESS');assert.equal(r.deliveryValidation.level,'DOCKER_VERIFIED');
});
test('provider errors pause and never retry automatically; explicit resume keeps the request budget',async()=>{
 const r=fixture('supervised');let calls=0;await driveSequence(r,{execute:async()=>{calls++;throw Error('429 quota')}});assert.equal(calls,1);assert.equal(r.sequence.status,'PAUSED');assert.match(r.sequence.error,/429/);
 await driveSequence(r,{execute});assert.equal(r.sequence.calls,3);assert.equal(r.approval.kind,'specification_review');
});
test('partial response pauses and cancellation prevents later model stages',async()=>{
 const r=fixture('semi');await driveSequence(r,{execute:async r=>{r.pendingDraft={text:'partial'}}});assert.equal(r.sequence.calls,1);assert.equal(r.sequence.status,'PAUSED');
 const c=fixture('semi');let calls=0;await driveSequence(c,{execute:async r=>{calls++;cancel(r)}});assert.equal(calls,1);assert.equal(c.status,'CANCELLED');assert.equal(c.sequence.status,'CANCELLED');
});
test('a nonadvancing executor and exhausted budget stop rather than looping or spending again',async()=>{
 const r=fixture('semi');await driveSequence(r,{execute:async()=>{}});assert.equal(r.sequence.calls,1);assert.match(r.sequence.error,/sem avanço/);
 r.sequence.calls=18;let calls=0;await driveSequence(r,{execute:async()=>{calls++}});assert.equal(calls,0);assert.match(r.sequence.error,/Limite/);
});
