import type { AgentDefinition, RunAgentState, RunEvent, RunSnapshot, TaskDefinition } from './domain'

export const defaultAgents: AgentDefinition[] = [
  {
    id: 'orchestrator', name: 'Orquestrador', role: 'ORCHESTRATOR',
    description: 'Dono do fluxo. Decompõe a demanda, delega e valida os critérios de avanço.', enabled: true,
    modelBinding: { mode: 'FIXED', providerId: 'openai', modelId: 'orchestrator-model', fallbackModelId: 'orchestrator-fallback', temperature: 0.1, reasoningLevel: 'high' },
    maxSteps: 150, permissions: { task: ['architect', 'developer', 'reviewer', 'qa', 'documentation'], edit: [], bash: [] },
  },
  {
    id: 'architect', name: 'Arquiteto', role: 'ARCHITECT',
    description: 'Transforma o pedido em especificação e plano técnico verificável.', enabled: true,
    modelBinding: { mode: 'FIXED', providerId: 'openai', modelId: 'codex-1', temperature: 0.15, reasoningLevel: 'high' },
    maxSteps: 80, permissions: { task: [], edit: ['spec.md', 'plan.md', 'research.md', 'data-model.md'], bash: ['git status'] },
  },
  {
    id: 'developer', name: 'Desenvolvedor', role: 'DEVELOPER',
    description: 'Implementa o código e os testes dentro do escopo de arquivos permitido.', enabled: true,
    modelBinding: { mode: 'FIXED', providerId: 'openai', modelId: 'codex-mini-latest', temperature: 0.1, reasoningLevel: 'medium' },
    maxSteps: 150, permissions: { task: [], edit: ['src/**', 'tests/**'], bash: ['npm test', 'npm run build', 'git diff'] },
  },
  {
    id: 'reviewer', name: 'Revisor', role: 'REVIEWER',
    description: 'Revisa a implementação e devolve problemas técnicos ao Desenvolvedor.', enabled: true,
    modelBinding: { mode: 'FIXED', providerId: 'openai', modelId: 'review-model', temperature: 0.05, reasoningLevel: 'high' },
    maxSteps: 60, permissions: { task: [], edit: ['review-report.md'], bash: ['git diff', 'npm run build'] },
  },
  {
    id: 'qa', name: 'QA', role: 'QA',
    description: 'Executa testes e valida critérios de aceite; não altera o produto diretamente.', enabled: true,
    modelBinding: { mode: 'FIXED', providerId: 'openai', modelId: 'qa-model', temperature: 0.05, reasoningLevel: 'medium' },
    maxSteps: 80, permissions: { task: [], edit: ['qa-report.md'], bash: ['npm test', 'npm run build'] },
  },
  {
    id: 'documentation', name: 'Documentação', role: 'DOCUMENTATION',
    description: 'Consolida README, decisões e documentação final da feature.', enabled: true,
    modelBinding: { mode: 'FIXED', providerId: 'openai', modelId: 'docs-model', temperature: 0.2, reasoningLevel: 'medium' },
    maxSteps: 50, permissions: { task: [], edit: ['README.md', 'docs/**'], bash: ['git status'] },
  },
]

