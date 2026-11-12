## Atualização 2.5.15 — estabilidade visual e sessão de trabalho

- Artefatos têm área de leitura limitada com rolagem interna vertical; código e tabelas longos rolam horizontalmente dentro do painel. Contêineres flex/grid deixam de herdar largura mínima do conteúdo. Avatar circular com ícone de pessoa substitui o texto Você.
- Progresso intermediário é estimativa visual baseada em tempo e arquivos locais, atualizado a cada 600 ms e limitado a menos de 100%. Conclusão depende do runtime; etapas reabertas deixam de aparecer concluídas só por constarem no histórico. Preferência de movimento reduzido continua disponível.
- Envio limpa o texto aceito pelo backend e impede envios duplicados durante a requisição. Se o usuário digitar outro texto enquanto aguarda, ele é preservado. Erro no envio preserva o prompt.
- Cancelar restaura console, prompt, tarefas, seleção, artefatos e explorador para novo trabalho; respostas e polls atrasados não restauram a execução anterior. Backend aceita cancelamento durante operação em andamento. O histórico é preservado no backend; provedores/bindings não são apagados. Requisição já enviada ao provedor pode terminar e consumir tokens, que ficam registrados sem avançar etapas ou aplicar arquivos.
- Catálogo de modelos guarda somente IDs no sessionStorage da aba, sobrevivendo à navegação/reload/runs até fechar a sessão. Chaves e tokens não entram nesse cache. Mudança de credencial/endpoint invalida catálogo correspondente; controle de autenticação segue no backend. Catálogo pode ser consultado novamente manualmente.
- Planejamento não recebe instruções de gerar código; blocos redundantes são omitidos do texto aceito sem nova chamada, mantendo resposta original para diagnóstico. Revisão exige evidence textual não vazia e recebe exemplo explícito; arrays não vazios de observações textuais são normalizados, arrays vazios continuam rejeitados.
- Verificação: 131 testes de runtime (incluindo projeção gradual, sessão de catálogo, evidência e cancelamento tardio) e build TypeScript/Vite aprovados. Prévia visual automatizada não pôde ser aberta neste ambiente; aparência e comportamento no navegador precisam de conferência na instalação do usuário. Nenhuma chamada real a provedor/Docker nesta validação.
- Instale com npm ci e reinicie API/frontend. Não é necessário apagar configurações ou histórico.

## Atualização 2.5.14 — histórico completo acessível

- Histórico mostra quantos documentos estão visíveis e o total. Botão Mostrar todos permite acessar os antigos, mantendo ordem dos mais recentes e conteúdo recolhível por documento.
- A seleção de histórico completo permanece durante atualizações da execução; iniciar nova execução volta aos quatro recentes. Nenhuma alteração nos artefatos persistidos ou chamadas aos modelos.
- Verificação: build TypeScript/Vite aprovado. Sem alteração no runtime.

## Atualização 2.5.13 — QA estático sem chamada redundante

- Docker indisponível + revisão estruturada favorável posterior à implementação e vinculada aos mesmos hashes: QA consolidado localmente, com zero tokens. Mantém STATIC_ONLY e informa que não houve segunda revisão independente.
- Arquivos alterados, revisão inválida/desfavorável ou falha Docker real não entram nesse reaproveitamento. Testes reais continuam tendo prioridade.
- Dashboard e contador do ciclo não contam artefatos locais ou reutilizados como chamadas pagas.
- Validação: 126 testes de runtime e build aprovados. Sem provedor real ou Docker nesta validação. Na execução anterior do usuário, a etapa QA redundante tinha 2.663 tokens; essa é a etapa que a nova regra elimina em condição equivalente, não uma promessa de economia total da próxima run.
- Atualize arquivos, execute npm ci, reinicie API/frontend e crie nova execução.

## Atualização 2.5.12 — implementação incremental por arquivo

