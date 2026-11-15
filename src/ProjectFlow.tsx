import {useState} from 'react'
import {ArrowUpRight,Check,ChevronDown,Square,AlertCircle,Terminal} from 'lucide-react'
import ArtifactMarkdown from './ArtifactMarkdown'
import {useClock,duration} from './ProjectInspector'
import type {StageEvent,ModelAttempt,StageRequest} from './ProjectInspector'

export type ProjectFlowState={
 id:string;projectId:string;goal:string;status:string;stage:string;calls:number;maxCalls:number;contextPaths:string[];
 draftId:string|null;summary:string;error:string|null;validation:string;canResume?:boolean;errorInfo?:{code:string;message:string;technical:string;retryable:boolean}|null;events?:StageEvent[];
 bindings:Record<string,{providerId:string;modelId:string}>;
 stages:Array<{id:string;label:string;name:string;status:string;text:string;detail:string;startedAt:string|null;endedAt:string|null;usage?:{total_tokens?:number}|null;rawText?:string;finishReason?:string|null;durationMs?:number;attempts?:ModelAttempt[];request?:StageRequest}>
}
const stateLabel:Record<string,string>={RUNNING:'Em andamento',READY:'Pronto para sua revisão',BLOCKED:'Ajustes necessários',FAILED:'Execução interrompida',CANCELLED:'Cancelado',CANCELLING:'Encerrando chamada',QUEUED:'Na sequência',COMPLETED:'Concluído'}
export default function ProjectFlow({flow,onCancel,onDraft,onInspect,onResume,engineering=false}:{flow:ProjectFlowState;onCancel?:()=>void;onDraft?:(id:string)=>void;onInspect?:(stageId:string)=>void;onResume?:(timeoutMs:number)=>void;engineering?:boolean}){
 const now=useClock();const [retryTimeout,setRetryTimeout]=useState(90000);
 const [selected,setSelected]=useState<string|null>(null)
 const active=flow.stages.find(s=>s.id===(selected||flow.stage))||flow.stages[0]
 const finished=flow.stages.filter(s=>s.status==='COMPLETED').length
 const running=['RUNNING','CANCELLING'].includes(flow.status)
 return <section className={'flow-ledger flow-'+flow.status.toLowerCase()} aria-label="Fluxo dos agentes">
  <header className="flow-ledger-head"><div className="flow-title"><span className="flow-sign">O/</span><div><span className="flow-eyebrow">REGISTRO DE EXECUÇÃO</span><h3>{stateLabel[flow.status]||flow.status}</h3></div></div><div className="flow-head-meta">{engineering&&onInspect&&<button className="flow-inspect" aria-label="Inspecionar etapa selecionada" onClick={()=>onInspect(active.id)}><Terminal size={13}/></button>}<span>{String(finished).padStart(2,'0')} / 06</span>{running&&onCancel&&<button aria-label="Cancelar fluxo" disabled={flow.status==='CANCELLING'} onClick={onCancel}><Square size={11}/> Parar</button>}</div></header>
  {engineering&&<p className="flow-engineering-hint">Selecione uma etapa para abrir o diagnóstico e os eventos.</p>}
  <ol className="flow-stations">{flow.stages.map((stage,i)=><li key={stage.id} className={'station-'+stage.status.toLowerCase()}><button onClick={()=>{setSelected(stage.id);if(engineering)onInspect?.(stage.id)}} aria-current={flow.stage===stage.id?'step':undefined} aria-pressed={active.id===stage.id} aria-label={stage.name+': '+(stateLabel[stage.status]||stage.status)}><span className="station-marker">{stage.status==='COMPLETED'?<Check size={12}/>:stage.status==='RUNNING'?<span className="station-live"/>:['FAILED','BLOCKED','CANCELLED'].includes(stage.status)?<AlertCircle size={13}/>:String(i+1).padStart(2,'0')}</span><strong>{stage.label}</strong><small>{stage.name}</small></button></li>)}</ol>
  <div className="flow-current" role="status"><span className={'flow-state-dot state-'+active.status.toLowerCase()}/><div><strong>{active.name}</strong><span>{active.status==='FAILED'?'Etapa interrompida':active.detail||stateLabel[active.status]||active.status}{engineering&&active.attempts?.length?' · '+duration(active.attempts.at(-1)?.durationMs??Math.max(0,now-Date.parse(active.attempts.at(-1)!.startedAt))):''}</span></div><span className="flow-model" title={flow.bindings[active.id]?.modelId}>{flow.bindings[active.id]?.modelId}</span></div>
  {(active.text||active.rawText)&&<details className="flow-artifact" key={active.id}><summary>{active.text?'Ver registro de '+active.name:'Ver resposta preservada (não validada)'}<ChevronDown size={13}/></summary><ArtifactMarkdown text={active.text||active.rawText||''}/></details>}
  {flow.error&&<p className="flow-error"><AlertCircle size={14}/>{flow.error}</p>}
  {flow.canResume&&onResume&&<div className="flow-resume"><p>As etapas concluídas serão preservadas. Retomar envia uma nova chamada ao provedor e pode gerar custo.</p><label>Prazo da retomada<select aria-label="Prazo da retomada" value={retryTimeout} onChange={e=>setRetryTimeout(Number(e.target.value))}><option value={90000}>90 segundos</option><option value={180000}>180 segundos</option></select></label><button onClick={()=>onResume(retryTimeout)}>Autorizar e retomar {flow.stages.find(s=>s.id===flow.stage)?.name}</button></div>}
  <footer><span>{engineering?(flow.events?.length||0)+' eventos · ':''}{flow.contextPaths.length} arquivo{flow.contextPaths.length===1?'':'s'} no contexto</span>{flow.status==='READY'?<span className="flow-validation">Revisão estática · testes pendentes</span>:<span>Original preservado até aprovação</span>}</footer>
  {flow.draftId&&onDraft&&<button className="flow-open-draft" disabled={running} onClick={()=>onDraft(flow.draftId!)}>Abrir proposta {flow.status!=='READY'&&'para inspeção'}<ArrowUpRight size={15}/></button>}
 </section>
}
