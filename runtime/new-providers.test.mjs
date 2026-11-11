import test from 'node:test';
import assert from 'node:assert/strict';
import {generateText,listModels,listProviders} from './providers.mjs';
const env={GEMINI_API_KEY:'fake-gemini-key',ANTHROPIC_API_KEY:'fake-anthropic-key'};
test('Google Gemini uses native API, key header, usage and finish reason',async()=>{
 let req;const fetchImpl=async(url,options)=>{req={url,options};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Olá'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:9,candidatesTokenCount:3,totalTokenCount:12}})}};
 const result=await generateText({providerId:'google',model:'gemini-2.5-flash',messages:[{role:'system',content:'instrução'},{role:'user',content:'oi'}]},{env,fetchImpl});
 assert.match(req.url,/gemini-2.5-flash:generateContent$/);assert.equal(req.options.headers['x-goog-api-key'],'fake-gemini-key');assert.equal(result.text,'Olá');assert.equal(result.finishReason,'stop');assert.equal(result.usage.total_tokens,12);
});
test('Gemini model listing filters unsupported generation types',async()=>{
 const models=await listModels('google',{env,fetchImpl:async()=>({ok:true,json:async()=>({models:[{name:'models/gemini-test',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]})})});
 assert.deepEqual(models.map(x=>x.id),['gemini-test']);
});
test('Anthropic uses native messages API and normalizes usage',async()=>{
 let req;const fetchImpl=async(url,options)=>{req={url,options};return {ok:true,json:async()=>({content:[{type:'text',text:'Resposta'}],stop_reason:'max_tokens',usage:{input_tokens:5,output_tokens:7}})}};
 const result=await generateText({providerId:'anthropic',model:'claude-test',messages:[{role:'system',content:'sys'},{role:'user',content:'oi'}]},{env,fetchImpl});
 assert.match(req.url,/\/messages$/);assert.equal(req.options.headers['x-api-key'],'fake-anthropic-key');assert.equal(result.finishReason,'length');assert.equal(result.usage.total_tokens,12);
});
test('provider status never returns credential values',()=>{const result=JSON.stringify(listProviders(env));assert.doesNotMatch(result,/fake-gemini-key|fake-anthropic-key/);});
