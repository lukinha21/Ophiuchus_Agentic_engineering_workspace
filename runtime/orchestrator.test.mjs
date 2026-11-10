import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,startRun,completeStage,approve,reportFailure,cancel} from './orchestrator.mjs';
const agents=[{id:'orchestrator',role:'ORCHESTRATOR',enabled:true,modelBinding:{modelId:'model-a'}}];
function init(){return startRun(createRun({id:'test',prompt:'Build API',agents}));}
function advanceToQA(run){completeStage(run);completeStage(run);approve(run,true);completeStage(run);completeStage(run);completeStage(run);return run;}
test('snapshot is independent from mutable agent configuration',()=>{const run=init();agents[0].modelBinding.modelId='changed';assert.equal(run.configSnapshot[0].modelBinding.modelId,'model-a');agents[0].modelBinding.modelId='model-a';});
test('approval gates pause execution',()=>{const run=init();completeStage(run);completeStage(run);assert.equal(run.status,'WAITING_APPROVAL');assert.throws(()=>completeStage(run));approve(run,true);assert.equal(run.stage,'architecture');});
test('QA failure returns to developer then review and QA',()=>{const run=advanceToQA(init());assert.equal(run.stage,'qa');reportFailure(run,{kind:'code',summary:'JWT test fails'});assert.equal(run.stage,'implementation');completeStage(run);assert.equal(run.stage,'review');completeStage(run);assert.equal(run.stage,'qa');completeStage(run);assert.equal(run.approval.kind,'merge_approval');});
test('requirement failure reopens specification',()=>{const run=advanceToQA(init());reportFailure(run,{kind:'requirements'});assert.equal(run.stage,'specification');});
test('correction limit blocks and requests human intervention',()=>{const run=advanceToQA(init());for(let i=0;i<3;i++)reportFailure(run,{kind:'code'});assert.equal(run.status,'BLOCKED');assert.ok(run.events.some(e=>e.type==='run.blocked'));});
test('cancelled run cannot advance',()=>{const run=init();cancel(run);assert.throws(()=>completeStage(run));});
