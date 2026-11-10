import test from 'node:test';import assert from 'node:assert/strict';
import {compactHistory,normalizeOptions,estimateTokens} from './optimization.mjs';
test('defaults safe and bounds',()=>{assert.equal(normalizeOptions({maxOutputTokens:999999}).maxOutputTokens,1400);assert.equal(normalizeOptions({mode:'aggressive'}).mode,'aggressive');});
test('compaction reduces long old artifacts while keeping latest',()=>{const a=[{stage:'discovery',text:'# Requisitos\n'+'X'.repeat(5000)},{stage:'specification',text:'LAST DETAIL '+ 'Y'.repeat(500)}];const off=compactHistory(a,{mode:'off'});const compact=compactHistory(a,{mode:'aggressive'});assert.ok(compact.length<off.length);assert.ok(compact.includes('LAST DETAIL'));});
test('token estimate explicitly approximate',()=>assert.equal(estimateTokens('12345678'),2));
import {createRun,startRun} from './orchestrator.mjs';
import {executeStage} from './executor.mjs';
test('mock execution works without external API',async()=>{const agents=[{id:'orchestrator',role:'ORCHESTRATOR',enabled:true,modelBinding:{providerId:'mock',modelId:'mock/offline'}}];const run=startRun(createRun({id:'mock-run',prompt:'Teste offline',agents}));await executeStage(run);assert.equal(run.artifacts.length,1);assert.equal(run.artifacts[0].usage.total_tokens,0);assert.equal(run.stage,'specification');});