- Fila de arquivos derivada dos caminhos entre crases na arquitetura da própria run, sem chamada extra ao modelo. Sem caminhos identificáveis, mantém o modo anterior de proposta completa. Não há algoritmo ou nome de negócio fixo.
- Uma chamada por arquivo, preservando fontes aceitas por verificações locais na run (não significa compilação). Só grava o conjunto quando estiver completo e validado. Correções que citam caminhos conhecidos reabrem somente esses arquivos; sem caminho explícito, refaz o conjunto para evitar preservar dependentes incorretos.
- Em modo por arquivo, resposta truncada é rejeitada com diagnóstico para uma versão compacta, sem concatenar rascunhos. Mesma falha duas vezes interrompe novas chamadas equivalentes; limites gerais continuam ativos.
- Testes orientados a casos compactos e verificações reutilizáveis. Instruções COBOL explicam declaração de dados e PERFORM sem USING, sem impor primalidade, intervalos ou nomes.
- UI mostra progresso por arquivo e artefatos parciais. Revisão desfavorável não pode ser reaproveitada por cache como aprovação.
- Validação: 122 testes de runtime e build aprovados; sem Docker e sem chamadas reais a provedores. Economia real ainda não medida. Uma chamada por arquivo pode aumentar o número de chamadas em projetos que antes cabiam em uma resposta; o objetivo é reduzir repetição e truncamento em saídas maiores.
- Atualize arquivos, execute npm ci, reinicie API/frontend e inicie nova execução. Runs antigas sem plano preservam o comportamento anterior.

## Atualização 2.5.11 — respostas inválidas e matriz de linguagens

- Revisão e QA preservam respostas inválidas como artefatos com uso de tokens, etapa, fontes e erro. Uma repetição orientada ocorre em um próximo passo do ciclo, respeitando seus limites de chamadas/tokens; segunda resposta inválida pausa com erro da etapa correta. Não há aprovação inferida de prosa.
- Implementação deve emitir apenas blocos de arquivos. Relatórios externos alegando compilação/execução são rejeitados e enviados como feedback; a interface identifica o conteúdo do modelo como alegação, sem substituir a evidência do runtime.
- Erro real encontrado na matriz: “em C#” podia ser classificado como C. Corrigido. Pré-verificação COBOL também rejeita PERFORM de parágrafo com USING.
- Matriz de protocolo com respostas controladas: COBOL, JavaScript, Python, Java, Go, Rust e C#. Cobre transporte de arquivos, resposta inválida, repetição com diagnóstico, QA e entrega canônica estática. Não equivale a geração real nem compilação nessas sete linguagens.
- 118 testes de runtime e build aprovados. Verificações funcionais adicionais locais: Python e JavaScript, 14 casos de primalidade em cada, com implementações de referência escritas para a verificação. Compiladores Java/Go/Rust/COBOL e Docker não disponíveis nesta validação; não foram instalados. Nenhuma chamada a provedores reais.
- Atualize arquivos, execute npm ci, reinicie API/frontend e inicie nova execução.

## Atualização 2.5.10 — qualidade e entrega canônica

- Entrega local sem chamada ao modelo: lista os arquivos da implementação e hashes, sem reescrever código. Verifica vínculo do QA com a mesma versão das fontes.
- Status visível distingue testes Docker aprovados de revisão somente estática. Docker não foi investigado nesta atualização.
- Revisão exige JSON estruturado; falhas voltam ao responsável. Parecer favorável em prosa não avança. Cache de revisões anteriores ao novo esquema não é reaproveitado.
- Verificações COBOL limitadas detectam DECLARE no formato inválido observado e referências WS-/LK-/TST- sem declaração no arquivo. Não são compilador nem prova de correção; a busca de identificadores é omitida em fontes com COPY/SQL, que podem fornecer declarações externas.
- 109 testes de runtime e build aprovados. Sem chamadas reais a provedores ou execução Docker nesta validação. Revisão estática por IA permanece sujeita a falhas.
- Atualize arquivos, execute npm ci, reinicie API/frontend e crie nova execução.

## Atualização 2.5.9 — feedback de rejeição e correções

- O desenvolvedor recebe um exemplo literal de delimitadores Markdown, com placeholders de caminho/conteúdo e linguagem da execução, sem regras de negócio fixas.
- A tentativa seguinte recebe o motivo da última rejeição destinada à etapa atual, com orientação para preservar os critérios de aceite e a lógica funcional.
- O ciclo automático respeita a rejeição já contabilizada pelo executor, não reaplica propostas antigas e não conta duas correções para a mesma resposta. Execuções bloqueadas retornam sem nova validação.
- Verificação: 104 testes de runtime aprovados e build de produção aprovado. Regressões cobrem resposta sem delimitadores, recuperação com feedback, ausência de gravação inválida e bloqueio após três chamadas rejeitadas. Provedor real e Docker não executados nesta verificação.
- Instalação: atualize os arquivos do projeto, execute npm ci e reinicie API/frontend. Faça uma nova execução para validar o fluxo completo; execuções já bloqueadas não são reabertas por esta atualização.

