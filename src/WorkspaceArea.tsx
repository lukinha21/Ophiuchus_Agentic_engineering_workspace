import {useId} from 'react'
import type {ReactNode} from 'react'
import {Files,History,ShieldCheck} from 'lucide-react'
export type WorkspaceView='files'|'history'|'tests'
export default function WorkspaceArea({view,onView,description,children}:{view:WorkspaceView;onView:(view:WorkspaceView)=>void;description:string;children:ReactNode}){
 const id=useId()
 return <section className="workspace-area" aria-label="Área de trabalho"><header><div><span className="v5-kicker">ÁREA DE TRABALHO</span><h2>Arquivos, histórico e validação</h2><p>{description}</p></div></header><div className="workspace-area-tabs" role="tablist" aria-label="Áreas da execução">{([{id:'files',name:'Arquivos',Icon:Files},{id:'history',name:'Histórico',Icon:History},{id:'tests',name:'Testes',Icon:ShieldCheck}] as const).map(item=><button key={item.id} id={id+'-'+item.id} type="button" role="tab" aria-selected={view===item.id} aria-controls={id+'-panel'} onClick={()=>onView(item.id)} onKeyDown={e=>{const order:WorkspaceView[]=['files','history','tests'];const at=order.indexOf(view);const next=e.key==='ArrowRight'?order[(at+1)%3]:e.key==='ArrowLeft'?order[(at+2)%3]:e.key==='Home'?'files':e.key==='End'?'tests':null;if(next){e.preventDefault();onView(next);document.getElementById(id+'-'+next)?.focus()}}}><item.Icon size={16}/>{item.name}</button>)}</div><div id={id+'-panel'} role="tabpanel" aria-labelledby={id+'-'+view} className="workspace-area-content">{children}</div></section>
}
