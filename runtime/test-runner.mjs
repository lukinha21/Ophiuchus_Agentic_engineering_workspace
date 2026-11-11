/** Fail-closed, opt-in JS tests in an isolated Docker container. No host fallback. */
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {listWorkspace,workspaceRoot,readWorkspaceFile} from './workspace.mjs';
import {stackContract} from './stack-contract.mjs';
export const TEST_IMAGE='node:22-alpine';
export function testFiles(files,contract={language:'javascript'}){
 const patterns={java:/(^|\/)[A-Za-z_][A-Za-z0-9_]*Test\.java$/,go:/(^|\/)[^/]+_test\.go$/,python:/(^|\/)(test_[^/]+|[^/]+_test)\.py$/,rust:/(^|\/)(Cargo\.toml|[^/]+\.rs)$/,csharp:/(^|\/)[^/]+\.csproj$/};
 const pattern=patterns[contract.language]||/(^|\/)[^/]+\.(test|spec)\.(m?js|cjs)$/;
 return files.filter(f=>pattern.test(f.path)).map(f=>f.path);
}
export function dockerArgs(root,files){
 if(!files.length)throw Error('Nenhum teste .test.js/.spec.js encontrado no workspace');
 return ['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','256m','--cpus','1','--user','65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,'--workdir','/workspace',TEST_IMAGE,'node','--test',...files];
}
export async function runWorkspaceTests(id,{base,timeoutMs=20000,spawnImpl=spawn,contract={language:'javascript'}}={}){
 const files=await listWorkspace(id,base);const tests=testFiles(files,contract);
 if(contract.tests==='unsupported')throw Error(`Execução Docker não disponível para ${contract.language}; QA bloqueado, sem fallback para Node.js`);
 if(!tests.length)throw Error(`Nenhum arquivo de teste para ${contract.language} encontrado. Gere testes compatíveis antes de executar.`);
 let args;
 if(contract.language==='java'){
  const sources=files.filter(f=>f.path.endsWith('.java')).map(f=>f.path);
  const classes=[];
  for(const path of tests){const content=(await readWorkspaceFile(id,path,base)).content;
   if(!/public\s+static\s+void\s+main\s*\(/.test(content))throw Error(`Teste Java ${path} não possui public static void main`);
   const pkg=content.match(/^\s*package\s+([a-zA-Z_][\w.]*)\s*;/m)?.[1];
   classes.push((pkg?pkg+'.':'')+path.split('/').at(-1).replace(/\.java$/,''));
  }
  args=javaDockerArgs(workspaceRoot(id,base),sources,classes);
 }else if(['go','python','rust','csharp'].includes(contract.language)){
  if(contract.language==='rust'&&!files.some(f=>f.path==='Cargo.toml'))throw Error('Rust exige Cargo.toml');
  args=languageDockerArgs(workspaceRoot(id,base),contract.language,tests);
 }else args=dockerArgs(workspaceRoot(id,base),tests);
 return new Promise((resolvePromise,reject)=>{
  let proc;try{proc=spawnImpl('docker',args,{shell:false,stdio:['ignore','pipe','pipe'],windowsHide:true});}catch(e){return reject(Error('Docker indisponível: execução de testes bloqueada'));}
  let output='',truncated=false,timedOut=false,settled=false;
  const finish=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolvePromise(result);};
  const capture=data=>{const chunk=data.toString();if(output.length+chunk.length>32000){output+=chunk.slice(0,Math.max(0,32000-output.length));truncated=true;}else output+=chunk;};
  proc.stdout?.on('data',capture);proc.stderr?.on('data',capture);
  proc.on('error',()=>finish(Error('Docker não está instalado ou não está acessível. Nenhum teste foi executado.')));
  proc.on('close',(code,signal)=>finish(null,{passed:code===0&&!timedOut,exitCode:code,signal,timedOut,truncated,output,tests,image:IMAGES[contract.language]||TEST_IMAGE,language:contract.language}));
  const timer=setTimeout(()=>{timedOut=true;proc.kill('SIGKILL');},Math.max(1000,Math.min(timeoutMs,30000)));
 });
}

export const JAVA_IMAGE='eclipse-temurin:21-jdk';
export function javaDockerArgs(root,sources,classes){
 if(!sources.length||!classes.length)throw Error('Fontes e testes Java obrigatórios');
 const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 const cmd=`javac -encoding UTF-8 -d /build ${sources.map(quote).join(' ')} && ${classes.map(c=>`java -ea -cp /build ${quote(c)}`).join(' && ')}`;
 return ['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','512m','--cpus','1','--user','65534:65534','--tmpfs','/tmp:rw,nosuid,size=32m','--tmpfs','/build:rw,nosuid,size=64m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,'--workdir','/workspace',JAVA_IMAGE,'sh','-c',cmd];
}

/** Pinned major runtime versions. Docker daemon pulls a missing image automatically.
 * Container networking remains disabled; no dependency installation at runtime. */
export const IMAGES=Object.freeze({javascript:TEST_IMAGE,java:JAVA_IMAGE,go:'golang:1.24-alpine',python:'python:3.13-alpine',rust:'rust:1.85-slim',csharp:'mcr.microsoft.com/dotnet/sdk:9.0'});
export function languageDockerArgs(root,language,tests){
 const image=IMAGES[language];if(!image||!['go','python','rust','csharp'].includes(language))throw Error('Linguagem não suportada');
 if(!tests.length)throw Error(`Nenhum teste ${language} encontrado`);
 const commands={
  go:['sh','-c','GO111MODULE=off GOPROXY=off GOSUMDB=off GOCACHE=/tmp/go-cache go test ./...'],
  python:['sh','-c','python -m unittest discover -s . -p "test_*.py" && python -m unittest discover -s . -p "*_test.py"'],
  rust:['sh','-c','CARGO_HOME=/tmp/cargo CARGO_TARGET_DIR=/tmp/target CARGO_NET_OFFLINE=true cargo test --offline'],
  csharp:['sh','-c','export DOTNET_CLI_HOME=/tmp DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 NUGET_PACKAGES=/tmp/nuget; mkdir -p /tmp/empty-nuget; for p in $(find . -name "*.csproj" -type f); do dotnet restore "$p" --source /tmp/empty-nuget >/tmp/restore.log 2>&1 || { cat /tmp/restore.log; exit 1; }; dotnet run --project "$p" --no-restore || exit 1; done'],
 };
 return ['run','--rm','--pull','missing','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','1024m','--cpus','1','--user','65534:65534','--tmpfs','/tmp:rw,nosuid,size=256m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,'--workdir','/workspace',image,...commands[language]];
}
