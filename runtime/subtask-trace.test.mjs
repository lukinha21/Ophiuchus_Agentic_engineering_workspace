import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,startRun,completeStage,reportFailure,approve} from './orchestrator.mjs';
const agents=[{role:'ORCHESTRATOR',enabled:true}];
const make=()=>startRun(createRun({id:'trace-test',prompt:'criar função',agents}));
test('stage artifact creates persisted documentary links, not invented tool events',()=>{
 const run=make();
 completeStage(run,{artifact:{id:'artifact-1',text:'Requisitos documentados',providerId:'mock'}});
 assert.deepEqual(Object.keys(run.subtasks),['sub-001','sub-002','sub-003']);
 assert.equal(run.events.filter(e=>e.type==='subtask.evidence.linked').length,3);
 assert.equal(run.events.filter(e=>e.type==='tool.activity').length,0);
 assert.equal(run.subtasks['sub-001'].verification,'NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(run.subtasks['sub-001'].artifactId,'artifact-1');
});
test('manual completion without artifact does not claim subtask evidence',()=>{
 const run=make();completeStage(run);assert.deepEqual(run.subtasks,{});
});
test('correction invalidates affected stage evidence and emits audit event',()=>{
 const run=make();completeStage(run,{artifact:{id:'a1',text:'descoberta'}});
 completeStage(run,{artifact:{id:'a2',text:'spec'}});
 approve(run,true);
 completeStage(run,{artifact:{id:'a3',text:'arquitetura'}});
 assert.ok(run.subtasks['sub-007']);
 reportFailure(run,{kind:'architecture',summary:'Revisar arquitetura'});
 assert.equal(run.subtasks['sub-007'],undefined);
 assert.ok(run.events.some(e=>e.type==='subtask.evidence.invalidated'&&e.subtaskId==='sub-007'));
 assert.ok(run.subtasks['sub-004']);
});
