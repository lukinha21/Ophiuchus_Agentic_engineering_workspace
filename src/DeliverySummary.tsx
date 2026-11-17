import type {ProjectFlowState} from './ProjectFlow'
import './delivery-summary.css'

export type DeliveryStatus = {
 review:'approved'|'blocked'|'pending'|'direct'
 tests:'passed'|'failed'|'notRun'
 smoke:boolean
 applied:number
 total:number
 exception?:string
}

export function deliveryStatus(draft:{
 id:string;workflowId?:string|null;changes:Array<{applied:boolean}>;
 test?:{passed:boolean|null;kind?:string}|null;delivery?:{status:string;reason:string}
},flow?:ProjectFlowState):DeliveryStatus{
 return {
  review:!draft.workflowId?'direct':flow?.draftId===draft.id&&flow.status==='READY'?'approved':flow?.status==='BLOCKED'?'blocked':'pending',
  tests:draft.test?.passed===true?'passed':draft.test?.passed===false?'failed':'notRun',
  smoke:draft.test?.kind==='BROWSER_SMOKE',
  applied:draft.changes.filter(change=>change.applied).length,
  total:draft.changes.length,
  exception:draft.delivery?.status==='WITHOUT_APPROVED_TESTS'?draft.delivery.reason:undefined,
 }
}

const reviewLabels={approved:'Revisão estática concluída',blocked:'Ajustes solicitados',pending:'Pareceres pendentes',direct:'Proposta em edição direta'}

export default function DeliverySummary({status}:{status:DeliveryStatus}){
 const tests=status.tests==='passed'?(status.smoke?'Checagem de abertura aprovada':'Testes aprovados na cópia isolada'):
  status.tests==='failed'?(status.smoke?'Checagem de abertura reprovada':'Testes reprovados na cópia isolada'):'Testes não executados'
 return <section className="delivery-summary" aria-label="Resumo da entrega">
  <h3>Resumo da entrega</h3>
  <dl>
   <div><dt>Revisão</dt><dd>{reviewLabels[status.review]}</dd></div>
   <div><dt>Testes</dt><dd>{tests}</dd></div>
   <div><dt>Aplicação</dt><dd>{status.applied} de {status.total} {status.total===1?'arquivo aplicado':'arquivos aplicados'}</dd></div>
  </dl>
  {status.exception&&<p>Revisão concluída sem testes aprovados. {status.exception}</p>}
 </section>
}
