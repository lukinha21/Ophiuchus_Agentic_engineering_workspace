import {useState} from 'react'
import {Bot,ShieldCheck,PauseCircle,Play,AlertTriangle,Settings2,Sparkles} from 'lucide-react'
import {api} from './runtimeClient'
import type {RuntimeRun} from './runtimeClient'
import './autopilot.css'
export default function AutopilotPanel({run}:{run:RuntimeRun}){
 const [files,setFiles]=useState(false),[tests,setTests]=useState(false),[approvals,setApprovals]=useState(false)
 const [mode,setMode]=useState<'standard'|'custom'>('standard')
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const [maxCalls,setMaxCalls]=useState(12),[maxTokens,setMaxTokens]=useState(30000)
 const active=run.autoPilot?.status==='RUNNING'
 const language=({java:'Java',go:'Go',python:'Python',rust:'Rust',csharp:'C#',javascript:'JavaScript'} as Record<string,string>)[(run.prompt.match(/\b(java|golang|go|python|rust|c#|csharp|javascript|node(?:\.js)?)\b/i)?.[1]||'javascript').toLowerCase().replace('golang','go').replace('c#','csharp').replace('node.js','javascript').replace('node','javascript')]||'Linguagem do projeto'
 const latestTest=(run as RuntimeRun & {testResults?:Array<{passed:boolean;language?:string;id?:string}>}).testResults?.at(-1)
 const staticOnly=run.dockerValidation?.status==='UNAVAILABLE'
 const qaApproved=Boolean(run.autoPilot?.qaVerified && latestTest?.passed && (run as RuntimeRun & {qaAssessment?:{status:string}}).qaAssessment?.status==='PASS')
 const start=async()=>{setBusy(true);setError('');try{await api(`/runs/${run.id}/autopilot/start`,{confirm:true,applyFiles:mode==='standard'?true:files,runTests:mode==='standard'?true:tests,autoApprovals:mode==='standard'?false:approvals,maxCalls:mode==='standard'?12:maxCalls,maxTokens:mode==='standard'?30000:maxTokens,maxSteps:24})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const stop=async()=>{setBusy(true);setError('');try{await api(`/runs/${run.id}/autopilot/stop`,{})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="auto-panel"><div className="auto-heading"><Bot size={20}/><div><strong>Pilot 2.5.1 · Ciclo assistido</strong><small>Agentes, arquivos e testes com autorização por execução</small></div><span className="auto-status">{run.autoPilot?.status||'DESLIGADO'}</span></div>
 {run.autoPilot?.lastError&&<p className="auto-message"><AlertTriangle size={15}/>{run.autoPilot.lastError}</p>}
 <div className="auto-metrics"><span>Passos <b>{run.autoPilot?.steps||0}</b></span><span>Chamadas <b>{run.autoPilot?.calls||0}</b></span><span>Docker <b>{staticOnly?'Indisponível':latestTest?(latestTest.passed?'Aprovado':'Reprovado'):'Não executado'}</b></span><span>QA do agente <b>{(run as RuntimeRun & {qaAssessment?:{status:string}}).qaAssessment?.status||'Pendente'}</b></span><span>Entrega validada <b>{qaApproved?'Sim':staticOnly&&run.qaAssessment?.status==='PASS'?'Parcial (sem Docker)':'Não'}</b></span></div>
 {!active&&['RUNNING','WAITING_APPROVAL'].includes(run.status)&&<div className="auto-settings">
  <div className="auto-mode-switch" role="group" aria-label="Modo do ciclo assistido"><button type="button" className={mode==='standard'?'selected':''} onClick={()=>setMode('standard')}><Sparkles size={16}/> Padrão</button><button type="button" className={mode==='custom'?'selected':''} onClick={()=>setMode('custom')}><Settings2 size={16}/> Personalizado</button></div>
  {mode==='standard'?<div className="auto-standard"><strong>Um clique para iniciar</strong><p>Autoriza nesta run a gravação de arquivos propostos e a execução de testes em Docker isolado ({language}). Limites fixos: 12 chamadas e 30.000 tokens. Checkpoints sensíveis continuam manuais.</p><p>O código gerado será executado no contêiner. Use somente em um computador e projeto confiáveis.</p></div>:<><label><input type="checkbox" checked={files} onChange={e=>setFiles(e.target.checked)}/> Autorizo gravar automaticamente arquivos propostos nesta run</label><label><input type="checkbox" checked={tests} onChange={e=>setTests(e.target.checked)}/> Autorizo executar testes de {language} no Docker nesta run (imagem aprovada, sem rede)</label><label><input type="checkbox" checked={approvals} onChange={e=>setApprovals(e.target.checked)}/> Permitir checkpoints automáticos quando houver evidências (opcional)</label><div className="auto-limits"><label>Máximo de chamadas<input type="number" min="1" max="30" value={maxCalls} onChange={e=>setMaxCalls(Number(e.target.value))}/></label><label>Limite de tokens<input type="number" min="1000" max="200000" step="1000" value={maxTokens} onChange={e=>setMaxTokens(Number(e.target.value))}/></label></div></>}
  <button disabled={busy||(mode==='custom'&&(!files||!tests))} onClick={()=>void start()}><Play size={15}/> {busy?'Iniciando…':mode==='standard'?'Autorizar e iniciar ciclo':'Iniciar ciclo personalizado'}</button>
 </div>}
 {active&&<button disabled={busy} onClick={()=>void stop()}><PauseCircle size={16}/> Pausar após a operação atual</button>}
 {staticOnly&&<p className="auto-message"><AlertTriangle size={15}/> Docker indisponível após {run.dockerValidation?.attempts} tentativa(s). Revisão estática de IA apenas; testes não executados com sucesso. A entrega não será classificada como verificada.</p>}
 <p className="auto-foot"><ShieldCheck size={14}/> Falhas de infraestrutura Docker não gastam correções de código; após tentativas limitadas, é possível entregar com revisão estática e aviso explícito. Mock não gera arquivos.</p>
 {error&&<p className="auto-message">{error}</p>}</section>
}
