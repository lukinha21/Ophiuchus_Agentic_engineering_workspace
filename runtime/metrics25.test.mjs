import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMetrics} from './metrics.mjs';
import {sourceSnapshot,buildMessages} from './executor.mjs';
import {compactHistory} from './optimization.mjs';
test('metrics use persisted real usage only, group model and run',()=>{
 const now=Date.parse('2026-11-11T12:00:00Z');const r={a:{id:'a',createdAt:'2026-11-11T10:00:00Z',status:'SUCCESS',artifacts:[{stage:'implementation',providerId:'google',model:'gemini',at:'2026-11-11T10:05:00Z',usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150}},{stage:'qa',providerId:'google',model:'gemini',at:'2026-11-11T10:06:00Z',usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}}],testResults:[{passed:true}]}};
 const m=summarizeMetrics(r,1,now);assert.equal(m.calls,2);assert.equal(m.input,120);assert.equal(m.output,60);assert.equal(m.models[0].stages.implementation,150);assert.equal(m.testsPassed,1);
});
test('source snapshot keeps exact proposals even in aggressive mode',async()=>{
 const code='public class Example {\n'+ 'int a=1;\n'.repeat(350)+'}';
 const run={id:'test-run',stage:'qa',artifacts:[{stage:'implementation',fileProposals:[{path:'src/Example.java',content:code}]}]};
 const snap=await sourceSnapshot(run);const messages=buildMessages({...run,prompt:'Java',testResults:[]},{mode:'aggressive',artifactChars:400,historyArtifacts:1},snap.context);
 assert.ok(messages[1].content.includes(code));assert.equal(snap.files[0].bytes,Buffer.byteLength(code));assert.equal(snap.files[0].sha256.length,64);
});
test('source over safe size blocks instead of silent truncation',async()=>{
 const run={id:'test-run',stage:'review',artifacts:[{stage:'implementation',fileProposals:[{path:'a.java',content:'a'.repeat(100000)},{path:'b.java',content:'b'.repeat(100000)}]}]};
 await assert.rejects(()=>sourceSnapshot(run),/PIPELINE_CONTEXT_LIMIT/);
});
