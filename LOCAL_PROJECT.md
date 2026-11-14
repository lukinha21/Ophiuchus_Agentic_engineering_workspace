# Projeto local supervisionado — primeira versão

## Como iniciar

1. Atualize o Ophiuchus, execute `npm ci` e reinicie API/frontend.
2. Configure um modelo real para o agente Desenvolvedor em Provedores.
3. No Console, use **Abrir pasta** no explorador lateral. No Windows, a API abre o seletor nativo de pastas via Windows PowerShell/Windows Forms; a seleção autoriza a leitura local dessa pasta. Cancelar a janela não abre projeto algum. Se a janela não estiver disponível (ou em outro sistema), o painel oferece entrada manual do caminho absoluto. A API deve rodar no mesmo computador em que você quer escolher a pasta.
4. A árvore aparece na lateral, no lugar da lista visual de agentes. Ela mostra somente os arquivos de texto permitidos. O início da aplicação permanece sem projeto aberto.
5. Use busca literal por nome ou conteúdo. Abra arquivos para conferir e marque até 8 para controlar o contexto, ou deixe a seleção automática localizar os mais relevantes ao pedido.
6. No console central, em **Contexto e permissões**, escolha **Analisar** ou **Propor alteração** e escreva o pedido no campo principal do chat. Autorize explicitamente o envio do pedido, dos caminhos e do conteúdo ao provedor configurado. Cada tarefa usa uma chamada limitada; propostas truncadas permitem uma única recuperação automática, com escopo reduzido e possível custo adicional; não executa o pipeline completo de sete etapas.
7. Revise a proposta por arquivo. Ela já está numa cópia isolada, mas ainda não foi aplicada ao projeto original.
8. Opcionalmente autorize testes Node.js na cópia via Docker. Só são suportados testes nativos node:test, sem instalar dependências. Falta de Docker/dependências é apresentada como falha de execução, sem aprovação inferida.
9. Autorize gravação e clique em **Aplicar este arquivo**. **Desfazer este arquivo** recupera a versão do snapshot, ou remove um arquivo novo criado pela própria proposta. Alterações manuais posteriores bloqueiam o desfazer.

## Primeiro teste recomendado

Abra `examples/project-lab`, incluído no pacote. Ele contém uma pequena função com um erro proposital e testes existentes. Leia o README do laboratório. Não comece com uma cópia de produção ou com a pasta inteira do usuário.

## Limites e comportamento

- A concessão vale apenas para a pasta autorizada e dura até fechar o projeto ou reiniciar a API. Trocar de tela mantém o projeto durante a sessão; recarregar/iniciar a aplicação volta ao explorador vazio e exige selecionar a pasta novamente.
- Snapshots, metadados e backups ficam em `.ophiuchus-local/projects`, fora dos arquivos editados. Fechar a concessão não apaga os backups; revisão/limpeza de retenção e recuperação entre reinícios serão evoluções futuras. O desfazer na interface exige a sessão ativa. Evite reiniciar a API antes de concluir sua revisão.
- Até 1000 arquivos, 128 KiB por arquivo e 12 MiB de texto por snapshot; 12 snapshots por sessão. Arquivos UTF-8, sem binários. Não há monitoramento contínuo de mudanças externas.
- Contexto integral de até 8 arquivos e 24.000 caracteres, mais um catálogo limitado de caminhos; não é enviado o conteúdo da pasta inteira. Selecione arquivos menores quando o contexto não couber. Arquivos não fornecidos integralmente não podem ser sobrescritos pelo modelo.
- Até 4 arquivos por proposta. Sem exclusão ou renomeação automática. A aplicação é individual por arquivo, não uma transação única de vários arquivos. Revise mudanças dependentes em conjunto antes de aplicar.
- Dependências, builds, diretórios ocultos (com exceção de .gitignore/.editorconfig), nomes sensíveis comuns, links simbólicos e hard links são excluídos. Implementação local de padrões comuns de .gitignore, inclusive regras aninhadas; ainda não pretende reproduzir todos os casos avançados do Git. Confira a árvore e o contexto antes de transmitir conteúdo.
- Segredos embutidos em código/configurações com nomes comuns não podem ser reconhecidos de forma geral. Não autorize envio de arquivos com credenciais.
- Antes de aplicar/desfazer, hashes detectam edições concorrentes; arquivos são substituídos individualmente por rename local. O processo supõe um workspace de um único usuário confiável, não um sistema multiusuário hostil. Não é uma garantia contra toda corrida de filesystem.
- Nenhum comando arbitrário, script npm, hook Git ou instalador é executado no host. Não há integração Git, extensão VS Code ou instalador desktop nesta fase. Testes dependentes de Jest, TypeScript, banco, serviços e pacotes de node_modules precisarão de suporte posterior.
- Uma proposta e um parecer de IA não comprovam funcionamento. Resultados de teste exibidos se referem à cópia isolada, não a qualquer versão do projeto original editada depois.
- Uso informado pelo provedor entra no dashboard mesmo se o JSON proposto for inválido. Os relatórios de projeto são registrados como DOCUMENTED, sem serem confundidos com uma entrega validada pelo pipeline anterior.

