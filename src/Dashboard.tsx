import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, Clock3, Coins, Cpu, Database, Gauge, Layers3, ShieldCheck, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import type { AgentDefinition, RunEvent, TaskDefinition } from './domain'

type Props = { events: RunEvent[]; tasks: TaskDefinition[]; agents: AgentDefinition[]; running: boolean; onGoConsole: () => void }
const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const money = (n: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:4}).format(n)
const palette = ['#9187ff','#4ccfb4','#f5b66c','#5b9bff','#e589d6','#80b1ba']
const sample = [
  { id:'orchestrator', input:23480, output:6450, cost:0.0942, calls:17, latency:2.4 },
  { id:'architect', input:41600, output:12180, cost:0.1825, calls:29, latency:3.8 },
  { id:'developer', input:68400, output:22600, cost:0.1438, calls:44, latency:2.1 },
  { id:'reviewer', input:19800, output:5280, cost:0.0761, calls:14, latency:2.7 },
  { id:'qa', input:26800, output:7130, cost:0.0894, calls:20, latency:2.6 },
  { id:'documentation', input:12800, output:3920, cost:0.0351, calls:9, latency:1.8 },
]
const days = [42,54,49,73,63,85,68,93,81,100,89,72]
export default function Dashboard({events,tasks,agents,running,onGoConsole}:Props) {
  const [period,setPeriod] = useState('7d')
  const [metric,setMetric] = useState<'tokens'|'cost'>('tokens')
  const [demo,setDemo] = useState(true)
  const completed=tasks.filter(t=>t.status==='SUCCESS').length
  const rows=useMemo(()=>sample.map((s,i)=>({ ...s,agent:agents.find(a=>a.id===s.id),color:palette[i] })),[agents])
  const totalIn=rows.reduce((a,b)=>a+b.input,0), totalOut=rows.reduce((a,b)=>a+b.output,0)
  const totalCost=rows.reduce((a,b)=>a+b.cost,0)
  const max=Math.max(...rows.map(r=>metric==='tokens'?r.input+r.output:r.cost))
  return <section className="analytics-page">
    <div className="dash-top"><div><div className="eyebrow">OBSERVABILIDADE / ANALYTICS</div><h1>Visão geral <span className="heading-spark">✦</span></h1><p>Consumo de modelos, eficiência operacional e saúde da orquestração.</p></div><div className="dash-top-actions"><div className="period-picker">{['24h','7d','30d'].map(v=><button key={v} className={period===v?'chosen':''} onClick={()=>setPeriod(v)}>{v}</button>)}</div><button className="dash-console" onClick={onGoConsole}>Abrir console <ArrowRight size={15}/></button></div></div>
    <div className="demo-banner"><div><span className="demo-pulse"/><strong>Dados demonstrativos</strong><span>As métricas abaixo são um cenário ilustrativo, não medições reais. O período selecionado é apenas uma prévia visual.</span></div><button onClick={()=>setDemo(v=>!v)}>{demo?'Sobre os dados':'Entendi'}</button></div>
    {!demo&&<p className="demo-explainer">Na integração real, valores virão de registros de chamadas dos providers, preços versionados por modelo, execuções e eventos persistidos. Até lá, nenhum valor representa cobrança efetiva.</p>}
    <div className="kpi-grid">
      <Kpi icon={<Layers3 size={18}/>} label="Tokens processados" value={fmt(totalIn+totalOut)} meta={`${fmt(totalIn)} entrada · ${fmt(totalOut)} saída`} color="violet" />
      <Kpi icon={<Coins size={18}/>} label="Custo estimado" value={money(totalCost)} meta="Exemplo com tarifas fictícias" color="mint" />
      <Kpi icon={<Activity size={18}/>} label="Chamadas de modelo" value={fmt(rows.reduce((a,b)=>a+b.calls,0))} meta="Distribuídas em 6 agentes" color="blue" />
      <Kpi icon={<Gauge size={18}/>} label="Latência média" value="2,6 s" meta="Média ilustrativa por chamada" color="amber" />
    </div>
    <div className="analytics-grid">
      <section className="analytics-card consumption"><div className="analytics-head"><div><div className="eyebrow">MODELOS / USO</div><h2>Consumo por modelo</h2><p>Compare a participação de cada agente no volume de tokens.</p></div><div className="chart-switch"><button className={metric==='tokens'?'chosen':''} onClick={()=>setMetric('tokens')}>Tokens</button><button className={metric==='cost'?'chosen':''} onClick={()=>setMetric('cost')}>Custo</button></div></div>
      <div className="model-chart">{rows.map(r=><div className="model-row" key={r.id}><div className="model-label"><span className="model-dot" style={{background:r.color}}/><div><strong>{r.agent?.modelBinding.modelId ?? r.id}</strong><small>{r.agent?.name ?? r.id}</small></div></div><div className="model-track"><motion.div initial={{width:0}} animate={{width:`${(metric==='tokens'?r.input+r.output:r.cost)/max*100}%`}} transition={{duration:.7}} style={{background:`linear-gradient(90deg, ${r.color}88, ${r.color})`}}/></div><strong className="model-value">{metric==='tokens'?fmt(r.input+r.output):money(r.cost)}</strong></div>)}</div>
      <div className="chart-foot"><span><span className="legend-square input"/> Entrada: {fmt(totalIn)}</span><span><span className="legend-square output"/> Saída: {fmt(totalOut)}</span><span>Valores ilustrativos</span></div></section>
      <section className="analytics-card trend"><div className="analytics-head"><div><div className="eyebrow">ATIVIDADE / TREND</div><h2>Volume de execução</h2><p>Distribuição ilustrativa de atividade.</p></div><span className="subtle-tag"><Zap size={12}/> Simulado</span></div><div className="trend-chart">{days.map((v,i)=><div className="trend-column" key={i}><motion.div initial={{height:0}} animate={{height:`${v}%`}} transition={{duration:.6,delay:i*.035}} className={i===9?'peak':''}/></div>)}</div><div className="trend-axis"><span>Início</span><span>Período demonstrativo</span><span>Fim</span></div><div className="trend-summary"><div><small>Pico de atividade</small><strong>100%</strong></div><div><small>Tendência</small><strong className="up">+18,4% <ArrowUpRight size={14}/></strong></div></div></section>
      <section className="analytics-card operational"><div className="analytics-head"><div><div className="eyebrow">EXECUÇÃO / SAÚDE</div><h2>Saúde operacional</h2><p>Estado real da simulação atual, sem inventar telemetria.</p></div><ShieldCheck size={19} className="muted-icon"/></div><div className="health-grid"><div><small>Tarefas concluídas</small><strong>{completed}<span> / {tasks.length}</span></strong><div className="health-bar"><i style={{width:`${completed/tasks.length*100}%`}}/></div></div><div><small>Eventos registrados</small><strong>{events.length}</strong><div className="health-caption">Em memória, nesta sessão</div></div><div><small>Estado do piloto</small><strong className="health-status">{running?'Em execução':events.some(e=>e.type==='run.completed')?'Concluído':'Pronto'}</strong><div className="health-caption">Orquestração simulada</div></div><div><small>Falhas observadas</small><strong>{events.filter(e=>e.type.includes('failed')).length}</strong><div className="health-caption">Nos eventos desta sessão</div></div></div></section>
      <section className="analytics-card breakdown"><div className="analytics-head"><div><div className="eyebrow">EFICIÊNCIA / MODELOS</div><h2>Entrada × saída</h2><p>Distribuição ilustrativa do consumo de tokens.</p></div><Cpu size={19} className="muted-icon"/></div><div className="donut-area"><div className="donut" style={{background:`conic-gradient(#9187ff 0 ${(totalIn/(totalIn+totalOut))*100}%, #4ccfb4 ${(totalIn/(totalIn+totalOut))*100}% 100%)`}}><div><strong>{Math.round(totalIn/(totalIn+totalOut)*100)}%</strong><span>entrada</span></div></div><div className="donut-legend"><div><span className="legend-square input"/><span>Tokens de entrada</span><strong>{fmt(totalIn)}</strong></div><div><span className="legend-square output"/><span>Tokens de saída</span><strong>{fmt(totalOut)}</strong></div><div><span className="legend-square neutral"/><span>Modelos configurados</span><strong>{agents.length}</strong></div></div></div></section>
    </div>
    <section className="analytics-card metric-table"><div className="analytics-head"><div><div className="eyebrow">DETALHAMENTO</div><h2>Eficiência por modelo</h2><p>Valores demonstrativos para testar a apresentação de métricas.</p></div><span className="subtle-tag"><Database size={12}/> Sem backend de métricas</span></div><div className="table-scroll"><table><thead><tr><th>Modelo</th><th>Agente</th><th>Entrada</th><th>Saída</th><th>Chamadas</th><th>Latência</th><th>Custo estimado</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><span className="model-dot" style={{background:r.color}}/>{r.agent?.modelBinding.modelId}</td><td>{r.agent?.name}</td><td>{fmt(r.input)}</td><td>{fmt(r.output)}</td><td>{r.calls}</td><td>{r.latency.toFixed(1)} s</td><td>{money(r.cost)}</td></tr>)}</tbody></table></div></section>
    <div className="dash-bottom"><span><Clock3 size={14}/> Próxima etapa: conectar usage, custo e latência ao ProviderAdapter real.</span><button onClick={onGoConsole}>Voltar à execução <ArrowRight size={14}/></button></div>
  </section>
}
function Kpi({icon,label,value,meta,color}:{icon:ReactNode;label:string;value:string;meta:string;color:string}) {return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className={`kpi-card kpi-${color}`}><div className="kpi-top"><span>{label}</span><div className="kpi-icon">{icon}</div></div><strong>{value}</strong><small>{meta}</small></motion.div>}
