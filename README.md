# Ophiuchus Pilot 0.7 — Engineering Workspace

Evolução do protótipo 0.6, mantendo a simulação de orquestração e o Dashboard.

## Executar

```bash
npm install
npm run dev
```

Para validar a compilação localmente: `npm run build`.

## Mudanças no Pilot 0.7

- Nova identidade visual: imagem original enviada pelo usuário em `public/ophiuchus-mark.png`, exibida no dock e como favicon da aba do navegador.
- Scrollbars personalizadas em trilhos escuros, com indicador roxo/azulado; suporte a Firefox e navegadores WebKit.
- Regras globais de contenção horizontal e quebra de conteúdo, incluindo configurações, provedores, bindings, console, painel de agentes e Inspector.
- Grid de provedores se reorganiza automaticamente; formulários e botões de conexão se ajustam à largura disponível.
- Inspector em overlay quando o viewport fica menor que 1350 px, preservando espaço mínimo para o console.
- Modo Engenharia reformulado: indicadores de tarefas, eventos, agentes ativos e integridade; pipeline com filtros e subtarefas expansíveis; eventos recentes selecionáveis; acesso ao diagnóstico e Dashboard.
- Modo Foco preservado; Engenharia reduz a timeline redundante para dar espaço ao painel operacional.
- As preferências e dimensões dos painéis continuam salvas no navegador.

## Limitações honestas

O Pilot 0.7 continua **simulado**. Métricas de eventos/tarefas são derivadas da simulação local; tokens/custos reais dependem de ProviderAdapter e telemetria backend. Os catálogos de provedores são ilustrativos e nenhuma API key é coletada.

Verificações efetuadas neste ambiente: parsing de TSX via TypeScript e parsing dos CSS com PostCSS. Não foi possível concluir `npm install`, portanto o build completo e o comportamento visual em navegador não foram validados aqui.
