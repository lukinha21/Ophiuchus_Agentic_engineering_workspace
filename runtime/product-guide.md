# Guia do Ophiuchus

## 1. O que o aplicativo faz

O Ophiuchus é um estúdio desktop de engenharia de software. Você pode conversar sobre código, abrir uma pasta para analisar arquivos, pedir uma proposta de alteração e acompanhar uma equipe de agentes. Você mantém o controle sobre o contexto enviado, os testes executados e as alterações aplicadas.

O console atende tanto perguntas gerais quanto tarefas de engenharia. Um pedido pode partir de uma conversa sem projeto aberto ou de uma pasta local já existente. Este guia descreve os fluxos e controles disponíveis na versão desktop 2.15.1.

## 2. Arquitetura do aplicativo

- **Interface** em React e TypeScript, compilada com Vite. O console reúne conversa, arquivos, execução, histórico, configurações e diagnóstico.
- **Desktop** em Electron no Windows. O processo principal inicia e encerra um serviço local. A janela usa a API pela interface de loopback.
- **Runtime** em Node.js. Trata as permissões do projeto, mantém o estado das execuções, monta o contexto, chama provedores, valida respostas e supervisiona propostas e testes.
- **Provedores** chamados por adaptadores. O modelo e o provedor podem variar por agente. Cada fluxo registra os modelos selecionados no início. Uma troca autorizada durante a retomada fica registrada naquela execução.
- **Estado local** para configurações, cofre, execuções e propostas. No desktop, os dados do runtime ficam no perfil do aplicativo, normalmente em `%APPDATA%\Ophiuchus\state`. O histórico de conversas e preferências visuais usam armazenamento local da interface.

## 3. Como o console escolhe a rota

1. **Resposta local.** Identidade do Ophiuchus, perguntas de ajuda reconhecidas, data, hora e operações aritméticas simples. O próprio aplicativo responde.
2. **IA direta.** Perguntas e explicações usam um modelo. Com projeto aberto e envio autorizado, a análise pode incluir arquivos selecionados ou contexto escolhido pelo runtime. O chat usa o modelo associado ao Desenvolvedor nessa rota.
3. **Engenharia.** Pedidos de mudança seguem a execução de engenharia. A seleção usa o pedido, o contexto disponível e sinais de impacto. Em uma conversa de projeto, você também pode escolher manualmente **Automático**, **Equipe completa**, **Analisar** ou **Edição direta** em **Contexto e permissões**.

Uma referência vaga como “corrige isso” pode precisar de esclarecimento. Ao continuar uma conversa, o aplicativo usa um trecho do histórico recente para dar contexto ao pedido.

## 4. A equipe e a sequência de trabalho

| Agente | Responsabilidade |
|---|---|
| Orquestrador | Delimita o pedido, organiza o plano e define os critérios de aceite. |
| Arquiteto | Analisa a abordagem, as interfaces, os riscos e as dependências. |
| Desenvolvedor | Prepara as alterações na cópia isolada. |
| Revisor | Analisa a proposta em relação ao código, ao pedido e aos contratos. |
| QA | Verifica os critérios e procura regressões, casos negativos e lacunas de validação. |
| Documentação | Resume as alterações propostas, as limitações e as verificações pendentes. |

No modo automático de um projeto local, uma correção pontual pode passar só por **Desenvolvedor → Revisor → QA**. Pedidos que envolvem contratos, autenticação ou outras mudanças de maior impacto podem seguir a equipe completa desde o início. Se a proposta pontual afetar vários arquivos de produção ou um caminho sensível, o runtime pode ampliar o fluxo. Ele cria outra proposta e bloqueia a aplicação do rascunho substituído.

As etapas trocam resultados estruturados. Uma resposta inválida, uma falha de provedor ou uma reprovação pode interromper o fluxo. Cada execução tem orçamento e prazo. O console mostra o progresso, a etapa atual e as opções de retomada disponíveis.

## 5. Abrir um projeto e preparar uma mudança

1. No **Console**, clique em **Abrir um projeto** ou use **Abrir pasta** no Explorador da barra lateral.
2. Selecione a pasta que deseja autorizar para leitura. No Explorador, escolha os arquivos relevantes ou use a seleção automática de contexto.
3. Abra **Contexto e permissões** e autorize o envio ao modelo quando for usar IA com o projeto. O console mostra os arquivos incluídos no contexto.
4. Escreva o pedido com o comportamento esperado e, se possível, indique o arquivo ou o erro.
5. Acompanhe os agentes no cartão da execução. Quando a proposta estiver pronta, clique em **Revisar proposta**.
6. Na área **Arquivos**, confira o diff e o **Resumo da entrega**. Autorize gravação e aplique os arquivos individualmente quando estiver satisfeito.

