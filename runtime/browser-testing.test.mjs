import test from 'node:test';
import assert from 'node:assert/strict';
import {browserTests,browserDockerArgs,BROWSER_IMAGE} from './browser-testing.mjs';
test('browser isolation mounts only snapshot readonly, denies network and avoids pulling during execution',()=>{
 const args=browserDockerArgs('/snapshot','index.html','fixture');
 for(const flag of ['--read-only','--cap-drop','--security-opt','--user','--init'])assert.ok(args.includes(flag));
 assert.equal(args[args.indexOf('--network')+1],'none');assert.equal(args[args.indexOf('--pull')+1],'never');
 assert.match(args.find(a=>a.startsWith('type=bind')),/dst=\/workspace,readonly$/);assert.ok(args.includes(BROWSER_IMAGE));
});
test('missing browser image reports not executed, never approved',async()=>{
 const calls=[];const result=await browserTests('/snapshot','index.html',{docker:async args=>{calls.push(args);return {passed:false,output:'Docker unavailable'}}});
 assert.equal(result.status,'NOT_RUN');assert.equal(result.passed,null);assert.equal(calls.length,1);
});
test('functional evidence and failed assertions survive parsing; exact container cleanup always runs',async()=>{
 for(const passed of [true,false]){const calls=[];const details={kind:'BROWSER_ASSERTIONS',passed,checks:[{name:'restart',passed}]};
 const result=await browserTests('/snapshot','index.html',{docker:async args=>{calls.push(args);return args[0]==='run'?{passed,exitCode:passed?0:1,output:'OPHIUCHUS_BROWSER_RESULT='+JSON.stringify(details)}:{passed:true,output:''}}});
 assert.equal(result.passed,passed);assert.equal(result.status,passed?'PASSED':'FAILED');assert.deepEqual(result.details,details);
 assert.equal(calls.at(-1)[0],'rm');assert.equal(calls.at(-1)[2],calls[1][calls[1].indexOf('--name')+1]);
 }
});
test('successful Docker exit without browser evidence cannot pass',async()=>{
 const result=await browserTests('/snapshot','index.html',{docker:async()=>({passed:true,output:''})});assert.equal(result.status,'NOT_RUN');assert.equal(result.passed,null);
});