## Atualização 2.5.8 — contratos e continuidade

- Contratos COBOL/Java sem nomes, algoritmos, aleatoriedade ou limites de tarefas anteriores. Regras de negócio vêm somente do pedido da run atual.
- Nova run inicia sem artefatos, rascunhos ou contrato da anterior; configurações de modelos continuam independentes do histórico de tarefas.
- Planejamento e revisão orientados a respostas concisas, sem reescrever implementação. Contexto por etapa inclui apenas decisões relevantes e a versão mais recente de cada etapa.
- Implementação rejeita blocos reiniciados, delimitadores inválidos, caminhos duplicados e blocos abertos antes de propor arquivos. A correção volta ao desenvolvedor, sujeita aos limites existentes. Não há reparo silencioso nem garantia de sintaxe baseada em Markdown.
- A interface distingue artefatos rejeitados por integridade. Finalização do modelo não comprova compilação.
- Validação: 101 testes de runtime, incluindo isolamento entre pedidos e continuação malformada. Sem chamadas pagas ou execução Docker nesta verificação.
- Uso: instale dependências com npm ci; inicie API e frontend como anteriormente. Para testar pedidos independentes, crie uma nova execução. Uma execução existente mantém seu pedido e artefatos para permitir correções.

# Ophiuchus Pilot 2.5.4

Correção do contrato imutável de linguagem desde a criação da run. O contrato é persistido, enviado nas mensagens system e user de cada agente, registrado por etapa e validado antes da progressão em Discovery, Specification e Architecture. Rejeições de planejamento não consomem tentativas de correção de código e interrompem a execução assistida para diagnóstico.

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

## Pilot 1.7 — Workspace de arquivos com aprovação explícita

