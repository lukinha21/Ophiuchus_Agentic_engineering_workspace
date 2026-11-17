import {useEffect, useState} from 'react'
import {ChevronRight, FolderOpen, History, Search, Sparkles, UserRound} from 'lucide-react'
import ArtifactMarkdown from './ArtifactMarkdown'
import ProjectFlow from './ProjectFlow'
import RuntimeFlow from './RuntimeFlow'
import type {ProjectFlowState} from './ProjectFlow'
import {api} from './runtimeClient'
import type {RuntimeRun} from './runtimeClient'
import './chat-history.css'

type ArchivedTurn = {
  role: 'user' | 'assistant'
  text: string
  flowId?: string
  draftId?: string
  error?: boolean
}
type ArchivedDraft = {
  id: string
  status: string
  summary: string
  changes: Array<{path: string; applied: boolean; diff: {tooLarge: boolean; lines: Array<{kind: string; text: string}>}}>
}
export type ChatSnapshot = {
  id: string
  project?: string
  messages: ArchivedTurn[]
  flows?: ProjectFlowState[]
  drafts?: ArchivedDraft[]
  runId?: string
  runStatus?: string
}
export type ArchivedChat = ChatSnapshot & {title: string; updatedAt: string}
export const historyKey = 'ophiuchus.chat-history.v1'

export function readChatHistory(): ArchivedChat[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]')
    if (Array.isArray(stored)) return stored.filter(chat => chat && typeof chat.id==='string' &&
      typeof chat.title==='string' && typeof chat.updatedAt==='string' && Array.isArray(chat.messages))
  } catch { /* Storage may be disabled or the cache may be invalid. */ }
  return []
}

export function snapshotFlow(flow: ProjectFlowState): ProjectFlowState {
  return {...flow, stages: flow.stages.map(({request, rawText, attempts, ...stage}) => stage)}
}

function chatStatus(chat: ArchivedChat, active: boolean) {
  const flow = chat.flows?.at(-1)
  const status = flow?.status ?? chat.runStatus
  if (status === 'RUNNING' || status === 'CANCELLING') return active ? 'Em andamento' : 'Execução interrompida'
  if (status === 'WAITING_APPROVAL') return 'Aguardando aprovação'
  if (status === 'FAILED') return 'Execução interrompida'
  if (status === 'BLOCKED') return 'Ajustes necessários'
  if (status === 'CANCELLED') return 'Cancelado'
  const draft = flow?.draftId ? chat.drafts?.find(item => item.id === flow.draftId) : chat.drafts?.at(-1)
  if (draft?.changes.some(change => !change.applied) || (flow?.status === 'READY' && flow.draftId && !draft)) {
    return 'Proposta para revisar'
  }
  return null
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const date = new Intl.DateTimeFormat('pt-BR', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})

