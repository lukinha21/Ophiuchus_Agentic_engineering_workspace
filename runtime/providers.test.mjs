import test from 'node:test';import assert from 'node:assert/strict';
import {listProviders,listModels,generateText,generateGeminiMedia,listImageModels,generateProviderImage} from './providers.mjs';
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

test('Gemini media sends image bytes for analysis and returns provider image bytes for generation',async()=>{
 const png={mimeType:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXH8AAAAASUVORK5CYII='};
 const requests=[];
 const options={env:{GEMINI_API_KEY:'test'},fetchImpl:async(url,request)=>{
  const body=JSON.parse(request.body);requests.push({url,body});
  const parts=body.contents[0].parts[1]?[{text:'Uma imagem de teste.'}]:[{inlineData:png}];
  return {ok:true,json:async()=>({candidates:[{content:{parts}}]})};
 }};
 assert.deepEqual(await generateGeminiMedia({model:'vision-test',prompt:'Analise.',image:png},options),{text:'Uma imagem de teste.'});
 assert.deepEqual(requests[0].body.contents[0].parts[1],{inlineData:png});
 assert.deepEqual(await generateGeminiMedia({model:'image-test',prompt:'Uma imagem.'},options),{image:png});
 assert.deepEqual(requests[1].body.generationConfig.responseModalities,['IMAGE']);
 assert.match(requests[1].url,/image-test:generateContent$/);
 await assert.rejects(generateGeminiMedia({model:'vision-test',prompt:'Analise.',image:{...png,mimeType:'image/jpeg'}},options),/formato informado/);
 assert.equal(requests.length,2);
});

test('Gemini media rejects text-only image outputs and preserves a provider quota error',async()=>{
 const args={model:'image-test',prompt:'Uma árvore'};
 const env={GEMINI_API_KEY:'test'};
 await assert.rejects(generateGeminiMedia(args,{env,fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Só texto'}]}}]})})}),/não retornou uma imagem/);
 await assert.rejects(generateGeminiMedia(args,{env,fetchImpl:async()=>({ok:false,status:429,json:async()=>({})})}),/HTTP 429/);
});

test('image catalogs include image generators for Gemini, OpenAI, and the OpenRouter Images API',async()=>{
 const env={GEMINI_API_KEY:'test',OPENAI_API_KEY:'test',OPENROUTER_API_KEY:'test'};
 const fetchImpl=async url=>{
  if(url.includes('googleapis'))return Response.json({models:[
   {name:'models/gemini-3.1-flash-lite-image',supportedGenerationMethods:['generateContent']},
   {name:'models/gemini-3.1-flash-lite',supportedGenerationMethods:['generateContent']}
  ]});
  if(url.includes('openrouter')){assert.match(url,/\/images\/models$/);return Response.json({data:[{id:'google/gemini-image',name:'Image'}]});}
  return Response.json({data:[{id:'gpt-image-1'},{id:'gpt-5'}]});
 };
 for(const [provider,expected] of [['google','gemini-3.1-flash-lite-image'],['openai','gpt-image-1'],['openrouter','google/gemini-image']]){
  assert.deepEqual((await listImageModels(provider,{env,fetchImpl})).map(model=>model.id),[expected]);
 }
});

test('image generation uses the provider-specific API and decodes only validated image bytes',async()=>{
 const data='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXH8AAAAASUVORK5CYII=';
 const env={OPENAI_API_KEY:'test',OPENROUTER_API_KEY:'test'};
 for(const [providerId,model,path] of [['openai','gpt-image-1','/images/generations'],['openrouter','google/gemini-image','/images']]){
  const result=await generateProviderImage({providerId,model,prompt:'Uma árvore'},{env,fetchImpl:async(url,request)=>{
   assert.ok(url.endsWith(path));
   const body=JSON.parse(request.body);
   assert.equal(body.model,model);
   assert.equal(body.prompt,'Uma árvore');
   return Response.json({data:[{b64_json:data}]});
  }});
  assert.deepEqual(result.image,{mimeType:'image/png',data});
 }
 await assert.rejects(generateProviderImage({providerId:'openrouter',model:'https://example.com',prompt:'Teste'},{env}),/modelo de imagem válido/);
});
