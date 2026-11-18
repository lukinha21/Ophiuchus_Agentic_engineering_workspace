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

type HistoryTurn = {role: 'user' | 'assistant'; content: string; draftId?: string}

const resendQuestion = 'O que você quer que eu mande novamente?'
const continuationQuestion = 'O que você quer continuar? Indique a conversa, a proposta ou o próximo passo.'
const correctionQuestion = 'Qual erro você quer corrigir? Mande a mensagem de erro ou indique o arquivo.'
const scopeQuestion = 'O que você quer que eu faça com isso? Posso explicar, analisar ou propor uma alteração.'
const resendChoice = 'Você quer que eu reenvie o guia ou a proposta?'
const clarificationMessages = new Set([resendChoice,resendQuestion, continuationQuestion, correctionQuestion, scopeQuestion])

function resolveContinuation(text: string, history: HistoryTurn[], inProject: boolean) {
  const latest = history.at(-1)
  const request = text.replace(/[,:]/g, ' ').replace(/\s+/g, ' ').replace(/^(?:por favor |entao )+/, '')
  const resendVerb = /\b(?:mand[ae]|mandar|envi[ae]|enviar|reenvi[ae]|reenviar|repit[ae]|repet[ei]|repetir|mostr[ae]|mostrar|receber)\b/
  const repeat = /\b(?:novamente|de novo|outra vez|mais uma vez)\b/
  const asksToResend = (/^(?:de novo|novamente)$/.test(request) || resendVerb.test(request) && repeat.test(request) ||
    /^(?:(?:voce )?(?:pode|consegue|poderia) )?(?:me )?(?:reenvie|reenvia|reenviar|repita|repete|repetir)\b/.test(request))
  const target = request
    .replace(/\b(?:por favor|de novo|outra vez|mais uma vez|do ophiuchus)\b/g, ' ')
    .replace(new RegExp(resendVerb.source, 'g'), ' ')
    .replace(/\b(?:me|voce|pode|pod[ei]ria|consegue|conseguiria|tem|como|quero|gostaria|de|o|a|um|uma|novamente|complet[ao])\b/g, ' ')
    .trim().replace(/\s+/g, ' ')
  const confirmsGuide = latest?.role === 'assistant' && latest.content === resendQuestion &&
    /^(?:o guia|o manual|a documentacao)(?: (?:complet[ao]|do ophiuchus))?$/.test(text)
  const requestsGuideAgain = resendVerb.test(request) && /^(?:guia|manual|documentacao)$/.test(target)
  const choosingProposal = latest?.role === 'assistant' && latest.content === resendChoice &&
    /^(?:a )?proposta$/.test(text)
  const choosingGuide = latest?.role === 'assistant' && latest.content === resendChoice &&
    /^(?:o )?(?:guia|manual)$/.test(text)
  if (choosingGuide) return {kind:'local', answer:productGuide.trim()} as const
  if (choosingProposal) {
    const proposal = [...history].reverse().find(turn => turn.role === 'assistant' && turn.draftId)
    if (proposal) return {kind:'local', answer:proposal.content, draftId:proposal.draftId} as const
  }
  if (confirmsGuide || requestsGuideAgain) return {kind: 'local', answer: productGuide.trim()} as const
  if (asksToResend) {
    const explicitLast = /^(?:ultima resposta|resposta anterior)$/.test(target)
    const vagueReference = /^(?:isso|isto|aquilo|ela|ele|esse|essa|mesma coisa|o mesmo)$/.test(target)
    const hasGuide = history.some(turn => turn.role === 'assistant' && turn.content.trimStart().startsWith('# Guia do Ophiuchus'))
    const proposal = [...history].reverse().find(turn => turn.role === 'assistant' && turn.draftId)
    if (!explicitLast && vagueReference && hasGuide && proposal) return {kind:'clarify', answer:resendChoice} as const
    if (/^proposta$/.test(target) && proposal) return {kind:'local', answer:proposal.content, draftId:proposal.draftId} as const
    if ((!target || vagueReference || explicitLast) && latest?.role === 'assistant' && latest.content.trim() && !clarificationMessages.has(latest.content)) {
      return {kind: 'local', answer: latest.content, draftId: latest.draftId} as const
    }
    return {kind: 'clarify', answer: resendQuestion} as const
  }

  if (/^(?:continue|continua|continuar|retome|retoma|retomar|tente de novo|tenta de novo|faca de novo|faz de novo|refaca|refaz|prossiga|siga)(?: (?:isso|isto|de onde parou|aqui|daqui|por favor))?$/.test(text)) {
    return {kind: 'clarify', answer: continuationQuestion} as const
  }

  if (/^(?:corrija|corrige|conserte|conserta|ajuste|arrume|altere|mude|fix) (?:isso|isto|esse (?:erro|bug)|that|it)$/.test(text)) {
    const recent = history.slice(-2).map(turn => turn.content).join(' ')
    // The project endpoint forwards the recent turns. The standalone engineering endpoint takes only the current request.
    const namedFile = /\b(?!node\.js\b)[\w.-]+\.(?:[cm]?[jt]sx?|py|java|go|rs|cs|cbl|html|css|json|md)\b/i.test(recent)
    const diagnostic = /\b(?:TypeError|SyntaxError|ReferenceError|ECONNRESET|ENOENT|ERR_[A-Z_]+)\b/.test(recent)
    const identifiesError = diagnostic || namedFile && /\b(?:erro|bug|falh\w*|exception|regressao|stack trace)\b/i.test(recent)
    if (!inProject || !identifiesError || latest?.content === correctionQuestion) return {kind: 'clarify', answer: correctionQuestion} as const
    return {kind: 'engineering'} as const
  }
  if (/^(?:isso|isto|esse|essa|o mesmo|a mesma coisa|faz isso|faca isso|pode|vai|manda|mande|pode mandar|arruma ai)(?: por favor)?$/.test(text)) {
    return {kind: 'clarify', answer: scopeQuestion} as const
  }
}