## Validação desta versão

Testes automatizados cobrem autorização de leitura/envio/gravação/execução; arquivos omitidos; busca e contexto; snapshots; isolamento de escrita; aplicação; desfazer; conflitos; links; truncamento; revogação e rotas HTTP. Chamadas ao modelo e ao Docker são substituídas por respostas controladas nesses testes. Isso verifica o runtime, não a qualidade de uma nova geração nem a compatibilidade com todo projeto real.

## Recuperação limitada de propostas truncadas

- A primeira chamada pede trechos curtos e uma melhoria coerente. Se o provedor informar limite de saída, a resposta é guardada para diagnóstico e descartada integralmente.
- Há no máximo uma nova chamada, restrita ao primeiro arquivo do contexto (ordem da seleção ou do ranking automático), com até três substituições. O runtime rejeita conteúdo integral, arquivos novos ou outros caminhos nessa recuperação. A síntese avisa que o escopo foi reduzido; isso não significa que todo o pedido foi concluído.
- As duas chamadas mantêm o limite de 4.096 tokens de saída cada e compartilham prazo de 90 segundos. Não há continuação de JSON incompleto, loop de tentativas nem repetição automática de erros HTTP, JSON inválido ou análises truncadas.
- O dashboard registra cada tentativa separadamente e a proposta exibe o total informado pelas duas respostas, quando disponível. Respostas originais ficam em `response.json` e `response-retry.json` no mesmo snapshot; eventos registram motivo de término e número da tentativa.
- Gravação no original e testes continuam exigindo suas autorizações separadas. Recuperação não aplica arquivos.

## Equipe completa — versão 2.7.0

O modo padrão agora é **Equipe completa · 6 agentes**. Antes de enviar, configure e habilite Orquestrador, Arquiteto, Desenvolvedor, Revisor, QA e Documentação em Agentes e modelos. Cada execução congela os seis vínculos de modelo; mudar a configuração não altera o fluxo em andamento.

A sequência é Direção → Estrutura → Implementação → Revisão → Critérios → Entrega. O Orquestrador define o plano e critérios, o Arquiteto define contratos, e o Desenvolvedor prepara uma proposta isolada usando as saídas anteriores. Revisor e QA recebem os arquivos propostos completos, com os originais; a Documentação recebe esses arquivos e os pareceres. Arquivos que mudarem durante o planejamento bloqueiam a implementação; alterações posteriores ainda são protegidas pelos hashes na aplicação.

- A autorização de envio cobre até **7 chamadas**: uma por agente mais uma recuperação limitada do Desenvolvedor, somente em truncamento. Não há repetição automática de HTTP 429/503, nem de parecer inválido. Cada etapa tem limite de saída e prazo de 90 segundos; a execução tem prazo total de 8 minutos.
- Cada modelo faz uma etapa em sequência. Não são seis processos com ferramentas livres: os agentes não executam comandos nem gravam no original. O runtime faz os repasses e valida os resultados.
- Pareceres exigem verdict, síntese e evidência textual. Revisor ou QA podem bloquear o fluxo. Parecer inválido, truncamento em outra etapa, erro de provedor ou orçamento excedido interrompem a execução. Não há correção automática em loop; faça um novo pedido com o diagnóstico para preparar outra proposta.
- Um fluxo só permite aplicar sua proposta depois que todas as etapas terminam e os dois pareceres passam. **READY significa revisão estática concluída, não teste executado nem alteração aplicada.** Testes Docker e gravação/desfazer continuam com consentimentos e ações separados.
- O registro no chat mostra a etapa e os estados informados pelo backend, sem porcentagem estimada. Clique em uma estação para consultar seu artefato. A seção de execuções preserva o histórico durante a sessão, inclusive depois de Novo chat. Logs e respostas ficam em `projects/<sessão>/flows/<fluxo>.json` e no snapshot de implementação. Sessões e fluxos ativos não são recuperados automaticamente após reiniciar a API.
- Parar cancela o sinal da chamada e impede repasses posteriores. O projeto permanece ocupado até o encerramento da operação, pois uma requisição já enviada pode consumir tokens. Escrita nunca é disparada ao terminar ou cancelar.
- Os modos Analisar e Edição direta continuam disponíveis para pedidos com apenas o Desenvolvedor. Trocar o modo exige renovar a autorização de envio.

### Prévia visual sem custos

Execute `npm run preview:studio` e abra `http://127.0.0.1:5195/preview.html`. Essa entrada usa App, ProjectPanel e ProjectFlow reais com transporte inteiramente simulado. Um banner permanente identifica a simulação. Nenhuma chamada sai para modelos e nenhum arquivo real é lido ou gravado pela prévia. O bundle fica em `.studio-preview`, separado de `dist`; não faz parte do aplicativo de produção.

Cenários: `?state=review` mantém o Revisor em atividade; `?state=ready` mostra o fluxo completo; `?state=blocked` mostra uma rejeição. Sem parâmetro, a trilha avança em intervalos simulados. Abra o projeto demonstrativo, autorize o envio simulado e mande uma mensagem para observar o widget.
