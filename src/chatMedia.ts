import {api} from './runtimeClient'

export type MediaImage = {mimeType:'image/png'|'image/jpeg'|'image/webp';data:string}
export type MediaResult = {
 mode:'analyse'|'direct'|'assisted';model:string;providerId?:ImageProviderId;originalPrompt:string;usedPrompt:string
 elapsedMs:number;calls:number;text?:string;image?:MediaImage
}
export type MediaTurn = {text:string;mediaId?:string}
export const defaultVisionModel='gemini-3.1-flash-lite'
export const imageProviders={google:'Google Gemini',openai:'OpenAI',openrouter:'OpenRouter'} as const
export type ImageProviderId=keyof typeof imageProviders
export type ImageBinding={providerId:ImageProviderId;modelId:string}
export type PromptRefinerBinding={providerId:string;modelId:string}
export const defaultPromptRefiner:PromptRefinerBinding={providerId:'google',modelId:defaultVisionModel}
export const defaultImageBinding:ImageBinding={providerId:'google',modelId:'gemini-3.1-flash-lite-image'}
export const imageFormats=['image/png','image/jpeg','image/webp']
export const maxAttachmentSize=4*1024*1024

export const imageDataUrl=(image:MediaImage)=>`data:${image.mimeType};base64,${image.data}`

export function isSupportedImage(file:File){
 return imageFormats.includes(file.type)&&file.size>0&&file.size<=maxAttachmentSize
}

export function encodeImage(file:File):Promise<MediaImage>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader()
  reader.onerror=()=>reject(Error('Não foi possível ler a imagem.'))
  reader.onload=()=>{
   const data=String(reader.result).split(',')[1]
   if(!data){reject(Error('A imagem está vazia.'));return}
   resolve({mimeType:file.type as MediaImage['mimeType'],data})
  }
  reader.readAsDataURL(file)
 })
}

export function imageIntent(prompt:string){
 const normalized=prompt.trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
 const command=/^(?:por favor[, ]+)?(?:(?:voce|vc) )?(?:(?:pode|consegue|poderia) )?(?:me )?(?:gere|gera|gerar|crie|cria|criar|faca|faz|fazer|produza|desenhe) (?:uma? )?(?:imagem|ilustracao|foto|desenho|arte visual)\b/.exec(normalized)
 if(!command)return null
 let subject=normalized.slice(command[0].length).replace(/(?:,? por favor)[.!?]*$/,'').trim()
 if(/^(?:docker|oci|de container|de conteiner)\b/.test(subject))return null
 const assisted=/\b(?:com (?:um )?agente|com refino|com refinamento)(?:[.!? ]*)$/.test(subject)
 subject=subject.replace(/\b(?:com (?:um )?agente|com refino|com refinamento)(?:[.!? ]*)$/,'').replace(/^[\s:,.!?]+|[\s:,.!?]+$/g,'').trim()
 if(!subject||/^(?:de|da|do|sobre|disso|disto|daquilo|dela|dele|de novo|novamente)$/.test(subject)){
  return {kind:'clarify'} as const
 }
 return {kind:'generate',mode:assisted?'assisted':'direct'} as const
}

function openImageStore(){
 return new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('ophiuchus-chat-images',1)
  request.onupgradeneeded=()=>request.result.createObjectStore('images')
  request.onerror=()=>reject(request.error)
  request.onblocked=()=>reject(Error('Armazenamento local ocupado'))
  request.onsuccess=()=>resolve(request.result)
 })
}

const fallbackImages=new Map<string,MediaImage>()
export async function loadChatImage(id:string){
 const fallback=fallbackImages.get(id)
 if(fallback)return fallback
 const db=await openImageStore()
 try{
  return await new Promise<MediaImage|undefined>((resolve,reject)=>{
   const request=db.transaction('images','readonly').objectStore('images').get(id)
   request.onsuccess=()=>resolve(request.result as MediaImage|undefined)
   request.onerror=()=>reject(request.error)
  })
 }finally{db.close()}
}

async function storeChatImage(image:MediaImage){
 const id=crypto.randomUUID()
 try{
  const db=await openImageStore()
  try{
   await new Promise<void>((resolve,reject)=>{
    const transaction=db.transaction('images','readwrite')
    transaction.oncomplete=()=>resolve()
    transaction.onabort=()=>reject(transaction.error)
    transaction.objectStore('images').put(image,id)
   })
  }finally{db.close()}
 }catch{
  fallbackImages.set(id,image)
 }
 return id
}

export async function sendChatImage(prompt:string,file:File|null,mode:'analyse'|'direct'|'assisted',generator=defaultImageBinding,refiner=defaultPromptRefiner):Promise<MediaTurn>{
 const result=await api<MediaResult>('/chat/images',{
  mode,prompt,model:mode==='analyse'?defaultVisionModel:generator.modelId,providerId:mode==='analyse'?'google':generator.providerId,useConfiguredModel:mode!=='analyse',
  ...(file?{image:await encodeImage(file)}:{}),
  ...(mode==='assisted'?{refinerModel:refiner.modelId,refinerProviderId:refiner.providerId}:{}),
  confirmSend:true,
 },undefined,AbortSignal.timeout(160000))
 if(result.image)return {text:mode==='assisted'?'Imagem gerada com refinamento do agente.':'Imagem gerada.',mediaId:await storeChatImage(result.image)}
 if(result.text)return {text:result.text}
 throw Error('O provedor não devolveu uma resposta de imagem.')
}
