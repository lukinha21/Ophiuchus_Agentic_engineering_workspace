import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,startRun,completeStage} from './orchestrator.mjs';
import {executeStage} from './executor.mjs';
import {normalizeOptions} from './optimization.mjs';
const agents=['orchestrator','architect','developer','reviewer','qa','documentation'].map(role=>({id:role,role:role.toUpperCase(),enabled:true,modelBinding:{providerId:'openai',modelId:'test'}}));
const make=(autonomy='supervised')=>{const r=startRun(createRun({id:'r',prompt:'Faça um algoritmo',agents}));r.executionOptions={...normalizeOptions(),autonomy};return r;};
test('truncamento não avança e continuação combina artefato',async()=>{
 const r=make();await executeStage(r,{generate:async()=>({text:'Primeira metade ',finishReason:'length',usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}})});
 assert.equal(r.stage,'discovery');assert.equal(r.artifacts.length,0);assert.equal(r.pendingDraft.text,'Primeira metade ');
 await executeStage(r,{generate:async()=>({text:'segunda metade.',finishReason:'stop',usage:{prompt_tokens:15,completion_tokens:5,total_tokens:20}})});
 assert.equal(r.stage,'specification');assert.equal(r.artifacts[0].text,'Primeira metade segunda metade.');assert.equal(r.artifacts[0].usage.total_tokens,50);assert.equal(r.pendingDraft,null);
});
test('continuações são limitadas',async()=>{const r=make();r.executionOptions.maxContinuations=0;await executeStage(r,{generate:async()=>({text:'incompleto',finishReason:'length'})});await assert.rejects(executeStage(r,{generate:async()=>{throw Error('não deveria chamar')}}),/Limite de continuações/)});
test('semiautônomo aprova especificação real completa e pausa na entrega',async()=>{const r=make('semi');await executeStage(r,{generate:async()=>({text:'requisitos',finishReason:'stop'})});await executeStage(r,{generate:async()=>({text:'contratos',finishReason:'stop'})});assert.equal(r.stage,'architecture');assert.equal(r.status,'RUNNING');assert.ok(r.events.some(e=>e.type==='approval.auto'))});
test('autonomia não aprova mock nem artefato de conclusão não verificada',async()=>{const r=make('autonomous');completeStage(r);completeStage(r);assert.equal(r.status,'WAITING_APPROVAL');assert.equal(r.approval.kind,'specification_review')});
test('opções inválidas usam política supervisionada',()=>{assert.equal(normalizeOptions({autonomy:'unsafe',maxContinuations:99}).autonomy,'supervised')});
