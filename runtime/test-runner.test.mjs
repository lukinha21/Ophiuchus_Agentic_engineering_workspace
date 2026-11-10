import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {applyProposals} from './workspace.mjs';
import {testFiles,dockerArgs,runWorkspaceTests} from './test-runner.mjs';
test('only explicit JS test files are selected',()=>{
 assert.deepEqual(testFiles([{path:'src/a.js'},{path:'tests/a.test.js'},{path:'tests/b.spec.mjs'}]),['tests/a.test.js','tests/b.spec.mjs']);
});
test('docker execution denies network, mounts read-only and restricts privileges',()=>{
 const args=dockerArgs('/tmp/project',['a.test.js']);
 for(const flag of ['none','--read-only','ALL','no-new-privileges','--memory','--cpus','--pids-limit','readonly'])assert.ok(args.join(' ').includes(flag));
 assert.equal(args.at(-2),'--test');
});
test('no test files means no execution',async()=>{
 const base=await mkdtemp(join(tmpdir(),'ophi-runner-'));try{await applyProposals('12345678-abcd',[{path:'src/index.js',content:'x'}],base);await assert.rejects(runWorkspaceTests('12345678-abcd',{base}),/Nenhum arquivo de teste/);}finally{await rm(base,{recursive:true,force:true});}
});
test('mocked docker process produces auditable result',async()=>{
 const base=await mkdtemp(join(tmpdir(),'ophi-runner-'));try{
  await applyProposals('12345678-abcd',[{path:'src/a.test.js',content:'test()'}],base);
  const result=await runWorkspaceTests('12345678-abcd',{base,spawnImpl:(_cmd,args)=>{
   assert.ok(args.includes('--network'));const proc=new EventEmitter();proc.stdout=new EventEmitter();proc.stderr=new EventEmitter();proc.kill=()=>{};
   queueMicrotask(()=>{proc.stdout.emit('data',Buffer.from('ok 1'));proc.emit('close',0,null);});return proc;
  }});
  assert.equal(result.passed,true);assert.match(result.output,/ok 1/);
 }finally{await rm(base,{recursive:true,force:true});}
});
