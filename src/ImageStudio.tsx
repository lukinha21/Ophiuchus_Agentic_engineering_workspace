import {useEffect,useRef,useState} from 'react'
import type {ClipboardEvent} from 'react'
import {Download,Image as ImageIcon,Paperclip,Search,Sparkles,X} from 'lucide-react'
import ArtifactMarkdown from './ArtifactMarkdown'
import {api} from './runtimeClient'
import {defaultVisionModel,encodeImage,imageDataUrl,imageProviders,isSupportedImage} from './chatMedia'
import type {ImageBinding,ImageProviderId,MediaResult,PromptRefinerBinding} from './chatMedia'
import './image-studio.css'

type Mode = 'analyse' | 'direct' | 'assisted'
type Entry = {id: string; result: MediaResult}
const modeLabel = {analyse:'Análise',direct:'Direta',assisted:'Com agente'}
export default function ImageStudio({configuredGenerator,refiner}:{configuredGenerator:ImageBinding;refiner:PromptRefinerBinding}){
 const [mode,setMode]=useState<'analyse'|'generate'>('analyse')
 const [textModel,setTextModel]=useState(defaultVisionModel)
 const [generator,setGenerator]=useState(configuredGenerator)
 useEffect(()=>setGenerator(configuredGenerator),[configuredGenerator])
 const [prompt,setPrompt]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [busy,setBusy]=useState<Mode|null>(null)
 const [error,setError]=useState('')
 const [entries,setEntries]=useState<Entry[]>([])
 const [consent,setConsent]=useState(false)
 const input=useRef<HTMLInputElement>(null)
 const operation=useRef<AbortController|null>(null)

 function attach(next:File|undefined){
  if(!next)return
  if(!isSupportedImage(next)){
   setFile(null);setConsent(false);setError('Escolha uma imagem PNG, JPEG ou WebP de até 4 MB.');return
  }
  setFile(next);setConsent(false);setError('')
 }
 function paste(event:ClipboardEvent<HTMLTextAreaElement>){
  if(mode!=='analyse'||busy)return
  const image=[...event.clipboardData.files].find(item=>item.type.startsWith('image/'))
  if(image){event.preventDefault();attach(image)}
 }
 async function submit(next:Mode){
  if(operation.current||!prompt.trim()||!consent||(next==='analyse'&&!file))return
  const controller=new AbortController()
  operation.current=controller;setBusy(next);setError('')
  try{
   const result=await api<MediaResult>('/chat/images',{
    mode:next,prompt,model:next==='analyse'?textModel.trim():generator.modelId.trim(),providerId:next==='analyse'?'google':generator.providerId,
    ...(next==='analyse'&&file?{image:await encodeImage(file)}:{}),
    ...(next==='assisted'?{refinerModel:refiner.modelId,refinerProviderId:refiner.providerId}:{}),confirmSend:true,
   },undefined,AbortSignal.any([controller.signal,AbortSignal.timeout(160000)]))
   if(!controller.signal.aborted)setEntries(previous=>[{id:crypto.randomUUID(),result},...previous])
  }catch(error){
   setError(controller.signal.aborted?'Solicitação interrompida.':(error as Error).message)
  }finally{
   operation.current=null;setBusy(null)
  }
 }
 const enabled=Boolean(!busy&&prompt.trim()&&consent&&(mode==='analyse'?file&&textModel.trim():generator.modelId.trim()))
 const comparable=entries.filter(({result})=>result.image&&result.originalPrompt===prompt.trim()&&result.model===generator.modelId.trim()&&result.providerId===generator.providerId)
 const pair=[comparable.find(entry=>entry.result.mode==='direct'),comparable.find(entry=>entry.result.mode==='assisted')]
 const paired=pair[0]&&pair[1]?pair as [Entry,Entry]:null
 const shown=paired?entries.filter(entry=>!paired.includes(entry)):entries

 function card({id,result}:Entry){
  return <article className="image-result" key={id}>
   <header><strong>{modeLabel[result.mode]}</strong><small>{result.model} · {result.calls} {result.calls===1?'chamada':'chamadas'} · {(result.elapsedMs/1000).toFixed(1)} s</small></header>
   {result.image&&<><img src={imageDataUrl(result.image)} alt={'Imagem gerada para: '+result.originalPrompt}/>
    <a className="image-save" href={imageDataUrl(result.image)} download={`ophiuchus-${result.mode}.${result.image.mimeType.split('/')[1]}`}><Download size={14}/> Salvar imagem</a></>}
   {result.text&&<ArtifactMarkdown text={result.text}/>}
   <details><summary>{result.mode==='assisted'?'Ver descrição original e refinada':'Ver pedido'}</summary>
    <p>{result.originalPrompt}</p>{result.mode==='assisted'&&<p>{result.usedPrompt}</p>}
   </details>
  </article>
 }

 return <main className="image-studio" aria-label="Chat de imagens">
  <header className="image-studio-head"><ImageIcon size={24}/><div><h1>Chat de imagens</h1><p>Analise um print com o Gemini ou escolha um provedor para gerar imagens.</p></div></header>
  <div className="image-modes" aria-label="Tipo de operação">
   <button type="button" disabled={Boolean(busy)} aria-pressed={mode==='analyse'} onClick={()=>{setMode('analyse');setConsent(false);setError('')}}><Search size={16}/> Analisar imagem</button>
   <button type="button" disabled={Boolean(busy)} aria-pressed={mode==='generate'} onClick={()=>{setMode('generate');setConsent(false);setError('')}}><Sparkles size={16}/> Gerar imagem</button>
  </div>
  <section className="image-composer" aria-label="Pedido de imagem">
   <div className="image-fields">
    {mode==='generate'&&<><label>Provedor de imagem<select disabled={Boolean(busy)} value={generator.providerId} onChange={event=>{const providerId=event.target.value as ImageProviderId;setGenerator({providerId,modelId:providerId===configuredGenerator.providerId?configuredGenerator.modelId:''});setConsent(false)}}>{Object.entries(imageProviders).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Modelo de imagem<input disabled={Boolean(busy)} value={generator.modelId} maxLength={128} onChange={event=>setGenerator(current=>({...current,modelId:event.target.value}))}/></label></>}
    {mode==='analyse'?<label>Modelo de análise<input disabled={Boolean(busy)} value={textModel} maxLength={128} onChange={event=>setTextModel(event.target.value)}/></label>:<div><strong>Agente de prompt</strong><p className="image-refiner-label">{refiner.providerId} · {refiner.modelId} · usa a configuração do Desenvolvedor quando disponível</p></div>}
   </div>
   {mode==='analyse'&&<div className="image-attachment">
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{attach(event.target.files?.[0]);event.target.value=''}}/>
    <button type="button" disabled={Boolean(busy)} onClick={()=>input.current?.click()}><Paperclip size={15}/> Anexar imagem</button>
    {file?<><span>{file.name}</span><button type="button" aria-label="Remover imagem" disabled={Boolean(busy)} onClick={()=>{setFile(null);setConsent(false)}}><X size={15}/></button></>:<small>PNG, JPEG ou WebP, até 4 MB. Também é possível colar um print.</small>}
   </div>}
   <label>{mode==='analyse'?'Pergunta sobre a imagem':'Descrição da imagem'}
    <textarea value={prompt} disabled={Boolean(busy)} maxLength={4000} onPaste={paste} onChange={event=>setPrompt(event.target.value)} placeholder={mode==='analyse'?'O que este print mostra?':'Descreva a cena, o estilo e os detalhes que quer preservar.'}/>
   </label>
   <label className="image-consent"><input type="checkbox" disabled={Boolean(busy)} checked={consent} onChange={event=>setConsent(event.target.checked)}/>
    {mode==='analyse'?'Autorizo o envio da imagem e da pergunta ao Google Gemini.':'Autorizo o envio da descrição a '+imageProviders[generator.providerId]+'. Com agente, a descrição também é enviada a '+refiner.providerId+' para refinamento. As chamadas podem gerar custos.'}
   </label>
   <div className="image-actions">
    {mode==='analyse'?<button type="button" disabled={!enabled} onClick={()=>void submit('analyse')}>Analisar</button>:<>
     <button type="button" disabled={!enabled} onClick={()=>void submit('direct')}>Gerar direto</button>
     <button type="button" disabled={!enabled} onClick={()=>void submit('assisted')}>Gerar com agente</button>
     <small>O agente refina a descrição antes de enviá-la ao mesmo gerador.</small>
    </>}
    {busy&&<button type="button" onClick={()=>operation.current?.abort()}>Interromper</button>}
   </div>
   {busy&&<p role="status">{busy==='analyse'?'Analisando imagem…':busy==='assisted'?'Refinando a descrição e gerando imagem…':'Gerando imagem…'}</p>}
   {error&&<p role="alert" className="image-error">{error}</p>}
  </section>
  {paired&&<section className="image-comparison" aria-label="Comparação de imagens">
   <h2>Comparar resultados</h2><div className="image-grid">{paired.map(card)}</div>
  </section>}
  {shown.length>0&&<section className="image-entries" aria-label="Respostas de imagem">{shown.map(card)}</section>}
 </main>
}
