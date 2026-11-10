# Ophiuchus Pilot 0.8 — UI + control-plane inicial

## Frontend

```bash
npm install
npm run dev
```

Correção do bug: removida a regra `.v5-engineering{display:none!important}` que escondia a **raiz inteira** do aplicativo ao selecionar Engenharia. O modo Engenharia utiliza `.v7-engineering` para sua seção própria.

## Runtime real (primeira etapa, sem integração de IA)

O diretório `runtime/` implementa uma máquina de estados de orquestração, independente do React, com snapshot imutável das configurações dos agentes, handoffs, dois checkpoints humanos e retorno de validação QA/Revisor para o agente responsável. Uma falha de código volta para implementação → revisão → QA; falhas de requisitos voltam para especificação; falhas de arquitetura voltam para arquitetura. Limites: duas correções por etapa e cinco por execução, com bloqueio e intervenção humana ao exceder.

```bash
npm run test:runtime
npm run api
```

A API local em `127.0.0.1:4317` fornece `GET /health`, `GET /runs`, `POST /runs`, `GET /runs/:id`, `GET /runs/:id/events`, `POST /runs/:id/complete`, `POST /runs/:id/approve`, `POST /runs/:id/failure`, `POST /runs/:id/cancel`. `POST /runs` requer `{ "prompt": "...", "agents": [{"id":"orchestrator","role":"ORCHESTRATOR","enabled":true,"modelBinding":{"providerId":"...","modelId":"..."}}] }`. As alterações são salvas em `.ophiuchus-local/runs.json` (arquivo local, protótipo de persistência).

**Limites explícitos:** o frontend continua usando `simulateRun` e **ainda não está conectado** à API; a API avança etapas por comandos explícitos e **não executa modelos, ferramentas, shell, Git nem sandbox**. A persistência JSON é para desenvolvimento local, não produção. A API deve ganhar autenticação/autorização, validação forte, transações e armazenamento robusto antes de ser exposta em rede. Provedores e OAuth ainda são apenas interfaces demonstrativas.

## Próximo marco

Conectar o frontend à API com eventos em tempo real, adicionar ProviderAdapter/ModelRegistry, permissões aplicadas no backend e execução de ferramentas em sandbox.

## Pilot 0.9 — Console conectado ao control-plane

Execute **em dois terminais**:

```bash
npm run api
npm run dev
```

A interface usa `/api` com proxy Vite para `127.0.0.1:4317`. O backend é exclusivamente local e salva runs em `.ophiuchus-local/runs.json`. O console recupera a última run ao recarregar a página, acompanha o estado por polling a cada 1,2 s e mostra eventos, tarefas, checkpoints e handoffs. Para validar o ciclo de correção, avance manualmente até QA e clique **Reportar erro de código**; o Orquestrador retorna à Implementação, seguida de Revisão e QA.

**Importante:** não há chamadas de modelos, execução de ferramentas, testes de código nem credenciais reais. Os botões de avanço são comandos manuais para validar a máquina de estados. A configuração de provedores continua demonstrativa.

## Pilot 1.0 — ProviderRegistry / ModelRegistry (backend)

The control-plane exposes `GET /providers` (safe configuration status) and `GET /providers/:id/models` (live model discovery, requires configured API key). Initial adapters: OpenAI, OpenRouter, custom OpenAI-compatible HTTPS endpoint. Keys are read **only** from server environment variables (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `OPHIUCHUS_CUSTOM_API_KEY` and `OPHIUCHUS_CUSTOM_BASE_URL`), never returned to the UI or written to the run database. `generateText` is implemented and unit-tested but **not yet connected to run execution**; manual stage completion remains in effect. Custom endpoints should only be configured to trusted hosts because the backend sends credentials to them. Provider accounts/login OAuth are not implemented.

Example (PowerShell): `$env:OPENAI_API_KEY='your-key'; npm run api`. Then request `http://127.0.0.1:4317/providers` or `/providers/openai/models`. Model availability depends on your account and provider.

## Pilot 1.1 — Provider Control Center

A página de Provedores agora consulta `GET /providers` e `GET /providers/:id/models` no backend local. A descoberta de modelos requer a variável de ambiente correspondente (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, ou `OPHIUCHUS_CUSTOM_API_KEY` com `OPHIUCHUS_CUSTOM_BASE_URL`). A API não recebe segredos pelo navegador. A escolha de modelos por agente é persistida em `.ophiuchus-local/bindings.json` via `GET/PUT /bindings`; essa pasta é ignorada pelo Git. Os modelos selecionados entram no snapshot de novas runs, mas **não há ainda execução de inferência por agente**. OAuth de provedores e Google/Anthropic nativos ainda não estão implementados. O botão de descoberta só funciona em provedores suportados/configurados.

Para Windows PowerShell, antes de `npm run api`:

```powershell
$env:OPENAI_API_KEY="sua-chave"
npm run api
```

