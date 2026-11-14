import {useState} from 'react'
import {ArrowUpRight,Check,ChevronDown,Square,AlertCircle} from 'lucide-react'
import ArtifactMarkdown from './ArtifactMarkdown'

export type ProjectFlowState={
 id:string;projectId:string;goal:string;status:string;stage:string;calls:number;maxCalls:number;contextPaths:string[];
 draftId:string|null;summary:string;error:string|null;validation:string;
 bindings:Record<string,{providerId:string;modelId:string}>;
 stages:Array<{id:string;label:string;name:string;status:string;text:string;detail:string;startedAt:string|null;endedAt:string|null;usage?:{total_tokens?:number}|null;rawText?:string;finishReason?:string|null}>
}
const stateLabel:Record<string,string>={RUNNING:'Em andamento',READY:'Pronto para sua revisão',BLOCKED:'Ajustes necessários',FAILED:'Execução interrompida',CANCELLED:'Cancelado',CANCELLING:'Encerrando chamada',QUEUED:'Na sequência',COMPLETED:'Concluído'}
export default function ProjectFlow({flow,onCancel,onDraft}:{flow:ProjectFlowState;onCancel?:()=>void;onDraft?:(id:string)=>void}){
 const [selected,setSelected]=useState<string|null>(null)
 const active=flow.stages.find(s=>s.id===(selected||flow.stage))||flow.stages[0]
 const finished=flow.stages.filter(s=>s.status==='COMPLETED').length
 const running=['RUNNING','CANCELLING'].includes(flow.status)
 return <section className={'flow-ledger flow-'+flow.status.toLowerCase()} aria-label="Fluxo dos agentes">
  <header className="flow-ledger-head"><div className="flow-title"><span className="flow-sign">O/</span><div><span className="flow-eyebrow">REGISTRO DE EXECUÇÃO</span><h3>{stateLabel[flow.status]||flow.status}</h3></div></div><div className="flow-head-meta"><span>{String(finished).padStart(2,'0')} / 06</span>{running&&onCancel&&<button aria-label="Cancelar fluxo" disabled={flow.status==='CANCELLING'} onClick={onCancel}><Square size={11}/> Parar</button>}</div></header>
  <ol className="flow-stations">{flow.stages.map((stage,i)=><li key={stage.id} className={'station-'+stage.status.toLowerCase()}><button onClick={()=>setSelected(stage.id)} aria-current={flow.stage===stage.id?'step':undefined} aria-pressed={active.id===stage.id} aria-label={stage.name+': '+(stateLabel[stage.status]||stage.status)}><span className="station-marker">{stage.status==='COMPLETED'?<Check size={12}/>:stage.status==='RUNNING'?<span className="station-live"/>:['FAILED','BLOCKED','CANCELLED'].includes(stage.status)?<AlertCircle size={13}/>:String(i+1).padStart(2,'0')}</span><strong>{stage.label}</strong><small>{stage.name}</small></button></li>)}</ol>
  <div className="flow-current" role="status"><span className={'flow-state-dot state-'+active.status.toLowerCase()}/><div><strong>{active.name}</strong><span>{active.detail||stateLabel[active.status]||active.status}</span></div><span className="flow-model" title={flow.bindings[active.id]?.modelId}>{flow.bindings[active.id]?.modelId}</span></div>
  {(active.text||active.rawText)&&<details className="flow-artifact" key={active.id}><summary>{active.text?'Ver registro de '+active.name:'Ver resposta preservada (não validada)'}<ChevronDown size={13}/></summary><ArtifactMarkdown text={active.text||active.rawText||''}/></details>}
  {flow.error&&<p className="flow-error"><AlertCircle size={14}/>{flow.error}</p>}
  <footer><span>{flow.calls} / {flow.maxCalls} chamadas · {flow.contextPaths.length} arquivo{flow.contextPaths.length===1?'':'s'} no contexto</span>{flow.status==='READY'?<span className="flow-validation">Revisão estática · testes pendentes</span>:<span>Original preservado até aprovação</span>}</footer>
  {flow.draftId&&onDraft&&<button className="flow-open-draft" disabled={running} onClick={()=>onDraft(flow.draftId!)}>Abrir proposta {flow.status!=='READY'&&'para inspeção'}<ArrowUpRight size={15}/></button>}
 </section>
}
