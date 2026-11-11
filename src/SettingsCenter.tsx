import { useEffect, useState } from 'react'
import { api } from './runtimeClient'
import { ArrowLeft, Check, ChevronDown, CircleHelp, ExternalLink, KeyRound, Link2, LockKeyhole, PlugZap, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { AgentDefinition } from './domain'

export type ProviderId = 'openai' | 'google' | 'anthropic' | 'openrouter' | 'custom' | 'mock'
export type Connection = { provider: ProviderId; method: 'api_key' | 'oauth'; label: string; connected: boolean }
export const providers: { id: ProviderId; name: string; description: string; models: string[]; oauth: boolean; url: string }[] = [
  { id: 'mock', name: 'Mock offline', description: 'Simulação sem internet, chave ou custo', models: ['mock/offline'], oauth: false, url: '' },
  { id: 'openai', name: 'OpenAI', description: 'GPT e modelos de codificação', models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'codex-mini-latest'], oauth: false, url: 'https://platform.openai.com/api-keys' },
  { id: 'google', name: 'Google Gemini', description: 'Família Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'], oauth: true, url: 'https://aistudio.google.com/apikey' },
  { id: 'anthropic', name: 'Anthropic', description: 'Família Claude', models: ['claude-sonnet-4-5', 'claude-opus-4-1'], oauth: false, url: 'https://console.anthropic.com/settings/keys' },
  { id: 'openrouter', name: 'OpenRouter', description: 'Gateway para múltiplos modelos', models: ['openai/gpt-5', 'google/gemini-2.5-pro', 'anthropic/claude-sonnet-4.5'], oauth: true, url: 'https://openrouter.ai/settings/keys' },
  { id: 'custom', name: 'Custom / OpenAI-compatible', description: 'Endpoint próprio e modelos manuais', models: [], oauth: false, url: '' },
]

