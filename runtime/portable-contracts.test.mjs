import test from 'node:test';import assert from 'node:assert/strict';
import {CONTRACTS,readHandoff,compactConversation} from './agent-contracts.mjs';
import {capabilities,normalizePolicy,rememberCapabilities} from './model-capabilities.mjs';
import {generateText} from './providers.mjs';
const contract={name:'review_v1',schema:CONTRACTS.reviewer};
const messages=[{role:'system',content:'Retorne JSON'},{role:'user',content:'arquivo'}];
const env={GEMINI_API_KEY:'fake-key',OPENAI_API_KEY:'fake-key',ANTHROPIC_API_KEY:'fake-key',OPENROUTER_API_KEY:'fake-key',OPHIUCHUS_CUSTOM_API_KEY:'fake-key',OPHIUCHUS_CUSTOM_BASE_URL:'https://api.groq.com/openai/v1'};
async function capture(providerId,model,extra={}){let body,calls=0;const result=await generateText({providerId,model,messages,responseContract:contract,...extra},{env,fetchImpl:async(url,options)=>{calls++;body=JSON.parse(options.body);return {ok:true,json:async()=>providerId==='google'?{candidates:[{content:{parts:[{text:'{}'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:30,candidatesTokenCount:5,totalTokenCount:40,thoughtsTokenCount:5,cachedContentTokenCount:12}}:providerId==='anthropic'?{content:[{type:'text',text:'{}'}],stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:5,cache_read_input_tokens:20,cache_creation_input_tokens:30}}:{choices:[{message:{content:'{}'},finish_reason:'stop'}],usage:{prompt_tokens:30,completion_tokens:10,total_tokens:40,prompt_tokens_details:{cached_tokens:20},completion_tokens_details:{reasoning_tokens:5}}}}}});return {body,result,calls};}
test('native schemas map to each supported endpoint without changing the model',async()=>{
 const g=await capture('google','gemini-3.6-flash');assert.equal(g.body.generationConfig.responseMimeType,'application/json');assert.ok(g.body.generationConfig.responseJsonSchema);assert.equal(g.result.usage.cached_input_tokens,12);
 const o=await capture('openai','gpt-5-mini');assert.equal(o.body.model,'gpt-5-mini');assert.equal(o.body.response_format.json_schema.strict,true);assert.equal(o.body.max_completion_tokens,600);assert.equal(o.body.max_tokens,undefined);assert.equal(o.result.usage.cached_input_tokens,20);
 const a=await capture('anthropic','claude-sonnet-4-5');assert.equal(a.body.output_config.format.type,'json_schema');assert.equal(a.result.usage.prompt_tokens,60);assert.equal(a.result.usage.total_tokens,65);assert.equal(a.result.usage.cache_write_tokens,30);
});
test('unknown models and custom gateways omit unsupported schema and cache parameters',async()=>{
 for(const [provider,model] of [['google','future-model'],['openai','unknown'],['anthropic','old-model'],['custom','unknown'],['openrouter','vendor/model']]){const {body,result,calls}=await capture(provider,model);assert.equal(result.execution.formatMode,'prompt');assert.equal(body.response_format,undefined);assert.equal(body.output_config,undefined);assert.equal(body.generationConfig?.responseJsonSchema,undefined);assert.equal(calls,1);}
 const forced=await capture('google','gemini-3.6-flash',{policy:{format:'prompt'}});assert.equal(forced.body.generationConfig.responseJsonSchema,undefined);
});
test('catalog metadata bounds output and enables gateway schemas only when advertised',async()=>{
 rememberCapabilities('google',[{name:'models/gemini-3.6-flash',outputTokenLimit:2048}]);const g=await capture('google','gemini-3.6-flash',{maxOutputTokens:8192});assert.equal(g.body.generationConfig.maxOutputTokens,2048);
 rememberCapabilities('openrouter',[{id:'vendor/schema',supported_parameters:['structured_outputs']}]);const r=await capture('openrouter','vendor/schema');assert.equal(r.body.response_format.type,'json_schema');assert.equal(capabilities('openrouter','vendor/other').structuredOutput,'prompt');
});
test('cache writes are opt-in and supported only on compatible endpoints',async()=>{
 const input=[messages[0],{role:'user',content:'source '.repeat(1600)}];const ordinary=await capture('anthropic','claude-sonnet-4-5',{messages:input});assert.equal(typeof ordinary.body.messages[0].content,'string');const explicit=await capture('anthropic','claude-sonnet-4-5',{messages:input,policy:{cache:'explicit'}});assert.equal(explicit.body.messages[0].content[0].cache_control.type,'ephemeral');const custom=await capture('custom','unknown',{messages:input,policy:{cache:'explicit'}});assert.equal(custom.body.cache_control,undefined);
});
test('contract failures do not accept prose, missing facts or oversized output',()=>{
 for(const text of ['prosa','{}',JSON.stringify({verdict:'pass',summary:'ok',evidence:''}),JSON.stringify({verdict:'pass',summary:'x'.repeat(401),evidence:'arquivo.js: problema'})])assert.throws(()=>readHandoff('reviewer',text),e=>e.code==='INVALID_HANDOFF');
 assert.equal(readHandoff('reviewer','{"verdict":"pass","summary":"ok","evidence":"a.js: contrato preservado"}').verdict,'pass');
});
test('policies preserve per-agent choice and deterministic history compaction preserves requirements',()=>{
 const policy=normalizePolicy({format:'auto',agents:{qa:{format:'prompt'}}});assert.equal(policy.agents.qa.format,'prompt');assert.throws(()=>normalizePolicy({agents:{other:{}}}));
 const h=[{role:'user',content:'não altere regra X'},{role:'user',content:'não altere regra X'},{role:'assistant',content:'decisão Y'},{role:'user',content:'não altere regra X'}];assert.equal(compactConversation(h).length,3);assert.equal(compactConversation(h,'full').length,4);
});
