/// <reference types="vite/client" />
/** Development-only visual fixture. Every fetch is intercepted; no model or filesystem calls. */
import {createRoot} from 'react-dom/client'
import './styles.css'
import App from './App'
import type {ProjectFlowState} from './ProjectFlow'
if(!import.meta.env.DEV)throw Error('Prévia disponível somente no servidor de desenvolvimento')
const stages=[['orchestrator','Direção','Orquestrador'],['architect','Estrutura','Arquiteto'],['developer','Implementação','Desenvolvedor'],['reviewer','Revisão','Revisor'],['qa','Critérios','QA'],['documentation','Entrega','Documentação']]
const bindings=Object.fromEntries(stages.map(([id])=>[id,{providerId:'google',modelId:'modelo-simulado'}]))
const project={id:'preview-project',root:'Projeto demonstrativo / atlas',name:'atlas',files:[{path:'src/App.tsx',bytes:1480},{path:'src/components/Navigation.tsx',bytes:924},{path:'src/styles.css',bytes:2470},{path:'README.md',bytes:612},{path:'package.json',bytes:423}],warnings:[]}
const flowId='preview-flow',draftId='preview-draft'
let started=0,cancelled=false,applied=false
const text:Record<string,string>={orchestrator:'Simplificar a navegação preservando rotas existentes.\n\n1. Conferir os estados selecionados.\n2. Preparar ajuste visual independente.\n3. Verificar acessibilidade e comportamento em telas menores.',architect:'Manter as interfaces públicas. Alterar apenas o estado visual de Navigation.tsx. Usar elementos nativos e foco visível.',developer:'Preparada uma alteração compacta em src/components/Navigation.tsx. O estado atual fica mais fácil de identificar.',reviewer:'Estado ativo vinculado à rota atual. Identificadores e contratos preservados. Parecer estático favorável.',qa:'Critérios conferidos por leitura. Navegação por teclado e responsividade exigem testes no navegador. Nenhum teste foi executado.',documentation:'A navegação agora identifica a seção atual com um marcador discreto.\n\nA proposta está pronta para revisão. Os pareceres são estáticos; aplicação e testes continuam separados.'}
function flow():ProjectFlowState{
 const scenario=new URLSearchParams(location.search).get('state')
 const index=scenario==='review'?3:scenario==='blocked'?3:scenario==='ready'?6:Math.min(6,Math.floor((Date.now()-started)/1600))
 return {id:flowId,projectId:project.id,goal:'Simplifique a navegação do projeto e preserve os comportamentos existentes.',status:cancelled?'CANCELLED':scenario==='blocked'?'BLOCKED':index===6?'READY':'RUNNING',stage:stages[Math.min(index,5)][0],calls:Math.min(index+1,6),maxCalls:7,contextPaths:['src/App.tsx','src/components/Navigation.tsx'],draftId:index>=3?draftId:null,summary:index===6?text.documentation:'',error:cancelled?'Execução cancelada. Nenhuma alteração aplicada.':scenario==='blocked'?'Revisor solicitou ajustes: foco de teclado não está visível.':null,validation:index===6?'STATIC_ONLY':'NOT_EXECUTED',bindings,stages:stages.map(([id,label,name],i)=>({id,label,name,status:cancelled&&i===index?'CANCELLED':scenario==='blocked'&&i===3?'BLOCKED':i<index?'COMPLETED':i===index?'RUNNING':'QUEUED',text:i<index?text[id]:'',detail:i===index?'Conferindo contratos, estados e possíveis regressões':'',startedAt:i<=index?new Date().toISOString():null,endedAt:i<index?new Date().toISOString():null,usage:i<index?{total_tokens:940}:null}))}
}
const draft=()=>({id:draftId,workflowId:flowId,goal:'Simplifique a navegação.',summary:text.developer,status:applied?'APPLIED':'REVIEW_REQUIRED',contextPaths:['src/components/Navigation.tsx'],changes:[{path:'src/components/Navigation.tsx',before:'<a href="/projeto">Projeto</a>',content:'<a href="/projeto" aria-current="page">Projeto</a>',reason:'Expõe a página atual para tecnologias assistivas.',applied,diff:{tooLarge:false,lines:[{kind:'remove',text:'<a href="/projeto">Projeto</a>'},{kind:'add',text:'<a href="/projeto" aria-current="page">Projeto</a>'}]}}],test:null})
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:input.toString(),location.origin),path=url.pathname.replace(/^\/api/,'')
 let data:unknown={error:'Rota ausente na simulação'},status=200
 if(path==='/projects/picker/cancel')data={cancelled:true}
 else if(path==='/health')data={ok:true}
 else if(path==='/bindings')data=bindings
 else if(path==='/projects/pick'||path==='/projects/open'||path===`/projects/${project.id}`)data=project
 else if(path.endsWith('/tree'))data={files:project.files,warnings:[]}
 else if(path.endsWith('/file'))data={path:url.searchParams.get('path'),content:'// Arquivo demonstrativo. Nenhum arquivo real é lido.\nexport const currentPage = "projeto";'}
 else if(path.endsWith('/search'))data={hits:[{path:'src/components/Navigation.tsx',line:1,text:'Componente de navegação'}],truncated:false}
 else if(path.endsWith('/flows')&&init?.method==='POST'){started=Date.now();cancelled=false;data=flow()}
 else if(path.endsWith('/flows'))data=started?[flow()]:[]
 else if(path.endsWith('/cancel')){cancelled=true;data=flow()}
 else if(path.endsWith('/'+flowId))data=flow()
 else if(path.endsWith('/apply')){applied=true;data=draft()}
 else if(path.endsWith('/undo')){applied=false;data=draft()}
 else if(path.endsWith('/'+draftId))data=draft()
 else if(path==='/providers')data=[{id:'google',name:'Google Gemini (simulado)',configured:true}]
 else if(path==='/metrics')data={runs:0,success:0,blocked:0,calls:0,input:0,output:0,unknownUsage:0,models:[],runsDetail:[],trend:[],tests:0,testsPassed:0}
 else if(path==='/vault')data={exists:true,unlocked:false,configured:[]}
 else if(path.endsWith('/close'))data={closed:true}
 else status=400
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
}
localStorage.removeItem('ophiuchus.activeRun')
const banner=document.createElement('div');banner.className='studio-preview-banner';banner.textContent='PRÉVIA LOCAL / DADOS SIMULADOS / NENHUMA CHAMADA A MODELOS';document.body.prepend(banner)
const style=document.createElement('style');style.textContent='.studio-preview-banner{position:fixed;top:0;left:0;right:0;z-index:9999;height:26px;display:flex;align-items:center;justify-content:center;background:#ded9bb;color:#605f42;font:9px ui-monospace,monospace;letter-spacing:.1em}.ophi-studio{position:fixed;top:26px;left:0;right:0;bottom:0;height:calc(100dvh - 26px)!important}';document.head.append(style)
createRoot(document.getElementById('root')!).render(<App/> )
