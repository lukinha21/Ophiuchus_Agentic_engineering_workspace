# Projeto local supervisionado — primeira versão

## Como iniciar

1. Atualize o Ophiuchus, execute `npm ci` e reinicie API/frontend.
2. Configure um modelo real para o agente Desenvolvedor em Provedores.
3. No Console, use **Abrir pasta** no explorador lateral. No Windows, a API abre o seletor nativo de pastas via Windows PowerShell/Windows Forms; a seleção autoriza a leitura local dessa pasta. Cancelar a janela não abre projeto algum. Se a janela não estiver disponível (ou em outro sistema), o painel oferece entrada manual do caminho absoluto. A API deve rodar no mesmo computador em que você quer escolher a pasta.
4. A árvore aparece na lateral, no lugar da lista visual de agentes. Ela mostra somente os arquivos de texto permitidos. O início da aplicação permanece sem projeto aberto.
5. Use busca literal por nome ou conteúdo. Abra arquivos para conferir e marque até 8 para controlar o contexto, ou deixe a seleção automática localizar os mais relevantes ao pedido.
6. No console central, em **Contexto e permissões**, escolha **Analisar** ou **Propor alteração** e escreva o pedido no campo principal do chat. Autorize explicitamente o envio do pedido, dos caminhos e do conteúdo ao provedor configurado. Cada tarefa usa uma chamada limitada; não executa o pipeline completo de sete etapas.
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
