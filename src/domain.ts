export type AgentStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_DEPENDENCY'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'

export type TaskStatus = AgentStatus

export type AgentRole =
  | 'ORCHESTRATOR'
  | 'ARCHITECT'
  | 'DEVELOPER'
  | 'REVIEWER'
  | 'QA'
  | 'DOCUMENTATION'

export type ModelMode = 'FIXED' | 'POLICY' | 'AUTO'

export interface ModelBinding {
  mode: ModelMode
  providerId: string
  modelId: string
  fallbackModelId?: string
  temperature: number
  reasoningLevel: 'low' | 'medium' | 'high'
}

export interface AgentDefinition {
  id: string
  name: string
  role: AgentRole
  description: string
  enabled: boolean
  modelBinding: ModelBinding
  maxSteps: number
  permissions: {
    task: string[]
    edit: string[]
    bash: string[]
  }
}

export interface RunAgentState {
  agentId: string
  status: AgentStatus
  currentTask: string
  lastEvent: string
  progress: number
  startedAt?: string
  finishedAt?: string
}

export interface TaskDefinition {
  id: string
  title: string
  description: string
  stage: string
  agentId: string
  status: TaskStatus
  progress: number
  subtasks: SubtaskDefinition[]
  eventCount: number
  startedAt?: string
  finishedAt?: string
}

export interface SubtaskDefinition {
  id: string
  title: string
  status: TaskStatus
  progress: number
  eventCount: number
}

export interface RunEvent {
  id: string
  at: string
  type: string
  agentId?: string
  taskId?: string
  subtaskId?: string
  message: string
  detail?: string
}

export interface RunSnapshot {
  runId: string
  prompt: string
  createdAt: string
  agents: AgentDefinition[]
  tasks: TaskDefinition[]
}
