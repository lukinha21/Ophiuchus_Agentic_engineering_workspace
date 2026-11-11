import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutopilotPolicy,autopilotStep,driveAutopilot} from './autopilot.mjs';
import {createRun,startRun} from './orchestrator.mjs';
const agents=[{role:'ORCHESTRATOR',enabled:true}];
function run(){const r=startRun(createRun({id:'pilot21',prompt:'teste',agents}));r.autoPilot={qaVerified:false};return r;}
test('autorização separada de gravação e testes',()=>{
 assert.throws(()=>createAutopilotPolicy({confirm:true,applyFiles:true}),/Autorize/);
 assert.throws(()=>createAutopilotPolicy({confirm:true,applyFiles:true,runTests:true,maxCalls:100}),/Limites/);
 assert.equal(createAutopilotPolicy({confirm:true,applyFiles:true,runTests:true}).runTests,true);
});
test('QA bloqueia sem arquivo de teste',async()=>{
 const r=run();r.stage='qa';
 const result=await autopilotStep(r,{runTests:true},{list:async()=>[]});
 assert.match(result.stop,/Nenhum teste/);
});
test('QA com falha retorna ao desenvolvedor e registra relatório',async()=>{
 const r=run();r.stage='qa';
 await autopilotStep(r,{runTests:true},{list:async()=>[{path:'src/a.test.js'}],test:async()=>({passed:false,tests:['src/a.test.js'],output:'assertion failed'})});
 assert.equal(r.stage,'implementation');assert.equal(r.corrections,1);assert.equal(r.testResults.length,1);
});
test('QA aprovado exige Docker real antes de concluir',async()=>{
 const r=run();r.stage='qa';
 await autopilotStep(r,{runTests:true},{list:async()=>[{path:'src/a.test.js'}],test:async()=>({passed:true,tests:['src/a.test.js'],output:'ok'}),execute:async(run)=>{run.stage='qa';run.status='WAITING_APPROVAL';run.approval={kind:'merge_approval',resume:'delivery'};}});
 assert.equal(r.autoPilot.qaVerified,true);assert.equal(r.status,'WAITING_APPROVAL');
 const result=await autopilotStep(r,{autoApprovals:false});assert.match(result.stop,/aprovação humana/);
});
test('loop respeita limite de etapas',async()=>{
 const r=run();await driveAutopilot(r,{maxSteps:2,maxCalls:5,maxTokens:5000},{step:async()=>({}),persist:async()=>{}});
 assert.equal(r.autoPilot.steps,2);assert.equal(r.autoPilot.status,'PAUSED');
});