- Após a etapa **implementation**, o modelo pode propor arquivos em blocos como ` ```javascript file:src/index.js ` (com quebra de linha após o cabeçalho).
- O painel **Workspace real · Arquivos** permite inspecionar o conteúdo, selecionar arquivos e confirmar a gravação manualmente.
- Os arquivos são gravados exclusivamente em `.ophiuchus-local/workspaces/<run-id>/`, isolados por execução. Não são escritos no código-fonte do Ophiuchus nem em repositórios externos.
- Bloqueios de path traversal, caminhos absolutos, arquivos ocultos, symlinks, tamanho (128 KiB por arquivo) e quantidade (40 arquivos) são aplicados no backend.
- Cada aprovação de gravação gera evento `workspace.files.applied` na run.
- **Limites intencionais:** não há execução de shell, testes, git, edição automática ou validação de código. Arquivos são propostas de IA não confiáveis; revise antes de aprovar. A gravação substitui arquivos de mesmo nome no workspace da run. Não exponha a API local em rede pública.


## Pilot 1.8 — diffs e testes controlados

- **Comparar** exibe a versão já gravada e a proposta mais recente, sem alterar arquivos. É uma comparação lado a lado, não um algoritmo de diff por linha.
- **Executar testes (Docker)** exige seleção explícita do usuário, Docker instalado e imagem `node:22-alpine` já disponível localmente (ou acesso prévio para baixar a imagem manualmente). A chamada Docker não faz fallback para execução no host. Executa apenas arquivos `*.test.js`, `*.spec.js`, `*.test.mjs`, `*.spec.mjs`, `*.test.cjs`, `*.spec.cjs` usando `node --test`, sem instalar dependências. Para ESM `.js`, inclua `package.json` com `"type":"module"` no workspace.
- O contêiner é criado sem rede, com filesystem raiz somente leitura, workspace montado somente leitura, privilégios reduzidos e limites de CPU/memória/processos e timeout. **Docker não é uma fronteira de segurança absoluta**, especialmente em hosts compartilhados ou com daemon comprometido; execute somente projetos que você aceita testar e use máquina/VM descartável para código realmente hostil.
- O resultado dos testes é salvo na run com evento e saída limitada a 32 KB. Se houver falhas, o usuário pode autorizar a devolução ao Desenvolvedor; não ocorre reexecução automática de IA nem gasto automático.
- Ações de escrita continuam exigindo aprovação explícita. Os testes não podem editar o workspace.
- Não há suporte ainda a dependências npm, testes de navegador, CI ou execução de projetos de outras linguagens.

## Pilot 1.9 — geração de testes, editor e ciclo de correção

- O prompt de implementação solicita arquivos de código **e** testes `node:test`, além de `package.json` quando necessário. A geração depende da resposta do modelo; o sistema não inventa arquivos ausentes.
- O painel Workspace oferece **Criar arquivo de teste** e **Editar**, com confirmação explícita antes de salvar. Arquivos são limitados e validados pelo backend.
- A comparação de propostas agora mostra linhas adicionadas e removidas, com limite para diffs grandes.
- Quando uma execução Docker falha e o usuário autoriza **devolução ao Desenvolvedor** em uma run ainda RUNNING, a próxima chamada de implementação recebe o relatório real de falha, com saída limitada a 5.000 caracteres.
- Os testes continuam exigindo autorização humana, Docker e imagem `node:22-alpine`. Não há execução automática nem instalação de dependências.
- Limitação: o retorno para correção requer run RUNNING. Uma run SUCCESS não pode ser reaberta neste piloto. Não há validação automática de cobertura nem aprovação automática baseada em Docker.


## Pilot 2.0 — Experiência visual do Workspace

- Workspace reorganizado com abas Arquivos e Testes, listas com ícones, editor em destaque e diffs coloridos.
- Artefatos de agentes com cabeçalho, metadados separados, Markdown e blocos de código.
- O botão **Novo teste** abre um exemplo útil para `isPrime`, em vez de `1 + 1 === 2`; ajuste o caminho e o conteúdo conforme seu projeto.
- O sistema alerta quando existe `example.test.js`, que não valida o código da aplicação.
- **Para testar retorno ao Desenvolvedor sem API:** crie uma run Mock, avance até review ou QA, grave uma implementação defeituosa e um teste que falhe, execute o Docker na aba Testes, e autorize a devolução. O Mock verifica o roteamento, mas não corrige o código.
- O workspace e o estado da run são separados por ID. Uma run antiga não pode ser reaberta após SUCCESS.
- Não foram adicionadas chamadas de API, dependências ou permissões de execução automáticas.


## Pilot 2.0.1 — correção do Workspace oculto

Corrigida a compressão vertical de `.ophi-files` no layout flex do Console.
O painel não pode encolher para 2px, e a rolagem continua no centro do Console.
Arquivos, Testes, editor e comparação permanecem acessíveis dentro do painel.

## Pilot 2.2 — Ciclo assistido com autorização por run

No Console, abra **Ciclo assistido**. Autorize separadamente a gravação automática de arquivos propostos e a execução de testes no Docker. A aprovação automática de checkpoints é opcional. Configure limites de chamadas e tokens, depois clique em **Iniciar ciclo autorizado**. O botão **Pausar** interrompe o ciclo após a operação atual; não cancela uma chamada de IA já em andamento. O estado aparece no próprio painel e no histórico.

O ciclo executa os agentes em sequência, aplica as propostas de implementação autorizadas, exige ao menos um arquivo de teste, executa `node --test` em Docker quando chega ao QA e devolve falhas reais ao Desenvolvedor (até os limites do Orquestrador). A entrega não recebe aprovação automática sem evidência de testes reais aprovados. No modo Mock, a automação pausa sem gerar arquivos ou alegar validação. Erros HTTP 429, timeout, respostas incompletas, Docker indisponível e ausência de testes pausam o ciclo, sem fingir sucesso.

**Limitações:** o QA automatizado ainda executa apenas testes JavaScript; a existência de testes aprovados não comprova cobertura, segurança ou conformidade integral. As permissões são concedidas por run e são amplas para arquivos propostos dentro do workspace isolado; use apenas modelos e pedidos confiáveis. O limite de tokens é aproximado e pode ser ultrapassado por uma chamada em andamento. Não há orçamento financeiro garantido, nem retomada automática após reiniciar o servidor. Testes não são executados no host.

## Pilot 2.2 — Conexões de IA sem terminal

Em **Configurações → Provedores**, crie um cofre local com senha mestra de no mínimo 12 caracteres, desbloqueie-o e salve a API key de cada provedor. O cofre é criptografado com AES-256-GCM e chave derivada com scrypt; as chaves não são retornadas pela API e não são salvas no navegador. O arquivo fica em `.ophiuchus-local/credentials.enc`, excluído do Git. Após reiniciar a API, desbloqueie o cofre na interface para voltar a usar as chaves. Se perder a senha mestra, não há recuperação das chaves armazenadas.

Adaptadores reais: OpenAI, OpenRouter, Google Gemini (API nativa `generateContent`) e Anthropic Claude (API nativa `messages`). Mock continua offline. Custom OpenAI-compatible permite selecionar Groq, Together, Fireworks, DeepSeek, Mistral ou Cerebras, com HTTPS pré-aprovado; configure a chave customizada separadamente. Variáveis de ambiente continuam como fallback opcional. Não existe login OAuth nesta versão.

**Importante:** a API local deve permanecer em `127.0.0.1` e o Vite é apenas para desenvolvimento local. Não publique a API ou o Vite na rede/internet, nem compartilhe a pasta `.ophiuchus-local`. As chaves ficam disponíveis em memória enquanto o cofre estiver desbloqueado. As requisições podem ter custos no provedor. O botão Consultar modelos faz uma chamada à API do provedor, mas não gera texto. A descoberta de modelos depende das permissões da chave e da disponibilidade do catálogo. Uma assinatura de chat não substitui créditos de API.


## Pilot 2.3 — contrato de linguagem e testes Java
- A solicitação original define um contrato determinístico de linguagem, propagado a todos os agentes.
- Para pedidos Java, propostas com JS/Node/package.json são rejeitadas antes de gravar arquivos.
- Java é compilado com javac e testado via classes `*Test.java` com `public static void main`, sem dependências de rede, em Docker JDK 21.
- A imagem Docker `eclipse-temurin:21-jdk` precisa estar baixada previamente (`docker pull eclipse-temurin:21-jdk`), pois o contêiner roda sem rede.
- JUnit/Maven com dependências externas ainda não são suportados no runner offline.
- Python, C# e Go não usam fallback JavaScript: testes são bloqueados até existir runner próprio.
- Uma run anterior não muda seu contrato nem seus arquivos automaticamente: crie uma nova run.

## Pilot 2.4 — executor Docker multilíngue

Suporte a Node.js, Java, Go, Python, Rust e projetos C# de testes autocontidos. O Docker baixa automaticamente a imagem correspondente **na primeira execução** (`--pull missing`); não é necessário executar `docker pull` manualmente. Docker Engine deve estar instalado e funcionando. Cada execução requer autorização na interface ou política autorizada de ciclo. Contêiner sem rede, sem privilégios, com workspace somente leitura e limites de recursos. O daemon Docker precisa de internet na primeira obtenção da imagem; execução dentro do contêiner permanece sem rede. Bibliotecas externas não são baixadas durante os testes. Projetos C# dependentes de pacotes NuGet e suítes xUnit/NUnit/MSTest externas ainda não são suportados offline; use projetos de teste console autocontidos. Python usa `unittest`; Go usa `go test`; Rust usa `cargo test --offline`. O executor não garante isolamento absoluto de código hostil.


## Pilot 2.4.1 — QA e evidência real
- Parser de QA aceita JSON puro, cercado por Markdown e envolvido em texto, sem inferir aprovação de texto livre.
- Respostas inválidas são registradas no estado de diagnóstico do QA; ciclo pausa em vez de avançar.
- QA do modelo e resultados Docker são indicadores separados. Aprovação automática de entrega exige ambos.
- Autorização de testes indica a linguagem detectada, em vez de JavaScript fixo.
- As imagens multilíngues do Pilot 2.4 foram preservadas.

## Pilot 2.5 — contexto íntegro e dashboard real
- Dashboard usa `GET /api/metrics?days=1|7|30` sobre runs persistidas; não exibe dados fictícios nem inventa preços/latência.
- Histórico compactado continua econômico, mas review/QA recebem arquivos integrais da implementação em um bloco separado, com SHA-256, bytes e origem (disco ou proposta).
- Contexto de código acima do limite seguro bloqueia a etapa com erro explícito, em vez de truncar silenciosamente.
- O Docker continua sendo a fonte da evidência de execução; o parecer do QA é exibido separadamente.
- Não há integração com preços de provedores nem telemetria de duração, portanto esses números não são mostrados.


### Pilot 2.5.2 — COBOL
- Contrato COBOL explícito, impede geração de JavaScript como fallback.
- Testes COBOL no Docker via GnuCOBOL (`cobc -x -free`), sem rede e sem execução no host.
- Imagem padrão `gnucobol/gnucobol:latest` **não validada neste ambiente**. Se não estiver disponível, configure `OPHIUCHUS_COBOL_IMAGE` para uma imagem GnuCOBOL verificada; o sistema deve falhar sem aprovar testes.
- OAuth PKCE OpenRouter implementado (callback localhost, validação state, troca de código no backend, armazenamento criptografado no cofre). Outros provedores continuam com API key; não há OAuth universal.


## Pilot 2.5.6: Docker COBOL e economia de contexto

A imagem antiga `gnucobol/gnucobol:latest` não está disponível no Docker Hub.
Construa uma imagem local uma vez (é necessário acesso à rede somente no build):

```bash
docker build -f docker/Dockerfile.gnucobol -t ophiuchus-gnucobol:local .
```

O executor usa `ophiuchus-gnucobol:local` por padrão ou `OPHIUCHUS_COBOL_IMAGE` se configurada.
Se a imagem não existir, o Docker falhará e a run poderá prosseguir com revisão estática, **sem** alegar que os testes passaram.
Falhas definitivas de imagem/repositório não são repetidas três vezes.

O histórico enviado aos modelos contém resumos curtos das decisões sem copiar blocos de código; a fonte canônica completa é transmitida separadamente nas etapas que precisam dela. O objetivo é reduzir tokens de entrada, não alterar o código entregue.

## Pilot 2.5.7 — Diagnóstico Docker e validação honesta

- Antes do QA, o autopilot verifica o daemon Docker sem chamadas a modelos. Para COBOL também verifica a imagem local e inicia o compilador sob as mesmas restrições de segurança usadas pelo executor.
- Para construir a imagem COBOL: `docker build -f docker/Dockerfile.gnucobol -t ophiuchus-gnucobol:local .`
- COBOL usa `/tmp:rw,exec,nosuid,size=64m` para permitir executar os binários compilados. Rede desativada, rootfs somente leitura, usuário não privilegiado e limites permanecem.
- Go encontra `go.mod` na raiz ou em subpastas e executa `go test -p 1 ./...` a partir de cada módulo, sem downloads de dependências.
- O resultado de cada teste registra argumentos do Docker, imagem, duração, código de saída e saída (limitada a 64 KiB); os eventos do QA também registram esses dados.
- Falhas definitivas de imagem interrompem novas tentativas. Erros de compilação ou de testes não autorizam fallback estático. Se a infraestrutura falhar, o fluxo segue com `dockerValidation.status=UNAVAILABLE` e revisão estática obrigatória, sem alegar que testes passaram.
- Execute `npm run test:runtime` para verificar o runtime. O pré-diagnóstico Docker real requer Docker instalado na máquina do usuário; os testes unitários usam simulações controladas.

## Pilot 2.5.7.1 — Correções de QA e Docker (11/11/2026)

- Pré-diagnóstico COBOL com diretório temporário real do host (`os.tmpdir()`), compatível com Windows/Linux, e limpeza automática.
- Smoke test efetivo: compila `smoke.cob` e executa binário com as mesmas restrições do executor (`--read-only`, `--network none`, usuário 65534, tmpfs `/tmp` com `exec`). Exige marcador `COBOL_SMOKE_OK` na saída.
- Falhas Docker registram código de saída, sinal, timeout, saída e comando executado, inclusive quando a saída está vazia.
- Antes do QA por IA, compilação sintática COBOL determinística (`cobc -fsyntax-only -free`) quando o Docker estiver disponível; erro de código retorna para correção, falha de infraestrutura ativa `STATIC_ONLY`.
- `DOCKER_VERIFIED` exige status Docker `PASSED`, `qaVerified=true` e relatório de teste aprovado vinculado por ID.
- Cache por hash SHA-256 dos arquivos de código para não repetir revisão/QA idênticos sem mudança nos arquivos; QA exige a mesma evidência Docker.
- `STATIC_ONLY` permanece uma avaliação estática, sem afirmar testes executados.

### Testes locais

```powershell
npm install
npm run test:runtime
node --input-type=module -e "import {dockerPreflight} from './runtime/test-runner.mjs'; console.log(JSON.stringify(await dockerPreflight({language:'cobol'}), null, 2))"
npm run api
```

Em outro terminal: `npm run dev`.

Se faltar a imagem COBOL:

```powershell
docker build -f docker/Dockerfile.gnucobol -t ophiuchus-gnucobol:local .
```

**Limites da validação desta entrega:** 94 testes de runtime passaram no ambiente de geração. Docker não está instalado nesse ambiente, portanto o smoke test real e o frontend no Windows precisam ser conferidos na máquina do usuário. O build de frontend requer `npm install` e não foi validado neste ambiente.
