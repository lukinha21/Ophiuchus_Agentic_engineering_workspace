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