const tips: Record<string,string> = {
  providers: 'Uma conexão autentica o acesso ao provedor. O modelo de cada agente é escolhido separadamente.',
  bindings: 'Bindings FIXED são copiados para o Run Snapshot. Alterações só afetam a próxima execução.',
  security: 'As chaves são enviadas somente à API local e armazenadas criptografadas com sua senha mestra. Nunca são retornadas ao navegador. OAuth PKCE disponível para OpenRouter. Google Gemini exige projeto Google Cloud e configuração OAuth; OpenAI API usa chaves ou identidade de workload, não login OAuth de assinatura ChatGPT.',
}
function Help({text}:{text:string}) { const [open,setOpen]=useState(false); return <span className="help-tip"><button type="button" className="help-trigger" aria-label={`Ajuda: ${text}`} aria-expanded={open} onClick={()=>setOpen(v=>!v)} onBlur={()=>setTimeout(()=>setOpen(false),180)}><CircleHelp size={14}/></button>{open&&<span role="tooltip" className="help-content">{text}</span>}</span> }
export default function SettingsCenter({agents, onUpdate, onBack}:{agents:AgentDefinition[]; onUpdate:(id:string,provider:string,model:string)=>void; onBack:()=>void}) {
  const [tab,setTab]=useState<'providers'|'bindings'|'preferences'>('providers')
  const [oauthLoading,setOauthLoading]=useState(false)
  const [selected,setSelected]=useState<ProviderId>('openai')
  const [query,setQuery]=useState('')
  const [method,setMethod]=useState<'api_key'|'oauth'>('api_key')
  const [connections,setConnections]=useState<Connection[]>([])
  const [vault,setVault]=useState({exists:false,unlocked:false,configured:[] as string[]})
  const [vaultPassword,setVaultPassword]=useState('')
  const [customEndpoint,setCustomEndpoint]=useState('https://api.groq.com/openai/v1')
  const [showSecret,setShowSecret]=useState(false)
  const [secret,setSecret]=useState('')
  const [serverProviders,setServerProviders]=useState<Array<{id:string;name:string;configured:boolean;kind:string}>>([])
  const [serverModels,setServerModels]=useState<Record<string,string[]>>({})
  const [busy,setBusy]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [options,setOptions]=useState({mode:'off',maxOutputTokens:1400,historyArtifacts:7,artifactChars:6500,keepRecent:2,autonomy:'supervised',maxContinuations:2})
  const [optionsSaved,setOptionsSaved]=useState('')
  useEffect(()=>{api<typeof options>('/execution-options').then(setOptions).catch(()=>{})},[])
  const saveOptions=async()=>{try{const saved=await api<typeof options>('/execution-options',options,'PUT');setOptions(saved);setOptionsSaved('Configurações salvas. Serão aplicadas às próximas runs.')}catch(e){setOptionsSaved((e as Error).message)}}
  useEffect(()=>{let live=true;api<Array<{id:string;name:string;configured:boolean;kind:string}>>('/providers').then(p=>{if(live)setServerProviders(p)}).catch(e=>{if(live)setFeedback('API offline: '+e.message)});return()=>{live=false}},[])
  const refreshProviders=async()=>{const [v,p]=await Promise.all([api<typeof vault>('/vault'),api<typeof serverProviders>('/providers')]);setVault(v);setServerProviders(p)}
  useEffect(()=>{void refreshProviders().catch(()=>{})},[])
  const unlock=async()=>{setBusy(true);setFeedback('');try{await api('/vault/unlock',{password:vaultPassword});setVaultPassword('');await refreshProviders();setFeedback('Cofre desbloqueado. Você pode salvar suas chaves.')}catch(e){setFeedback((e as Error).message)}finally{setBusy(false)}}
  const lock=async()=>{setBusy(true);try{await api('/vault/lock',{});setSecret('');await refreshProviders();setFeedback('Cofre bloqueado.')}catch(e){setFeedback((e as Error).message)}finally{setBusy(false)}}
  const saveEndpoint=async()=>{setBusy(true);try{await api('/vault/custom-endpoint',{baseUrl:customEndpoint},'PUT');await refreshProviders();setFeedback('Endpoint HTTPS autorizado e salvo no cofre.')}catch(e){setFeedback((e as Error).message)}finally{setBusy(false)}}
  const saveKey=async()=>{setBusy(true);setFeedback('');try{await api(`/vault/credentials/${selected}`,{key:secret},'PUT');setSecret('');await refreshProviders();setFeedback('Chave salva no cofre criptografado.')}catch(e){setFeedback((e as Error).message)}finally{setBusy(false)}}
  const deleteKey=async()=>{if(!window.confirm('Remover a chave salva deste provedor?'))return;setBusy(true);try{await api(`/vault/credentials/${selected}`,{},'DELETE');await refreshProviders();setFeedback('Chave removida do cofre.')}catch(e){setFeedback((e as Error).message)}finally{setBusy(false)}}
  const discover=async(id:string)=>{setBusy(true);setFeedback('');try{const models=await api<Array<{id:string}>>(`/providers/${id}/models`);setServerModels(p=>({...p,[id]:models.map(m=>m.id)}));setFeedback(`${models.length} modelos encontrados em ${id}.`)}catch(e){setFeedback((e as Error).message)}finally{setBusy(false)}}
  const beginGoogleOAuth=async()=>{
   if(!vault.unlocked){setFeedback('Desbloqueie o cofre antes de conectar Google.');return}
   setOauthLoading(true);setFeedback('');
   try{
    const config=await api<{enabled:boolean;clientId:string|null}>('/oauth/google/config');
    if(!config.enabled||!config.clientId)throw Error('Configure OPHIUCHUS_GOOGLE_CLIENT_ID e OPHIUCHUS_GOOGLE_CLIENT_SECRET na API local e reinicie. É necessário criar um aplicativo OAuth no Google Cloud.');
    const verifier=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    const challenge=btoa(String.fromCharCode(...hash)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const state=crypto.randomUUID();const callback=new URL(window.location.href);callback.search='';callback.hash='';
    sessionStorage.setItem('ophiuchus.google.pkce',JSON.stringify({verifier,state,redirectUri:callback.toString(),created:Date.now()}));
    const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id',config.clientId);auth.searchParams.set('redirect_uri',callback.toString());auth.searchParams.set('response_type','code');
    auth.searchParams.set('scope','https://www.googleapis.com/auth/generative-language.retriever https://www.googleapis.com/auth/cloud-platform');
    auth.searchParams.set('access_type','offline');auth.searchParams.set('prompt','consent');auth.searchParams.set('state',state);
    auth.searchParams.set('code_challenge',challenge);auth.searchParams.set('code_challenge_method','S256');
    window.location.assign(auth.toString());
   }catch(e){setFeedback((e as Error).message);setOauthLoading(false)}
  };
  const beginOpenRouterOAuth=async()=>{
   if(!vault.unlocked){setFeedback('Desbloqueie o cofre antes de entrar com OpenRouter.');return}
   setOauthLoading(true);setFeedback('');
   try{
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    const challenge=btoa(String.fromCharCode(...hash)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const state=crypto.randomUUID();
    sessionStorage.setItem('ophiuchus.openrouter.pkce',JSON.stringify({verifier,state,created:Date.now()}));
    const callback=new URL(window.location.href);callback.search='';callback.hash='';
    const url=new URL('https://openrouter.ai/auth');
    url.searchParams.set('callback_url',callback.toString());url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');url.searchParams.set('state',state);url.searchParams.set('key_label','Ophiuchus');
    window.location.assign(url.toString());
   }catch(e){setFeedback((e as Error).message);setOauthLoading(false)}
  };
  useEffect(()=>{
   const params=new URLSearchParams(window.location.search);const code=params.get('code');
   if(!code)return;
   const googleRaw=sessionStorage.getItem('ophiuchus.google.pkce');
   if(googleRaw){
    window.history.replaceState(null,'',window.location.pathname);sessionStorage.removeItem('ophiuchus.google.pkce');
    let saved:{verifier:string;state:string;redirectUri:string;created:number};try{saved=JSON.parse(googleRaw)}catch{setFeedback('Estado Google OAuth inválido');return}
    if(params.get('state')!==saved.state||Date.now()-saved.created>10*60*1000){setFeedback('Google OAuth expirado ou estado inválido');return}
    setSelected('google');setMethod('oauth');setOauthLoading(true);
    void api('/oauth/google/exchange',{code,verifier:saved.verifier,redirectUri:saved.redirectUri}).then(async()=>{await refreshProviders();setFeedback('Google Gemini conectado via OAuth. Token de atualização protegido no cofre.');}).catch(e=>setFeedback((e as Error).message)).finally(()=>setOauthLoading(false));return;
   }
   const raw=sessionStorage.getItem('ophiuchus.openrouter.pkce');
   if(!raw)return;
   window.history.replaceState(null,'',window.location.pathname);
   sessionStorage.removeItem('ophiuchus.openrouter.pkce');
   let saved:{verifier:string;state:string;created:number};
   try{saved=JSON.parse(raw)}catch{setFeedback('Estado OAuth inválido');return}
   if(params.get('state')!==saved.state||Date.now()-saved.created>10*60*1000){setFeedback('OAuth expirado ou estado inválido. Recomece.');return}
   setSelected('openrouter');setMethod('oauth');setOauthLoading(true);
   void api('/oauth/openrouter/exchange',{code,verifier:saved.verifier}).then(async()=>{await refreshProviders();setFeedback('OpenRouter conectado com OAuth PKCE. Chave salva no cofre.');}).catch(e=>setFeedback((e as Error).message)).finally(()=>setOauthLoading(false));
  },[]);
  const isConfigured=(id:string)=>serverProviders.some(p=>p.id===id&&p.configured)
  const provider=providers.find(p=>p.id===selected)!
  const available=providers.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()))
  return <section className="settings-page">
    <div className="settings-top"><div><div className="eyebrow">CONTROL CENTER / PILOT 1.5</div><h1>Configurações</h1><p>Conexões, modelos e comportamento da sua fábrica de software.</p></div><button className="outline-action" onClick={onBack}><ArrowLeft size={15}/> Voltar ao console</button></div>
    <div className="settings-banner"><ShieldCheck size={19}/><div><strong>Conexões gerenciadas pelo backend local</strong><p>Salve suas chaves no cofre criptografado local. A senha mestra é necessária após reiniciar a API; nenhuma chave aparece nas respostas do backend. Variáveis de ambiente continuam opcionais.</p></div></div>
    <div className="settings-layout"><nav className="settings-sidebar" aria-label="Seções de configuração"><button className={tab==='providers'?'active':''} onClick={()=>setTab('providers')}><PlugZap size={17}/> Provedores <ChevronDown size={14}/></button><button className={tab==='bindings'?'active':''} onClick={()=>setTab('bindings')}><Sparkles size={17}/> Agentes e modelos <ChevronDown size={14}/></button><button className={tab==='preferences'?'active':''} onClick={()=>setTab('preferences')}><SlidersHorizontal size={17}/> Preferências <ChevronDown size={14}/></button></nav><div className="settings-content">
      {tab==='providers' && <><div className="settings-section-heading"><div><h2>Provedores de IA <Help text={tips.providers}/></h2><p>Escolha como pretende autenticar cada serviço.</p></div><span className="settings-count">{serverProviders.filter(p=>p.configured).length} provedores configurados</span></div><div className="provider-grid"><div className="provider-list"><div className="provider-search"><Search size={15}/><input placeholder="Buscar provedor..." value={query} onChange={e=>setQuery(e.target.value)}/></div>{available.map(p=><button key={p.id} className={`provider-option ${selected===p.id?'active':''}`} onClick={()=>{setSelected(p.id);setSecret('');setMethod('api_key')}}><span className="provider-logo">{p.name[0]}</span><span><strong>{p.name}</strong><small>{p.description}</small></span><ChevronDown size={15}/></button>)}</div><div className="provider-detail"><div className="provider-detail-title"><span className="provider-logo large">{provider.name[0]}</span><div><h3>{provider.name}</h3><p>{provider.description}</p></div></div><div className="settings-muted">Status: <strong>{serverProviders.some(p=>p.id===selected)?isConfigured(selected)?'Configurado no backend':'Sem chave no backend':'Sem integração'}</strong></div><div className="field-label">Método de conexão <Help text={tips.security}/></div><div className="connect-methods"><button className={method==='api_key'?'active':''} onClick={()=>setMethod('api_key')}><KeyRound size={16}/> API Key</button><button disabled={!provider.oauth} className={method==='oauth'?'active':''} onClick={()=>setMethod('oauth')}><Link2 size={16}/> Entrar com conta</button></div>{method==='api_key'?<>
  <div className="vault-panel"><strong><LockKeyhole size={16}/> Cofre local criptografado</strong><p className="settings-muted">{vault.unlocked?'Desbloqueado nesta sessão. Chaves protegidas por AES-256-GCM.':'Bloqueado. Digite a senha mestra para desbloquear ou criar o cofre (mínimo 12 caracteres).'}</p>
  {!vault.unlocked?<div className="vault-row"><input type="password" autoComplete="new-password" placeholder="Senha mestra do cofre" value={vaultPassword} onChange={e=>setVaultPassword(e.target.value)}/><button disabled={busy||vaultPassword.length<12} onClick={()=>void unlock()}>{vault.exists?'Desbloquear':'Criar cofre'}</button></div>:<div className="vault-row"><span className="vault-status"><ShieldCheck size={15}/> Cofre desbloqueado</span><button onClick={()=>void lock()} disabled={busy}>Bloquear</button></div>}
  </div>
  {selected!=='mock'&&<><label className="field-label">Chave de API {vault.configured.includes(selected)?'· salva no cofre':''}</label><div className="secret-preview"><KeyRound size={16}/><input disabled={!vault.unlocked} type={showSecret?'text':'password'} value={secret} autoComplete="off" onChange={e=>setSecret(e.target.value)} placeholder={vault.unlocked?'Cole a chave aqui (não será exibida novamente)':'Desbloqueie o cofre primeiro'}/><button onClick={()=>setShowSecret(!showSecret)} disabled={!vault.unlocked}>{showSecret?'Ocultar':'Exibir'}</button></div><div className="vault-actions"><button disabled={busy||!vault.unlocked||secret.trim().length<8} onClick={()=>void saveKey()}>Salvar chave com segurança</button>{vault.unlocked&&vault.configured.includes(selected)&&<button onClick={()=>void deleteKey()} disabled={busy}>Remover chave</button>}</div></>}
  {selected==='custom'&&<div className="vault-panel"><label className="field-label">Endpoint OpenAI-compatible</label><select value={customEndpoint} onChange={e=>setCustomEndpoint(e.target.value)} disabled={!vault.unlocked} className="vault-select"><option value="https://api.groq.com/openai/v1">Groq</option><option value="https://api.together.xyz/v1">Together AI</option><option value="https://api.fireworks.ai/inference/v1">Fireworks AI</option><option value="https://api.deepseek.com/v1">DeepSeek</option><option value="https://api.mistral.ai/v1">Mistral AI</option><option value="https://api.cerebras.ai/v1">Cerebras</option></select><div className="vault-actions"><button disabled={!vault.unlocked||busy} onClick={()=>void saveEndpoint()}>Salvar endpoint</button></div><p className="settings-muted">Somente endpoints HTTPS pré-aprovados. Outros endpoints podem continuar sendo definidos pela variável de ambiente.</p></div>}
  {provider.url&&<a className="provider-doc-link" href={provider.url} target="_blank" rel="noreferrer">Abrir portal de chaves <ExternalLink size={13}/></a>}
  </>:<p className="settings-muted">{selected==='openrouter'?<><p className="settings-muted">Conecte sua conta OpenRouter via OAuth PKCE. O cofre deve estar desbloqueado; a chave gerada será armazenada criptografada na API local.</p><button className="primary-action" disabled={!vault.unlocked||oauthLoading} onClick={()=>void beginOpenRouterOAuth()}>{oauthLoading?'Conectando...':'Entrar com OpenRouter'}</button></>:selected==='google'?<><p className="settings-muted">OAuth Google requer aplicativo próprio no Google Cloud, consentimento configurado, Generative Language API ativada e OPHIUCHUS_GOOGLE_CLIENT_ID/SECRET no servidor. A conta Google não concede automaticamente créditos da API.</p><button className="primary-action" disabled={!vault.unlocked||oauthLoading} onClick={()=>void beginGoogleOAuth()}>{oauthLoading?'Conectando...':'Entrar com Google'}</button></>:<p className="settings-muted">Este provedor não oferece conexão OAuth integrada ao Ophiuchus. Use uma chave de API oficial; assinatura de chat não equivale a créditos de API.</p>}</p>}
  <button className="primary-action" disabled={busy||!isConfigured(selected)} onClick={()=>void discover(selected)}><PlugZap size={16}/> {busy?'Consultando...':'Consultar modelos disponíveis'}</button>{feedback&&<p className="settings-muted" role="status">{feedback}</p>}<div className="catalog-preview"><div className="catalog-title">Modelos disponíveis <span>{serverModels[selected]?'Catálogo consultado':'Aguardando consulta'}</span></div>{serverModels[selected]?.length?serverModels[selected].map(m=><div key={m} className="catalog-model"><span className="model-dot"/>{m}</div>):<p className="settings-muted">Configure a API key no servidor e clique em Consultar modelos disponíveis.</p>}</div></div></div></>}
      {tab==='bindings' && <><div className="settings-section-heading"><div><h2>Modelos por agente <Help text={tips.bindings}/></h2><p>Configure cada papel independentemente, sem perder a autoridade do Orchestrator.</p></div><span className="settings-count">Modo FIXED</span></div><div className="binding-list">{agents.map(agent=><div className="binding-card" key={agent.id}><div className="binding-avatar">{agent.name.slice(0,1)}</div><div className="binding-identity"><strong>{agent.name}</strong><small>{agent.description}</small></div><div className="binding-controls"><label>Provedor<select value={agent.modelBinding.providerId} onChange={e=>onUpdate(agent.id,e.target.value,e.target.value==='mock'?'mock/offline':serverModels[e.target.value]?.[0]||agent.modelBinding.modelId)}><option value={agent.modelBinding.providerId} hidden>{agent.modelBinding.providerId}</option>{serverProviders.filter(p=>p.configured).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Modelo<select value={agent.modelBinding.modelId} onChange={e=>onUpdate(agent.id,agent.modelBinding.providerId,e.target.value)}><option value={agent.modelBinding.modelId}>{agent.modelBinding.modelId}</option>{(serverModels[agent.modelBinding.providerId]||[]).filter(m=>m!==agent.modelBinding.modelId).map(m=><option key={m} value={m}>{m}</option>)}</select></label></div><span className="binding-fixed"><Check size={12}/> FIXED</span></div>)}</div><div className="settings-footnote"><CircleHelp size={15}/> Modelos consultados diretamente do backend aparecem após descoberta. O binding é salvo localmente no servidor e copiado para o snapshot da próxima execução.</div></>}
      {tab==='preferences'&&<><div className="settings-section-heading"><div><h2>Experiência e flexibilidade</h2><p>Personalize a forma como o console apresenta o trabalho.</p></div></div><div className="optimization-options"><h3>Autonomia e aprovações</h3><p>O modo semiautônomo aprova automaticamente especificações com artefatos reais completos; a entrega continua sob aprovação humana. O autônomo também avança após QA, mas isso é uma validação documental, não execução de testes. Mock e artefatos incompletos exigem aprovação humana.</p><label>Nível de autonomia<select value={options.autonomy} onChange={e=>setOptions(p=>({...p,autonomy:e.target.value}))}><option value="supervised">Supervisionado — todos os checkpoints manuais</option><option value="semi">Semiautônomo — especificação automática, entrega manual</option><option value="autonomous">Autônomo — checkpoints documentais automáticos</option></select></label><label>Máximo de continuações por resposta<input type="number" min="0" max="3" value={options.maxContinuations} onChange={e=>setOptions(p=>({...p,maxContinuations:Number(e.target.value)}))}/></label><h3>Economia de contexto e tokens</h3><p>Inspirado em técnicas de pruning/compaction do OpenCode. A compactação é local e determinística: não usa outra chamada de IA. Pode perder detalhes; desligue quando precisar de contexto integral.</p><label>Modo de otimização<select value={options.mode} onChange={e=>setOptions(p=>({...p,mode:e.target.value}))}><option value="off">Desativado — contexto completo</option><option value="balanced">Balanceado — extratos de artefatos antigos</option><option value="aggressive">Agressivo — extratos menores</option></select></label><label>Máximo de tokens de saída por etapa<input type="number" min="128" max="4096" value={options.maxOutputTokens} onChange={e=>setOptions(p=>({...p,maxOutputTokens:Number(e.target.value)}))}/></label><label>Artefatos anteriores no contexto<input type="number" min="1" max="12" value={options.historyArtifacts} onChange={e=>setOptions(p=>({...p,historyArtifacts:Number(e.target.value)}))}/></label><label>Máximo de caracteres por artefato<input type="number" min="400" max="12000" value={options.artifactChars} onChange={e=>setOptions(p=>({...p,artifactChars:Number(e.target.value)}))}/></label><label>Artefatos recentes preservados (modo balanceado)<input type="number" min="1" max="5" value={options.keepRecent} onChange={e=>setOptions(p=>({...p,keepRecent:Number(e.target.value)}))}/></label><button className="primary-action" onClick={()=>void saveOptions()}>Salvar opções de execução</button>{optionsSaved&&<p role="status">{optionsSaved}</p>}<small>Não há compressão mágica de tokens: os resultados dependem dos artefatos e o total real é medido pelo provedor. Nenhuma chamada automática de resumo é feita.</small></div></>}
    </div></div>
  </section>
}
