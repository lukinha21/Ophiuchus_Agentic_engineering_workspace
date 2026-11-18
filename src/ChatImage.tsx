import {useEffect,useState} from 'react'
import {Download} from 'lucide-react'
import {imageDataUrl,loadChatImage} from './chatMedia'
import type {MediaImage} from './chatMedia'
import './image-studio.css'

export default function ChatImage({id}:{id:string}){
 const [image,setImage]=useState<MediaImage>()
 const [loaded,setLoaded]=useState(false)
 useEffect(()=>{
  let active=true
  void loadChatImage(id).then(value=>{if(active)setImage(value)}).catch(()=>{}).finally(()=>{if(active)setLoaded(true)})
  return()=>{active=false}
 },[id])
 if(!loaded)return <p role="status">Carregando imagem…</p>
 if(!image)return <p>Imagem indisponível no armazenamento local.</p>
 const url=imageDataUrl(image)
 return <div className="chat-image">
  <img src={url} alt="Imagem gerada pelo Ophiuchus"/>
  <a className="image-save" href={url} download={`ophiuchus-${id.slice(0,8)}.${image.mimeType.split('/')[1]}`}><Download size={14}/> Salvar imagem</a>
 </div>
}
