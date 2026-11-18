import test from 'node:test';
import assert from 'node:assert/strict';
import {refineImagePrompt} from './image-refinement.mjs';

test('image refinement preserves the exact original and gives it precedence in the generator prompt',async()=>{
 const original='Um gato galáctico no fundo preto, sem planetas. Texto exato: “LUMEN”.';
 const signal=new AbortController().signal;
 let calls=0;
 const prompt=await refineImagePrompt(original,{providerId:'google',modelId:'fixture'},{signal,generate:async(args,options)=>{
  calls++;
  assert.equal(options.signal,signal);
  assert.equal(args.messages[1].content,original);
  assert.match(args.messages[0].content,/Deixe em aberto as escolhas/);
  assert.match(args.messages[0].content,/cenário, objetos, pose, enquadramento/);
  return {text:'Destaque o gato e integre o efeito galáctico ao pelo.',finishReason:'stop'};
 }});
 assert.equal(calls,1);
 assert.ok(prompt.includes(original));
 assert.match(prompt,/somente se compatível/);
 assert.match(prompt,/Se houver conflito, siga o original/);
});

test('empty, oversized and truncated refinements are rejected before image generation',async()=>{
 for(const result of [{text:''},{text:'x'.repeat(701)},{text:'Incompleto',finishReason:'length'}]){
  await assert.rejects(refineImagePrompt('Um gato',{providerId:'google',modelId:'fixture'},{generate:async()=>result}),/refinamento curto e completo/);
 }
});