Em outro terminal: `npm install` e `npm run dev`. Não compartilhe sua chave nem faça commit dela. Para consultar um catálogo, abra Provedores, escolha um provedor configurado e clique em **Consultar modelos disponíveis**. Para salvar modelos por agente, abra **Agentes e modelos**.

## Pilot 1.2 — execução de uma etapa por IA

Com `OPENAI_API_KEY` no ambiente do servidor e modelos configurados na aba Provedores, inicie uma **nova run** para congelar os bindings. No Console, use **Executar etapa com IA** para chamar o modelo associado ao agente atual. A resposta é salva como artefato na run e pode ser expandida na interface. O QA devolve uma decisão estruturada ao Orquestrador, que reabre a etapa responsável em caso de falha. Aprovações humanas continuam obrigatórias.

- Execute `npm run api` e `npm run dev` em terminais separados.
- Cada clique chama uma API externa e pode gerar custos.
- Não existe execução de código, acesso a arquivos do projeto, terminal, testes reais nem edição automática. As respostas são propostas de IA, não entregáveis aplicados ao repositório.
- Para usar modelos selecionados depois de criar uma run, inicie outra run (snapshot imutável).
- Erros de rede ou respostas inválidas deixam a etapa atual intacta.
- O endpoint local `/runs/:id/execute` aceita uma execução por vez por run.


## Pilot 1.3 — Limites, Mock e economia de contexto

- `mock/offline` é um provedor local sem chamadas externas. Na tela **Provedores**, consulte modelos do Mock e vincule **todos** os agentes ao `mock/offline` **antes de iniciar uma nova run**. O Mock apenas valida o fluxo, não executa testes de código.
- Em **Configurações → Preferências**, selecione economia de contexto desligada, balanceada ou agressiva; defina saída de 128 a 4096 tokens, janela de artefatos e limite de caracteres. Opções são persistidas em `.ophiuchus-local/options.json` e congeladas no snapshot de cada nova run.
- Economia local por extração determinística de linhas relevantes de artefatos antigos (pruning). **Não é o algoritmo do OpenCode/9router, nem uma integração com seus serviços**; foi inspirada na estratégia pública de compactação, sem custo de sumarização por IA. A redução de tokens é aproximada e pode omitir informações importantes.
- HTTP 429 exibe dica e Retry-After quando fornecido, sem retry automático que gaste cota.
- Métrica de tokens mostra o uso reportado pelo provedor (Mock = 0); não é custo em moeda.
- Runs existentes preservam suas configurações; crie uma nova run para aplicar mudanças.


## Pilot 1.5 — Integridade e autonomia

- Respostas com `finish_reason: length` ficam em `pendingDraft` e **não avançam** a etapa. Clique novamente em **Executar etapa com IA** para continuar; o texto parcial é preservado. A continuação consome outra chamada e pode repetir texto.
- Limite de continuações por etapa (0–3) configurável nas Preferências; rascunho pode ser descartado. Ao esgotar, descarte o rascunho. Não há retries automáticos para HTTP 429.
- Cada artefato mostra `finishReason`, estado de integridade (`complete` apenas quando `stop`; demais são `unverified`), número de continuações e tokens de entrada/saída informados pelo provedor.
- Política de autonomia configurável para **novas runs**: `supervised` exige ambos os checkpoints; `semi` automatiza a revisão de especificação quando há artefato real com `stop`, mas exige aprovação humana antes da entrega; `autonomous` automatiza ambos quando há artefato real com `stop`.
- **Importante:** a aprovação automática é documental e baseada em regras simples, não uma revisão inteligente independente. Não há execução de código, compilação, testes reais, verificação semântica nem edição de arquivos. O QA é uma avaliação textual do modelo. Artefatos Mock e etapas concluídas manualmente não passam automaticamente pelos checkpoints.
- Visualização segura de Markdown (subconjunto: títulos, parágrafos, listas, tabelas, links HTTPS e blocos de código). Conteúdo não é interpretado como HTML e não há realce sintático avançado.
- O snapshot da configuração é criado ao iniciar uma nova run; runs antigas continuam supervisionadas.

### Validação

`npm run test:runtime` — testes do runtime com provedores simulados, sem custo. Não foram realizadas chamadas reais pagas.


## Pilot 1.6 — Rastreabilidade por subtarefa

- Cada subtarefa tem ID estável e registro persistido em `run.subtasks` quando existe artefato de etapa.
- O backend emite `subtask.evidence.linked` para associar o **mesmo** artefato às subtarefas da etapa. Não são chamadas separadas, testes executados ou trabalho individual comprovado.
- O Inspector conta eventos por `subtaskId` e indica **evidência documental (não verificada)**.
- Correções invalidam os vínculos de evidência das etapas dependentes e registram `subtask.evidence.invalidated`.
- Runs antigas continuam legíveis, mas não recebem eventos fictícios retroativos; podem exibir 0% nas subtarefas sem evidência persistida.
- A fase de workspace real e a execução de testes continuam fora do escopo.