const taskTemplates: Array<Omit<TaskDefinition, 'status' | 'progress' | 'eventCount'>> = [
  { id: 'task-001', title: 'Descoberta e decomposição', description: 'Interpretar a solicitação e estruturar o trabalho executável.', stage: 'E0', agentId: 'orchestrator', subtasks: [
    { id: 'sub-001', title: 'Analisar requisitos', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-002', title: 'Identificar restrições', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-003', title: 'Decompor tarefas', status: 'QUEUED', progress: 0, eventCount: 0 },
  ] },
  { id: 'task-002', title: 'Especificação', description: 'Transformar a intenção em requisitos verificáveis e critérios de aceite.', stage: 'E1', agentId: 'architect', subtasks: [
    { id: 'sub-004', title: 'Definir requisitos', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-005', title: 'Definir critérios de aceite', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-006', title: 'Gerar spec.md', status: 'QUEUED', progress: 0, eventCount: 0 },
  ] },
  { id: 'task-003', title: 'Planejamento técnico', description: 'Definir arquitetura, dados, dependências e estratégia de implementação.', stage: 'E2', agentId: 'architect', subtasks: [
    { id: 'sub-007', title: 'Pesquisar abordagem', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-008', title: 'Modelar dados', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-009', title: 'Criar plano técnico', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-010', title: 'Validar consistência', status: 'QUEUED', progress: 0, eventCount: 0 },
  ] },
  { id: 'task-004', title: 'Implementação', description: 'Construir a solução dentro das permissões e executar os testes disponíveis.', stage: 'E4', agentId: 'developer', subtasks: [
    { id: 'sub-011', title: 'Preparar estrutura', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-012', title: 'Implementar código', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-013', title: 'Executar testes', status: 'QUEUED', progress: 0, eventCount: 0 },
  ] },
  { id: 'task-005', title: 'Revisão', description: 'Verificar qualidade, aderência ao plano e possíveis regressões.', stage: 'E5', agentId: 'reviewer', subtasks: [
    { id: 'sub-014', title: 'Inspecionar alterações', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-015', title: 'Validar critérios', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-016', title: 'Gerar review-report.md', status: 'QUEUED', progress: 0, eventCount: 0 },
  ] },
  { id: 'task-006', title: 'QA e entrega', description: 'Executar validação final e consolidar a entrega.', stage: 'E6/E7', agentId: 'qa', subtasks: [
    { id: 'sub-017', title: 'Executar suíte de testes', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-018', title: 'Validar aceite', status: 'QUEUED', progress: 0, eventCount: 0 },
    { id: 'sub-019', title: 'Consolidar entrega', status: 'QUEUED', progress: 0, eventCount: 0 },
  ] },
]

export function createTasks(): TaskDefinition[] {
  return taskTemplates.map((task) => ({ ...task, status: 'QUEUED', progress: 0, eventCount: 0, subtasks: task.subtasks.map((sub) => ({ ...sub })) }))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function simulateRun(
  snapshot: RunSnapshot,
  onAgents: (states: RunAgentState[]) => void,
  onTasks: (tasks: TaskDefinition[]) => void,
  onEvent: (event: RunEvent) => void,
  isStopped: () => boolean,
) {
  const states: RunAgentState[] = snapshot.agents.map((agent) => ({
    agentId: agent.id, status: agent.id === 'orchestrator' ? 'RUNNING' : 'QUEUED',
    currentTask: agent.id === 'orchestrator' ? 'Interpretando a solicitação' : 'Aguardando delegação',
    lastEvent: agent.id === 'orchestrator' ? 'Run iniciado' : 'Aguardando tarefa', progress: 0,
  }))
  const tasks = snapshot.tasks.map((task) => ({ ...task, subtasks: task.subtasks.map((sub) => ({ ...sub })) }))
  const emit = (event: RunEvent) => onEvent(event)
  const now = () => new Date().toISOString()

  onAgents([...states]); onTasks([...tasks])
  emit({ id: crypto.randomUUID(), at: now(), type: 'run.created', message: `Execução ${snapshot.runId} criada.` })

  for (let index = 0; index < tasks.length; index += 1) {
    if (isStopped()) return
    const task = tasks[index]
    const agent = snapshot.agents.find((item) => item.id === task.agentId)!
    const state = states.find((item) => item.agentId === task.agentId)!

    task.status = 'RUNNING'; task.progress = 5; task.startedAt = now()
    state.status = 'RUNNING'; state.currentTask = task.title; state.progress = 5; state.startedAt = task.startedAt; state.lastEvent = `Executando ${task.stage}`
    onAgents([...states]); onTasks([...tasks])
    emit({ id: crypto.randomUUID(), at: now(), type: 'task.started', agentId: agent.id, taskId: task.id, message: `${task.title} iniciada.`, detail: `${agent.modelBinding.providerId}/${agent.modelBinding.modelId}` })

    for (let subIndex = 0; subIndex < task.subtasks.length; subIndex += 1) {
      const subtask = task.subtasks[subIndex]
      subtask.status = 'RUNNING'; subtask.progress = 10
      emit({ id: crypto.randomUUID(), at: now(), type: 'subtask.started', agentId: agent.id, taskId: task.id, subtaskId: subtask.id, message: `${subtask.title} iniciada.` })
      for (let progress = 25; progress <= 100; progress += 25) {
        await sleep(220)
        if (isStopped()) return
        subtask.progress = progress
        task.progress = Math.min(98, Math.round(((subIndex + progress / 100) / task.subtasks.length) * 100))
        state.progress = task.progress
        state.lastEvent = subtask.title
        subtask.eventCount += 1
        task.eventCount += 1
        onAgents([...states]); onTasks([...tasks])
        if (progress === 50 || progress === 100) {
          emit({ id: crypto.randomUUID(), at: now(), type: progress === 100 ? 'subtask.finished' : 'tool.activity', agentId: agent.id, taskId: task.id, subtaskId: subtask.id, message: progress === 100 ? `${subtask.title} concluída.` : `${subtask.title}: atividade interna`, detail: progress === 100 ? undefined : 'Detalhes disponíveis no modo debug.' })
        }
      }
      subtask.status = 'SUCCESS'; subtask.progress = 100
      onTasks([...tasks])
    }

    task.status = 'SUCCESS'; task.progress = 100; task.finishedAt = now()
    state.status = 'SUCCESS'; state.progress = 100; state.currentTask = 'Concluído'; state.finishedAt = task.finishedAt; state.lastEvent = 'Tarefa concluída'
    onAgents([...states]); onTasks([...tasks])
    emit({ id: crypto.randomUUID(), at: now(), type: 'task.finished', agentId: agent.id, taskId: task.id, message: `${task.title} concluída.` })

    if (index < tasks.length - 1) {
      const next = tasks[index + 1]
      const nextAgent = snapshot.agents.find((item) => item.id === next.agentId)!
      emit({ id: crypto.randomUUID(), at: now(), type: 'handoff.created', agentId: 'orchestrator', taskId: task.id, message: `Handoff preparado para ${nextAgent.name}.`, detail: `Próxima tarefa: ${next.title}.` })
      await sleep(180)
      const nextState = states.find((item) => item.agentId === next.agentId)!
      nextState.status = 'QUEUED'; nextState.currentTask = next.title
      onAgents([...states])
    }
  }

  const orchestrator = states.find((item) => item.agentId === 'orchestrator')!
  orchestrator.status = 'SUCCESS'; orchestrator.currentTask = 'Execução concluída'; orchestrator.progress = 100; orchestrator.lastEvent = 'Entrega pronta para inspeção'
  onAgents([...states]); onTasks([...tasks])
  emit({ id: crypto.randomUUID(), at: now(), type: 'run.completed', agentId: 'orchestrator', message: 'Execução concluída. Todas as tarefas simuladas foram validadas.' })
}
