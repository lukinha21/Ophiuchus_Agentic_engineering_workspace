/** Deterministic, offline context pruning; never sends extra API requests. */
export const DEFAULT_OPTIONS=Object.freeze({mode:'off',maxOutputTokens:1400,historyArtifacts:7,artifactChars:6500,keepRecent:2,autonomy:'supervised',maxContinuations:2});
export function normalizeOptions(value={}){
 const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const integer=(key,min,max)=>Number.isInteger(v[key])&&v[key]>=min&&v[key]<=max?v[key]:DEFAULT_OPTIONS[key];
 return {mode:['off','balanced','aggressive'].includes(v.mode)?v.mode:'off',maxOutputTokens:integer('maxOutputTokens',128,4096),historyArtifacts:integer('historyArtifacts',1,12),artifactChars:integer('artifactChars',400,12000),keepRecent:integer('keepRecent',1,5),autonomy:['supervised','semi','autonomous'].includes(v.autonomy)?v.autonomy:'supervised',maxContinuations:integer('maxContinuations',0,3)};
}
export function compactHistory(artifacts,options){
 const cfg=normalizeOptions(options);
 const selected=artifacts.slice(-cfg.historyArtifacts);
 if(cfg.mode==='off')return selected.map(a=>`[${a.stage}]\n${String(a.text||'').slice(0,cfg.artifactChars)}`).join('\n\n');
 const limit=cfg.mode==='aggressive'?Math.min(cfg.artifactChars,1000):Math.min(cfg.artifactChars,2600);
 const recent=cfg.mode==='aggressive'?1:cfg.keepRecent;
 return selected.map((a,i)=>{
  const raw=String(a.text||'').trim();
  if(i>=selected.length-recent)return `[${a.stage}]\n${raw.slice(0,limit)}`;
  // Extract structural highlights; deterministic and free. No invented summary.
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const priority=lines.filter(s=>/^#{1,5}\s|^(?:[-*]|\d+[.)])\s|^(?:requisit|crit[eé]rio|decis[aã]o|risco|contrato|interface|erro|falha|teste|arquivo)/i.test(s));
  const chosen=(priority.length?priority:lines).filter(line=>!/^```|^\s*(?:package |import |public |private |class |return |export |function )/.test(line)).slice(0,cfg.mode==='aggressive'?8:16).join('\n');
  return `[${a.stage} — extrato local, consulte artefato completo se necessário]\n${chosen.slice(0,limit)}`;
 }).join('\n\n');
}
export function estimateTokens(text){return Math.ceil(String(text).length/4);} // approximation only
