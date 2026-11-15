# Validação de projetos HTML e Canvas

Abra o Docker Desktop. Na proposta, use **Baixar e preparar navegador Docker** uma vez. O download precisa de internet e pode levar alguns minutos. Depois autorize **Testar cópia isolada**. O aplicativo não executa código do projeto no Windows.

A cópia é montada somente para leitura em um contêiner sem rede, sem privilégios adicionais e com limites de memória, processos e tempo. Dependências externas bloqueadas aparecem no resultado: não são silenciosamente consideradas aprovadas.

Sem roteiro, `BROWSER_SMOKE` verifica abertura, erros JavaScript, recursos locais e dimensões dos Canvas. Isso **não comprova as regras do jogo nem a aparência correta**.

Para interações reproduzíveis, inclua `ophiuchus.browser-tests.json` na raiz do projeto:

```json
{
  "cases": [{
    "name": "Iniciar partida",
    "path": "index.html",
    "steps": [
      {"action": "click", "selector": "#start"},
      {"action": "visible", "selector": "canvas"},
      {"action": "text", "selector": "#status", "value": "Jogando"}
    ]
  }]
}
```

As ações aceitas são `click`, `fill`, `press`, `visible`, `text` e `count`. `fill`, `press` e `text` recebem `value` textual; `count` recebe inteiro. São permitidos até 20 casos e 50 passos por caso. Cada caso abre uma página independente. Não há avaliação de JavaScript arbitrário no roteiro. O resultado `BROWSER_ASSERTIONS` cobre somente os casos declarados.

Projetos que precisam de bundler, serviços, login externo ou dependências baixadas em tempo de execução exigem uma configuração específica futura. Para eles, ou quando o Docker estiver indisponível, **Concluir sem testes aprovados** registra o motivo e preserva falhas anteriores. A ação não aplica arquivos nem transforma uma revisão da IA em teste executado.
