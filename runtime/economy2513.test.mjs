import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';
import {executeStage} from './executor.mjs';
import {summarizeMetrics} from './metrics.mjs';
const agents=['ORCHESTRATOR','REVIEWER','QA','DOCUMENTATION'].map(role=>({role,enabled:true,modelBinding:{providerId:'google',modelId:'test'}}));
async function reviewed(){const r=createRun({id:'economy-run',prompt:'JavaScript função',agents});r.stage='review';r.artifacts=[{id:'impl',stage:'implementation',fileProposals:[{path:'fn.mjs',content:'export const f=()=>1;'}]}];await executeStage(r,{generate:async()=>({text:JSON.stringify({verdict:'pass',kind:'code',summary:'Revisão',evidence:'Somente estática'}),finishReason:'stop',usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})});return r;}
test('unavailable Docker reuses exact review without paid QA and preserves static label',async()=>{
 const r=await reviewed();r.dockerValidation={status:'UNAVAILABLE'};
 await executeStage(r,{generate:async()=>{throw Error('no model QA');}});
 assert.equal(r.stage,'qa');assert.equal(r.status,'WAITING_APPROVAL');assert.equal(r.qaAssessment.validationLevel,'STATIC_ONLY');assert.equal(r.artifacts.at(-1).usage.total_tokens,0);assert.match(r.qaAssessment.summary,/nenhuma segunda revisão/);
 r.status='RUNNING';r.stage='delivery';await executeStage(r,{generate:async()=>{throw Error('no model delivery');}});assert.equal(r.status,'SUCCESS');assert.equal(r.deliveryValidation.level,'STATIC_ONLY');
});
test('source changed since review requires a fresh paid assessment',async()=>{
 const r=await reviewed();r.dockerValidation={status:'UNAVAILABLE'};r.artifacts[0].fileProposals[0].content='changed';let called=0;
 await executeStage(r,{generate:async()=>{called++;return {text:JSON.stringify({verdict:'fail',kind:'code',summary:'Mudou',evidence:'Nova revisão necessária'}),finishReason:'stop'};}});
 assert.equal(called,1);assert.equal(r.stage,'implementation');
});
test('real Docker failure cannot be hidden by prior review',async()=>{
 const r=await reviewed();r.dockerValidation={status:'CODE_FAILED'};r.testResults=[{passed:false}];await assert.rejects(executeStage(r,{generate:async()=>({text:'{}'})}),/PIPELINE_TEST_FAILURE/);
});
test('dashboard excludes local consolidation and cached artifacts from model call counts',()=>{
 const m=summarizeMetrics({r:{createdAt:new Date().toISOString(),artifacts:[{providerId:'google',model:'m',usage:{prompt_tokens:10,completion_tokens:5}},{providerId:'local',usage:{total_tokens:0}},{providerId:'google',reusedFrom:'a'}]}});assert.equal(m.calls,1);assert.equal(m.input,10);assert.equal(m.output,5);
});
