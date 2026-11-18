import productHelp from '../runtime/product-help.json' with {type: 'json'}
import productGuide from '../runtime/product-guide.md?raw'

function answerProductQuestion(question: string) {
  const asks = /^(?:como|onde|qual|quais|o que|me (?:explica|explique|fala|fale|mostra|mostre)|explique|descreva)\b/
  const aboutOphiuchus = /\b(?:do ophiuchus|no ophiuchus|o ophiuchus|sua arquitetura|seu funcionamento|seu escopo|como voce funciona|voce funciona|seus agentes|voce usa)\b/
  const aboutExternalProject = /\b(?:do meu (?:app|projeto|sistema)|no meu (?:app|projeto|sistema)|deste projeto|desse projeto|dessa (?:aplicacao|funcao))\b/
  const alsoRequestsWork = /\be\s+(?:crie|adicione|implemente|corrija|remova|altere|refatore|gere|escreva)\b/
  if ((!asks.test(question) && !aboutOphiuchus.test(question)) ||
    aboutExternalProject.test(question) || alsoRequestsWork.test(question)) return undefined
  if (/^(?:crie|adicione|implemente|corrija|altere|refatore|gere|escreva)\b/.test(question)) return undefined
  if (/^(?:como|me (?:ensina|ensine) a) (?:eu |posso )?(?:criar|adicionar|implementar|programar|construir)\b/.test(question)) return undefined

  const requestsGuide = /\b(?:documentacao|guia|manual)\b/.test(question)
  const isComprehensive = /\b(?:complet[ao]|detalhad[ao]|escopo|tudo|geral)\b/.test(question)
  if (requestsGuide && isComprehensive && aboutOphiuchus.test(question)) return productGuide.trim()
  if (/\b(?:debug|diagnostico|inspector|modo engenharia|entrada \/ saida)\b/.test(question)) return productHelp.debug
  if (/\bdashboard\b/.test(question)) return productHelp.dashboard
  if (/\b(?:cofre|chave (?:de )?api|conectar (?:o )?(?:gemini|provedor))\b/.test(question)) return productHelp.vault
  if (/\b(?:historico|retomar (?:uma |a )?conversa)\b/.test(question)) return productHelp.history
  if (/\b(?:configur\w*|alter\w*|modific\w*|mud\w*|troc\w*|escolh\w*)\b.*\b(?:agentes?|modelos?)\b|\bagentes e modelos\b/.test(question)) return productHelp.agents
  if (aboutOphiuchus.test(question) && /\b(?:arquitetura|funciona|funcionamento|tecnologias?|stack|runtime|electron|backend)\b/.test(question)) return productHelp.architecture
  if (aboutOphiuchus.test(question) && /\b(?:agentes?|fluxos?|equipe|funciona)\b/.test(question)) return productHelp.workflow
}

type HistoryTurn = {role: 'user' | 'assistant'; content: string}

const identityAnswers = {
  introduction: 'Sou o Ophiuchus, seu assistente de engenharia de software.',
  capabilities: 'Posso explicar código, propor correções e coordenar uma equipe de agentes para tarefas maiores. Você revisa e aprova as alterações antes que elas sejam aplicadas ao projeto.',
}

export function routeIntent(prompt: string, history: HistoryTurn[] = [], now = new Date(),
  binding?: {providerId: string; modelId: string}) {
  const text = prompt.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[?!.]+$/, '').trim().replace(/\s+/g, ' ')
  const question = text.replace(/\b(?:oq|oque)\b/g, 'o que')
    .replace(/\bvc\b/g, 'voce').replace(/\bpra\b/g, 'para')

  if (/^(?:quem (?:e voce|voce e)|o que (?:e voce|voce e)|qual (?:e )?(?:o )?seu nome|who are you|what are you)$/.test(question)) {
    return {kind: 'local', answer: identityAnswers.introduction} as const
  }
  if (/^(?:(?:para que|o que) (?:voce (?:serve|faz|pode fazer)|serve o ophiuchus|faz o ophiuchus)|como voce pode me ajudar|what can you do|what do you do)$/.test(question)) {
    return {kind: 'local', answer: identityAnswers.introduction + ' ' + identityAnswers.capabilities} as const
  }
  if (/^(?:qual (?:modelo|ia) (?:voce (?:usa|esta usando)|e usado)|qual (?:e )?(?:o )?seu modelo|what model (?:are you using|do you use))$/.test(question)) {
    const answer = binding?.providerId && binding.modelId
      ? `O modelo configurado para respostas de IA neste chat é ${binding.modelId} (${binding.providerId}). A equipe de engenharia pode usar um modelo diferente por etapa.`
      : 'O chat está sem modelo de IA configurado. As respostas locais do Ophiuchus continuam disponíveis.'
    return {kind: 'local', answer} as const
  }
  const productAnswer = answerProductQuestion(question)
  if (productAnswer) return {kind: 'local', answer: productAnswer} as const

  if (/^(?:que dia e hoje|qual (?:e )?a data de hoje|data de hoje|what(?:'s| is) today'?s date)$/.test(text)) {
    return {kind: 'local', answer: new Intl.DateTimeFormat('pt-BR', {dateStyle: 'full'}).format(now)} as const
  }
  if (/^(?:que horas sao(?: agora)?|qual (?:e )?a hora(?: agora)?|what time is it)$/.test(text)) {
    return {kind: 'local', answer: new Intl.DateTimeFormat('pt-BR', {timeStyle: 'short'}).format(now)} as const
  }
  const calculation = /^(?:quanto e |calcule )?(-?\d+(?:[.,]\d+)?)\s*([+×*÷/−-])\s*(-?\d+(?:[.,]\d+)?)$/.exec(text)
  if (calculation) {
    const [, left, operator, right] = calculation
    const a = Number(left.replace(',', '.')), b = Number(right.replace(',', '.'))
    const result = operator === '+' ? a + b : operator === '-' || operator === '−' ? a - b :
      operator === '*' || operator === '×' ? a * b : a / b
    if (Number.isFinite(result)) {
      return {kind: 'local', answer: new Intl.NumberFormat('pt-BR', {maximumSignificantDigits: 15}).format(result)} as const
    }
    if ((operator === '/' || operator === '÷') && b === 0) {
      return {kind: 'local', answer: 'A divisão por zero é indefinida.'} as const
    }
  }

  const mutation = /\b(?:crie|cria|implemente|implementa|corrija|corrige|conserte|conserta|adicione|adiciona|remova|altere|mude|refatore|gere|escreva|ajuste|fix|implement|build|add|create)\b/
  const asksHow = /^(?:como (?:eu |posso )?|how (?:do i |can i ))/
  if (mutation.test(text) && !asksHow.test(text)) {
    const refersBack = /^(?:corrija|corrige|conserte|conserta|ajuste|fix) (?:isso|isto|esse (?:erro|bug)|that|it)$/.test(text)
    if (refersBack && !history.length) {
      return {kind: 'clarify', answer: 'Qual erro você quer corrigir? Mande a mensagem de erro ou indique o arquivo.'} as const
    }
    return {kind: 'engineering'} as const
  }
  if (/^(?:o que|por que|porque|qual|quais|quando|onde|quem|quanto|como|que |(?:me )?expli(?:que|ca)|analise|resuma|compare|oi|ola|obrigad[oa]|what|why|how|who|when|where|explain)\b/.test(text) || prompt.trim().endsWith('?')) {
    return {kind: 'direct'} as const
  }
  return {kind: 'engineering'} as const
}
