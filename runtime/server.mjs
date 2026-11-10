/** Local-only control-plane API. No credentials, tools, or provider calls. */
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRun,startRun,completeStage,approve,reportFailure,cancel} from './orchestrator.mjs';
import {listProviders,listModels} from './providers.mjs';
const PORT=Number(process.env.OPHIUCHUS_PORT||4317);
const DB=resolve(process.env.OPHIUCHUS_STATE_FILE||'./.ophiuchus-local/runs.json');
let runs={};
const BINDINGS=resolve(process.env.OPHIUCHUS_BINDINGS_FILE||'./.ophiuchus-local/bindings.json');
let bindings={};
try{bindings=JSON.parse(await readFile(BINDINGS,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const saveBindings=async()=>{await mkdir(dirname(BINDINGS),{recursive:true});await writeFile(BINDINGS,JSON.stringify(bindings,null,2),{mode:0o600});};
try{runs=JSON.parse(await readFile(DB,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const save=async()=>{await mkdir(dirname(DB),{recursive:true});await writeFile(DB,JSON.stringify(runs,null,2));};
const json=(res,code,value)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
const readBody=async(req)=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>1024*1024)throw Error('Payload grande demais');}return JSON.parse(text||'{}');};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'ophiuchus-control-plane',providerExecution:false});
  if(req.method==='GET'&&url.pathname==='/providers')return json(res,200,listProviders());
  if(req.method==='GET'&&url.pathname==='/bindings')return json(res,200,bindings);
  if(req.method==='PUT'&&url.pathname==='/bindings'){const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Bindings inválidos');const next={};for(const [agentId,binding] of Object.entries(body)){if(!/^[a-z0-9_-]{1,64}$/i.test(agentId)||!binding||typeof binding!=='object'||typeof binding.providerId!=='string'||typeof binding.modelId!=='string'||binding.modelId.length>180||!binding.modelId.trim())throw Error('Binding inválido');if(!listProviders().some(p=>p.id===binding.providerId))throw Error('Provedor não suportado');next[agentId]={providerId:binding.providerId,modelId:binding.modelId};}bindings=next;await saveBindings();return json(res,200,bindings);}
  const modelMatch=url.pathname.match(/^\/providers\/([a-z0-9-]+)\/models$/);
  if(req.method==='GET'&&modelMatch){const models=await listModels(modelMatch[1],{signal:AbortSignal.timeout(12000)});return json(res,200,models);}
  if(req.method==='GET'&&url.pathname==='/runs')return json(res,200,Object.values(runs).map(r=>({id:r.id,status:r.status,stage:r.stage,createdAt:r.createdAt})));
  if(req.method==='POST'&&url.pathname==='/runs'){
   const body=await readBody(req);const run=startRun(createRun({id:randomUUID(),prompt:body.prompt,agents:body.agents}));runs[run.id]=run;await save();return json(res,201,run);
  }
  const match=url.pathname.match(/^\/runs\/([\w-]+)(?:\/(complete|approve|failure|cancel|events))?$/);
  if(!match)return json(res,404,{error:'Rota não encontrada'});
  const run=runs[match[1]];if(!run)return json(res,404,{error:'Run não encontrado'});
  if(req.method==='GET'&&match[2]==='events')return json(res,200,run.events);
  if(req.method==='GET'&&!match[2])return json(res,200,run);
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
  const body=await readBody(req);
  switch(match[2]){
   case 'complete':completeStage(run,body);break;
   case 'approve':approve(run,body.accepted===true);break;
   case 'failure':reportFailure(run,body);break;
   case 'cancel':cancel(run);break;
   default:return json(res,404,{error:'Ação não encontrada'});
  }
  await save();return json(res,200,run);
 }catch(error){json(res,400,{error:error.message});}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Ophiuchus control-plane: http://127.0.0.1:${PORT}`));
