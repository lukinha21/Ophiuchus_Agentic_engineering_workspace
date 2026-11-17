import {useState} from 'react'
import {ChevronRight, FolderOpen, History, Search, Trash2} from 'lucide-react'
import ArtifactMarkdown from './ArtifactMarkdown'
import type {ProjectFlowState} from './ProjectFlow'
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
  projectRoot?: string
  selectedPaths?: string[]
  messages: ArchivedTurn[]
  flows?: ProjectFlowState[]
  drafts?: ArchivedDraft[]
  runId?: string
  runStatus?: string
}
export type ArchivedChat = ChatSnapshot & {title: string; updatedAt: string}
export const historyKey = 'ophiuchus.chat-history.v1'

type StoredHistory = {chats: ArchivedChat[]; deletedIds: string[]}

export function readChatHistory(): StoredHistory {
  try {
    const stored = JSON.parse(localStorage.getItem(historyKey) ?? '[]')
    const chats = Array.isArray(stored) ? stored : stored?.chats
    const deletedIds: string[] = Array.isArray(stored?.deletedIds)
      ? stored.deletedIds.filter((id: unknown) => typeof id === 'string')
      : []
    return {
      chats: Array.isArray(chats) ? chats.filter(chat => chat && typeof chat.id==='string' &&
        typeof chat.title==='string' && typeof chat.updatedAt==='string' && Array.isArray(chat.messages) &&
        !deletedIds.includes(chat.id)) : [],
      deletedIds,
    }
  } catch {
    return {chats: [], deletedIds: []}
  }
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

export function SavedProposal({draft}: {draft: ArchivedDraft}) {
  return <details className="history-proposal">
    <summary>Ver proposta salva <span>{draft.changes.length} {draft.changes.length === 1 ? 'arquivo' : 'arquivos'}</span></summary>
    <ArtifactMarkdown text={draft.summary}/>
    {draft.changes.map(change => <details className="history-diff" key={change.path}>
      <summary><code>{change.path}</code>{change.applied && <span>Aplicado</span>}</summary>
      {change.diff.tooLarge ? <p>Diff indisponível para este arquivo devido ao tamanho.</p> :
        <pre>{change.diff.lines.map((line, index) => <span className={'history-line ' + line.kind} key={index}>
          {line.kind === 'add' ? '+ ' : line.kind === 'remove' ? '− ' : '  '}{line.text}
        </span>)}</pre>}
    </details>)}
  </details>
}

export default function ChatHistory({chats, activeIds, currentId, storageError, busy, onOpen, onDelete}: {
  chats: ArchivedChat[]; activeIds: string[]; currentId?: string; storageError: boolean; busy: boolean
  onOpen: (chat: ArchivedChat) => void; onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [project, setProject] = useState('')
  const projects = [...new Set(chats.flatMap(chat => chat.project ? [chat.project] : []))].sort()
  const visible = chats.filter(chat => normalize(chat.title).includes(normalize(query.trim())) &&
    (!project || (project === 'no-project' ? !chat.project : chat.project === project.slice(8))))

  return <section className="history-list" aria-label="Histórico de conversas">
    <header><History size={17}/><h1>Histórico</h1></header>
    <div className="history-filters">
      <div className="history-search"><Search size={15}/><input aria-label="Buscar conversas" placeholder="Buscar por título" value={query} onChange={event => setQuery(event.target.value)}/></div>
      <select aria-label="Filtrar por projeto" value={project} onChange={event => setProject(event.target.value)}>
        <option value="">Todos os projetos</option><option value="no-project">Sem projeto</option>
        {projects.map(name => <option value={'project:' + name} key={name}>{name}</option>)}
      </select>
    </div>
    {storageError && <p role="alert" className="history-error">Não foi possível salvar o histórico local.</p>}
    <ul>
      {visible.map(chat => {
        const status = chatStatus(chat, activeIds.includes(chat.id))
        return <li key={chat.id}>
          <button className="history-open" type="button" disabled={busy} aria-current={currentId === chat.id ? 'true' : undefined} onClick={() => onOpen(chat)}>
            <strong>{chat.title}</strong><ChevronRight size={15}/>
            <span><FolderOpen size={13}/>{chat.project || 'Sem projeto'}</span>
            <time dateTime={chat.updatedAt}>{date.format(new Date(chat.updatedAt))}</time>
            {status && <small>{status}</small>}
          </button>
          <button className="history-delete" type="button" aria-label={'Excluir conversa: ' + chat.title} title="Excluir conversa" onClick={() => {
            if (window.confirm('Excluir esta conversa do histórico local?')) onDelete(chat.id)
          }}><Trash2 size={14}/></button>
        </li>
      })}
    </ul>
    {!visible.length && <p className="history-empty">{chats.length ? 'Nenhuma conversa corresponde à busca.' : 'Suas conversas aparecerão aqui.'}</p>}
  </section>
}
