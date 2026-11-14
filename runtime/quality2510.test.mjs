import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from './orchestrator.mjs';
import {executeStage} from './executor.mjs';
import {checkCobolSources} from './cobol-static.mjs';
const agents=['ORCHESTRATOR','REVIEWER','QA','DOCUMENTATION'].map(role=>({role,enabled:true,modelBinding:{providerId:'google',modelId:'test'}}));
const make=()=>{const r=createRun({id:'quality-test',prompt:'COBOL primalidade',agents});r.stage='review';r.artifacts=[{stage:'implementation',fileProposals:[{path:'isprime.cob',content:'01 WS-DIVISOR PIC 9.\nADD 2 TO WS-DIVISOR.'}]}];return r;};
test('review failure returns to developer with concrete feedback',async()=>{
 const r=make();await executeStage(r,{generate:async()=>({text:JSON.stringify({verdict:'fail',kind:'code',summary:'isprime.cob: nome incorreto',evidence:'WS-DIVISior não declarado'}),finishReason:'stop'})});assert.equal(r.stage,'implementation');assert.equal(r.corrections,1);
});
test('unstructured favorable prose cannot approve review',async()=>{
 const r=make();const deps={generate:async()=>({text:'Nenhum erro encontrado',finishReason:'stop'})};await executeStage(r,deps);assert.equal(r.artifacts.at(-1).integrity,'invalid_response');await assert.rejects(executeStage(r,deps),/REVIEW_INVALID_RESPONSE/);assert.equal(r.stage,'review');
});
test('canonical delivery spends zero model tokens and preserves source manifest',async()=>{
 const r=make();await executeStage(r,{generate:async()=>({text:JSON.stringify({verdict:'pass',kind:'code',summary:'Revisão estática',evidence:'Sem execução'}),finishReason:'stop'})});
 r.dockerValidation={status:'UNAVAILABLE'};
 await executeStage(r,{generate:async()=>({text:JSON.stringify({verdict:'pass',kind:'code',summary:'Revisão estática',evidence:'Sem execução'}),finishReason:'stop'})});
 r.status='RUNNING';r.stage='delivery';
 await executeStage(r,{generate:async()=>{throw Error('delivery must not call model');}});
 const a=r.artifacts.at(-1);assert.equal(r.status,'SUCCESS');assert.equal(a.usage.total_tokens,0);assert.equal(r.deliveryValidation.level,'STATIC_ONLY');assert.match(a.text,/isprime.cob/);assert.doesNotMatch(a.text,/```/);assert.match(a.text,/não comprovados/);assert.equal(a.sourceManifest[0].sha256,r.artifacts.find(x=>x.stage==='qa').sourceManifest[0].sha256);
});
test('delivery refuses source changed after QA',async()=>{
 const r=make();r.stage='delivery';r.qaAssessment={status:'PASS'};r.artifacts.push({stage:'qa',sourceFingerprint:'wrong'});await assert.rejects(executeStage(r),/DELIVERY_SOURCE_CHANGED/);
});
test('COBOL narrow checks catch the observed typo and misplaced DECLARE',()=>{
 assert.equal(checkCobolSources([{path:'a.cob',content:'01 WS-DIVISOR PIC 9.\nADD 2 TO WS-DIVISior.'}]).ok,false);
 assert.equal(checkCobolSources([{path:'a.cob',content:'DECLARE i PIC 9 COMP.'}]).ok,false);
 assert.equal(checkCobolSources([{path:'a.cob',content:'PERFORM RUN-SINGLE-TEST USING 7'}]).ok,false);
 assert.equal(checkCobolSources([{path:'a.cob',content:'01 WS-DIVISOR PIC 9.\n*> WS-UNKNOWN\nDISPLAY "WS-UNKNOWN"\nADD 2 TO ws-divisor.'}]).ok,true);
});