O runtime trabalha com um recorte do projeto, respeita limites de contexto e exclui dependências, builds e nomes sensíveis comuns. As propostas ficam em uma cópia isolada. Ao aplicar, o runtime verifica conflitos com o original. A alteração de um arquivo aplicado pode ser desfeita pelo próprio painel quando a versão atual permite uma reversão segura.

## 6. Revisão, testes e entrega

O **Resumo da entrega** mostra três estados separados:

- **Revisão.** Registra se o fluxo concluiu a revisão estática, pede ajustes ou ainda aguarda pareceres. O modo de edição direta tem sua própria indicação.
- **Testes.** Mostra se foram executados e qual foi o resultado na cópia isolada. Uma checagem de abertura de página é identificada como tal.
- **Aplicação.** Mostra quantos arquivos da proposta já foram aplicados ao projeto.

Na aba **Testes** da área de trabalho, selecione a proposta, confira o plano disponível e autorize **Testar cópia isolada**. O suporte depende do projeto e do runner. Alguns projetos têm testes em Docker, incluindo cenários Node.js e testes de páginas no Chromium quando preparados. Uma entrega sem testes aprovados pode registrar o motivo quando o painel oferecer essa opção.

O status **Pronto para sua revisão** indica que a revisão estática foi concluída. Acompanhe separadamente o resultado dos testes e a aplicação dos arquivos.

## 7. Configurar provedores e modelos

- Abra **Provedores** na barra superior ou nas configurações da lateral.
- Na seção **Provedores**, desbloqueie o cofre local e configure a conexão suportada pelo provedor. O cofre mantém as credenciais criptografadas.
- Abra **Agentes e modelos**, escolha o papel e associe um provedor e um modelo.
- Use **Dashboard** na barra superior ou o ícone de gráfico da lateral para consultar execuções, uso registrado de modelos e resultados de testes. As métricas aparecem quando o runtime tem esses dados.

Uma etapa pode usar um modelo diferente das demais. Conectar um provedor e associar um modelo ao agente são configurações distintas. O acesso também depende da disponibilidade e da cota do provedor.

## 8. Diagnóstico e recuperação

No **Console**, ative **Modo Engenharia**. Clique em uma etapa do cartão dos agentes ou abra o **Inspector**. Em **Engenharia / Diagnóstico**, consulte **Resumo**, **Eventos** e **Entrada / saída** na execução de projeto. Você pode ver o estado, as tentativas, as chamadas registradas e os dados preparados para a etapa.

Se uma execução de projeto puder ser retomada, o cartão mostra o agente e o modelo envolvidos. Em caso de HTTP 429, você pode esperar ou escolher **Trocar modelo da etapa**. A retomada exige autorização e reaproveita as etapas concluídas. O modelo escolhido vale para aquela execução. A retomada depende do estado salvo, do orçamento e da integridade dos arquivos de contexto.

## 9. Histórico e retomada de conversas

O relógio da barra lateral abre ou fecha o **Histórico**. Busque pelo título ou filtre pelo projeto. A lista mostra a última atividade e pendências quando existem. Clicar em uma entrada abre a conversa no console principal.

Em chats de projeto, o diff salvo pode ser consultado antes de renovar o acesso à pasta. Se o aplicativo solicitar, autorize a leitura da pasta antes de continuar o trabalho. Uma execução interrompida só oferece retomada quando existe um ponto válido. Abrir uma conversa por si só não inicia chamadas, testes nem gravação.

O botão de lixeira remove uma conversa do histórico local depois de confirmar. Conversas que versões antigas mantinham apenas em memória não podem ser recuperadas pelo histórico.

## 10. Instalação, atualização e dados

No Windows, o aplicativo empacotado abre com o atalho **Ophiuchus** da área de trabalho e inicia o próprio serviço local. Em um checkout de desenvolvimento, a sequência usada para empacotar e instalar é:

```text
npm ci
npm run build
npm run desktop:package
npm run desktop:install
```

O instalador aponta o atalho existente para o último pacote, preservando o perfil e a instalação anterior. Se uma versão estiver aberta, encerre-a antes de reabrir pelo atalho. A atualização é instalada localmente a partir de um build empacotado.

## 11. O que confirmar antes de confiar em uma entrega

- Confira se os arquivos relevantes apareceram no contexto da execução.
- Abra os pareceres e o diff da proposta.
- Veja se o resultado registrado é revisão estática, checagem de abertura ou teste executado.
- Confirme quais arquivos foram aplicados no projeto.
- Se uma pergunta sobre a interface ou arquitetura exceder este guia e a ajuda interna, verifique o detalhe no aplicativo ou na versão do código em uso.
