/** User-facing diagnostics describe observed transport state, never an invented cause. */
export function projectError(error,{stage='Agente',timeoutMs=90000,cancelled=false}={}){
 const raw=String(error?.message||error||'Falha desconhecida');
 if(error?.code==='MODEL_OUTPUT_LIMIT')return {code:'MODEL_OUTPUT_LIMIT',message:`${stage} atingiu o limite de saída antes de concluir. Nenhuma alteração aplicada. Retome para refazer esta etapa com um limite maior.`,retryable:true,technical:raw};
 if(error?.code==='INVALID_HANDOFF')return {code:'INVALID_HANDOFF',message:raw+' Nenhuma alteração aplicada; corrija o contrato ou escolha outro modelo.',retryable:false,technical:raw};
 if(cancelled)return {code:'CANCELLED',message:'Execução cancelada. Nenhuma alteração aplicada.',retryable:false,technical:raw};
 if(error?.name==='TimeoutError'||/aborted due to timeout|timed? ?out/i.test(raw))return {code:'MODEL_TIMEOUT',message:`${stage} excedeu ${Math.round(timeoutMs/1000)} segundos sem uma resposta completa. Nenhuma alteração aplicada. É possível retomar esta etapa sem repetir as concluídas.`,retryable:true,technical:raw};
 if(/não configurado|desbloqueie.*cofre/i.test(raw))return {code:'PROVIDER_NOT_CONFIGURED',message:'O provedor não está disponível. Configure a chave ou desbloqueie o cofre antes de executar.',retryable:true,technical:raw};
 const http=raw.match(/HTTP\s+(\d{3})/i);
 if(http){const status=Number(http[1]);return {code:'PROVIDER_HTTP_'+status,message:status===429?'O provedor limitou as requisições. Aguarde antes de retomar.':status===503?'O provedor está temporariamente indisponível. Você pode retomar esta etapa depois.':raw,retryable:[408,429,500,502,503,504].includes(status),technical:raw};}
 if(/fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|network/i.test(raw))return {code:'NETWORK_ERROR',message:'A comunicação com o provedor falhou. Verifique a conexão antes de retomar.',retryable:true,technical:raw};
 return {code:/Conflito/.test(raw)?'SOURCE_CONFLICT':/orçamento/i.test(raw)?'CALL_BUDGET_EXCEEDED':'INVALID_STAGE_RESULT',message:raw,retryable:false,technical:raw};
}
