/** Fail-closed, opt-in JS tests in an isolated Docker container. No host fallback. */
import {spawn} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {mkdtemp,writeFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {listWorkspace,workspaceRoot,readWorkspaceFile} from './workspace.mjs';
import {stackContract} from './stack-contract.mjs';
import {performance} from 'node:perf_hooks';
export const TEST_IMAGE='node:22-alpine';
export function testFiles(files,contract={language:'javascript'}){
 const patterns={cobol:/(^|\/)(?:test|teste|spec)[^/]*\.(?:cob|cbl)$/i,java:/(^|\/)[A-Za-z_][A-Za-z0-9_]*Test\.java$/,go:/(^|\/)[^/]+_test\.go$/,python:/(^|\/)(test_[^/]+|[^/]+_test)\.py$/,rust:/(^|\/)(Cargo\.toml|[^/]+\.rs)$/,csharp:/(^|\/)[^/]+\.csproj$/};
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
 }else if(contract.language==='cobol'){
  args=cobolDockerArgs(workspaceRoot(id,base),files.filter(f=>/\.(cob|cbl)$/i.test(f.path)).map(f=>f.path),tests);
 }else if(['go','python','rust','csharp'].includes(contract.language)){
  if(contract.language==='rust'&&!files.some(f=>f.path==='Cargo.toml'))throw Error('Rust exige Cargo.toml');
  args=languageDockerArgs(workspaceRoot(id,base),contract.language,tests,{files});
 }else args=dockerArgs(workspaceRoot(id,base),tests);
 const image=args.find((arg,i)=>i>0 && ['node:22-alpine','eclipse-temurin:21-jdk',...Object.values(IMAGES),process.env.OPHIUCHUS_COBOL_IMAGE].includes(arg))||IMAGES[contract.language]||TEST_IMAGE;
 const execution=await executeDocker(args,{spawnImpl,timeoutMs});
 return {...execution,tests,image,language:contract.language,command:{executable:'docker',args},durationMs:execution.durationMs};
}

/** Capture the exact Docker invocation and result, without using a shell on the host. */
export function executeDocker(args,{spawnImpl=spawn,timeoutMs=20000}={}){
 return new Promise(resolvePromise=>{
  const started=performance.now();let proc,output='',truncated=false,timedOut=false,settled=false,timer;
  const finish=(result)=>{if(settled)return;settled=true;clearTimeout(timer);resolvePromise({...result,durationMs:Math.round(performance.now()-started),output:output||result.output||'',truncated,timedOut});};
  try{proc=spawnImpl('docker',args,{shell:false,stdio:['ignore','pipe','pipe'],windowsHide:true});}
  catch(error){finish({passed:false,exitCode:null,spawnError:String(error?.message||error),output:String(error?.message||error)});return;}
  const capture=data=>{const chunk=data.toString();const remaining=Math.max(0,64000-output.length);output+=chunk.slice(0,remaining);if(chunk.length>remaining)truncated=true;};
  proc.stdout?.on('data',capture);proc.stderr?.on('data',capture);
  proc.on('error',error=>finish({passed:false,exitCode:null,spawnError:String(error?.message||error),output:output+'\n'+String(error?.message||error)}));
  proc.on('close',(exitCode,signal)=>finish({passed:exitCode===0&&!timedOut,exitCode,signal}));
  timer=setTimeout(()=>{timedOut=true;proc.kill('SIGKILL');},Math.max(1000,Math.min(timeoutMs,120000)));
 });
}
/** Local, deterministic Docker diagnostics. A real COBOL program is compiled and run.
 * A fresh host temp directory is mounted so Windows and Linux both work. */