const identityAnswers = {
  introduction: 'Sou o Ophiuchus, seu assistente de engenharia de software.',
  capabilities: 'Posso explicar código, propor correções e coordenar uma equipe de agentes para tarefas maiores. Você revisa e aprova as alterações antes que elas sejam aplicadas ao projeto.',
}

export function routeIntent(prompt: string, history: HistoryTurn[] = [], now = new Date(),
  binding?: {providerId: string; modelId: string}, inProject = false) {
  const text = prompt.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[?!.]+$/, '').trim().replace(/\s+/g, ' ')
  const question = text.replace(/\b(?:oq|oque)\b/g, 'o que')
    .replace(/\bvc\b/g, 'voce').replace(/\bpra\b/g, 'para')

  const continuation = resolveContinuation(question, history, inProject)
  if (continuation) return continuation

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

  const instruction = question.replace(/^(?:por favor[ ,]+|preciso que (?:voce )?|quero que (?:voce )?|gostaria que (?:voce )?|(?:voce )?(?:pode|consegue|poderia) (?:me )?)+/, '')
  const change = /^(?:crie|cria|criar|implemente|implementa|implementar|corrija|corrige|corrigir|conserte|conserta|consertar|arrume|adicione|adiciona|adicionar|remova|remover|altere|alterar|mude|refatore|refatorar|gere|escreva|ajuste|simplifique|transforme|melhore|desenvolva|fix|implement|build|add|create)\s+(.+)$/.exec(instruction)
  if (change) {
    const target = change[1].replace(/(?:,? por favor| para mim| pra mim| ai| aqui)$/, '')
    if (/^(?:os? |as? )?(?:algo|alguma coisa|coisa|negocio|codigo|projeto|app|sistema|arquivos?|erros?|bugs?|problemas?|resto|tudo|outro|outra|outros|outras|o mesmo|mesma coisa)$/.test(target) ||
      /^(?:isso|isto|aquilo|ele|ela|esse|essa)(?:$| (?!erro$|bug$))/.test(target) ||
      /^(?:o|a|os|as) que (?:falei|pedi|conversamos|combinamos|falta|ficou faltando)$/.test(target)) {
      return {kind:'clarify', answer:scopeQuestion} as const
    }
    return {kind: 'engineering'} as const
  }
  if (/^(?:o que|por que|porque|qual|quais|quando|onde|quem|quanto|como|que |(?:me )?expli(?:que|ca)|analise|resuma|compare|oi|ola|obrigad[oa]|what|why|how|who|when|where|explain)\b/.test(question)) {
    return {kind: 'direct'} as const
  }
  return {kind: 'uncertain', answer: scopeQuestion} as const
}
