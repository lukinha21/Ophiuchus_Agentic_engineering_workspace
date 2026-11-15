import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {executeDocker,classifyTestFailure} from './test-runner.mjs';
export const BROWSER_IMAGE='ophiuchus-browser:1.64.1-v1';
export const browserContext=resolve(dirname(fileURLToPath(import.meta.url)),'../docker/browser');
export function browserDockerArgs(root,entry,name){return ['run','--rm','--init','--name',name,'--pull','never','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','768m','--cpus','1','--user','1000:1000','--tmpfs','/tmp:rw,nosuid,size=256m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,BROWSER_IMAGE,entry]}
export async function browserTests(root,entry,{docker=executeDocker}={}){
 const inspect=await docker(['image','inspect',BROWSER_IMAGE],{timeoutMs:10000});
 if(!inspect.passed)return {status:'NOT_RUN',passed:null,needsPreparation:true,output:'O navegador Docker ainda não está preparado ou o Docker está indisponível. Use Preparar navegador Docker e tente novamente.\n'+inspect.output};
 const name='ophiuchus-browser-'+randomUUID();let execution;
 try{execution=await docker(browserDockerArgs(root,entry,name),{timeoutMs:60000})}finally{await docker(['rm','-f',name],{timeoutMs:10000})}
 const line=execution.output.split(/\r?\n/).find(l=>l.startsWith('OPHIUCHUS_BROWSER_RESULT='));let details;
 try{if(line)details=JSON.parse(line.slice('OPHIUCHUS_BROWSER_RESULT='.length))}catch{}
 if(!details||details.kind==='BROWSER_SETUP_ERROR'||classifyTestFailure(execution)==='infrastructure')return {...execution,status:'NOT_RUN',passed:null,output:'Validação não concluída no navegador isolado.\n'+execution.output};
 return {...execution,status:execution.passed&&details.passed?'PASSED':'FAILED',passed:execution.passed&&details.passed,kind:details.kind,details,output:JSON.stringify(details,null,2)};
}
export async function prepareBrowser({docker=executeDocker}={}){return docker(['build','--tag',BROWSER_IMAGE,browserContext],{timeoutMs:600000,maxTimeoutMs:600000})}
