import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Paperclip, Image as ImageIcon, MessageSquarePlus, Activity, BarChart3, Settings2, Zap, Square, ChevronDown, ChevronRight, Code2, ShieldCheck, FileText, BrainCircuit, Sparkles, CircleHelp, PanelRightOpen, Check, Clock3, ArrowUp, Workflow, Eye, RotateCcw, SlidersHorizontal, Cpu, ListTree, LayoutGrid, X, Terminal, MessageCircle, CircleDot, Search, Filter, Layers3, Gauge, Timer, GitBranch, ArrowRight, PanelLeftClose, FolderOpen, Bot, UserRound, Moon, Sun } from 'lucide-react'
import type { AgentDefinition, RunAgentState, RunEvent, RunSnapshot, TaskDefinition, AgentStatus } from './domain'
import { createTasks, defaultAgents } from './mockOrchestrator'
import { api, projectRun } from './runtimeClient'
import type { RuntimeRun } from './runtimeClient'
import Dashboard from './Dashboard'
import ImageStudio from './ImageStudio'
import ChatImage from './ChatImage'
import {defaultImageBinding,defaultPromptRefiner,imageProviders,imageIntent,isSupportedImage,sendChatImage} from './chatMedia'
import type {ImageBinding,MediaTurn} from './chatMedia'
import SettingsCenter from './SettingsCenter'
import {routeIntent} from './intentRouter'
import ClarificationOptions from './ClarificationOptions'
import ArtifactMarkdown from './ArtifactMarkdown'
import WorkspacePanel from './WorkspacePanel'
import WorkspaceArea from './WorkspaceArea'
import type {WorkspaceView} from './WorkspaceArea'
import ProjectPanel from './ProjectPanel'
import type {ProjectHandle,ProjectStatus} from './ProjectPanel'
import RuntimeFlow from './RuntimeFlow'
import ChatHistory,{historyKey,readChatHistory} from './ChatHistory'
import type {ArchivedChat,ChatSnapshot} from './ChatHistory'
import './workspace-v05.css'
import './workspace-v06.css'
import './workspace-v07.css'
import './studio.css'
import './studio-dark.css'
import './engineering.css'
import {BrandMark,ThemePicker,themes,readTheme} from './Appearance'
import type {ThemeId} from './Appearance'
import './appearance.css'
import './visual-system.css'

