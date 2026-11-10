# Ophiuchus Pilot 0.5 — Workspace Modes

Protótipo React + TypeScript + Vite. **Não executa modelos de IA reais.** A orquestração, os eventos e os estados são simulados. As métricas do Dashboard são demonstrativas.

## Executar

```bash
npm install
npm run dev
```

## O que mudou

- Identidade visual premium inspirada na referência enviada: dock de navegação, agentes e tarefas hierárquicos, console de conversa, card de tarefa ativa e composer persistente.
- Dois modos: **Foco** (padrão, informações essenciais) e **Engenharia** (plano completo, subtarefas e detalhes).
- Painel de preferências com alternância instantânea, densidade, sidebar, Inspector, métricas rápidas, animações e nível de detalhamento. Preferências salvas em `localStorage` do navegador.
- Inspector contextual por agente ou tarefa, com eventos de diagnóstico filtrados.
- Dashboard e configuração de provedores/bindings preservados do Pilot 0.4.
- Indicadores animados apenas durante a execução simulada.

## Limites conhecidos

- Modelos, conexões, autenticação OAuth/API keys, execução de ferramentas, persistência do histórico de runs e custos reais **ainda não estão implementados**.
- Métricas rápidas mostram apenas dados que a simulação realmente fornece (eventos/tarefas); tokens ficam indisponíveis.
- A simulação segue uma sequência predefinida e não gera artefatos reais.
- Preferências visuais persistem localmente, não entre dispositivos.
- Não há checkpoint humano real ainda.

## Próxima fase

Backend de orquestração, ProviderRegistry/ModelRegistry, persistência de tarefas e eventos, telemetria real, segurança e testes E2E.
