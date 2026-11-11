import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTestFailure,languageDockerArgs} from './test-runner.mjs';
import {autopilotStep} from './autopilot.mjs';
import {createRun,startRun} from './orchestrator.mjs';
const agents=[{role:'ORCHESTRATOR',enabled:true}];
function run(){const r=startRun(createRun({id:'test255',prompt:'crie função em Go',agents}));r.stage='qa';r.autoPilot={qaVerified:false};return r;}
test('classifica erro fork/exec como infraestrutura',()=>assert.equal(classifyTestFailure({passed:false,output:'fork/exec /usr/local/go/pkg/tool/linux_amd64/asm: resource temporarily unavailable'}),'infrastructure'));
test('classifica assertion como falha real de código',()=>assert.equal(classifyTestFailure({passed:false,output:'--- FAIL: TestSortearNumero'}),'code'));
test('Go usa paralelismo reduzido',()=>{const args=languageDockerArgs('/tmp','go',['src/a_test.go']);assert.ok(args.join(' ').includes('GOMAXPROCS=1'));assert.ok(args.join(' ').includes('go test -p 1'));});
test('falha Docker 3 vezes, segue QA sem correções de código',async()=>{
 const r=run();let attempts=0;let executed=false;
 await autopilotStep(r,{runTests:true,maxDockerAttempts:3},{list:async()=>[{path:'src/sorteio_test.go'}],test:async()=>{attempts++;return {passed:false,tests:['src/sorteio_test.go'],output:'resource temporarily unavailable'};},execute:async()=>{executed=true;}});
 assert.equal(attempts,3);assert.equal(executed,true);assert.equal(r.corrections,0);assert.equal(r.dockerValidation.status,'UNAVAILABLE');assert.equal(r.testResults.length,3);assert.equal(r.autoPilot.qaVerified,false);
});
test('erro real de teste não autoriza fallback estático',async()=>{
 const r=run();let attempts=0;
 await autopilotStep(r,{runTests:true,maxDockerAttempts:3},{list:async()=>[{path:'src/sorteio_test.go'}],test:async()=>{attempts++;return {passed:false,tests:['src/sorteio_test.go'],output:'--- FAIL: TestSortearNumero'};}});
 assert.equal(attempts,1);assert.equal(r.stage,'implementation');assert.equal(r.corrections,1);
});
