import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';
import {buildMessages,executeStage} from './executor.mjs';
import {validateProposalEnvelope} from './workspace.mjs';
import {stackContract} from './stack-contract.mjs';
import {compactHistory} from './optimization.mjs';
const agents=['ORCHESTRATOR','DEVELOPER'].map(role=>({role,enabled:true,modelBinding:{providerId:'google',modelId:'test'}}));
test('new parity run never inherits lottery requirements or draft',()=>{
 const old=createRun({id:'old',prompt:'COBOL sortear de 1 a 500',agents});old.artifacts.push({stage:'specification',text:'FUNCTION RANDOM sorteio 500'});old.pendingDraft={text:'old'};
 const fresh=createRun({id:'fresh',prompt:'COBOL função par ou ímpar',agents});
 for(const stage of ['discovery','specification','architecture','implementation','review','qa','delivery']){
  fresh.stage=stage;const context=buildMessages(fresh).map(x=>x.content).join('\n');
  assert.doesNotMatch(context,/500|FUNCTION RANDOM|sorteio|Lottery/);assert.match(context,/par ou ímpar/);
 }
 assert.deepEqual(fresh.artifacts,[]);assert.equal(fresh.pendingDraft,undefined);
});
test('changed language belongs to new run only',()=>{
 createRun({id:'old',prompt:'COBOL sorteio',agents});const fresh=createRun({id:'new',prompt:'Python par ou ímpar',agents});assert.equal(fresh.languageContract.language,'python');assert.doesNotMatch(buildMessages(fresh)[0].content,/sorteio|COBOL/);
});
test('malformed continuations, duplicate files and unclosed blocks rejected',()=>{
 for(const text of ['```cobol file:tests/test.cob\nCALL T-RESULT```cobol file:tests/test.cob\nSTOP RUN.\n```','```cobol file:a.cob\nx','```cobol file:a.cob\nx\n```\n```cobol file:a.cob\ny\n```'])assert.equal(validateProposalEnvelope(text).ok,false);
 assert.equal(validateProposalEnvelope('```cobol file:a.cob\nSTOP RUN.\n```').ok,true);
});
test('broken resumed implementation cannot advance or propose files',async()=>{
 const run=createRun({id:'new',prompt:'COBOL par ou ímpar',agents});run.stage='implementation';run.pendingDraft={stage:'implementation',text:'```cobol file:a.cob\nCALL T-RESULT',attempts:1};
 await executeStage(run,{generate:async()=>({text:'```cobol file:tests/test.cob\nSTOP RUN.\n```',finishReason:'stop'})});
 assert.equal(run.stage,'implementation');assert.deepEqual(run.artifacts.at(-1).fileProposals,[]);assert.equal(run.corrections,1);
});
test('review context excludes repeated source and superseded stage versions',()=>{
 const artifacts=[{stage:'specification',text:'OLD REQUIREMENT'},{stage:'specification',text:'CURRENT REQUIREMENT'},{stage:'architecture',text:'LONG ARCHITECTURE'},{stage:'review',text:'OLD REVIEW'}];
 const context=compactHistory(artifacts,{}, {stage:'review'});assert.match(context,/CURRENT/);assert.doesNotMatch(context,/OLD|LONG/);
});

test('language keyword does not disable a supported runner',()=>{assert.equal(stackContract('faça na linguagem COBOL uma função par ou ímpar').tests,'cobol');});
