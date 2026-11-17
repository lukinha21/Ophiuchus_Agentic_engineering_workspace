import {useEffect,useId,useState} from 'react'
import {api} from './runtimeClient'
import {readModelCatalog} from './modelCatalog'

export type RecoveryBinding = {providerId:string; modelId:string}
type Provider = {id:string; name:string; configured:boolean}

export default function FlowRecovery({stage,binding,rateLimited,onResume}:{
 stage:string;binding?:RecoveryBinding;rateLimited:boolean
 onResume:(timeoutMs:number,replacement?:RecoveryBinding)=>void
}){
 const [timeout,setTimeoutMs]=useState(90000)
 const [changing,setChanging]=useState(false)
 const [providers,setProviders]=useState<Provider[]>([])
 const [providerId,setProviderId]=useState(binding?.providerId||'')
 const [modelId,setModelId]=useState('')
 const [models,setModels]=useState<string[]>([])
 const [modelMessage,setModelMessage]=useState('')
 const [providerError,setProviderError]=useState('')
 const catalogId=useId()

 useEffect(()=>{
  if(!changing)return
  let active=true
  void api<Provider[]>('/providers').then(items=>{
   if(!active)return
   const available=items.filter(item=>item.configured&&item.id!=='mock')
   setProviders(available)
   setProviderId(current=>available.some(item=>item.id===current)?current:available[0]?.id||'')
   setProviderError(available.length?'':'Nenhum provedor configurado e disponível.')
  }).catch(()=>{if(active)setProviderError('Não foi possível carregar os provedores disponíveis.')})
  return ()=>{active=false}
 },[changing])

 useEffect(()=>{
  if(!changing||!providerId)return
  let active=true
  setModels(readModelCatalog()[providerId]||[])
  setModelMessage('Carregando modelos…')
  void api<Array<{id:string}>>(`/providers/${encodeURIComponent(providerId)}/models`).then(items=>{
   if(active){setModels(items.map(item=>item.id));setModelMessage('')}
  }).catch(()=>{if(active)setModelMessage('A lista está indisponível. Você pode informar o identificador do modelo.')})
  return ()=>{active=false}
 },[changing,providerId])

 const model=modelId.trim()
 const valid=providers.some(item=>item.id===providerId)&&Boolean(model)&&model.length<=180&&
  (providerId!==binding?.providerId||model!==binding?.modelId)
 return <div className="flow-resume">
  <p><strong>Etapa interrompida: {stage}</strong>{binding&&<> · {binding.modelId} ({binding.providerId})</>}</p>
  <p>{rateLimited?'O provedor retornou HTTP 429. Você pode aguardar ou escolher outro modelo. ':''}Retomar preserva as etapas concluídas e faz novas chamadas ao provedor.</p>
  <label>Prazo da retomada<select aria-label="Prazo da retomada" value={timeout} onChange={event=>setTimeoutMs(Number(event.target.value))}>
   <option value={90000}>90 segundos</option><option value={180000}>180 segundos</option>
  </select></label>
  {changing?<div className="flow-replacement">
   <label>Provedor para {stage}<select value={providerId} onChange={event=>{setProviderId(event.target.value);setModelId('')}}>
    <option value="" disabled>Selecione um provedor</option>{providers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
   <label>Modelo para {stage}<input list={catalogId} value={modelId} maxLength={180} onChange={event=>setModelId(event.target.value)} placeholder="Selecione ou digite o modelo"/></label>
   <datalist id={catalogId}>{models.map(id=><option key={id} value={id}/>)}</datalist>
   {(providerError||modelMessage)&&<p role="status">{providerError||modelMessage}</p>}
   <button type="button" disabled={!valid} onClick={()=>onResume(timeout,{providerId,modelId:model})}>Autorizar troca e retomar</button>
   <button type="button" onClick={()=>{setChanging(false);setModelId('')}}>Voltar</button>
  </div>:<div className="flow-recovery-actions">
   <button type="button" onClick={()=>onResume(timeout)}>Autorizar e retomar {stage}</button>
   <button type="button" onClick={()=>setChanging(true)}>Trocar modelo da etapa</button>
  </div>}
 </div>
}
