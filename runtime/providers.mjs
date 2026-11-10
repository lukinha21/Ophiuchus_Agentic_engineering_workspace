/** Provider catalog and guarded OpenAI-compatible adapter. Credentials never leave server responses. */
export const PROVIDERS = Object.freeze([
 {id:'mock',name:'Mock offline (sem API)',baseUrl:null,env:null,kind:'local'},
 {id:'openai',name:'OpenAI',baseUrl:'https://api.openai.com/v1',env:'OPENAI_API_KEY',kind:'openai-compatible'},
 {id:'openrouter',name:'OpenRouter',baseUrl:'https://openrouter.ai/api/v1',env:'OPENROUTER_API_KEY',kind:'openai-compatible'},
 {id:'custom',name:'Custom OpenAI-compatible',baseUrl:null,env:'OPHIUCHUS_CUSTOM_API_KEY',kind:'openai-compatible'}
]);
const allowedHosts = new Set(['api.openai.com','openrouter.ai']);
export function resolveProvider(id,env=process.env){
 const provider=PROVIDERS.find(p=>p.id===id);if(!provider)throw Error('Provedor desconhecido');
 if(id==='mock')return {...provider,configured:true,baseUrl:null};
 const baseUrl=id==='custom'?env.OPHIUCHUS_CUSTOM_BASE_URL:provider.baseUrl;
 if(!baseUrl)return {...provider,configured:false,baseUrl:null};
 const url=new URL(baseUrl);
 if(url.protocol!=='https:' || (id!=='custom' && !allowedHosts.has(url.hostname)))throw Error('Endpoint HTTPS inválido');
 return {...provider,baseUrl:url.toString().replace(/\/$/,''),configured:Boolean(env[provider.env])};
}
export function listProviders(env=process.env){return PROVIDERS.map(p=>{const r=resolveProvider(p.id,env);return {id:r.id,name:r.name,kind:r.kind,configured:r.configured,baseUrl:r.baseUrl};});}
export async function listModels(id,{env=process.env,fetchImpl=fetch,signal}={}){
 const p=resolveProvider(id,env);if(id==='mock')return [{id:'mock/offline',providerId:'mock',label:'Mock offline — sem custo'}];if(!p.configured)throw Error('Provedor não configurado no servidor');
 const response=await fetchImpl(`${p.baseUrl}/models`,{headers:{Authorization:`Bearer ${env[p.env]}`},signal});
 if(!response.ok)throw Error(`Falha ao consultar catálogo do provedor (HTTP ${response.status})`);
 const json=await response.json();if(!Array.isArray(json.data))throw Error('Catálogo inválido');
 return json.data.filter(m=>typeof m.id==='string').map(m=>({id:m.id,providerId:id,label:m.name||m.id})).sort((a,b)=>a.id.localeCompare(b.id));
}
export async function generateText({providerId,model,messages,maxOutputTokens=600},{env=process.env,fetchImpl=fetch,signal}={}){
 const p=resolveProvider(providerId,env);if(!p.configured)throw Error('Provedor não configurado no servidor');
 if(!model||!Array.isArray(messages)||messages.length===0)throw Error('Modelo e mensagens obrigatórios');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>4096)throw Error('Limite de saída inválido');
 const response=await fetchImpl(`${p.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${env[p.env]}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages,max_tokens:maxOutputTokens}),signal});
 if(!response.ok){
  const retryHeader=response.headers?.get?.('retry-after');
  const rateReset=response.headers?.get?.('x-ratelimit-reset');
  let detail='';try{const err=await response.json();detail=String(err?.error?.message||err?.message||'').slice(0,240);}catch{}
  if(response.status===429){
   let seconds=Number(retryHeader);if(retryHeader&&!Number.isFinite(seconds)){const date=Date.parse(retryHeader);seconds=Number.isFinite(date)?Math.ceil((date-Date.now())/1000):NaN;}
   const wait=Number.isFinite(seconds)&&seconds>0?` Aguarde ${Math.ceil(seconds)} segundos antes de tentar novamente.`:'';
   throw Error(`Limite de requisições do ${p.name} (HTTP 429).${wait}${detail?' '+detail:''}${rateReset?' Reinício informado: '+rateReset:''} Não repita chamadas imediatamente.`);
  }
  throw Error(`Falha na geração (HTTP ${response.status})${detail?': '+detail:''}`);
 }
 const json=await response.json();const choice=json.choices?.[0];
 const content=choice?.message?.content;
 const text=typeof content==='string'?content:Array.isArray(content)?content.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n'):'';
 if(!text.trim())throw Error(`O modelo retornou texto vazio (finish_reason: ${choice?.finish_reason||'não informado'}). Experimente outro modelo ou aumente o limite de saída.`);
 return {providerId,model,text,usage:json.usage??null,finishReason:choice?.finish_reason??null};
}
