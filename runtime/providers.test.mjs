import test from 'node:test';import assert from 'node:assert/strict';
import {listProviders,listModels,generateText} from './providers.mjs';
test('catalog reports configuration without leaking keys',()=>{const result=listProviders({OPENAI_API_KEY:'supersecret'});assert.equal(result.find(p=>p.id==='openai').configured,true);assert.equal(JSON.stringify(result).includes('supersecret'),false);});
test('models are discovered using a mocked provider',async()=>{const models=await listModels('openai',{env:{OPENAI_API_KEY:'test'},fetchImpl:async(url,options)=>{assert.match(url,/\/models$/);assert.equal(options.headers.Authorization,'Bearer test');return {ok:true,json:async()=>({data:[{id:'model-b'},{id:'model-a'}]})};}});assert.deepEqual(models.map(m=>m.id),['model-a','model-b']);});
test('adapter returns usage and text',async()=>{const result=await generateText({providerId:'openai',model:'demo',messages:[{role:'user',content:'oi'}]},{env:{OPENAI_API_KEY:'test'},fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'Olá'}}],usage:{total_tokens:9}})})});assert.equal(result.text,'Olá');assert.equal(result.usage.total_tokens,9);});
test('no credential means no external request',async()=>{await assert.rejects(()=>listModels('openai',{env:{},fetchImpl:()=>{throw Error('Should not call');}}),/não configurado/);});

test('empty truncated responses retain finish reason and usage for bounded recovery',async()=>{
 const result=await generateText({providerId:'openai',model:'demo',allowEmptyTruncated:true,messages:[{role:'user',content:'oi'}]},{env:{OPENAI_API_KEY:'test'},fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:''},finish_reason:'length'}],usage:{total_tokens:4096}})})});
 assert.equal(result.text,'');assert.equal(result.finishReason,'length');assert.equal(result.usage.total_tokens,4096);
});

test('larger stage output is transmitted and remains hard bounded',async()=>{
 let body;const options={env:{GEMINI_API_KEY:'test'},fetchImpl:async(url,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'ok'}]},finishReason:'STOP'}]})}}};
 const args={providerId:'google',model:'gemini-test',messages:[{role:'user',content:'oi'}],maxOutputTokens:16384};await generateText(args,options);assert.equal(body.generationConfig.maxOutputTokens,16384);await assert.rejects(generateText({...args,maxOutputTokens:16385},options),/Limite/);
});
