import {useEffect,useState} from 'react'
import {api} from './runtimeClient'
import './workspace-files.css'
type Proposal={path:string;content:string}
type Saved={path:string;bytes:number}
export default function WorkspacePanel({runId,artifactCount}:{runId:string;artifactCount:number}){
 const [proposals,setProposals]=useState<Proposal[]>([])
 const [artifactId,setArtifactId]=useState<string|null>(null)
 const [files,setFiles]=useState<Saved[]>([])
 const [selected,setSelected]=useState<string[]>([])
 const [preview,setPreview]=useState<{path:string;content:string}|null>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [diff,setDiff]=useState<{path:string;exists:boolean;before:string;after:string;changed:boolean}|null>(null)
 const [testResult,setTestResult]=useState<{passed:boolean;output:string;timedOut:boolean;tests:string[]}|null>(null)
 const [confirmTests,setConfirmTests]=useState(false)
 const refresh=async()=>{try{const [p,w]=await Promise.all([api<{artifactId:string|null;files:Proposal[]}>(`/runs/${runId}/workspace/proposals`),api<{files:Saved[]}>(`/runs/${runId}/workspace`)]);setProposals(p.files);setArtifactId(p.artifactId);setFiles(w.files);setSelected(old=>old.filter(x=>p.files.some(f=>f.path===x)));}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void refresh()},[runId,artifactCount])
 const apply=async()=>{if(!artifactId||!selected.length)return;setBusy(true);setError('');try{await api(`/runs/${runId}/workspace/apply`,{artifactId,paths:selected});setSelected([]);await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const showDiff=async(path:string)=>{setError('');try{setDiff(await api(`/runs/${runId}/workspace/diff?path=${encodeURIComponent(path)}`))}catch(e){setError((e as Error).message)}}
 const executeTests=async()=>{setBusy(true);setError('');try{setTestResult(await api(`/runs/${runId}/workspace/test`,{confirm:true}));setConfirmTests(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const sendFailure=async()=>{if(!testResult||testResult.passed)return;setBusy(true);setError('');try{await api(`/runs/${runId}/failure`,{kind:'code',summary:'Falha de testes Docker: '+testResult.output.slice(0,1200)});setTestResult(null);await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const viewFile=async(path:string)=>{setError('');try{setPreview(await api<{path:string;content:string}>(`/runs/${runId}/workspace/file?path=${encodeURIComponent(path)}`))}catch(e){setError((e as Error).message)}}
 return <section className="ophi-files"><div className="ophi-files-head"><strong>Workspace real · Arquivos</strong><button onClick={()=>void refresh()}>Atualizar</button></div><p>Os modelos propõem arquivos; somente você autoriza a gravação. Testes JavaScript somente com confirmação explícita e Docker isolado; nenhuma execução direta no host.</p>
 {error&&<p className="ophi-files-error">{error}</p>}
 <h4>Propostas da última implementação ({proposals.length})</h4>
 {proposals.length?proposals.map(f=><div className="ophi-file-row" key={f.path}><label><input type="checkbox" checked={selected.includes(f.path)} onChange={e=>setSelected(old=>e.target.checked?[...old,f.path]:old.filter(p=>p!==f.path))}/><code>{f.path}</code></label><span className="ophi-file-actions"><button onClick={()=>setPreview(f)}>Visualizar</button><button onClick={()=>void showDiff(f.path)}>Comparar</button></span></div>):<p>Nenhuma proposta ainda. A etapa Implementation deve gerar blocos de código com <code>file:caminho/do/arquivo.js</code>.</p>}
 {selected.length>0&&<button className="ophi-apply" disabled={busy} onClick={()=>void apply()}>{busy?'Gravando…':`Confirmar gravação de ${selected.length} arquivo(s)`}</button>}
 <h4>Arquivos gravados ({files.length})</h4>
 {files.map(f=><div className="ophi-file-row" key={f.path}><code>{f.path}</code><button onClick={()=>void viewFile(f.path)}>Abrir · {f.bytes} B</button></div>)}
 <h4>Testes reais · Docker</h4>
 <p>Execute somente código que você autoriza. Requer Docker instalado e imagem node:22-alpine disponível. Rede desativada, workspace somente leitura e recursos limitados. Não é uma garantia absoluta de isolamento.</p>
 <label className="ophi-test-confirm"><input type="checkbox" checked={confirmTests} onChange={e=>setConfirmTests(e.target.checked)}/> Autorizo executar os testes JavaScript gravados neste workspace em um contêiner isolado.</label>
 <button disabled={!confirmTests||busy||!files.length} onClick={()=>void executeTests()}>{busy?'Executando…':'Executar testes (Docker)'}</button>
 {testResult&&<div className="ophi-file-preview"><strong>{testResult.passed?'Testes aprovados':'Testes falharam'}{testResult.timedOut?' · Timeout':''}</strong><p>{testResult.tests.join(', ')}</p><pre>{testResult.output}</pre>{!testResult.passed&&<button disabled={busy} onClick={()=>void sendFailure()}>Autorizar devolução ao Desenvolvedor</button>}</div>}
 {diff&&<div className="ophi-file-preview"><div><strong>Comparação · {diff.path}</strong><button onClick={()=>setDiff(null)}>Fechar</button></div><p>{diff.exists?'Versão gravada vs. proposta':'Arquivo novo'} · {diff.changed?'Com alterações':'Sem alterações'}</p><strong>Antes</strong><pre>{diff.exists?diff.before:'(arquivo inexistente)'}</pre><strong>Depois</strong><pre>{diff.after}</pre></div>}
 {preview&&<div className="ophi-file-preview"><div><strong>{preview.path}</strong><button onClick={()=>setPreview(null)}>Fechar</button></div><pre>{preview.content}</pre></div>}
 </section>
}
