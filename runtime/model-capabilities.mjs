const catalog=new Map();
export function rememberCapabilities(provider,models){for(const m of models){const id=provider==='google'?m.name?.replace(/^models\//,''):m.id;if(typeof id==='string')catalog.set(provider+':'+id,{outputLimit:Number.isInteger(m.outputTokenLimit)?m.outputTokenLimit:null,inputLimit:Number.isInteger(m.inputTokenLimit)?m.inputTokenLimit:null,parameters:Array.isArray(m.supported_parameters)?m.supported_parameters:[]});}}
export function capabilities(provider,model){
 const known=catalog.get(provider+':'+model)||{};
 const native=provider==='google'&&/^gemini-(?:2\.5|3(?:\.|-))/.test(model)?'gemini':provider==='openai'&&/^(?:gpt-4o-mini(?:-|$)|gpt-4o-2024-(?:08|11)|gpt-4\.1(?:-|$)|gpt-[56](?:\.|-|$))/.test(model)?'openai':provider==='anthropic'&&/^claude-(?:sonnet|opus|haiku)-(?:4-[5-9]|[5-9])/.test(model)?'anthropic':provider==='openrouter'&&known.parameters?.includes('structured_outputs')?'openai':null;
 return {structuredOutput:native||'prompt',cache:provider==='google'||provider==='openai'?'provider-managed':provider==='anthropic'?'explicit-opt-in':'unknown',outputLimit:known.outputLimit||null,inputLimit:known.inputLimit||null,source:catalog.has(provider+':'+model)?'catalog-and-adapter':'conservative-adapter',outputParameter:provider==='openai'&&/^(?:gpt-[56]|o[134])/.test(model)?'max_completion_tokens':'max_tokens'};
}
export function normalizePolicy(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Política de execução inválida');
 if(Object.keys(value).some(key=>!['format','cache','history','agents'].includes(key)))throw Error('Campo desconhecido na política de execução');
 const policy={format:value.format??'auto',cache:value.cache??'provider',history:value.history??'dedupe'};
 if(!['auto','prompt'].includes(policy.format)||!['provider','explicit'].includes(policy.cache)||!['dedupe','full'].includes(policy.history))throw Error('Política de execução inválida');
 const agents={};for(const [role,override] of Object.entries(value.agents||{})){if(!['orchestrator','architect','developer','reviewer','qa','documentation'].includes(role))throw Error('Agente da política inválido');if(!override||typeof override!=='object'||Array.isArray(override)||override.agents)throw Error('Política por agente inválida');agents[role]=normalizePolicy({...policy,...override});delete agents[role].agents;}
 return {...policy,agents};
}
export function requestMode(provider,model,contract,policy={}){const c=capabilities(provider,model);return {...c,formatMode:contract&&policy.format!=='prompt'?c.structuredOutput:'prompt',cacheMode:policy.cache==='explicit'&&c.cache==='explicit-opt-in'?'explicit-opt-in':c.cache==='provider-managed'?'provider-managed':'not-requested'};}
// Keep schema bounds in local validation; native APIs accept different subsets.
export function portableSchema(schema){if(Array.isArray(schema))return schema.map(portableSchema);if(!schema||typeof schema!=='object')return schema;const result=Object.fromEntries(Object.entries(schema).filter(([key])=>!['minLength','maxLength','minItems','maxItems'].includes(key)).map(([key,v])=>[key,portableSchema(v)]));if(schema.maxLength)result.description=`Até ${schema.maxLength} caracteres.`;if(schema.maxItems)result.description=`Até ${schema.maxItems} itens.`;return result;}
