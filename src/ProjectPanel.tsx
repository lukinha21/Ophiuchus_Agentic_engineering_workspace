import {Fragment,forwardRef,useEffect,useImperativeHandle,useState,useRef} from 'react'
import {createPortal} from 'react-dom'
import {FolderOpen,FileCode2,Search,Eye,RefreshCw,ShieldCheck,GitCompareArrows,Play,Undo2,Check,Settings2,X,UserRound,Sparkles,MessageSquarePlus,LoaderCircle,AlertCircle} from 'lucide-react'
import type {AgentDefinition} from './domain'
import {api} from './runtimeClient'
import ArtifactMarkdown from './ArtifactMarkdown'
import './project-panel.css'
import ProjectFlow from './ProjectFlow'
import type {ProjectFlowState} from './ProjectFlow'
import ProjectInspector from './ProjectInspector'
type Turn={id:string;role:'user'|'assistant';text:string;error?:boolean;draftId?:string;flowId?:string}
type FileInfo={path:string;bytes:number}
type Project={id:string;root:string;name:string;files:FileInfo[];warnings:string[];drafts?:Array<{id:string;summary:string;status:string;createdAt:string}>}
type Change={path:string;content:string;before:string|null;reason:string;applied:boolean;diff:{tooLarge:boolean;lines:Array<{kind:string;text:string}>}}
type Draft={id:string;goal?:string;summary:string;status:string;changes:Change[];contextPaths:string[];workflowId?:string|null;testPlan?:{available:boolean;reason:string|null;tests:string[]};usage?:{total_tokens?:number};test?:{status?:string;passed:boolean|null;output:string;tests:string[];scope:string}|null}
function FileTree({files,selected,onSelect,onOpen,prefix='',depth=0}:{files:FileInfo[];selected:string[];onSelect:(path:string)=>void;onOpen:(path:string)=>void;prefix?:string;depth?:number}){
 const folders=new Set(files.map(f=>f.path.slice(prefix.length)).filter(p=>p.includes('/')).map(p=>p.split('/')[0]))
 const direct=files.filter(f=>!f.path.slice(prefix.length).includes('/'))
 return <div className="project-tree-level">{[...folders].sort().map(folder=><details key={folder} open={depth<1}><summary><FolderOpen size={14}/>{folder}</summary><FileTree files={files.filter(f=>f.path.startsWith(prefix+folder+'/'))} selected={selected} onSelect={onSelect} onOpen={onOpen} prefix={prefix+folder+'/'} depth={depth+1}/></details>)}{direct.map(f=><div className="project-file" key={f.path}><label title={'Incluir no contexto: '+f.path}><input type="checkbox" checked={selected.includes(f.path)} onChange={()=>onSelect(f.path)}/><FileCode2 size={14}/><span>{f.path.slice(prefix.length)}</span></label><button aria-label={'Ler '+f.path} title={'Ler '+f.path} onClick={()=>onOpen(f.path)}><Eye size={14}/></button></div>)}</div>
}
export type ProjectHandle={submit:(goal:string)=>Promise<boolean>;openFolder:()=>Promise<boolean>}
export type ProjectStatus={active:boolean;name:string;busy:boolean;canSend:boolean}
type Props={agents:AgentDefinition[];onSettings:()=>void;sidebarTarget:HTMLElement|null;workTarget:HTMLElement|null;onStatus:(status:ProjectStatus)=>void;onNewChat:()=>void;engineering:boolean;inspectorTarget:HTMLElement|null;onInspect:()=>void;onCloseInspector:()=>void;disabled?:boolean}
const ProjectPanel=forwardRef<ProjectHandle,Props>(function ProjectPanel({agents,onSettings,sidebarTarget,workTarget,onStatus,onNewChat,engineering,inspectorTarget,onInspect,onCloseInspector,disabled=false},ref){
 const [path,setPath]=useState(''),[readAllowed,setReadAllowed]=useState(false),[project,setProject]=useState<Project|null>(null)
 const [selected,setSelected]=useState<string[]>([]),[preview,setPreview]=useState<{path:string;content:string}|null>(null)
 const [query,setQuery]=useState(''),[hits,setHits]=useState<Array<{path:string;line:number;text:string}>>([])
 const [contractFormat,setContractFormat]=useState<'auto'|'prompt'>('auto'),[cachePolicy,setCachePolicy]=useState<'provider'|'explicit'>('provider')
 const [mode,setMode]=useState<'orchestrate'|'analyse'|'propose'>('orchestrate'),[sendAllowed,setSendAllowed]=useState(false)
 const [writeAllowed,setWriteAllowed]=useState(false),[executeAllowed,setExecuteAllowed]=useState(false)
 const [messages,setMessages]=useState<Turn[]>([]);const endRef=useRef<HTMLDivElement>(null);const taskLock=useRef(false)
 const [contextPaths,setContextPaths]=useState<string[]>([]),[usage,setUsage]=useState<number|null>(null)
 const [draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('')
 useEffect(()=>{try{sessionStorage.removeItem('ophiuchus.local-project')}catch{}},[])
 const [flows,setFlows]=useState<Record<string,ProjectFlowState>>({}),[activeFlowId,setActiveFlowId]=useState<string|null>(null);const finishedFlows=useRef(new Set<string>());
 const [inspection,setInspection]=useState<{flowId:string;stageId:string|null}|null>(null)
 const [manual,setManual]=useState(false),[picking,setPicking]=useState(false)
 const developer=agents.find(a=>a.role==='DEVELOPER'&&a.enabled),binding=developer?.modelBinding
 const action=async(label:string,fn:()=>Promise<void>)=>{if(busy)return false;setBusy(label);setError('');try{await fn();return true}catch(e){setError((e as Error).message);return false}finally{setBusy('')}}
 const adopt=(p:Project)=>{setInspection(null);setFlows({});setActiveFlowId(null);finishedFlows.current.clear();setProject(p);setSelected([]);setPreview(null);setDraft(null);setMessages([]);setHits([]);setContextPaths([]);setUsage(null);setSendAllowed(false);setWriteAllowed(false);setExecuteAllowed(false);setManual(false);setPath('')}
 const open=()=>action('Abrindo pasta',async()=>{adopt(await api<Project>('/projects/open',{path:path.trim(),confirmRead:readAllowed}))})
 const pick=()=>action('Escolha a pasta na janela do Windows',async()=>{
  if(disabled)throw Error('Conclua ou cancele a execução atual antes de abrir um projeto');
  setPicking(true);try{const result=await api<Project&{cancelled?:boolean}>('/projects/pick',{confirmRead:true});if(!result.cancelled)adopt(result)}catch(e){setManual(true);throw e}finally{setPicking(false)}
 })
 const cancelPicker=async()=>{try{await api('/projects/picker/cancel',{});setManual(true)}catch(e){setError((e as Error).message)}};
 const close=()=>action('Fechando projeto',async()=>{if(!project)return;await api(`/projects/${project.id}/close`,{});setProject(null);try{sessionStorage.removeItem('ophiuchus.local-project')}catch{}setPath('');setReadAllowed(false);setSelected([]);setPreview(null);setDraft(null);setMessages([]);setQuery('');setHits([]);setSendAllowed(false);setWriteAllowed(false);setExecuteAllowed(false);setContextPaths([]);setUsage(null)})
 const refresh=()=>action('Atualizando árvore',async()=>{if(!project)return;const p=await api<{files:FileInfo[];warnings:string[]}>(`/projects/${project.id}/tree`);setProject({...project,...p});setSelected(s=>s.filter(path=>p.files.some(f=>f.path===path)))})
 const read=(path:string)=>void action('Lendo arquivo',async()=>{if(project)setPreview(await api(`/projects/${project.id}/file?path=${encodeURIComponent(path)}`))})
 const search=()=>action('Buscando',async()=>{if(!project)return;const result=await api<{hits:typeof hits;truncated:boolean}>(`/projects/${project.id}/search?q=${encodeURIComponent(query)}`);setHits(result.hits);if(result.truncated)setError('Mostrando os primeiros 100 resultados; refine a busca.')})
 const task=async(request:string)=>{
  if(!project||taskLock.current||busy||!sendAllowed)return false;
  taskLock.current=true;const turnId=crypto.randomUUID();
  const history=messages.filter(m=>!m.error).slice(-6).map(({role,text})=>({role,content:text.slice(0,1800)}));
  setMessages(m=>[...m,{id:turnId,role:'user',text:request}]);
  if(mode==='orchestrate'){
   setBusy('Orquestrando projeto');setError('');setDraft(null);setWriteAllowed(false);setExecuteAllowed(false);
   try{
    const bindings=Object.fromEntries(agents.filter(a=>a.enabled).map(a=>[a.role.toLowerCase(),{providerId:a.modelBinding.providerId,modelId:a.modelBinding.modelId}]));
    const flow=await api<ProjectFlowState>(`/projects/${project.id}/flows`,{goal:request,paths:selected,history,bindings,policy:{format:contractFormat,cache:cachePolicy},confirmSend:sendAllowed});
    setFlows(old=>({...old,[flow.id]:flow}));setInspection({flowId:flow.id,stageId:null});setActiveFlowId(flow.id);setMessages(old=>old.map(m=>m.id===turnId?{...m,flowId:flow.id}:m));return true;
   }catch(e){setError((e as Error).message);setMessages(old=>[...old,{id:crypto.randomUUID(),role:'assistant',text:(e as Error).message,error:true}]);setBusy('');taskLock.current=false;return false;}
  }
  const ok=await action(mode==='analyse'?'Analisando o contexto e preparando a resposta':'Preparando alterações na cópia isolada',async()=>{
   try{
    const result=await api<{summary?:string;draft?:Draft;usage?:{total_tokens?:number};contextPaths?:string[]}>(`/projects/${project.id}/task`,{goal:request,mode,paths:selected,history,binding:{providerId:binding?.providerId,modelId:binding?.modelId},confirmSend:sendAllowed});
    const text=result.summary||result.draft?.summary||'O modelo não apresentou uma resposta.';
    setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text,draftId:result.draft?.id}]);
    setDraft(result.draft||null);setContextPaths(result.contextPaths||result.draft?.contextPaths||[]);setUsage(result.usage?.total_tokens??result.draft?.usage?.total_tokens??null);setWriteAllowed(false);setExecuteAllowed(false);
    const updated=await api<Project>(`/projects/${project.id}`).catch(()=>null);if(updated)setProject(updated)
   }catch(e){setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:(e as Error).message,error:true}]);throw e}
  });taskLock.current=false;return ok
 }
 useEffect(()=>{
  if(!project||!activeFlowId)return;let alive=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try{
    const flow=await api<ProjectFlowState>(`/projects/${project.id}/flows/${activeFlowId}`);if(!alive)return;
    setFlows(old=>({...old,[flow.id]:flow}));
    if(!['RUNNING','CANCELLING'].includes(flow.status)){
     if(!finishedFlows.current.has(flow.id)){
      finishedFlows.current.add(flow.id);
      if(flow.status==='READY')setMessages(old=>[...old,{id:crypto.randomUUID(),role:'assistant',text:flow.summary,draftId:flow.draftId||undefined}]);
      setContextPaths(flow.contextPaths);const tokens=flow.stages.map(s=>s.usage?.total_tokens);setUsage(tokens.every(x=>typeof x==='number')?tokens.reduce<number>((a,b)=>a+(b||0),0):null);
      if(flow.draftId){const draft=await api<Draft>(`/projects/${project.id}/drafts/${flow.draftId}`);if(alive)setDraft(draft);}
     }
     if(alive){setActiveFlowId(null);setBusy('');taskLock.current=false;}return;
    }
   }catch(e){if(alive)setError('Acompanhamento indisponível; tentando reconectar. '+(e as Error).message);}
   if(alive)timer=setTimeout(()=>void poll(),1000);
  };void poll();return()=>{alive=false;clearTimeout(timer);};
 },[project?.id,activeFlowId]);
 const cancelFlow=async(id:string)=>{if(!project)return;try{const flow=await api<ProjectFlowState>(`/projects/${project.id}/flows/${id}/cancel`,{});setFlows(old=>({...old,[id]:flow}));}catch(e){setError((e as Error).message)}};
 const resumeFlow=async(flowId:string,timeoutMs:number)=>{
  if(!project||busy||taskLock.current)return;taskLock.current=true;setBusy('Retomando etapa');setError('');
  try{const flow=await api<ProjectFlowState>(`/projects/${project.id}/flows/${flowId}/resume`,{confirmSend:true,timeoutMs});finishedFlows.current.delete(flowId);setFlows(old=>({...old,[flowId]:flow}));setInspection({flowId,stageId:null});setActiveFlowId(flowId);}
  catch(e){setError((e as Error).message);setBusy('');taskLock.current=false;}
 };
 const inspect=(flowId:string,stageId:string)=>{setInspection({flowId,stageId});onInspect()};
 const showDraft=(id:string)=>{void action('Abrindo proposta',async()=>{if(project){setDraft(await api(`/projects/${project.id}/drafts/${id}`));setWriteAllowed(false);setExecuteAllowed(false)}})};
 const newChat=()=>{if(busy||taskLock.current)return;onNewChat();setMessages([]);setDraft(null);setContextPaths([]);setUsage(null);setError('');setPreview(null);setHits([]);setWriteAllowed(false);setExecuteAllowed(false)}
 useEffect(()=>{endRef.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})},[messages,busy,activeFlowId?flows[activeFlowId]?.stage:null])

 const modify=(path:string,kind:'apply'|'undo')=>action(kind==='apply'?'Aplicando arquivo revisado':'Desfazendo alteração',async()=>{if(!project||!draft)return;setDraft(await api(`/projects/${project.id}/drafts/${draft.id}/${kind}`,{path,confirmWrite:writeAllowed}));setPreview(null);const p=await api<{files:FileInfo[];warnings:string[]}>(`/projects/${project.id}/tree`);setProject({...project,...p})})
 const test=()=>action('Executando testes na cópia isolada',async()=>{if(project&&draft)setDraft(await api(`/projects/${project.id}/drafts/${draft.id}/test`,{confirmExecute:executeAllowed}))})
 const select=(path:string)=>{setSelected(s=>s.includes(path)?s.filter(p=>p!==path):s.length<8?[...s,path]:s)}
 useImperativeHandle(ref,()=>({submit:task,openFolder:pick}))
 const teamReady=['ORCHESTRATOR','ARCHITECT','DEVELOPER','REVIEWER','QA','DOCUMENTATION'].every(role=>agents.some(a=>a.enabled&&a.role===role&&a.modelBinding.providerId!=='mock'&&a.modelBinding.modelId));
 const canSend=Boolean(project&&sendAllowed&&!busy&&(mode==='orchestrate'?teamReady:binding&&binding.providerId!=='mock'))
 const draftFlow=draft?.workflowId?flows[draft.workflowId]:null;const canApplyDraft=!draft?.workflowId||draftFlow?.status==='READY'
 useEffect(()=>onStatus({active:Boolean(project),name:project?.name||'',busy:Boolean(busy),canSend}),[project?.id,project?.name,busy,canSend,onStatus])
 const inspectFlow=inspection?flows[inspection.flowId]||null:activeFlowId?flows[activeFlowId]:Object.values(flows).at(-1)||null;
 const inspector=engineering?<ProjectInspector flows={Object.values(flows)} flow={inspectFlow} stageId={inspection?.stageId||null} onFlow={flowId=>setInspection({flowId,stageId:null})} onStage={stageId=>{if(inspectFlow)setInspection({flowId:inspectFlow.id,stageId})}} onClose={onCloseInspector}/>:null
 const sidebar=<section className="local-project project-rail" aria-label="Arquivos do projeto"><div className="project-rail-heading"><span>EXPLORADOR</span>{project&&<div><button title="Atualizar arquivos" disabled={Boolean(busy)} onClick={()=>void refresh()}><RefreshCw size={14}/></button><button title="Fechar projeto" disabled={Boolean(busy)} onClick={()=>void close()}><X size={14}/></button></div>}</div>
 {!project?<div className="project-rail-empty"><span className="rail-index">01 / PONTO DE PARTIDA</span><h2>Um lugar para<br/>construir.</h2><p>Abra um projeto existente.<br/>O contexto começa nos seus arquivos.</p><button className="project-open-native" disabled={disabled||Boolean(busy)} onClick={()=>void pick()} title="Escolher uma pasta no Windows e autorizar sua leitura local"><FolderOpen size={18}/> {picking?'Selecionando…':'Abrir pasta'}</button>{picking&&<div className="project-picker-note"><p>Escolha a pasta na janela gráfica do Windows. O console permanece oculto.</p><button onClick={()=>void cancelPicker()}>Cancelar seletor e informar caminho</button></div>}<button className="project-manual-toggle" onClick={()=>setManual(x=>!x)} disabled={Boolean(busy)||disabled}>{manual?'Ocultar caminho':'Informar caminho manualmente'}</button>{manual&&<div className="project-manual"><label>Caminho local<input aria-label="Caminho da pasta do projeto" value={path} onChange={e=>setPath(e.target.value)} placeholder="Caminho absoluto da pasta"/></label><label className="project-check"><input type="checkbox" checked={readAllowed} onChange={e=>setReadAllowed(e.target.checked)}/> Autorizo a leitura desta pasta.</label><button disabled={!path.trim()||!readAllowed||Boolean(busy)||disabled} onClick={()=>void open()}>Abrir pelo caminho</button></div>}</div>:<><div className="project-root-name" title={project.root}><FolderOpen size={15}/><strong>{project.name}</strong></div><div className="project-rail-search"><input aria-label="Buscar no projeto" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nos arquivos…" onKeyDown={e=>{if(e.key==='Enter'&&query.length>=2&&!busy)void search()}}/><button aria-label="Buscar arquivos" disabled={query.length<2||Boolean(busy)} onClick={()=>void search()}><Search size={15}/></button></div><div className="project-rail-files"><FileTree files={project.files} selected={selected} onSelect={select} onOpen={read}/></div><div className="project-rail-footer">{project.files.length} arquivos · {selected.length?`${selected.length} no contexto`:'contexto automático'}<small title="Dependências, builds, links e nomes sensíveis comuns são excluídos.">Leitura autorizada somente nesta pasta</small></div></>}
 {busy&&<p className="project-rail-busy" role="status">{busy}…</p>}</section>
 const work=project?<section className="local-project project-in-console" aria-label="Contexto e alterações do projeto">
 <div className="project-context-bar"><FolderOpen size={16}/><strong>{project.name}</strong><span>{mode==='orchestrate'?'Equipe de 6 agentes':mode==='analyse'?'Análise direta':'Edição direta'} · {selected.length?`${selected.length} arquivos marcados`:'Contexto automático'}</span><button disabled={Boolean(busy)} onClick={newChat} title="Limpar a conversa; manter a pasta e os arquivos"><MessageSquarePlus size={15}/> Novo chat</button><button onClick={onSettings} title="Configurar modelo"><Settings2 size={14}/></button></div>
 <details className="project-console-permission" open={!sendAllowed}><summary>Contexto e permissões</summary><div className="project-task-modes"><button disabled={Boolean(busy)} className={mode==='orchestrate'?'selected':''} onClick={()=>{setMode('orchestrate');setSendAllowed(false)}}>Equipe completa · 6 agentes</button><button disabled={Boolean(busy)} className={mode==='analyse'?'selected':''} onClick={()=>{setMode('analyse');setSendAllowed(false)}}>Analisar</button><button disabled={Boolean(busy)} className={mode==='propose'?'selected':''} onClick={()=>{setMode('propose');setSendAllowed(false)}}>Edição direta</button></div><small>{mode==='orchestrate'?'Seis agentes em sequência, até 7 chamadas por pedido (inclui uma recuperação). Revisão e QA estáticos; testes separados. ':''}Modelo do Desenvolvedor: {binding?.providerId||'não configurado'} / {binding?.modelId||'selecione um modelo'}. Até 8 arquivos e 24.000 caracteres de conteúdo por pedido. Dependências e arquivos sensíveis comuns são excluídos.</small><div className="project-task-modes"><label>Passagem entre agentes<select disabled={Boolean(busy)} value={contractFormat} onChange={e=>setContractFormat(e.target.value as 'auto'|'prompt')}><option value="auto">Automática por capacidade do modelo</option><option value="prompt">Compatibilidade máxima · JSON validado localmente</option></select></label><label>Cache<select disabled={Boolean(busy)} value={cachePolicy} onChange={e=>setCachePolicy(e.target.value as 'provider'|'explicit')}><option value="provider">Gerenciado pelo provedor</option><option value="explicit">Solicitar cache explícito quando compatível</option></select></label></div><small>Os contratos são validados em todos os provedores. Cache explícito é opcional e pode ter cobrança de gravação. Os modelos escolhidos por agente são preservados.</small><label className="project-check"><input type="checkbox" checked={sendAllowed} onChange={e=>setSendAllowed(e.target.checked)}/> Autorizo o envio do pedido e do contexto aos modelos do modo selecionado, incluindo até 7 chamadas na equipe completa. Escrita e testes continuam exigindo aprovação separada.</label></details>
 {hits.length>0&&<div className="project-search-results"><strong>Resultados da busca</strong>{hits.map((h,i)=><button key={i} onClick={()=>read(h.path)}><code>{h.path}{h.line?':'+h.line:''}</code><span>{h.text}</span></button>)}</div>}
 {preview&&<div className="project-preview"><header><strong>{preview.path}</strong><button aria-label="Fechar leitura" onClick={()=>setPreview(null)}><X size={15}/></button></header><pre>{preview.content}</pre></div>}
 <div className="project-chat-thread" aria-label="Conversa do projeto" aria-live="polite">
 {Object.keys(flows).length>0&&<details className="project-flow-history"><summary>Execuções deste projeto · {Object.keys(flows).length}</summary>{Object.values(flows).map(flow=><details key={flow.id}><summary>{flow.goal.slice(0,90)} · {flow.status==='READY'?'Revisado':flow.status==='RUNNING'?'Em andamento':flow.status}</summary><ProjectFlow flow={flow} onDraft={showDraft} engineering={engineering} onInspect={stageId=>inspect(flow.id,stageId)} onResume={busy?undefined:timeout=>void resumeFlow(flow.id,timeout)}/></details>)}</details>}
 {!messages.length&&<div className="project-chat-empty"><Sparkles size={24}/><h2>O próximo passo começa aqui.</h2><p>Descreva a mudança. A equipe define o caminho, prepara uma proposta e confere os critérios. Você acompanha cada etapa e decide o que entra no projeto.</p></div>}
 {messages.map(m=><Fragment key={m.id}><div className={'v5-chat-line '+(m.role==='user'?'user':'assistant')}><div className={'v5-chat-avatar '+m.role}>{m.role==='user'?<UserRound size={22}/>:<Sparkles size={22}/>}</div><div className={'project-message '+(m.error?'project-message-error':'')}><span className="v5-chat-by">{m.role==='user'?'Você':'Ophiuchus'}</span><ArtifactMarkdown text={m.text}/>{m.draftId&&<button disabled={Boolean(busy)} onClick={()=>void action('Abrindo proposta',async()=>{setDraft(await api(`/projects/${project.id}/drafts/${m.draftId}`));setWriteAllowed(false);setExecuteAllowed(false)})}><GitCompareArrows size={14}/> Revisar proposta</button>}</div></div>{m.flowId&&flows[m.flowId]&&<ProjectFlow flow={flows[m.flowId]} onCancel={()=>void cancelFlow(m.flowId!)} onDraft={showDraft} engineering={engineering} onInspect={stageId=>inspect(m.flowId!,stageId)} onResume={busy?undefined:timeout=>void resumeFlow(m.flowId!,timeout)}/>}</Fragment>)}
 {busy&&taskLock.current&&!activeFlowId&&<div className="project-working" role="status"><LoaderCircle size={19}/><div><strong>Ophiuchus está trabalhando</strong><span>{busy}…</span></div><span className="project-thinking-dots">•••</span></div>}
 <div className="project-chat-end" ref={endRef}/></div>
    {contextPaths.length>0&&<details className="project-context"><summary>Arquivos enviados ao modelo ({contextPaths.length})</summary>{contextPaths.map(p=><code key={p}>{p}</code>)}</details>}
    {draft&&<div className="project-draft"><h2><GitCompareArrows size={19}/> Proposta supervisionada</h2><p>{draft.summary}</p>{draft.goal&&<p>Pedido desta proposta: {draft.goal}</p>}<small>Estado: {draft.status}. Os arquivos abaixo já existem na cópia isolada; o original só muda ao aplicar cada arquivo.</small>{!canApplyDraft&&<p className="flow-error">Aplicação bloqueada: a equipe ainda não concluiu os pareceres deste fluxo.</p>}<label className="project-check"><input type="checkbox" checked={writeAllowed} onChange={e=>setWriteAllowed(e.target.checked)}/> Autorizo gravar ou desfazer os arquivos revisados abaixo, somente ao clicar na ação de cada arquivo.</label>{draft.changes.map(c=><details className="project-change" key={c.path} open><summary><code>{c.path}</code><span>{c.applied?'Aplicado':c.before===null?'Novo arquivo':'Modificado'}</span></summary><p>{c.reason}</p>{c.diff.tooLarge?<pre>{c.content}</pre>:<pre className="project-diff">{c.diff.lines.map((l,i)=><div key={i} className={'diff-'+l.kind}>{l.kind==='add'?'+':l.kind==='remove'?'-':' '} {l.text||' '}</div>)}</pre>}<button disabled={!writeAllowed||Boolean(busy)||(!c.applied&&!canApplyDraft)} onClick={()=>void modify(c.path,c.applied?'undo':'apply')}>{c.applied?<Undo2 size={15}/>:<Check size={15}/>} {c.applied?'Desfazer este arquivo':'Aplicar este arquivo'}</button></details>)}
    <div className="project-tests"><strong>Validar a cópia isolada</strong><p>Primeira etapa: testes nativos Node.js em Docker, sem rede e sem instalar dependências. Projetos com Jest, TypeScript ou serviços externos podem exigir configuração futura. Nada é executado no host.</p><p role="status">{draft.testPlan?.reason}</p><label className="project-check"><input type="checkbox" disabled={draft.testPlan?.available===false} checked={executeAllowed} onChange={e=>setExecuteAllowed(e.target.checked)}/> Autorizo executar os testes da cópia em contêiner Docker isolado.</label><button disabled={!executeAllowed||Boolean(busy)||draft.testPlan?.available===false} onClick={()=>void test()}><Play size={15}/> Testar cópia isolada</button>{draft.test&&<div className={draft.test.status==='NOT_RUN'?'project-test-unavailable':draft.test.passed?'project-test-pass':'project-error'}><strong>{draft.test.status==='NOT_RUN'?'Testes não executados':draft.test.passed?'Testes da cópia aprovados':'Testes da cópia não aprovados'}</strong><pre>{draft.test.output}</pre></div>}</div></div>}

 {project.warnings.length>0&&<details className="project-warnings"><summary>Arquivos omitidos / avisos ({project.warnings.length})</summary>{project.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
 </section>:null
 return <>{error&&createPortal(<div className="project-toast" role="alert"><AlertCircle size={23}/><div><strong>Não foi possível concluir</strong><p>{error}</p></div><button aria-label="Fechar aviso" onClick={()=>setError('')}><X size={18}/></button></div>,document.body)}{sidebarTarget&&createPortal(sidebar,sidebarTarget)}{workTarget&&createPortal(work,workTarget)}{engineering&&inspectorTarget&&createPortal(inspector,inspectorTarget)}</>
})
export default ProjectPanel
