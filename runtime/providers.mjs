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
 if(!Array.isArray(models))throw Error('Catálogo inválido');
 return models.filter(m=>typeof m.name==='string'||typeof m.id==='string').filter(m=>p.kind!=='gemini'||m.supportedGenerationMethods?.includes('generateContent')).map(m=>({id:p.kind==='gemini'?m.name.replace(/^models\//,''):m.id,providerId:id,label:m.displayName||m.name||m.id})).sort((a,b)=>a.id.localeCompare(b.id));
}
function normalizeMessages(messages){return messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content)}]}));}
export async function generateText({providerId,model,messages,maxOutputTokens=600},{env=process.env,fetchImpl=fetch,signal}={}){
 const p=resolveProvider(providerId,env);if(!p.configured)throw Error('Provedor não configurado no servidor');
 if(typeof model!=='string'||!model.trim()||!Array.isArray(messages)||!messages.length)throw Error('Modelo e mensagens obrigatórios');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>4096)throw Error('Limite de saída inválido');
 let url,body;
 if(p.kind==='gemini'){
  if(!/^[a-zA-Z0-9._-]{1,128}$/.test(model))throw Error('Modelo Gemini inválido');
  const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
  url=`${p.baseUrl}/models/${model}:generateContent`;
  body={contents:normalizeMessages(messages.filter(m=>m.role!=='system')),generationConfig:{maxOutputTokens}};
  if(system)body.systemInstruction={parts:[{text:system}]};
 }else if(p.kind==='anthropic'){
  url=p.baseUrl+'/messages';body={model,max_tokens:maxOutputTokens,messages:messages.filter(m=>m.role!=='system').map(m=>({role:m.role,content:m.content})),system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')};
 }else{url=p.baseUrl+'/chat/completions';body={model,messages,max_tokens:maxOutputTokens};}
 const googleToken=providerId==='google'?await googleAccessToken(env,fetchImpl):null;const requestHeaders=googleToken?{Authorization:`Bearer ${googleToken}`} : headers(p);
 const response=await fetchImpl(url,{method:'POST',headers:{...requestHeaders,'Content-Type':'application/json'},body:JSON.stringify(body),signal});await checkResponse(response,p.name);
 const json=await response.json();let text='',finishReason=null,usage=null;
 if(p.kind==='gemini'){
  const candidate=json.candidates?.[0];text=(candidate?.content?.parts||[]).filter(x=>typeof x.text==='string'&&!x.thought).map(x=>x.text).join('\n');
  finishReason=candidate?.finishReason==='MAX_TOKENS'?'length':candidate?.finishReason==='STOP'?'stop':candidate?.finishReason||null;
  const u=json.usageMetadata||{};usage={prompt_tokens:u.promptTokenCount||0,completion_tokens:u.candidatesTokenCount||0,total_tokens:u.totalTokenCount||0};
 }else if(p.kind==='anthropic'){
  text=(json.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');finishReason=json.stop_reason==='max_tokens'?'length':json.stop_reason==='end_turn'?'stop':json.stop_reason||null;
  usage={prompt_tokens:json.usage?.input_tokens||0,completion_tokens:json.usage?.output_tokens||0,total_tokens:(json.usage?.input_tokens||0)+(json.usage?.output_tokens||0)};
 }else{
  const choice=json.choices?.[0];const content=choice?.message?.content;
  text=typeof content==='string'?content:Array.isArray(content)?content.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n'):'';
  finishReason=choice?.finish_reason??null;usage=json.usage??null;
 }
 if(!text.trim())throw Error(`O modelo retornou texto vazio (finish_reason: ${finishReason||'não informado'}). Experimente outro modelo ou aumente o limite de saída.`);
 return {providerId,model,text,usage,finishReason};
}
