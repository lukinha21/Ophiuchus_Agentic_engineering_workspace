import {rememberCapabilities,requestMode,portableSchema} from './model-capabilities.mjs';
import {googleAccessToken} from './google-oauth.mjs';
/** Provider adapters; secrets remain in the backend. */
import {getCredential,getCustomEndpoint} from './vault.mjs';
export const PROVIDERS=Object.freeze([
 {id:'mock',name:'Mock offline',baseUrl:null,env:null,kind:'local'},
 {id:'openai',name:'OpenAI',baseUrl:'https://api.openai.com/v1',env:'OPENAI_API_KEY',kind:'openai-compatible'},
 {id:'openrouter',name:'OpenRouter',baseUrl:'https://openrouter.ai/api/v1',env:'OPENROUTER_API_KEY',kind:'openai-compatible'},
 {id:'google',name:'Google Gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta',env:'GEMINI_API_KEY',kind:'gemini'},
 {id:'anthropic',name:'Anthropic Claude',baseUrl:'https://api.anthropic.com/v1',env:'ANTHROPIC_API_KEY',kind:'anthropic'},
 {id:'custom',name:'OpenAI-compatible personalizado',baseUrl:null,env:'OPHIUCHUS_CUSTOM_API_KEY',kind:'openai-compatible'}
]);
const allowedHosts=new Set(['api.openai.com','openrouter.ai','generativelanguage.googleapis.com','api.anthropic.com']);
export function resolveProvider(id,env=process.env){
 const p=PROVIDERS.find(p=>p.id===id);if(!p)throw Error('Provedor desconhecido');
 if(id==='mock')return {...p,configured:true,baseUrl:null,key:null};
 const baseUrl=id==='custom'?(getCustomEndpoint()||env.OPHIUCHUS_CUSTOM_BASE_URL):p.baseUrl;
 const key=getCredential(id)||env[p.env]||null;
 if(!baseUrl)return {...p,configured:false,baseUrl:null,key:null};
 const url=new URL(baseUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(id!=='custom'&&!allowedHosts.has(url.hostname)))throw Error('Endpoint HTTPS inválido');
 return {...p,baseUrl:url.toString().replace(/\/$/,''),configured:Boolean(key),key};
}
export function listProviders(env=process.env){return PROVIDERS.map(p=>{const r=resolveProvider(p.id,env);return {id:r.id,name:r.name,kind:r.kind,configured:r.configured,baseUrl:r.baseUrl,source:getCredential(p.id)?'vault':r.configured?'environment':null};});}
function errMessage(json){return String(json?.error?.message||json?.message||'').slice(0,240);}
async function checkResponse(response,name){if(response.ok)return;let detail='';try{detail=errMessage(await response.json());}catch{}if(response.status===429){let wait=response.headers?.get?.('retry-after');throw Error(`Limite de requisições do ${name} (HTTP 429).${wait?' Aguarde '+wait+' segundos.':''}${detail?' '+detail:''} Não repita chamadas imediatamente.`);}throw Error(`Falha no ${name} (HTTP ${response.status})${detail?': '+detail:''}`);}
const headers=(p)=>p.kind==='gemini'?{'x-goog-api-key':p.key}:p.kind==='anthropic'?{'x-api-key':p.key,'anthropic-version':'2023-06-01'}:{Authorization:`Bearer ${p.key}`};
export async function listModels(id,{env=process.env,fetchImpl=fetch,signal}={}){
 const p=resolveProvider(id,env);if(id==='mock')return [{id:'mock/offline',providerId:'mock',label:'Mock offline — sem custo'}];if(!p.configured)throw Error('Provedor não configurado no servidor');
 const path=p.kind==='anthropic'?'/models?limit=100':p.kind==='gemini'?'/models?pageSize=1000':'/models';
 const googleToken=id==='google'?await googleAccessToken(env,fetchImpl):null;const requestHeaders=googleToken?{Authorization:`Bearer ${googleToken}`} : headers(p);
 const response=await fetchImpl(p.baseUrl+path,{headers:requestHeaders,signal});await checkResponse(response,p.name);
 const json=await response.json();const models=p.kind==='gemini'?json.models:json.data;
 if(!Array.isArray(models))throw Error('Catálogo inválido');rememberCapabilities(id,models);
 return models.filter(m=>typeof m.name==='string'||typeof m.id==='string').filter(m=>p.kind!=='gemini'||m.supportedGenerationMethods?.includes('generateContent')).map(m=>({id:p.kind==='gemini'?m.name.replace(/^models\//,''):m.id,providerId:id,label:m.displayName||m.name||m.id})).sort((a,b)=>a.id.localeCompare(b.id));
}
const imageMimeTypes=new Set(['image/png','image/jpeg','image/webp']);
export const maxImageInputBytes=4*1024*1024;
const maxImageOutputBytes=12*1024*1024;

function validatedImage(part,limit){
 if(!imageMimeTypes.has(part?.mimeType)||typeof part.data!=='string'||part.data.length>Math.ceil(limit/3)*4||
   !/^[0-9A-Za-z+/]+={0,2}$/.test(part.data))throw Error('Imagem inválida ou acima do limite. Use PNG, JPEG ou WebP.');
 const bytes=Buffer.from(part.data,'base64');
 const valid=bytes.length<=limit&&bytes.toString('base64')===part.data&&(
  part.mimeType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
  part.mimeType==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
  bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
 if(!valid)throw Error('O conteúdo da imagem não corresponde ao formato informado.');
 return {mimeType:part.mimeType,data:part.data};
}

export async function generateGeminiMedia({model,prompt,image},{env=process.env,fetchImpl=fetch,signal}={}){
 if(typeof model!=='string'||!/^[a-zA-Z0-9._-]{1,128}$/.test(model))throw Error('Informe um modelo Gemini válido.');
 const provider=resolveProvider('google',env);
 if(!provider.configured)throw Error('Configure o Google Gemini e desbloqueie o cofre em Provedores.');
 const parts=[{text:prompt}];
 if(image!==undefined)parts.push({inlineData:validatedImage(image,maxImageInputBytes)});
 const body={contents:[{role:'user',parts}],generationConfig:image===undefined?{responseModalities:['IMAGE']}:{maxOutputTokens:4096}};
 const token=await googleAccessToken(env,fetchImpl);
 const authorization=token?{Authorization:'Bearer '+token}:headers(provider);
 const response=await fetchImpl(provider.baseUrl+'/models/'+model+':generateContent',{
  method:'POST',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify(body),signal
 });
 await checkResponse(response,provider.name);
 const payload=await response.json();
 const candidate=payload.candidates?.[0];
 const visible=Array.isArray(candidate?.content?.parts)?candidate.content.parts.filter(part=>part&&!part.thought):[];
 const text=visible.map(part=>typeof part.text==='string'?part.text:'').join('\n').trim();
 if(image!==undefined){
  if(!text)throw Error('O modelo não retornou uma análise. Verifique se ele aceita imagens.');
  return {text};
 }
 const generated=visible.find(part=>part.inlineData);
 if(!generated)throw Error('O modelo não retornou uma imagem. Verifique o modelo de geração e o pedido.');
 return {image:validatedImage(generated.inlineData,maxImageOutputBytes)};
}

export const imageGenerationProviders=new Set(['google','openai','openrouter']);
export function validImageModel(providerId,model){
 return imageGenerationProviders.has(providerId)&&typeof model==='string'&&model.length<=128&&
  (providerId==='openrouter'?/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:-]+$/:/^[a-zA-Z0-9._-]+$/).test(model);
}

export async function listImageModels(providerId,options={}){
 if(!imageGenerationProviders.has(providerId))throw Error('Provedor sem integração de geração de imagens.');
 if(providerId!=='openrouter'){
  const models=await listModels(providerId,options);
  return models.filter(model=>providerId==='google'?/image|nano-banana/i.test(model.id):/^gpt-image(?:-|$)/i.test(model.id));
 }
 const {env=process.env,fetchImpl=fetch,signal}=options;
 const provider=resolveProvider(providerId,env);
 if(!provider.configured)throw Error('Configure o OpenRouter em Provedores.');
 const response=await fetchImpl(provider.baseUrl+'/images/models',{headers:headers(provider),signal});
 await checkResponse(response,provider.name);
 const payload=await response.json();
 if(!Array.isArray(payload.data))throw Error('Catálogo de imagens inválido.');
 return payload.data.filter(model=>validImageModel(providerId,model.id)).map(model=>({id:model.id,providerId,label:model.name||model.id}));
}

export async function generateProviderImage({providerId,model,prompt},options={}){
 if(!validImageModel(providerId,model))throw Error('Informe um modelo de imagem válido para o provedor selecionado.');
 if(providerId==='google')return generateGeminiMedia({model,prompt},options);
 const {env=process.env,fetchImpl=fetch,signal}=options;
 const provider=resolveProvider(providerId,env);
 if(!provider.configured)throw Error('Configure '+provider.name+' em Provedores e desbloqueie o cofre.');
 if(providerId==='openai'&&!/^gpt-image(?:-|$)/i.test(model))throw Error('Selecione um modelo GPT Image no catálogo da OpenAI.');
 const response=await fetchImpl(provider.baseUrl+(providerId==='openai'?'/images/generations':'/images'),{
  method:'POST',headers:{...headers(provider),'Content-Type':'application/json'},
  body:JSON.stringify({model,prompt,...(providerId==='openai'?{output_format:'png',n:1}:{})}),signal,
 });
 await checkResponse(response,provider.name);
 const output=(await response.json()).data?.[0];
 const data=output?.b64_json;
 if(typeof data!=='string'||!data)throw Error('O provedor não retornou os bytes de uma imagem.');
 const mimeType=output.media_type||(data.startsWith('/9j/')?'image/jpeg':data.startsWith('UklG')?'image/webp':'image/png');
 return {image:validatedImage({data,mimeType},maxImageOutputBytes)};
}

function normalizeMessages(messages){return messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content)}]}));}
export async function generateText({providerId,model,messages,maxOutputTokens=600,allowEmptyTruncated=false,responseContract,policy={}},{env=process.env,fetchImpl=fetch,signal}={}){
 const p=resolveProvider(providerId,env);if(!p.configured)throw Error('Provedor não configurado no servidor');
 if(typeof model!=='string'||!model.trim()||!Array.isArray(messages)||!messages.length)throw Error('Modelo e mensagens obrigatórios');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>16384)throw Error('Limite de saída inválido');
 const execution=requestMode(providerId,model,responseContract,policy);if(execution.outputLimit)maxOutputTokens=Math.min(maxOutputTokens,execution.outputLimit);
 const schema=responseContract?portableSchema(responseContract.schema):null;
 let url,body;
 if(p.kind==='gemini'){
  if(!/^[a-zA-Z0-9._-]{1,128}$/.test(model))throw Error('Modelo Gemini inválido');
  const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  url=`${p.baseUrl}/models/${model}:generateContent`;
  body={contents:normalizeMessages(messages.filter(m=>m.role!=='system')),generationConfig:{maxOutputTokens}};
  if(system)body.systemInstruction={parts:[{text:system}]};
  if(schema&&execution.formatMode==='gemini'){body.generationConfig.responseMimeType='application/json';body.generationConfig.responseJsonSchema=schema;}
 }else if(p.kind==='anthropic'){
  url=p.baseUrl+'/messages';body={model,max_tokens:maxOutputTokens,messages:messages.filter(m=>m.role!=='system').map(m=>({role:m.role,content:m.content})),system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')};
  if(schema&&execution.formatMode==='anthropic')body.output_config={format:{type:'json_schema',schema}};
  if(execution.cacheMode==='explicit-opt-in'){const source=body.messages.find(m=>m.role==='user'&&m.content.length>=8192);if(source)source.content=[{type:'text',text:source.content,cache_control:{type:'ephemeral'}}];else execution.cacheMode='not-requested-short-prefix';}
 }else{url=p.baseUrl+'/chat/completions';body={model,messages,[execution.outputParameter]:maxOutputTokens};if(schema&&execution.formatMode==='openai')body.response_format={type:'json_schema',json_schema:{name:responseContract.name,strict:true,schema}};}
 const googleToken=providerId==='google'?await googleAccessToken(env,fetchImpl):null;const requestHeaders=googleToken?{Authorization:`Bearer ${googleToken}`} : headers(p);
 const response=await fetchImpl(url,{method:'POST',headers:{...requestHeaders,'Content-Type':'application/json'},body:JSON.stringify(body),signal});await checkResponse(response,p.name);
 const json=await response.json();let text='',finishReason=null,usage=null;
 if(p.kind==='gemini'){
  const candidate=json.candidates?.[0];text=(candidate?.content?.parts||[]).filter(x=>typeof x.text==='string'&&!x.thought).map(x=>x.text).join('\n');
  finishReason=candidate?.finishReason==='MAX_TOKENS'?'length':candidate?.finishReason==='STOP'?'stop':candidate?.finishReason||null;
  const u=json.usageMetadata||{};usage={prompt_tokens:u.promptTokenCount||0,completion_tokens:u.candidatesTokenCount||0,total_tokens:u.totalTokenCount||0,thinking_tokens:u.thoughtsTokenCount||0,cached_input_tokens:u.cachedContentTokenCount||0};
 }else if(p.kind==='anthropic'){
  text=(json.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');finishReason=json.stop_reason==='max_tokens'?'length':json.stop_reason==='end_turn'?'stop':json.stop_reason||null;
  const u=json.usage||{},cached=u.cache_read_input_tokens||0,written=u.cache_creation_input_tokens||0;usage={prompt_tokens:(u.input_tokens||0)+cached+written,completion_tokens:u.output_tokens||0,total_tokens:(u.input_tokens||0)+cached+written+(u.output_tokens||0),cached_input_tokens:cached,cache_write_tokens:written};
 }else{
  const choice=json.choices?.[0];const content=choice?.message?.content;
  text=typeof content==='string'?content:Array.isArray(content)?content.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n'):'';
  finishReason=choice?.finish_reason??null;usage=json.usage?{...json.usage,cached_input_tokens:json.usage.prompt_tokens_details?.cached_tokens??0,thinking_tokens:json.usage.completion_tokens_details?.reasoning_tokens??0}:null;
 }
 if(!text.trim()&&!(allowEmptyTruncated&&finishReason==='length'))throw Error(`O modelo retornou texto vazio (finish_reason: ${finishReason||'não informado'}). Experimente outro modelo ou aumente o limite de saída.`);
 return {providerId,model,text,usage,finishReason,execution};
}
