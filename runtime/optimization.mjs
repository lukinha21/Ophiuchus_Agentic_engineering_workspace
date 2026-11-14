/** Deterministic, offline context pruning; never sends extra API requests. */
export const DEFAULT_OPTIONS=Object.freeze({mode:'off',maxOutputTokens:1400,historyArtifacts:7,artifactChars:6500,keepRecent:2,autonomy:'supervised',maxContinuations:2});
export function normalizeOptions(value={}){
 const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const integer=(key,min,max)=>Number.isInteger(v[key])&&v[key]>=min&&v[key]<=max?v[key]:DEFAULT_OPTIONS[key];
 return {mode:['off','balanced','aggressive'].includes(v.mode)?v.mode:'off',maxOutputTokens:integer('maxOutputTokens',128,4096),historyArtifacts:integer('historyArtifacts',1,12),artifactChars:integer('artifactChars',400,12000),keepRecent:integer('keepRecent',1,5),autonomy:['supervised','semi','autonomous'].includes(v.autonomy)?v.autonomy:'supervised',maxContinuations:integer('maxContinuations',0,3)};
}
/** Preserve requirements and decisions, but never resend generated source from old artifacts.
 * Full canonical source is sent separately by sourceSnapshot for review/QA/developer corrections. */
export function compactHistory(artifacts,options,{stage}={}){
 const cfg=normalizeOptions(options);
 const allowed=stage==='discovery'?[]:stage==='specification'?['discovery']:stage==='architecture'?['specification']:stage==='implementation'?['specification','architecture','review','qa']:stage==='review'||stage==='qa'?['specification']:['specification','qa'];
 const candidates=(artifacts||[]).filter(a=>!stage||allowed.includes(a.stage));
 const latest=new Map();for(const a of candidates)if(['discovery','specification','architecture','review','qa'].includes(a.stage))latest.set(a.stage,a);
 const selected=[...latest.values()].slice(-5);
 const limit=cfg.mode==='aggressive'?500:cfg.mode==='balanced'?800:1100;
 return selected.map(a=>{
  const raw=String(a.text||'').replace(/```[^\n]*\n[\s\S]*?```/g,'[bloco de código omitido: consulte fonte canônica]');
  const lines=raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const relevant=lines.filter(l=>/^#{1,5}\s|^(?:[-*]|\d+[.)])\s|(?:requisito|critério|contrato|risco|decisão|falha|veredito|limitação)/i.test(l));
  return `[${a.stage} — resumo de decisões, sem código]\n${(relevant.length?relevant:lines).slice(0,12).join('\n').slice(0,limit)}`;
 }).join('\n\n');
}
export function estimateTokens(text){return Math.ceil(String(text).length/4);} // approximation only
