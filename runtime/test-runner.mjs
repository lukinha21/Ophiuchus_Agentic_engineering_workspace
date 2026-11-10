/** Fail-closed, opt-in JS tests in an isolated Docker container. No host fallback. */
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {listWorkspace,workspaceRoot} from './workspace.mjs';
export const TEST_IMAGE='node:22-alpine';
export function testFiles(files){return files.filter(f=>/(^|\/)[^/]+\.(test|spec)\.(m?js|cjs)$/.test(f.path)).map(f=>f.path);}
export function dockerArgs(root,files){
 if(!files.length)throw Error('Nenhum teste .test.js/.spec.js encontrado no workspace');
 return ['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','256m','--cpus','1','--user','65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,'--workdir','/workspace',TEST_IMAGE,'node','--test',...files];
}
export async function runWorkspaceTests(id,{base,timeoutMs=20000,spawnImpl=spawn}={}){
 const files=await listWorkspace(id,base);const tests=testFiles(files);
 if(!tests.length)throw Error('Nenhum arquivo de teste encontrado. Grave um arquivo .test.js ou .spec.js primeiro.');
 const args=dockerArgs(workspaceRoot(id,base),tests);
 return new Promise((resolvePromise,reject)=>{
  let proc;try{proc=spawnImpl('docker',args,{shell:false,stdio:['ignore','pipe','pipe'],windowsHide:true});}catch(e){return reject(Error('Docker indisponível: execução de testes bloqueada'));}
  let output='',truncated=false,timedOut=false,settled=false;
  const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolvePromise(result);};
  const capture=data=>{const chunk=data.toString();if(output.length+chunk.length>32000){output+=chunk.slice(0,Math.max(0,32000-output.length));truncated=true;}else output+=chunk;};
  proc.stdout?.on('data',capture);proc.stderr?.on('data',capture);
  proc.on('error',()=>finish(Error('Docker não está instalado ou não está acessível. Nenhum teste foi executado.')));
  proc.on('close',(code,signal)=>finish(null,{passed:code===0&&!timedOut,exitCode:code,signal,timedOut,truncated,output,tests,image:TEST_IMAGE}));
  const timer=setTimeout(()=>{timedOut=true;proc.kill('SIGKILL');},Math.max(1000,Math.min(timeoutMs,30000)));
 });
}
