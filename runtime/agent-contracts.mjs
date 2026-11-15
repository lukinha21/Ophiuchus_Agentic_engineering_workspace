const text=maxLength=>({type:'string',minLength:1,maxLength});
const list=(maxItems,maxLength)=>({type:'array',maxItems,items:text(maxLength)});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const assessment=object({verdict:{type:'string',enum:['pass','fail']},summary:text(400),evidence:text(900)});
export const CONTRACTS=Object.freeze({
 orchestrator:object({summary:text(320),scope:list(3,180),criteria:list(4,180),files:list(8,240)}),
 architect:object({summary:text(320),decisions:list(4,220),risks:list(3,180)}),
 reviewer:assessment,qa:assessment,
 documentation:object({summary:text(400),changes:list(5,240),limitations:list(4,200),checks:list(4,180)}),
 developer:object({summary:text(800),changes:{type:'array',minItems:1,maxItems:4,items:{anyOf:[object({path:text(240),edits:{type:'array',minItems:1,maxItems:8,items:object({oldText:text(10000),newText:{type:'string',maxLength:20000}})},reason:text(300)}),object({path:text(240),content:text(48000),reason:text(300)})]}}})
});
// Deliberately bounded subset shared by our contracts, not a general schema interpreter.
export function validateContract(value,schema,path='$'){
 if(schema.anyOf){if(!schema.anyOf.some(s=>{try{validateContract(value,s,path);return true}catch{return false}}))throw Error(path+': formato inválido');return value;}
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error(path+': objeto obrigatório');
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw Error(path+'.'+key+': obrigatório');
  for(const key of Object.keys(value)){if(!schema.properties[key])throw Error(path+'.'+key+': campo não permitido');validateContract(value[key],schema.properties[key],path+'.'+key);}
 }else if(schema.type==='array'){
  if(!Array.isArray(value)||value.length<(schema.minItems||0)||value.length>schema.maxItems)throw Error(path+': lista fora dos limites');value.forEach((v,i)=>validateContract(v,schema.items,path+'['+i+']'));
 }else if(schema.type==='string'){
  if(typeof value!=='string'||(schema.minLength&&!value.trim())||value.length>(schema.maxLength??Infinity)||schema.enum&&!schema.enum.includes(value))throw Error(path+': texto inválido ou fora dos limites');
 }
 return value;
}
export function readHandoff(role,raw){
 try{const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));validateContract(value,CONTRACTS[role]);return value;}
 catch(e){const error=Error('Contrato de '+role+' inválido: '+e.message);error.code='INVALID_HANDOFF';throw error;}
}
export function handoffText(role,value){
 if(['reviewer','qa'].includes(role))return value.summary+'\n\n'+value.evidence;
 const headings={scope:'Escopo',criteria:'Critérios de aceite',files:'Arquivos',decisions:'Decisões',risks:'Riscos',changes:'Mudanças',limitations:'Limitações',checks:'Verificações pendentes'};
 return [value.summary,...Object.entries(headings).filter(([key])=>value[key]?.length).map(([key,title])=>'### '+title+'\n'+value[key].map(v=>'- '+v).join('\n'))].join('\n\n');
}
export function compactConversation(history,mode='dedupe'){
 if(!Array.isArray(history)||history.length>6||history.some(m=>!['user','assistant'].includes(m?.role)||typeof m.content!=='string'||m.content.length>1800))throw Error('Histórico de conversa inválido');
 if(mode==='full')return structuredClone(history);const result=[];
 for(const message of history){const last=result.at(-1);if(!last||last.role!==message.role||last.content!==message.content)result.push(message);}
 return structuredClone(result);
}
