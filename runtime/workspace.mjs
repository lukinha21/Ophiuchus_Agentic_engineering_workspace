/** Sandboxed per-run file workspace. Only explicit user-approved writes. */
import {mkdir,readFile,writeFile,readdir,realpath,lstat} from 'node:fs/promises';
import {resolve,join,relative,sep,dirname} from 'node:path';
const MAX_FILE=128*1024, MAX_FILES=40;
export function safePath(path){
 if(typeof path!=='string'||path.length>180||!path.trim()||path.includes('\\')||path.includes('\0')||path.startsWith('/')||/^[a-z]:/i.test(path))throw Error('Caminho inválido');
 const parts=path.split('/');if(parts.some(p=>!p||p==='.'||p==='..'||p.startsWith('.')))throw Error('Caminho inválido');
 if(parts.some(p=>! /^[a-zA-Z0-9_@+(). -]+$/.test(p)))throw Error('Caminho inválido');
 return parts.join('/');
}
export function workspaceRoot(id,base=process.env.OPHIUCHUS_WORKSPACES_DIR||'./.ophiuchus-local/workspaces'){
 if(!/^[0-9a-f-]{8,64}$/i.test(id))throw Error('Run inválida');return resolve(base,id);
}
async function ensureSafe(root,path){
 const dest=resolve(root,path);if(!dest.startsWith(root+sep))throw Error('Caminho fora do workspace');
 let cursor=root;for(const segment of path.split('/').slice(0,-1)){
  cursor=join(cursor,segment);try{const st=await lstat(cursor);if(st.isSymbolicLink()||!st.isDirectory())throw Error('Diretório inseguro');}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 try{const st=await lstat(dest);if(st.isSymbolicLink()||!st.isFile())throw Error('Arquivo inseguro');}catch(e){if(e.code!=='ENOENT')throw e;}
 return dest;
}
/** Reject malformed envelopes before any file can reach review or disk. No silent repair. */
export function validateProposalEnvelope(text){
 let opened=null;const paths=new Set();let count=0;
 for(const line of String(text||'').split(/\r?\n/)){
  if(!line.includes('```'))continue;
  if(opened){
   if(!/^\s*```\s*$/.test(line))return {ok:false,reason:'Bloco de arquivo interrompido ou reiniciado; gere novamente arquivos completos, sem concatenar versões.'};
   opened=null;continue;
  }
  const match=line.match(/^\s*```(?:[\w.+-]+)?\s+(?:file|path)\s*[:=]\s*([^`]+?)\s*$/i);
  if(!match)return {ok:false,reason:'Bloco sem caminho de arquivo ou delimitador inválido; use blocos completos com file:caminho.'};
  let path;try{path=safePath(match[1]);}catch{return {ok:false,reason:'Caminho de arquivo inválido'};}
  if(paths.has(path))return {ok:false,reason:`Arquivo duplicado: ${path}. Gere uma única versão completa por caminho.`};
  paths.add(path);opened=path;count++;
 }
 if(opened)return {ok:false,reason:`Arquivo incompleto: ${opened}; falta fechar o bloco.`};
 return count?{ok:true}:{ok:false,reason:'Nenhum arquivo completo proposto'};
}
export function extractProposals(text){
 if(typeof text!=='string')return [];
 const out=[];const pattern=/```(?:[\w.+-]+)?\s+(?:file|path)\s*[:=]\s*([^\n`]+)\n([\s\S]*?)```/gi;
 for(const m of text.matchAll(pattern)){
  try{const path=safePath(m[1].trim());const content=m[2].replace(/\n$/,'');if(Buffer.byteLength(content)>MAX_FILE)continue;if(!out.some(f=>f.path===path))out.push({path,content});}catch{}
  if(out.length>=MAX_FILES)break;
 }
 return out;
}
export async function listWorkspace(id,base){const root=workspaceRoot(id,base);const result=[];
 async function walk(dir,prefix=''){
  let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}
  for(const e of entries){if(e.isSymbolicLink())continue;const rel=prefix?prefix+'/'+e.name:e.name;
   if(e.isDirectory())await walk(join(dir,e.name),rel);
   else if(e.isFile()){const st=await lstat(join(dir,e.name));result.push({path:rel,bytes:st.size});if(result.length>MAX_FILES)throw Error('Limite de arquivos excedido');}
  }
 }
 await walk(root);return result.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function readWorkspaceFile(id,path,base){path=safePath(path);const root=workspaceRoot(id,base);await ensureSafe(root,path);const buf=await readFile(join(root,path));if(buf.length>MAX_FILE)throw Error('Arquivo grande demais');return {path,content:buf.toString('utf8')};}
export async function applyProposals(id,proposals,base){
 if(!Array.isArray(proposals)||!proposals.length||proposals.length>MAX_FILES)throw Error('Propostas inválidas');
 const root=workspaceRoot(id,base);const existing=await listWorkspace(id,base);const existingNames=new Set(existing.map(x=>x.path));const paths=new Set();const normalized=[];
 for(const item of proposals){const path=safePath(item.path);if(paths.has(path)||typeof item.content!=='string'||Buffer.byteLength(item.content)>MAX_FILE)throw Error('Proposta inválida ou duplicada');paths.add(path);normalized.push({path,content:item.content});}
 if(new Set([...existingNames,...paths]).size>MAX_FILES)throw Error('Limite de arquivos excedido');
 await mkdir(root,{recursive:true});
 for(const p of normalized)await ensureSafe(root,p.path);
 for(const p of normalized){const dest=join(root,p.path);await mkdir(dirname(dest),{recursive:true});await ensureSafe(root,p.path);await writeFile(dest,p.content,{flag:'w',mode:0o600});}
 return listWorkspace(id,base);
}