type Mode = 'focus' | 'engineering'
type Density = 'comfortable' | 'compact'
type Preferences = { mode:Mode; density:Density; sidebar:boolean; inspector:boolean; metrics:boolean; motion:boolean; activity:'summary'|'subtasks'|'debug' }
const defaults:Preferences={mode:'focus',density:'comfortable',sidebar:true,inspector:false,metrics:false,motion:true,activity:'summary'}
function readPrefs():Preferences { let saved=defaults;try{saved={...defaults,...JSON.parse(localStorage.getItem('ophiuchus.workspace.v05')||'{}')}}catch{}return window.innerWidth<760?{...saved,sidebar:false}:saved }
const icons = {ORCHESTRATOR:Sparkles,ARCHITECT:BrainCircuit,DEVELOPER:Code2,REVIEWER:Eye,QA:ShieldCheck,DOCUMENTATION:FileText}
const labels:Record<AgentStatus,string>={IDLE:'Disponível',QUEUED:'Aguardando',RUNNING:'Executando',WAITING_APPROVAL:'Aguardando aprovação',WAITING_DEPENDENCY:'Aguardando',SUCCESS:'Concluído',FAILED:'Falhou',CANCELLED:'Cancelado'}
const help={agents:'Agentes são especialistas com funções e modelos independentes. Selecione um agente para consultar suas tarefas.',console:'O console mostra o objetivo e a etapa ativa. Eventos técnicos ficam disponíveis no Inspector.',pipeline:'Progresso visual estimado durante a execução; 100% só após confirmação do runtime. O plano agrupa as tarefas principais. Abra uma tarefa para ver suas subtarefas e eventos.',metrics:'Tokens são informados pelo provedor quando disponíveis; Mock usa zero.',inspector:'O Inspector apresenta contexto, subtarefas e eventos da seleção atual.',modes:'Foco prioriza a conversa. Engenharia mostra mais detalhes operacionais. Você pode personalizar ambos.'}
function Tip({text}:{text:string}){return <span className="v5-tip" tabIndex={0} title={text} aria-label={text}><CircleHelp size={14}/></span>}
function StatusIcon({status}:{status:AgentStatus}){return status==='SUCCESS'?<Check size={13}/>:status==='RUNNING'?<span className="v5-spinner"/>:status==='QUEUED'?<Clock3 size={13}/>:<CircleDot size={12}/>}
export default function App(){
 const [theme,setTheme]=useState<ThemeId>(readTheme)
 const darkTheme=themes.find(t=>t.id===theme)!.dark
 const [reading,setReading]=useState(()=>{try{return localStorage.getItem('ophiuchus.reading')==='large'?'large':'normal'}catch{return 'normal'}})
 useEffect(()=>{try{localStorage.setItem('ophiuchus.reading',reading)}catch{}},[reading])
 useEffect(()=>{try{localStorage.setItem('ophiuchus.theme',theme)}catch{}document.documentElement.style.colorScheme=darkTheme?'dark':'light';},[theme])
 const [view,setView]=useState<'console'|'dashboard'|'settings'|'images'>(()=>new URLSearchParams(window.location.search).has('code')?'settings':'console')
 const [agents,setAgents]=useState<AgentDefinition[]>(defaultAgents)
 const [states,setStates]=useState<RunAgentState[]>(defaultAgents.map(a=>({agentId:a.id,status:'IDLE',currentTask:'Aguardando execução',lastEvent:'Sem atividade',progress:0})))
 const [tasks,setTasks]=useState<TaskDefinition[]>(createTasks())
 const [events,setEvents]=useState<RunEvent[]>([])
 const [prompt,setPrompt]=useState('')
 const [submittedPrompt,setSubmittedPrompt]=useState('')
 const [prefs,setPrefs]=useState<Preferences>(readPrefs)
 const [selectedTask,setSelectedTask]=useState<string|null>(null)
 const [selectedAgent,setSelectedAgent]=useState<string|null>(null)
 const projectRef=useRef<ProjectHandle>(null)
 const [projectStatus,setProjectStatus]=useState<ProjectStatus>({active:false,name:'',busy:false,canSend:false})
 const [projectSidebarHost,setProjectSidebarHost]=useState<HTMLElement|null>(null)
 const [projectInspectorHost,setProjectInspectorHost]=useState<HTMLElement|null>(null)
 const [projectWorkHost,setProjectWorkHost]=useState<HTMLDivElement|null>(null)

 const [showPreferences,setShowPreferences]=useState(false)
 const [showAllArtifacts,setShowAllArtifacts]=useState(false)
 const [workspaceView,setWorkspaceView]=useState<WorkspaceView>('files')
 const [showWorkspace,setShowWorkspace]=useState(()=>{try{return localStorage.getItem('ophiuchus.workspace.visible')!=='false'}catch{return true}})
 const [running,setRunning]=useState(false)
 const [runtimeRun,setRuntimeRun]=useState<RuntimeRun|null>(null)
 const [runtimeError,setRuntimeError]=useState('')
 const [executingAI,setExecutingAI]=useState(false)
 const [apiOnline,setApiOnline]=useState(false)
 const [showAllTasks,setShowAllTasks]=useState(false)
 const [engineeringFilter,setEngineeringFilter]=useState<'all'|'active'|'completed'>('all')
 const [engineeringSelection,setEngineeringSelection]=useState<string|null>(null)
 const uiEpoch=useRef(0)
 const [showHistory,setShowHistory]=useState(false)
 const [openingChat,setOpeningChat]=useState(false)
 const [historyError,setHistoryError]=useState('')
 const [history,setHistory]=useState(readChatHistory)
 const [storageError,setStorageError]=useState(false)
 const [plainChatId,setPlainChatId]=useState<string>(()=>crypto.randomUUID())
 const [projectChatId,setProjectChatId]=useState<string>()
 const saveChat=useCallback((snapshot:ChatSnapshot)=>{
  if(snapshot.project)setProjectChatId(snapshot.id)
  const first=snapshot.messages.find(message=>message.role==='user')
  if(!first)return
  const title=first.text.trim().replace(/\s+/g,' ').slice(0,85)
  const updatedAt=new Date().toISOString()
  setHistory(current=>current.deletedIds.includes(snapshot.id)?current:{
   ...current,chats:[{...snapshot,title,updatedAt},...current.chats.filter(chat=>chat.id!==snapshot.id)]
  })
 },[])
 const deleteChat=(id:string)=>setHistory(current=>({
  chats:current.chats.filter(chat=>chat.id!==id),
  deletedIds:current.deletedIds.includes(id)?current.deletedIds:[...current.deletedIds,id]
 }))
 useEffect(()=>{
  try{localStorage.setItem(historyKey,JSON.stringify(history));setStorageError(false)}
  catch{setStorageError(true)}
 },[history])
 const [imageGenerator,setImageGenerator]=useState(defaultImageBinding)
 useEffect(()=>{let active=true;void api<ImageBinding>('/image-settings').then(saved=>{if(active&&saved.modelId&&Object.hasOwn(imageProviders,saved.providerId))setImageGenerator(saved)}).catch(()=>{});return()=>{active=false}},[])
 const saveImageModel=async(binding:ImageBinding)=>{const saved=await api<ImageBinding>('/image-settings',binding,'PUT',AbortSignal.timeout(8000));setImageGenerator(saved)}
 const composerRef=useRef<HTMLTextAreaElement>(null)
 const imageInput=useRef<HTMLInputElement>(null)
 const [attachment,setAttachment]=useState<File|null>(null)
 const [attachmentError,setAttachmentError]=useState('')
 const acceptAttachment=(file:File|undefined)=>{
  if(!file)return
  const supported=isSupportedImage(file);setAttachment(supported?file:null)
  setAttachmentError(supported?'':'Escolha uma imagem PNG, JPEG ou WebP de até 4 MB.')
 }
 const clearAttachment=()=>{setAttachment(null);setAttachmentError('')}
 const chooseClarification=(value:string)=>{setPrompt(value);composerRef.current?.focus()}
 const [chat,setChat]=useState<Array<{role:'user'|'assistant';content:string;error?:boolean;mediaId?:string}>>([])
 const [submitting,setSubmitting]=useState(false)
 const [cancelling,setCancelling]=useState(false)
 const workspaceRef=useRef<HTMLDivElement>(null)
 const [panelSizes,setPanelSizes]=useState<{agents:number;inspector:number}>(()=>{try{return {...{agents:260,inspector:290},...JSON.parse(localStorage.getItem('ophiuchus.panels.v06')||'{}')}}catch{return {agents:260,inspector:290}}})
 const [narrow,setNarrow]=useState(()=>window.innerWidth<1350)
 useEffect(()=>{const onResize=()=>setNarrow(window.innerWidth<1350);window.addEventListener('resize',onResize);return ()=>window.removeEventListener('resize',onResize)},[])
 useEffect(()=>{localStorage.setItem('ophiuchus.panels.v06',JSON.stringify(panelSizes))},[panelSizes])
 const beginResize=(side:'agents'|'inspector',e:React.PointerEvent<HTMLDivElement>)=>{e.preventDefault();const root=workspaceRef.current;if(!root)return;const bounds=root.getBoundingClientRect();const startX=e.clientX;const initial=panelSizes[side];const onMove=(ev:PointerEvent)=>{const delta=ev.clientX-startX;const desired=side==='agents'?initial+delta:initial-delta;const max=side==='agents'?Math.min(410,bounds.width-(effectiveInspector&&!narrow?panelSizes.inspector:0)-390):Math.min(430,bounds.width-(prefs.sidebar?panelSizes.agents:0)-390);setPanelSizes(p=>({...p,[side]:Math.max(side==='agents'?190:250,Math.min(max,desired))}))};const onUp=()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);document.body.style.cursor='';document.body.style.userSelect=''};document.body.style.cursor='col-resize';document.body.style.userSelect='none';window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp)}
 useEffect(()=>{localStorage.setItem('ophiuchus.workspace.v05',JSON.stringify(prefs))},[prefs])
 useEffect(()=>{localStorage.setItem('ophiuchus.workspace.visible',String(showWorkspace))},[showWorkspace])
 const setPref=<K extends keyof Preferences>(key:K,value:Preferences[K])=>setPrefs(p=>({...p,[key]:value}))
 const selectedTaskData=tasks.find(t=>t.id===selectedTask)
 const selectedAgentData=agents.find(a=>a.id===selectedAgent)
 const activeTask=tasks.find(t=>t.status==='RUNNING')??(events.some(e=>e.type==='run.completed')?[...tasks].reverse().find(t=>t.status==='SUCCESS'):tasks.find(t=>t.status==='QUEUED'))??tasks[0]
 const activeAgent=agents.find(a=>a.id===activeTask.agentId)??agents[0]
 const currentSub=activeTask.subtasks.find(s=>s.status==='RUNNING')
 const completed=tasks.filter(t=>t.status==='SUCCESS').length
 const finished=events.some(e=>e.type==='run.completed')
 const cancelled=events.some(e=>e.type==='run.cancelled')
 const eventList=useMemo(()=>events.filter(e=>selectedTask?e.taskId===selectedTask:selectedAgent?e.agentId===selectedAgent:true),[events,selectedTask,selectedAgent])
 const chooseTask=(id:string)=>{setPref('mode','engineering');setSelectedTask(id);setSelectedAgent(null);setPref('inspector',true)}
 const chooseAgent=(id:string)=>{setSelectedAgent(id);setSelectedTask(null);setPref('inspector',true)}
 const applyRuntime=(run:RuntimeRun)=>{if(localStorage.getItem('ophiuchus.activeRun')!==run.id)return;setRuntimeRun(run);const projected=projectRun(run);setTasks(projected.tasks);setStates(projected.states);setEvents(projected.events);setRunning(run.status==='RUNNING'&&run.sequence?.status!=='PAUSED');setSubmittedPrompt(run.prompt)}
 useEffect(()=>{api<Record<string,{providerId:string;modelId:string}>>('/bindings').then(saved=>setAgents(old=>old.map(a=>saved[a.id]?{...a,modelBinding:{...a.modelBinding,...saved[a.id],mode:'FIXED'}}:a))).catch(()=>{});},[])
 useEffect(()=>{let alive=true;const poll=async()=>{try{const health=await api<{ok:boolean}>('/health');if(alive)setApiOnline(health.ok);const id=localStorage.getItem('ophiuchus.activeRun');if(id){const run=await api<RuntimeRun>(`/runs/${id}`);if(alive&&localStorage.getItem('ophiuchus.activeRun')===id)applyRuntime(run)}}catch{if(alive)setApiOnline(false)}};void poll();const interval=setInterval(()=>void poll(),1200);return()=>{alive=false;clearInterval(interval)}},[])
 const developerModel=agents.find(agent=>agent.enabled&&agent.role==='DEVELOPER')?.modelBinding
 const imageRefiner=developerModel?.providerId&&developerModel.providerId!=='mock'&&developerModel.modelId?developerModel:defaultPromptRefiner
 const start=async()=>{
 const sentText=prompt.trim()
 if((!sentText&&!attachment)||openingChat||running||submitting||cancelling||projectStatus.busy||(projectStatus.active&&!projectStatus.canSend))return
 const intent=attachment?null:imageIntent(sentText)
 if(attachment||intent){
  const file=attachment
  const request=sentText||'Descreva esta imagem.'
  const visible=file?request+'\n\nImagem anexada: '+file.name:request
  const job=():Promise<MediaTurn>=>intent?.kind==='clarify'?Promise.resolve({text:'O que você quer que apareça na imagem? Descreva a cena ou o assunto.'}):sendChatImage(request,file,file?'analyse':intent?.kind==='generate'?intent.mode:'direct',imageGenerator,imageRefiner)
  setSubmitting(true);setPrompt('');clearAttachment()
  try{
   if(projectStatus.active){await projectRef.current?.submitMedia(visible,job);return}
   setChat(turns=>[...turns,{role:'user',content:visible}])
   const result=await job()
   setChat(turns=>[...turns,{role:'assistant',content:result.text,mediaId:result.mediaId}])
  }catch(error){setChat(turns=>[...turns,{role:'assistant',content:(error as Error).message,error:true}])}
  finally{setSubmitting(false)}
  return
 }
 if(projectStatus.active){if(!prompt.trim()||openingChat||submitting||projectStatus.busy||!projectStatus.canSend)return;const sent=prompt.trim();setPrompt('');setSubmitting(true);try{await projectRef.current?.submit(sent)}finally{setSubmitting(false)}return;}if(!prompt.trim()||openingChat||running||submitting||cancelling)return;const sent=prompt.trim();const epoch=++uiEpoch.current;setRuntimeError('');setSubmitting(true);try{const history=[...(runtimeRun?[{role:'user' as const,content:runtimeRun.prompt}]:[]),...chat.filter(turn=>!turn.error)].slice(-6).map(({role,content})=>({role,content}));const binding=agents.find(agent=>agent.enabled&&agent.role==='DEVELOPER')?.modelBinding;const intent=routeIntent(sent,history,new Date(),binding);
 if(intent.kind!=='engineering'){
  setChat(turns=>[...turns,{role:'user',content:sent}]);setPrompt(current=>current.trim()===sent?'':current);
  try{
   let answer:string
   if(intent.kind==='direct')answer=(await api<{answer:string}>('/chat/direct',{prompt:sent,history,binding,confirmSend:true},undefined,AbortSignal.timeout(95000))).answer
   else if(intent.kind==='uncertain'&&binding?.providerId&&binding.providerId!=='mock'&&binding.modelId){
    answer=(await api<{answer:string}>('/chat/direct',{prompt:sent,history,binding,confirmSend:true,resolveIntent:true},undefined,AbortSignal.timeout(23000)).catch(()=>null))?.answer||intent.answer
   }else answer=intent.answer
   if(epoch===uiEpoch.current)setChat(turns=>[...turns,{role:'assistant',content:answer}]);
  }catch(e){if(epoch===uiEpoch.current)setChat(turns=>[...turns,{role:'assistant',content:(e as Error).message,error:true}]);}
  return;
 }
 const run=await api<RuntimeRun>('/runs',{prompt:sent,agents,confirmSend:true});if(epoch!==uiEpoch.current)return;localStorage.setItem('ophiuchus.activeRun',run.id);setSelectedTask(null);setSelectedAgent(null);setShowAllArtifacts(false);setPrompt(current=>current.trim()===sent?'':current);applyRuntime(run)}catch(e){if(epoch===uiEpoch.current)setRuntimeError((e as Error).message)}finally{if(epoch===uiEpoch.current)setSubmitting(false)}}
 const runtimeAction=async(action:string,body:object={})=>{if(!runtimeRun||executingAI||cancelling)return;const epoch=uiEpoch.current;setRuntimeError('');if(action==='execute'||action==='continue')setExecutingAI(true);try{const run=await api<RuntimeRun>(`/runs/${runtimeRun.id}/${action}`,body);if(epoch===uiEpoch.current)applyRuntime(run)}catch(e){if(epoch===uiEpoch.current)setRuntimeError((e as Error).message)}finally{if(epoch===uiEpoch.current)setExecutingAI(false)}}
 useEffect(()=>{
  saveChat({id:plainChatId,messages:chat.map(turn=>({role:turn.role,text:turn.content,error:turn.error,mediaId:turn.mediaId}))})
 },[chat,plainChatId,saveChat])
 const activeRunId=runtimeRun?.id
 const activeRunPrompt=runtimeRun?.prompt
 const activeRunStatus=runtimeRun?.sequence?.status==='PAUSED'?'FAILED':runtimeRun?.status
 const activeRunActivity=runtimeRun?.events.at(-1)?.id
 useEffect(()=>{
  if(activeRunId&&activeRunPrompt)saveChat({id:activeRunId,messages:[{role:'user',text:activeRunPrompt}],runId:activeRunId,runStatus:activeRunStatus})
 },[activeRunId,activeRunPrompt,activeRunStatus,activeRunActivity,saveChat])
 const clear=()=>{clearAttachment();setPlainChatId(crypto.randomUUID());setChat([]);uiEpoch.current++;localStorage.removeItem('ophiuchus.activeRun');setRuntimeRun(null);setRunning(false);setTasks(createTasks());setEvents([]);setSubmittedPrompt('');setPrompt('');setRuntimeError('');setExecutingAI(false);setSubmitting(false);setSelectedTask(null);setSelectedAgent(null);setShowAllArtifacts(false);setShowAllTasks(false);setShowWorkspace(true);setWorkspaceView('files');setEngineeringSelection(null);setEngineeringFilter('all');setPref('inspector',false);setView('console');setStates(agents.map(a=>({agentId:a.id,status:'IDLE',currentTask:'Aguardando execução',lastEvent:'Sem atividade',progress:0})))}
 const switchBusy=openingChat||submitting||cancelling||executingAI||projectStatus.busy
 const openArchivedChat=async(saved:ArchivedChat)=>{
  if(switchBusy||running)return
  if(saved.project&&projectStatus.active&&saved.id===projectChatId)return
  if(!saved.project&&!saved.runId&&!projectStatus.active&&saved.id===plainChatId)return
  if(saved.runId&&saved.runId===activeRunId)return
  setOpeningChat(true);setHistoryError('')
  try{
   const run=saved.runId?await api<RuntimeRun>(`/runs/${saved.runId}`):null
   await projectRef.current?.openChat(saved.project?saved:null)
   clear()
   setProjectChatId(saved.project?saved.id:undefined)
   if(run){localStorage.setItem('ophiuchus.activeRun',run.id);applyRuntime(run)}
   else if(!saved.project){
    setPlainChatId(saved.id)
    setChat(saved.messages.map(message=>({role:message.role,content:message.text,error:message.error,mediaId:message.mediaId})))
   }
  }catch(e){setHistoryError((e as Error).message)}
  finally{setOpeningChat(false)}
 }
 const stop=async()=>{if(!runtimeRun||cancelling)return;const id=runtimeRun.id;setCancelling(true);setRuntimeError('');try{await api(`/runs/${id}/cancel`,{});saveChat({id,messages:[{role:'user',text:runtimeRun.prompt}],runId:id,runStatus:'CANCELLED'});clear()}catch(e){setRuntimeError('Não foi possível cancelar: '+(e as Error).message)}finally{setCancelling(false)}}
 useEffect(()=>{if(!runtimeRun||!running)return;const id=setInterval(()=>{const p=projectRun(runtimeRun);setTasks(p.tasks);setStates(p.states)},600);return()=>clearInterval(id)},[runtimeRun,running])
 const previousProject=useRef(false)
 useEffect(()=>{if(previousProject.current!==projectStatus.active){if(projectStatus.active)clear();else setPrompt('');previousProject.current=projectStatus.active}},[projectStatus.active])
 const updateBinding=(id:string,providerId:string,modelId:string)=>{const next=agents.map(a=>a.id===id?{...a,modelBinding:{...a.modelBinding,providerId,modelId,mode:'FIXED' as const}}:a);setAgents(next);const payload=Object.fromEntries(next.map(a=>[a.id,{providerId:a.modelBinding.providerId,modelId:a.modelBinding.modelId}]));void api('/bindings',payload,'PUT').catch(e=>setRuntimeError('Não foi possível salvar bindings: '+e.message));}
 const visibleTasks=prefs.mode==='focus'&&!showAllTasks?tasks.filter(t=>t.status==='RUNNING'||t.status==='SUCCESS').slice(-3):tasks
 const effectiveInspector=prefs.mode==='engineering'&&prefs.inspector
 useEffect(()=>{if(projectStatus.active&&prefs.mode==='engineering')setPrefs(p=>p.inspector?p:{...p,inspector:true})},[projectStatus.active,prefs.mode])
 return <div className={`ophi-studio ${darkTheme?'theme-dark':''} theme-${theme} text-${reading} ${projectStatus.active?'has-project':''} v5-app v5-${prefs.mode} v5-${prefs.density} ${prefs.motion?'':'v5-reduced'}`}>
  <aside className="v5-dock" aria-label="Navegação"><div className="v5-logo" title="Ophiuchus"><BrandMark/></div>
   <button title="Console" aria-label="Console" className={view==='console'?'active':''} onClick={()=>setView('console')}><MessageCircle size={20}/></button>
   <button title="Histórico de conversas" aria-label="Histórico de conversas" aria-expanded={showHistory&&view==='console'} className={showHistory&&view==='console'?'active':''} onClick={()=>{setShowHistory(view!=='console'||!showHistory);setView('console')}}><Clock3 size={20}/></button>
   <button title="Chat de imagens" aria-label="Chat de imagens" className={view==='images'?'active':''} onClick={()=>setView('images')}><ImageIcon size={20}/></button>
   <button title="Dashboard" aria-label="Dashboard" className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}><BarChart3 size={20}/></button>
   <button title="Provedores e agentes" aria-label="Configurações de provedores" className={view==='settings'?'active':''} onClick={()=>setView('settings')}><Settings2 size={20}/></button>
   <button title="Arquivos do projeto" aria-label="Arquivos do projeto" className={!showHistory&&prefs.sidebar&&view==='console'?'active':''} onClick={()=>{setView('console');setShowHistory(false);setPref('sidebar',showHistory||!prefs.sidebar)}}><FolderOpen size={20}/></button><div className="v5-dock-spacer"/><button title="Preferências visuais" aria-label="Preferências visuais" onClick={()=>setShowPreferences(true)}><SlidersHorizontal size={20}/></button>
  </aside>
  <div className="v5-body"><header className="v5-topbar"><div className="v5-wordmark"><strong>ophiuchus<span> /</span></strong><small>ESTÚDIO DE ENGENHARIA</small></div>
   <div className="v5-tabs"><button className={view==='console'?'active':''} onClick={()=>setView('console')}><MessageCircle size={15}/> Console</button><button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}><BarChart3 size={15}/> Dashboard</button><button className={view==='settings'?'active':''} onClick={()=>setView('settings')}><Settings2 size={15}/> Provedores</button></div>
   <div className="v5-live"><span className={`v5-led ${running?'pulse':''}`}/>{projectStatus.busy?'Trabalhando no projeto':projectStatus.active?projectStatus.name:running?'Execução em tempo real':finished?'Execução concluída':cancelled?'Execução cancelada':'Sistema pronto'}</div>
   <div className="v5-top-actions">{view==='console'&&<><button className="v5-mode-toggle" title={help.modes} onClick={()=>setPref('mode',prefs.mode==='focus'?'engineering':'focus')}><LayoutGrid size={15}/>{prefs.mode==='focus'?'Modo Foco':'Modo Engenharia'}</button></>}</div>
  </header>
  <div className="v5-page" style={{display:view==='images'?undefined:'none'}}><ImageStudio configuredGenerator={imageGenerator} refiner={imageRefiner}/></div>
  {view==='images'?null:view==='dashboard'?<div className="v5-page"><Dashboard onGoConsole={()=>setView('console')}/></div>:view==='settings'?<div className="v5-page"><SettingsCenter agents={agents} imageGenerator={imageGenerator} onSaveImageModel={saveImageModel} onUpdate={updateBinding} onBack={()=>setView('console')}/></div>:<div ref={workspaceRef} style={{'--v6-agents':`${panelSizes.agents}px`,'--v6-inspector':`${panelSizes.inspector}px`} as React.CSSProperties} className={`v5-workspace v6-workspace ${!prefs.sidebar&&!showHistory?'no-rail':''} ${effectiveInspector?'with-inspector':''} ${narrow?'v6-narrow':''}`}>
   {showHistory?<aside className="v5-project-sidebar history-panel">
    <ChatHistory chats={history.chats} onDelete={deleteChat} busy={switchBusy||running} onOpen={entry=>void openArchivedChat(entry)}
     activeIds={[projectChatId||'',activeRunId||'']} currentId={projectStatus.active?projectChatId:activeRunId||plainChatId} storageError={storageError}/>
    {historyError&&<p role="alert" className="history-error">{historyError}</p>}
   </aside>:prefs.sidebar&&<aside className="v5-project-sidebar" ref={setProjectSidebarHost}/>}
   {(prefs.sidebar||showHistory)&&!narrow&&<div className="v6-resizer v6-resizer-left" role="separator" aria-orientation="vertical" aria-label="Redimensionar explorador de arquivos" title="Arraste para redimensionar o explorador" onPointerDown={e=>beginResize('agents',e)}/>}
   <section className="v5-center"><div className="v5-console-head"><div className="v5-console-heading"><span className="v5-kicker"><Sparkles size={13}/> CONTEXTO → CONSTRUÇÃO</span><h1>{projectStatus.active?'Trabalho em movimento.':'Dê forma ao próximo passo.'}</h1><p>Uma equipe, um projeto. Cada decisão deixa um registro.</p></div><div className="v5-console-tools">{!projectStatus.active&&<button className="workspace-new-chat" disabled={submitting||cancelling||executingAI||Boolean(runtimeRun?.status==='WAITING_APPROVAL'||running)} title={runtimeRun?.status==='WAITING_APPROVAL'||running?'Conclua ou cancele a execução atual antes de abrir outro chat':'Iniciar uma conversa vazia; as execuções anteriores continuam salvas'} onClick={clear}><MessageSquarePlus size={16}/> Novo chat</button>}<span className="v5-demo-pill">RUNTIME LOCAL</span><Tip text={help.console}/>{running&&<button className="v5-stop" onClick={stop}><Square size={12}/> Parar</button>}</div></div>
    <div hidden={!projectStatus.active} className="project-conversation v5-conversation"><div ref={setProjectWorkHost}/></div>
    {!projectStatus.active&&!runtimeRun&&!chat.length&&<section className="studio-start"><div className="studio-start-rule"><span>SEU PRÓXIMO PROJETO</span><span>01 — 06</span></div><h2>Boas ideias precisam<br/>de um lugar para acontecer.</h2><p>Traga os arquivos que você já tem ou descreva algo novo.<br/>A equipe cuida do caminho. Você mantém a direção.</p><button onClick={()=>void projectRef.current?.openFolder()}><FolderOpen size={16}/> Abrir um projeto <ArrowUp size={15}/></button><div className="studio-start-steps"><span>01 <b>Defina</b></span><span>02 <b>Construa</b></span><span>03 <b>Confira</b></span></div></section>}
    {!projectStatus.active&&chat.length>0&&<div className="v5-conversation" aria-live="polite">{chat.map((turn,index)=><div key={index} className={`v5-chat-line ${turn.role}`}><div className="project-message"><span className="v5-chat-by">{turn.role==='user'?'Você':'Ophiuchus'}</span><ArtifactMarkdown text={turn.content}/>{turn.mediaId&&<ChatImage key={turn.mediaId} id={turn.mediaId}/>}{turn.role==='assistant'&&index===chat.length-1&&<ClarificationOptions answer={turn.content} onChoose={chooseClarification}/>}</div></div>)}</div>}
    {!projectStatus.active&&!runtimeRun&&runtimeError&&<p role="alert" className="runtime-error">{runtimeError}</p>}
    <div className="legacy-console-flow" hidden={projectStatus.active||!runtimeRun}>
    <div className="v5-conversation"><div className="v5-chat-line user"><div className="v5-chat-avatar user"><UserRound size={22}/></div><div className="project-message"><span className="v5-chat-by">Você</span><ArtifactMarkdown text={submittedPrompt}/></div></div></div>
    {runtimeRun&&<RuntimeFlow run={runtimeRun} engineering={prefs.mode==='engineering'} onInspect={chooseTask} onCancel={()=>void stop()}/>}
    <div className="runtime-control" role="region" aria-label="Controles do Orquestrador"><div className="runtime-control-head"><span className={apiOnline?'online':'offline'}>● {apiOnline?'API local conectada':'API desconectada'}</span>{runtimeRun&&<span>Run {runtimeRun.id.slice(0,8)} · {runtimeRun.stage} · {runtimeRun.sequence?.status==='PAUSED'&&runtimeRun.status==='RUNNING'?'PAUSED':runtimeRun.status} · {runtimeRun.corrections} correções</span>}</div>{runtimeError&&<p className="runtime-error">{runtimeError}</p>}{runtimeRun?.sequence?.error&&<p className="runtime-error">{runtimeRun.sequence.error}</p>}{runtimeRun&&<div className="runtime-actions">{runtimeRun.status==='RUNNING'&&<>{runtimeRun.sequence?.status==='RUNNING'?<span role="status">A equipe está trabalhando. As validações seguem suas preferências.</span>:<button disabled={executingAI} onClick={()=>void runtimeAction('continue',{confirmSend:true})}>{executingAI?'Retomando…':'Retomar execução'}</button>}<button disabled={cancelling} onClick={()=>void stop()}>Cancelar execução</button></>}{runtimeRun.status==='WAITING_APPROVAL'&&<><strong>Validação: {runtimeRun.approval?.kind==='specification_review'?'Especificação':'Entrega'}</strong><button disabled={runtimeRun.sequence?.status==='RUNNING'} onClick={()=>void runtimeAction('approve',{accepted:true})}>Aprovar e continuar</button><button disabled={runtimeRun.sequence?.status==='RUNNING'} onClick={()=>void runtimeAction('approve',{accepted:false})}>Rejeitar</button></>}{['BLOCKED','CANCELLED','SUCCESS'].includes(runtimeRun.status)&&<span>Execução encerrada. Inicie outra run para continuar.</span>}</div>}{runtimeRun?.filePlan&&!runtimeRun.filePlan.complete&&<p>Implementação por arquivo: {runtimeRun.filePlan.accepted.length}/{runtimeRun.filePlan.paths.length} preservados por verificações locais. Próximo: {runtimeRun.filePlan.paths.find(path=>!runtimeRun.filePlan?.accepted.some(f=>f.path===path))}. Compilação ainda não comprovada.</p>}{runtimeRun?.pendingDraft&&<div className="runtime-draft"><strong>Resposta interrompida em {runtimeRun.pendingDraft.stage}</strong><p>Limite de tokens atingido. {runtimeRun.pendingDraft.attempts} geração(ões). Clique em Retomar execução para continuar sem perder o texto já produzido. A continuação pode consumir mais tokens.</p><details><summary>Visualizar rascunho incompleto</summary><ArtifactMarkdown text={runtimeRun.pendingDraft.text}/></details><button disabled={executingAI} onClick={()=>void runtimeAction('discard-draft')}>Descartar rascunho</button></div>}<small>A equipe avança automaticamente. Os checkpoints seguem o nível de autonomia salvo nesta execução. Gravação e testes continuam com autorização própria.</small></div>
    {runtimeRun&&<div className="ophi-workspace-toggle"><button type="button" aria-expanded={showWorkspace} onClick={()=>setShowWorkspace(x=>!x)}><FolderOpen size={16}/>{showWorkspace?"Ocultar área de trabalho":"Mostrar área de trabalho"}<ChevronDown size={15} className={showWorkspace?"ophi-chevron-open":""}/></button><span>{runtimeRun.autoPilot?.status==='RUNNING'?'Ciclo assistido em execução · ':''}Arquivos e testes disponíveis sob demanda</span></div>}
    {runtimeRun&&showWorkspace&&<WorkspaceArea view={workspaceView} onView={setWorkspaceView} description="Arquivos gerados nesta execução. Gravações e testes mantêm suas autorizações próprias."><div hidden={workspaceView!=='history'}>{runtimeRun?.artifacts?.length? <div className="runtime-artifacts ow-artifacts"><div className="ow-artifacts-title"><div><span>HISTÓRICO DE GERAÇÃO</span><strong>Artefatos dos agentes</strong></div><b>{runtimeRun.artifacts.length} documentos</b></div><div className="ow-artifact-history-controls"><small>Mostrando {showAllArtifacts?runtimeRun.artifacts.length:Math.min(4,runtimeRun.artifacts.length)} de {runtimeRun.artifacts.length} documentos · mais recentes primeiro</small>{runtimeRun.artifacts.length>4&&<button type="button" aria-expanded={showAllArtifacts} aria-controls="artifact-history-list" onClick={()=>setShowAllArtifacts(value=>!value)}>{showAllArtifacts?'Mostrar somente os 4 recentes':`Mostrar todos (${runtimeRun.artifacts.length})`}</button>}</div><div id="artifact-history-list">{[...runtimeRun.artifacts].reverse().slice(0,showAllArtifacts?undefined:4).map(a=><details key={a.id}><summary><span className="ow-artifact-stage">{a.stage}</span><span className="ow-artifact-model">{a.providerId}/{a.model}</span><span className="ow-artifact-tokens">{a.usage?.total_tokens??'—'} tokens</span></summary><div className="artifact-content" tabIndex={0} aria-label="Conteúdo do artefato"><div className="artifact-meta">{a.integrity==='complete'?'Resposta concluída':a.integrity==='unverified'?'Conclusão não verificada':a.integrity==='invalid'?'Arquivos rejeitados por integridade':a.integrity==='invalid_response'?'Parecer inválido — preservado para diagnóstico':a.integrity==='partial'?'Arquivo preservado — implementação em andamento':'Artefato anterior'} · entrada {a.usage?.prompt_tokens??'—'} / saída {a.usage?.completion_tokens??'—'} tokens · término {a.finishReason??'não informado'} · continuações {a.continuations??0}</div><small>{a.providerId==='local'?'Relatório local baseado em evidências registradas.':'Conteúdo gerado por IA. Alegações neste texto não comprovam compilação ou execução; consulte a validação do runtime.'}</small><ArtifactMarkdown text={a.text}/></div></details>)}</div></div>:null}{!runtimeRun.artifacts?.length&&<p className="workspace-empty">Os resultados dos agentes aparecerão aqui.</p>}</div><div hidden={workspaceView==='history'}><WorkspacePanel section={workspaceView==='tests'?'tests':'files'} runId={runtimeRun.id} artifactCount={runtimeRun.artifacts?.length??0}/></div></WorkspaceArea>}
    {prefs.metrics&&<div className="v5-quick-metrics"><div><span><Cpu size={15}/> Tokens</span><strong>{runtimeRun?.artifacts?.reduce((sum,a)=>sum+(a.usage?.total_tokens??0),0)??0}</strong><small>{runtimeRun?.artifacts?.some(a=>a.providerId!=='mock')?'Uso informado pelo provedor':runtimeRun?.artifacts?.length?'Mock · zero tokens':'Aguardando execução'}</small></div><div><span><Activity size={15}/> Eventos</span><strong>{events.length}</strong><small>{runtimeRun?'Eventos da run real':'Prévia local'}</small></div><div><span><Check size={15}/> Tarefas</span><strong>{completed}/{tasks.length}</strong><small>Concluídas</small></div><Tip text={help.metrics}/></div>}
    </div>
    <div className="v5-composer"><input ref={imageInput} type="file" aria-label="Arquivo de imagem" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{acceptAttachment(event.target.files?.[0]);event.target.value=''}}/>
    {attachment&&<div className="chat-attachment"><Paperclip size={14}/><span>{attachment.name} · será enviada ao Gemini</span><button type="button" aria-label="Remover imagem anexada" onClick={clearAttachment}><X size={15}/></button></div>}
    {attachmentError&&<p role="alert" className="chat-attachment">{attachmentError}</p>}
    <textarea ref={composerRef} aria-label="Sua solicitação" value={prompt} onPaste={event=>{const file=[...event.clipboardData.files].find(item=>item.type.startsWith('image/'));if(file&&!submitting&&!running&&!projectStatus.busy){event.preventDefault();acceptAttachment(file)}}} onChange={e=>setPrompt(e.target.value)} placeholder={projectStatus.active?`O que deseja fazer em ${projectStatus.name}?`:'Descreva o que deseja construir...'}/><div className="v5-composer-bottom"><div><button type="button" title="Anexar imagem" aria-label="Anexar imagem" disabled={submitting||running||projectStatus.busy} onClick={()=>imageInput.current?.click()}><Paperclip size={17}/></button><button title="Configurar modelos" onClick={()=>setView('settings')}><Settings2 size={17}/></button><span>{imageIntent(prompt)?.kind==='generate'&&!attachment?'Geração com '+imageProviders[imageGenerator.providerId]+(imageIntent(prompt)?.mode==='assisted'?' · refinamento com '+imageRefiner.providerId:''):projectStatus.active?'Projeto aberto · contexto e mudanças supervisionadas':'Respostas locais, IA ou equipe conforme o pedido · chamadas de IA podem gerar custo'}</span></div><button className="v5-send" onClick={start} disabled={openingChat||running||submitting||cancelling||projectStatus.busy||(projectStatus.active&&!projectStatus.canSend)||(!prompt.trim()&&!attachment)} title={attachment?'Enviar imagem ao Google Gemini':projectStatus.active?'Enviar pedido ao projeto aberto':'Enviar pedido'}>{running||submitting?<span className="v5-spinner"/>:<ArrowUp size={19}/>}</button></div></div>
   </section>
   {effectiveInspector&&!narrow&&<div className="v6-resizer v6-resizer-right" role="separator" aria-orientation="vertical" aria-label="Redimensionar Inspector" title="Arraste para redimensionar o Inspector" onPointerDown={e=>beginResize('inspector',e)}/>}
   {effectiveInspector&&(projectStatus.active?<aside className="v5-inspector project-engineering-inspector" ref={setProjectInspectorHost}/>:<aside className="v5-inspector"><div className="v5-inspector-top"><div><span className="v5-kicker">INSPECTOR <Tip text={help.inspector}/></span><h3>{selectedTaskData?.title??selectedAgentData?.name??'Detalhes'}</h3></div><button title="Fechar Inspector" onClick={()=>{setSelectedTask(null);setSelectedAgent(null);setPref('inspector',false)}}><X size={18}/></button></div>{selectedTaskData?<><div className="v5-inspector-status"><StatusIcon status={selectedTaskData.status}/>{labels[selectedTaskData.status]} · {selectedTaskData.progress}%</div><div className="v5-inspector-section"><h4>Responsável</h4><p>{agents.find(a=>a.id===selectedTaskData.agentId)?.name}</p><small>{agents.find(a=>a.id===selectedTaskData.agentId)?.modelBinding.modelId}</small></div><div className="v5-inspector-section"><h4>Subtarefas</h4>{selectedTaskData.subtasks.map(s=><div className="v5-inspector-sub" key={s.id}><StatusIcon status={s.status}/><span>{s.title}<small>{s.eventCount} eventos · {s.progress}%{runtimeRun?.subtasks?.[s.id]?' · Evidência documental (não verificada)':''}</small></span></div>)}</div></>:selectedAgentData?<><div className="v5-inspector-status"><StatusIcon status={states.find(s=>s.agentId===selectedAgentData.id)?.status??'IDLE'}/>{labels[states.find(s=>s.agentId===selectedAgentData.id)?.status??'IDLE']}</div><div className="v5-inspector-section"><h4>Especialidade</h4><p>{selectedAgentData.description}</p></div><div className="v5-inspector-section"><h4>Modelo fixo</h4><p>{selectedAgentData.modelBinding.providerId} / {selectedAgentData.modelBinding.modelId}</p><button className="v5-text-action" onClick={()=>setView('settings')}>Alterar binding <ChevronRight size={13}/></button></div></>:<div className="v5-inspector-section">Selecione uma tarefa ou agente para inspecionar.</div>}
   <div className="v5-inspector-section"><h4><Terminal size={14}/> Diagnóstico</h4><small>Eventos registrados pelo backend. Associação documental não significa execução independente.</small><div className="v5-debug-list">{eventList.length?eventList.slice(-35).reverse().map(e=><div className="v5-debug-event" key={e.id}><time>{new Date(e.at).toLocaleTimeString('pt-BR')}</time><strong>{e.type}</strong><p>{e.message}</p></div>):<p className="v5-empty">Nenhum evento nesta seleção.</p>}</div></div></aside>)}
   {!effectiveInspector&&prefs.mode==='engineering'&&<button className="v5-inspector-open" title="Abrir Inspector" onClick={()=>setPref('inspector',true)}><PanelRightOpen size={17}/></button>}
  </div>}
  </div>
  <ProjectPanel ref={projectRef} onArchive={saveChat} onClarification={chooseClarification} onExplorer={()=>{setShowHistory(false);setPref('sidebar',true)}} agents={agents} engineering={prefs.mode==='engineering'} inspectorTarget={projectInspectorHost} onInspect={()=>setPref('inspector',true)} onCloseInspector={()=>setPref('inspector',false)} onSettings={()=>setView('settings')} sidebarTarget={projectSidebarHost} workTarget={projectWorkHost} onStatus={setProjectStatus} onNewChat={()=>{setPrompt('');clearAttachment()}} disabled={running||submitting}/>

  {showPreferences&&<div className="v5-overlay" onMouseDown={()=>setShowPreferences(false)}><motion.div className="v5-preferences" initial={{x:40,opacity:0}} animate={{x:0,opacity:1}} onMouseDown={e=>e.stopPropagation()}><div className="v5-preferences-head"><div><span className="v5-kicker">PERSONALIZAÇÃO</span><h2>Seu workspace, seu jeito.</h2><p>As preferências são salvas neste navegador.</p></div><button onClick={()=>setShowPreferences(false)} aria-label="Fechar"><X size={20}/></button></div><div className="v5-pref-section"><h3>Modo de trabalho <Tip text={help.modes}/></h3><div className="v5-mode-cards"><button className={prefs.mode==='focus'?'selected':''} onClick={()=>setPref('mode','focus')}><Sparkles size={20}/><strong>Foco</strong><small>Conversa e tarefa atual</small></button><button className={prefs.mode==='engineering'?'selected':''} onClick={()=>setPref('mode','engineering')}><Workflow size={20}/><strong>Engenharia</strong><small>Plano e detalhes</small></button></div></div><div className="v5-pref-section"><h3>Tema de cores</h3><ThemePicker value={theme} onChange={setTheme}/></div><div className="v5-pref-section"><h3>Tamanho do texto</h3><div className="v5-segment"><button aria-pressed={reading==='normal'} className={reading==='normal'?'selected':''} onClick={()=>setReading('normal')}>Padrão legível</button><button aria-pressed={reading==='large'} className={reading==='large'?'selected':''} onClick={()=>setReading('large')}>Ampliado</button></div><p>O tamanho das letras é independente do espaçamento compacto.</p></div><div className="v5-pref-section"><h3>Densidade</h3><div className="v5-segment"><button className={prefs.density==='comfortable'?'selected':''} onClick={()=>setPref('density','comfortable')}>Confortável</button><button className={prefs.density==='compact'?'selected':''} onClick={()=>setPref('density','compact')}>Compacta</button></div></div><div className="v5-pref-section"><h3>Painéis e experiência</h3>{([{key:'sidebar',label:'Explorador do projeto',icon:ListTree},{key:'inspector',label:'Inspector contextual',icon:PanelRightOpen},{key:'metrics',label:'Métricas rápidas',icon:Activity},{key:'motion',label:'Animações e transições',icon:Zap}] as const).map(item=>{const Icon=item.icon;return <label className="v5-switch-row" key={item.key}><span><Icon size={17}/>{item.label}</span><input type="checkbox" checked={prefs[item.key]} onChange={e=>setPref(item.key,e.target.checked)}/><i/></label>})}</div><div className="v5-pref-section"><h3>Detalhamento no modo Engenharia</h3><div className="v5-segment">{(['summary','subtasks','debug'] as const).map(a=><button key={a} className={prefs.activity===a?'selected':''} onClick={()=>setPref('activity',a)}>{a==='summary'?'Resumo':a==='subtasks'?'Subtarefas':'Debug'}</button>)}</div><p className="v5-pref-hint">Eventos continuam disponíveis no Inspector, independentemente do modo.</p></div><button className="v5-reset" onClick={()=>setPrefs(defaults)}><RotateCcw size={15}/> Restaurar padrão</button></motion.div></div>}
 </div>
}
