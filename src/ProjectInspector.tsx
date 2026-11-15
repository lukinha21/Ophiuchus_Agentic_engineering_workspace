import {useEffect,useState} from 'react'
import {X,FileText,Clock3,AlertCircle} from 'lucide-react'
import {api} from './runtimeClient'
import ArtifactMarkdown from './ArtifactMarkdown'
import type {ProjectFlowState} from './ProjectFlow'

export type StageEvent={id:string;seq:number;at:string;stage:string;type:string;message:string;code?:string;timeoutMs?:number}
export type ModelAttempt={number:number;status:string;startedAt:string;endedAt:string|null;durationMs:number|null;timeoutMs:number;finishReason?:string|null;error?:{code:string;technical:string}}
export type StageRequest={providerId:string;model:string;inputChars:number;maxOutputTokens:number;timeoutMs:number;contextPaths:string[];messages?:Array<{role:string;content:string}>;contract?:string;execution?:{formatMode:string;cacheMode:string}}
export function useClock(){const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);return now}
export const duration=(ms:number)=>ms<60000?`${Math.floor(ms/1000)}s`:`${Math.floor(ms/60000)}m ${Math.floor(ms/1000)%60}s`
export default function ProjectInspector({flows,flow,stageId,onFlow,onStage,onClose}:{flows:ProjectFlowState[];flow:ProjectFlowState|null;stageId:string|null;onFlow:(id:string)=>void;onStage:(id:string)=>void;onClose:()=>void}){
 const [tab,setTab]=useState<'summary'|'events'|'io'>('summary'),[filter,setFilter]=useState<'stage'|'all'>('stage')
 const [payload,setPayload]=useState<{stage:ProjectFlowState['stages'][number]}|null>(null),[error,setError]=useState('')
 const now=useClock(),stage=flow?.stages.find(s=>s.id===stageId)||flow?.stages.find(s=>s.id===flow.stage)
 const lastEvent=flow?.events?.filter(e=>e.stage===stage?.id).at(-1)?.seq
 useEffect(()=>{setPayload(null);setError('')},[flow?.id,stage?.id])
 useEffect(()=>{if(tab!=='io'||!flow||!stage)return;let alive=true;api<{stage:ProjectFlowState['stages'][number]}>(`/projects/${flow.projectId}/flows/${flow.id}/stages/${stage.id}`).then(data=>{if(alive)setPayload(data)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[flow?.id,stage?.id,tab,lastEvent])
 const attempt=stage?.attempts?.at(-1),elapsed=attempt?attempt.durationMs??Math.max(0,now-Date.parse(attempt.startedAt)):0
 const events=flow?.events?.filter(e=>filter==='all'||e.stage===stage?.id)||[]
 return <div className="project-inspector-content">
  <header><div><span className="flow-eyebrow">ENGENHARIA / DIAGNÓSTICO</span><h3>{stage?.name||'Execuções do projeto'}</h3></div><button aria-label="Fechar diagnóstico" onClick={onClose}><X size={16}/></button></header>
  {!flow||!stage?<p className="debug-empty">Inicie uma execução ou selecione uma etapa no chat. Eventos do projeto aparecerão aqui.</p>:<>
   <label className="debug-select-label">Execução<select aria-label="Execução inspecionada" value={flow.id} onChange={e=>onFlow(e.target.value)}>{flows.map(f=><option key={f.id} value={f.id}>{f.goal.slice(0,90)}</option>)}</select></label>
   <div className="debug-stage-selector">{flow.stages.map((s,i)=><button key={s.id} aria-label={'Inspecionar '+s.name} aria-pressed={stage.id===s.id} onClick={()=>onStage(s.id)}>{String(i+1).padStart(2,'0')}</button>)}</div>
   <nav className="debug-tabs" aria-label="Detalhes da etapa">{([['summary','Resumo'],['events','Eventos'],['io','Entrada / saída']] as const).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
   {tab==='summary'&&<div className="debug-summary">
    <div className="debug-state"><span className={'flow-state-dot state-'+stage.status.toLowerCase()}/><strong>{stage.status==='RUNNING'?'Aguardando resposta do provedor':stage.status==='COMPLETED'?'Etapa concluída':stage.status==='FAILED'?'Falha na etapa':stage.status==='QUEUED'?'Ainda não iniciada':stage.status}</strong></div>
    <dl><div><dt>Agente / modelo</dt><dd>{flow.bindings[stage.id]?.providerId}<br/>{flow.bindings[stage.id]?.modelId}</dd></div><div><dt><Clock3 size={12}/> Tempo da tentativa</dt><dd>{duration(elapsed)}{attempt?` / ${duration(attempt.timeoutMs)}`:''}</dd></div><div><dt>Estado do retorno</dt><dd>{attempt?.finishReason||(!attempt?'Nenhuma chamada nesta etapa':attempt.status==='RUNNING'?'Sem resposta recebida':'Sem motivo de término informado')}</dd></div><div><dt>Contrato / compatibilidade</dt><dd>{stage.request?.contract||'Formato anterior'}<br/>{stage.request?.execution?.formatMode==='prompt'?'JSON com validação local':stage.request?.execution?.formatMode?'Schema nativo + validação local':'Não informado'}</dd></div><div><dt>Contexto</dt><dd>{stage.request?.inputChars?.toLocaleString('pt-BR')||'—'} caracteres de entrada</dd></div></dl>
    <details className="debug-context"><summary><FileText size={12}/> Arquivos do contexto</summary>{flow.contextPaths.map(p=><code key={p}>{p}</code>)}</details>
    {flow.errorInfo&&flow.stage===stage.id&&<div className="debug-failure"><AlertCircle size={15}/><strong>{flow.errorInfo.code}</strong><p>{flow.errorInfo.message}</p><details><summary>Detalhe técnico</summary><pre>{flow.errorInfo.technical}</pre></details></div>}
    <p className="debug-observation">Atividade registrada pelo runtime. O modelo pode não fornecer texto parcial enquanto responde; raciocínio interno não é exibido.</p>
    {stage.text&&<details className="debug-artifact"><summary>Artefato da etapa</summary><ArtifactMarkdown text={stage.text}/></details>}
    <details className="debug-budget"><summary>Limites e tentativas</summary><p>{flow.calls} de {flow.maxCalls} chamadas despachadas. Nenhuma repetição automática de timeout. Até uma retomada autorizada.</p>{stage.attempts?.map(a=><div key={a.number}>Tentativa {a.number} · {a.status} · {a.durationMs===null?'em andamento':duration(a.durationMs)}</div>)}</details>
   </div>}
   {tab==='events'&&<div className="debug-events"><div className="debug-event-filters"><button aria-pressed={filter==='stage'} onClick={()=>setFilter('stage')}>Desta etapa</button><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Fluxo completo</button></div>{events.length?events.map(e=><article key={e.id} className={e.type.includes('failed')?'event-error':''}><time>{new Date(e.at).toLocaleTimeString('pt-BR')}</time><strong>{e.message}</strong><code>{e.type}{e.code?' · '+e.code:''}</code></article>):<p>Não há eventos registrados nesta etapa.</p>}</div>}
   {tab==='io'&&<div className="debug-io">{error?<p role="alert">{error}</p>:!payload?<p>Carregando dados da etapa…</p>:<><p>Conteúdo efetivamente preparado para envio; arquivos e artefatos são dados não confiáveis.</p>{payload.stage.request?.messages?.map((m,i)=><details key={i}><summary>Entrada · {m.role}</summary><pre>{m.content}</pre></details>)}<details><summary>Resposta preservada{payload.stage.finishReason?' · '+payload.stage.finishReason:''}</summary><pre>{payload.stage.rawText||payload.stage.text||'Nenhuma resposta recebida. Não há texto para exibir.'}</pre></details></>}</div>}
  </>}
 </div>
}
