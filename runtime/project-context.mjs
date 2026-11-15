import {lineDiff} from './line-diff.mjs';

function changedDiff(before,after){
 const a=before.split('\n'),b=after.split('\n');let start=0,end=0;
 while(start<Math.min(a.length,b.length)&&a[start]===b[start])start++;
 while(end<Math.min(a.length,b.length)-start&&a[a.length-1-end]===b[b.length-1-end])end++;
 return lineDiff(a.slice(Math.max(0,start-2),a.length-Math.max(0,end-2)).join('\n'),b.slice(Math.max(0,start-2),b.length-Math.max(0,end-2)).join('\n'));
}

// Review keeps complete originals and proposals. Other roles receive only their dependencies.
export function stageContext(role,{original,draft,stages,history,goal}){
 const dependencies={orchestrator:[],architect:['orchestrator'],reviewer:['orchestrator','architect','developer'],qa:['orchestrator','developer'],documentation:['developer','reviewer','qa']};
 const artifacts=stages.filter(s=>s.status==='COMPLETED'&&dependencies[role]?.includes(s.id)).map(s=>({role:s.id,text:s.text.slice(0,role==='documentation'?1200:1600)}));
 let files=original,contextKind='COMPLETE_SELECTED_FILES';
 if(role==='orchestrator'){
  files=original.map(f=>({path:f.path,sha256:f.sha256,chars:f.content.length,overview:f.content.length>2600?f.content.slice(0,1200)+'\n[... trecho intermediário omitido; arquitetura recebe o arquivo completo ...]\n'+f.content.slice(-1400):f.content,overviewPartial:f.content.length>2600}));contextKind='FILE_OVERVIEWS';
 }else if(role==='qa'){
  files=draft.changes.map(c=>({path:c.path,proposed:c.content}));contextKind='COMPLETE_PROPOSED_FILES';
 }else if(role==='documentation'){
  files=draft.changes.map(c=>{const diff=changedDiff(c.before||'',c.content);if(diff.tooLarge)return {path:c.path,summary:c.reason||draft.summary,diffUnavailable:true};const keep=new Set();diff.lines.forEach((l,i)=>{if(l.kind!=='same')for(let n=Math.max(0,i-2);n<=Math.min(diff.lines.length-1,i+2);n++)keep.add(n)});return {path:c.path,changes:diff.lines.filter((_,i)=>keep.has(i))};});contextKind='CHANGED_LINES_WITH_CONTEXT';
 }else if(role==='reviewer')files=draft.changes.map(c=>({path:c.path,before:c.before,proposed:c.content}));
 return {goal,history:role==='orchestrator'||role==='architect'?history:[],artifacts,files,contextPartial:true,contextKind};
}
