import {clarificationOptions} from './intentRouter'

export default function ClarificationOptions({answer,onChoose}: {
  answer: string
  onChoose: (prompt: string) => void
}) {
  const options = clarificationOptions(answer)
  if (!options.length) return null
  return <div className="clarification-options" aria-label="Opções de esclarecimento">
    {options.map(option => <button key={option.label} type="button" onClick={() => onChoose(option.prompt)}>{option.label}</button>)}
  </div>
}