export default function ChatHistory({chats, activeIds, storageError, onBack}: {
  chats: ArchivedChat[]; activeIds: string[]; storageError: boolean; onBack: () => void
}) {
  const [query, setQuery] = useState('')
  const [project, setProject] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [run, setRun] = useState<RuntimeRun | null>(null)
  const [runError, setRunError] = useState(false)
  const projects = [...new Set(chats.flatMap(chat => chat.project ? [chat.project] : []))].sort()
  const visible = chats.filter(chat => normalize(chat.title).includes(normalize(query.trim())) &&
    (!project || (project === 'no-project' ? !chat.project : chat.project === project.slice(8))))
  const selected = visible.find(chat => chat.id === selectedId) ?? visible[0]
  const runId = selected?.runId
  useEffect(() => {
    let cancelled = false
    setRun(null)
    setRunError(false)
    if (runId) void api<RuntimeRun>('/runs/' + encodeURIComponent(runId)).then(value => {
      if (!cancelled) setRun(value)
    }).catch(() => {
      if (!cancelled) setRunError(true)
    })
    return () => { cancelled = true }
  }, [runId])

  const proposals = (ids: Array<string | null | undefined>) => selected?.drafts?.filter(item => ids.includes(item.id)).map(item =>
    <details className="history-proposal" key={item.id}>
      <summary>Ver proposta <span>{item.changes.length} {item.changes.length === 1 ? 'arquivo' : 'arquivos'}</span></summary>
      <ArtifactMarkdown text={item.summary}/>
      {item.changes.map(change => <details className="history-diff" key={change.path}>
        <summary><code>{change.path}</code>{change.applied && <span>Aplicado</span>}</summary>
        {change.diff.tooLarge ? <p>Diff indisponível para este arquivo devido ao tamanho.</p> :
          <pre>{change.diff.lines.map((line, index) => <span className={'history-line ' + line.kind} key={index}>
            {line.kind === 'add' ? '+ ' : line.kind === 'remove' ? '− ' : '  '}{line.text}
          </span>)}</pre>}
      </details>)}
    </details>)

  return <section className="chat-history" aria-label="Histórico de conversas">
    <aside className="history-list">
      <header><History size={19}/><h1>Histórico</h1></header>
      <div className="history-filters">
        <div className="history-search"><Search size={15}/><input aria-label="Buscar conversas" placeholder="Buscar por título" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <select aria-label="Filtrar por projeto" value={project} onChange={event => setProject(event.target.value)}>
          <option value="">Todos os projetos</option><option value="no-project">Sem projeto</option>
          {projects.map(name => <option value={'project:' + name} key={name}>{name}</option>)}
        </select>
      </div>
      <ul>
        {visible.map(chat => {
          const status = chatStatus(chat, activeIds.includes(chat.id))
          return <li key={chat.id}><button type="button" aria-current={selected?.id === chat.id ? 'true' : undefined} onClick={() => setSelectedId(chat.id)}>
            <strong>{chat.title}</strong><ChevronRight size={15}/>
            <span><FolderOpen size={13}/>{chat.project || 'Sem projeto'}</span>
            <time dateTime={chat.updatedAt}>{date.format(new Date(chat.updatedAt))}</time>
            {status && <small>{status}</small>}
          </button></li>
        })}
      </ul>
      {!visible.length && <p className="history-empty">{chats.length ? 'Nenhuma conversa corresponde à busca.' : 'Suas conversas aparecerão aqui.'}</p>}
    </aside>
    <div className="history-reader">
      {storageError && <p role="alert" className="history-error">Não foi possível salvar o histórico no armazenamento local.</p>}
      {selected ? <>
        <header className="history-reader-head">
          <div><h2>{selected.title}</h2><p>{selected.project || 'Sem projeto'} · Consulta</p></div>
          <button type="button" onClick={onBack}>Voltar ao console</button>
        </header>
        <div className="history-transcript">
          {selected.messages.map((message, index) => {
            const flow = selected.flows?.find(item => item.id === message.flowId)
            const stage = flow && ['RUNNING','CANCELLING'].includes(flow.status) && !activeIds.includes(selected.id) ? {...flow,status:'FAILED',error:'Execução interrompida.'} : flow
            const draftAppearsLater = flow?.draftId && selected.messages.some(turn => turn.draftId === flow.draftId)
            return <div className="history-turn" key={index}>
              <div className={'history-message ' + message.role}>
                <span className="history-avatar">{message.role === 'user' ? <UserRound size={16}/> : <Sparkles size={16}/>}</span>
                <div><strong>{message.role === 'user' ? 'Você' : 'Ophiuchus'}</strong><ArtifactMarkdown text={message.text}/></div>
              </div>
              {stage && <ProjectFlow flow={stage}/>}
              {proposals([message.draftId, draftAppearsLater ? undefined : flow?.draftId])}
            </div>
          })}
          {run?.id === runId && run && <RuntimeFlow run={run} engineering={false}/>}
          {runId && run?.id !== runId && <p role="status">{runError ? 'Os detalhes da execução estão indisponíveis.' : 'Carregando execução…'}</p>}
        </div>
      </> : <div className="history-blank"><History size={32}/><p>{chats.length ? 'Ajuste os filtros para abrir uma conversa.' : 'Inicie uma conversa no console para criar seu histórico.'}</p><button onClick={onBack}>Ir ao console</button></div>}
    </div>
  </section>
}