export async function dockerPreflight(contract,{spawnImpl=spawn,timeoutMs=20000}={}){
 const daemonArgs=['info','--format','{{.ServerVersion}}'];
 const daemon=await executeDocker(daemonArgs,{spawnImpl,timeoutMs});
 if(!daemon.passed)return {ok:false,reason:dockerFailureReason('Docker daemon indisponível',daemon),command:['docker',...daemonArgs],result:daemon};
 const image=contract.language==='cobol'?(process.env.OPHIUCHUS_COBOL_IMAGE||IMAGES.cobol):IMAGES[contract.language]||TEST_IMAGE;
 if(contract.language==='cobol'){
  const inspectArgs=['image','inspect',image,'--format','{{.Id}}'];
  const inspected=await executeDocker(inspectArgs,{spawnImpl,timeoutMs});
  if(!inspected.passed)return {ok:false,reason:`Imagem COBOL ${image} ausente. Execute docker build -f docker/Dockerfile.gnucobol -t ${image} .; ${dockerFailureReason('Docker image inspect',inspected)}`,command:['docker',...inspectArgs],result:inspected};
  let root;
  try{
   root=await mkdtemp(join(tmpdir(),'ophiuchus-cobol-smoke-'));
   await chmod(root,0o755);
   await writeFile(join(root,'smoke.cob'),`>>SOURCE FORMAT FREE
IDENTIFICATION DIVISION.
PROGRAM-ID. SMOKE.
PROCEDURE DIVISION.
 DISPLAY "COBOL_SMOKE_OK".
 GOBACK.
END PROGRAM SMOKE.
`,'ascii');
   const args=cobolDockerArgs(root,['smoke.cob'],['smoke.cob']);
   const smoke=await executeDocker(args,{spawnImpl,timeoutMs});
   if(!smoke.passed||!smoke.output.includes('COBOL_SMOKE_OK'))return {ok:false,reason:dockerFailureReason('Compilação/execução COBOL no sandbox',smoke),command:['docker',...args],result:smoke};
  }catch(error){return {ok:false,reason:`Falha preparando smoke test COBOL: ${error?.message||error}`};}
  finally{if(root)await rm(root,{recursive:true,force:true}).catch(()=>{});}
 }
 return {ok:true,image,daemonVersion:daemon.output.trim()};
}
export function dockerFailureReason(context,result){
 const details=String(result?.output||result?.spawnError||'').trim();
 return `${context}: exitCode=${result?.exitCode??'null'} signal=${result?.signal||'none'} timedOut=${Boolean(result?.timedOut)}; ${details||'(sem saída do processo Docker)'}`;
}
/** Compile-only check, independent from AI judgment. Never claim executable tests passed. */
export async function cobolSyntaxCheck(id,{base,spawnImpl=spawn,timeoutMs=20000}={}){
 const files=(await listWorkspace(id,base)).filter(f=>/\.(cob|cbl)$/i.test(f.path));
 if(!files.length)return {passed:false,exitCode:null,output:'Nenhum fonte COBOL encontrado',classification:'code'};
 const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 const cmd=files.map(f=>`cobc -fsyntax-only -free ${quote(f.path)}`).join(' && ');
 const args=cobolDockerArgs(workspaceRoot(id,base),[files[0].path],[files[0].path]);
 args.splice(-3,3,'sh','-c',cmd);
 const result=await executeDocker(args,{spawnImpl,timeoutMs});
 return {...result,language:'cobol',check:'syntax',command:{executable:'docker',args},image:process.env.OPHIUCHUS_COBOL_IMAGE||IMAGES.cobol};
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
export const IMAGES=Object.freeze({cobol:'ophiuchus-gnucobol:local',javascript:TEST_IMAGE,java:JAVA_IMAGE,go:'golang:1.24-alpine',python:'python:3.13-alpine',rust:'rust:1.85-slim',csharp:'mcr.microsoft.com/dotnet/sdk:9.0'});
export function languageDockerArgs(root,language,tests,{files=[]}={}){
 const image=IMAGES[language];if(!image||!['go','python','rust','csharp'].includes(language))throw Error('Linguagem não suportada');
 if(!tests.length)throw Error(`Nenhum teste ${language} encontrado`);
 const commands={
  go:['sh','-c','GOMAXPROCS=1 GOPROXY=off GOSUMDB=off GOCACHE=/tmp/go-cache go test -p 1 ./...'],
  python:['sh','-c','python -m unittest discover -s . -p "test_*.py" && python -m unittest discover -s . -p "*_test.py"'],
  rust:['sh','-c','CARGO_HOME=/tmp/cargo CARGO_TARGET_DIR=/tmp/target CARGO_NET_OFFLINE=true cargo test --offline'],
  csharp:['sh','-c','export DOTNET_CLI_HOME=/tmp DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_CLI_TELEMETRY_OPTOUT=1 NUGET_PACKAGES=/tmp/nuget; mkdir -p /tmp/empty-nuget; for p in $(find . -name "*.csproj" -type f); do dotnet restore "$p" --source /tmp/empty-nuget >/tmp/restore.log 2>&1 || { cat /tmp/restore.log; exit 1; }; dotnet run --project "$p" --no-restore || exit 1; done'],
 };
 const modules=language==='go'?files.filter(f=>f.path==='go.mod'||f.path.endsWith('/go.mod')).map(f=>dirname(f.path)).map(p=>p==='.'?'':p):[];
 if(language==='go'){
  if(files.length&&!modules.length)throw Error('Go exige go.mod no workspace; gere go.mod para permitir testes reais');
  // Multiple modules: test each independently. No silent omission.
  const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
  if(modules.length)commands.go=['sh','-c',modules.map(dir=>`cd ${quote('/workspace'+(dir?'/'+dir:''))} && GOMAXPROCS=1 GOPROXY=off GOSUMDB=off GOCACHE=/tmp/go-cache go test -p 1 ./...`).join(' && ')];
 }
 return ['run','--rm','--pull','missing','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','1024m','--cpus','1','--user','65534:65534','--tmpfs','/tmp:rw,nosuid,size=256m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,'--workdir','/workspace',image,...commands[language]];
}

/** COBOL tests must be native executables; no JS fallback.
 * Override OPHIUCHUS_COBOL_IMAGE for a locally vetted GnuCOBOL image.
 */
export function cobolDockerArgs(root,sources,tests){
 if(!sources.length||!tests.length)throw Error('COBOL exige código e teste .cob/.cbl');
 const image=process.env.OPHIUCHUS_COBOL_IMAGE||IMAGES.cobol;
 const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 const commands=tests.map((test,i)=>{
  const support=sources.filter(s=>s!==test&&!/(^|\/)(test|teste|spec)[^/]*\.(cob|cbl)$/i.test(s));
  return `cobc -x -free -I /workspace -o /tmp/cobol_test_${i} ${[test,...support].map(quote).join(' ')} && /tmp/cobol_test_${i}`;
 });
 return ['run','--rm','--pull','missing','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','512m','--cpus','1','--user','65534:65534','--tmpfs','/tmp:rw,exec,nosuid,size=64m','--mount',`type=bind,src=${resolve(root)},dst=/workspace,readonly`,'--workdir','/workspace',image,'sh','-c',commands.join(' && ')];
}

/** Classify Docker failures without asking an LLM to interpret infrastructure logs. */
export function classifyTestFailure(result){
 if(result?.passed)return 'passed';
 const output=String(result?.output||result?.message||result?.spawnError||'');
 if(result?.spawnError||result?.timedOut)return 'infrastructure';
 // Docker itself failed before launching the workload (exit 125).
 if(result?.exitCode===125||result?.exitCode===126||result?.exitCode===127 && /docker:|container runtime|OCI runtime/i.test(output))return 'infrastructure';
 if(/resource temporarily unavailable|cannot allocate memory|out of memory|no space left on device|too many open files|fork\/exec|failed to create (?:new )?thread|pids limit|pull access denied|repository does not exist|manifest unknown|cannot connect to the docker daemon|error response from daemon|context deadline exceeded|TLS handshake timeout|network is unreachable|i\/o timeout|permission denied while trying to connect to the docker daemon|Docker indisponível|Docker não está instalado/i.test(output))return 'infrastructure';
 // Program errors (including permission denied from a compiled binary) must not be silently accepted.
 return 'code';
}
export function retryableInfrastructureFailure(result){
 const output=String(result?.output||result?.message||'');
 if(/pull access denied|repository does not exist|manifest unknown|authentication required|no basic auth credentials|invalid reference format|executable file not found|image not known|no such image/i.test(output))return false;
 return true;
}
