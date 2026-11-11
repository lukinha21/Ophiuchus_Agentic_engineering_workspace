import {useState} from 'react'
import {Bot,ShieldCheck,PauseCircle,Play,AlertTriangle} from 'lucide-react'
import {api} from './runtimeClient'
import type {RuntimeRun} from './runtimeClient'
import './autopilot.css'
export default function AutopilotPanel({run}:{run:RuntimeRun}){
 const [files,setFiles]=useState(false),[tests,setTests]=useState(false),[approvals,setApprovals]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const [maxCalls,setMaxCalls]=useState(12),[maxTokens,setMaxTokens]=useState(30000)
 const active=run.autoPilot?.status==='RUNNING'
 const language=({java:'Java',go:'Go',python:'Python',rust:'Rust',csharp:'C#',javascript:'JavaScript'} as Record<string,string>)[(run.prompt.match(/\b(java|golang|go|python|rust|c#|csharp|javascript|node(?:\.js)?)\b/i)?.[1]||'javascript').toLowerCase().replace('golang','go').replace('c#','csharp').replace('node.js','javascript').replace('node','javascript')]||'Linguagem do projeto'
 const latestTest=(run as RuntimeRun & {testResults?:Array<{passed:boolean;language?:string;id?:string}>}).testResults?.at(-1)
 const qaApproved=Boolean(run.autoPilot?.qaVerified && latestTest?.passed && (run as RuntimeRun & {qaAssessment?:{status:string}}).qaAssessment?.status==='PASS')
 const start=async()=>{setBusy(true);setError('');try{await api(`/runs/${run.id}/autopilot/start`,{confirm:true,applyFiles:files,runTests:tests,autoApprovals:approvals,maxCalls,maxTokens,maxSteps:24})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const stop=async()=>{setBusy(true);setError('');try{await api(`/runs/${run.id}/autopilot/stop`,{})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="auto-panel"><div className="auto-heading"><Bot size={20}/><div><strong>Pilot 2.4.1 · Ciclo assistido</strong><small>Agentes, arquivos e testes com autorização por execução</small></div><span className="auto-status">{run.autoPilot?.status||'DESLIGADO'}</span></div>
 {run.autoPilot?.lastError&&<p className="auto-message"><AlertTriangle size={15}/>{run.autoPilot.lastError}</p>}
 <div className="auto-metrics"><span>Passos <b>{run.autoPilot?.steps||0}</b></span><span>Chamadas <b>{run.autoPilot?.calls||0}</b></span><span>Docker <b>{latestTest?(latestTest.passed?'Aprovado':'Reprovado'):'Não executado'}</b></span><span>QA do agente <b>{(run as RuntimeRun & {qaAssessment?:{status:string}}).qaAssessment?.status||'Pendente'}</b></span><span>Entrega validada <b>{qaApproved?'Sim':'Não'}</b></span></div>
 {!active&&['RUNNING','WAITING_APPROVAL'].includes(run.status)&&<div className="auto-settings"><label><input type="checkbox" checked={files} onChange={e=>setFiles(e.target.checked)}/> Autorizo gravar automaticamente arquivos propostos nesta run</label><label><input type="checkbox" checked={tests} onChange={e=>setTests(e.target.checked)}/> Autorizo executar testes de {language} no Docker nesta run (imagem aprovada, sem rede)</label><label><input type="checkbox" checked={approvals} onChange={e=>setApprovals(e.target.checked)}/> Permitir checkpoints automáticos quando houver evidências (opcional)</label><div className="auto-limits"><label>Máximo de chamadas<input type="number" min="1" max="30" value={maxCalls} onChange={e=>setMaxCalls(Number(e.target.value))}/></label><label>Limite de tokens<input type="number" min="1000" max="200000" step="1000" value={maxTokens} onChange={e=>setMaxTokens(Number(e.target.value))}/></label></div><button disabled={busy||!files||!tests} onClick={()=>void start()}><Play size={15}/> Iniciar ciclo autorizado</button></div>}
 {active&&<button disabled={busy} onClick={()=>void stop()}><PauseCircle size={16}/> Pausar após a operação atual</button>}
 <p className="auto-foot"><ShieldCheck size={14}/> Sem Docker ou testes reais, o QA é bloqueado. Mock não gera arquivos. Limites não garantem custo exato; chamadas em andamento podem consumir tokens.</p>
 {error&&<p className="auto-message">{error}</p>}</section>
}
