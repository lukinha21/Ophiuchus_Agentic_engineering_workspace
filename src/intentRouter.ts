type HistoryTurn = {role: 'user' | 'assistant'; content: string}

export function routeIntent(prompt: string, history: HistoryTurn[] = [], now = new Date()) {
  const text = prompt.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[?!.]+$/, '')
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
