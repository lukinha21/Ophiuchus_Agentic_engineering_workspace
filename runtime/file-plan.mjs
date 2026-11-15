import {safePath} from './workspace.mjs';
import {stackContract} from './stack-contract.mjs';
/** Architecture paths are hints; mandatory contract artifacts must be queued too. */
function completePaths(paths,contract){
 const result=[...paths];
 if(contract.language==='java'&&!result.some(p=>/Test\.java$/.test(p))){
  const source=result.find(p=>p.endsWith('.java'));
  if(source)result.push(safePath(source.replace(/\.java$/,'Test.java')));
 }
 if(contract.language==='cobol'&&!result.some(p=>/(test|teste|spec)[^/]*\.(cob|cbl)$/i.test(p))){
  const source=result.find(p=>/\.(cob|cbl)$/i.test(p));
  if(source){const at=source.lastIndexOf('/');result.push(safePath(source.slice(0,at+1)+'test_'+source.slice(at+1)));}
 }
 return result;
}
/** Derive a work queue from this run's architecture, without another model call. */
export function prepareFilePlan(run){
 if(run.filePlan?.complete)run.filePlan=null;
 if(run.filePlan){run.filePlan.paths=completePaths(run.filePlan.paths,run.languageContract||stackContract(run.prompt));return run.filePlan;}
 const architecture=[...(run.artifacts||[])].reverse().find(a=>a.stage==='architecture');
 if(!architecture)return null;
 const paths=[];
 for(const m of String(architecture.text||'').matchAll(/`([^`\n]+\.(?:cob|cbl|cpy|java|py|js|mjs|cjs|go|rs|cs|csproj|toml|json))`/gi)){
  try{const path=safePath(m[1]);if(!paths.includes(path))paths.push(path);}catch{}
 }
 if(!paths.length||paths.length>40)return null;
 const previous=[...(run.artifacts||[])].reverse().find(a=>a.stage==='implementation'&&a.fileProposals?.length);
 const failure=[...(run.events||[])].reverse().find(e=>e.type==='validation.failed'&&e.target==='implementation');
 const targets=previous&&failure?paths.filter(p=>String(failure.summary).includes(p)):[];
 const accepted=targets.length?previous.fileProposals.filter(f=>paths.includes(f.path)&&!targets.includes(f.path)):[];
 run.filePlan={paths:completePaths(paths,run.languageContract||stackContract(run.prompt)),accepted,complete:false,failures:{}};return run.filePlan;
}
export function fileTaskContext(plan){
 if(!plan)return '';
 const target=plan.paths.find(p=>!plan.accepted.some(f=>f.path===p));
 return `\nTRABALHO DESTA CHAMADA: somente ${target}. Gere exatamente um bloco completo para esse caminho; não repita outros arquivos. Testes devem ser compactos: tabela de casos e rotina de verificação reutilizável, sem repetir grandes blocos por caso. Preserve todos os critérios de aceite.\nArquivos já aceitos por verificações estáticas locais (não compilados): ${plan.accepted.map(f=>f.path).join(', ')||'nenhum'}.`;
}
