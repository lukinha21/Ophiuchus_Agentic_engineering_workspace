/** Narrow preflight checks, not a compiler or proof of correctness. */
export function checkCobolSources(proposals){
 for(const file of proposals.filter(f=>/\.(cob|cbl)$/i.test(f.path))){
  const source=String(file.content||'').replace(/\*>[^\n]*/g,'').replace(/"(?:""|[^"\n])*"|'(?:''|[^'\n])*'/g,'');
  if(/^\s*DECLARE(?:\s*$|\s+[\w-]+\s+PIC\b)/im.test(source))return {ok:false,reason:`${file.path}: DECLARE no procedimento não é uma declaração de dados GnuCOBOL. Declare variáveis na seção de dados apropriada.`};
  // COPY/SQL can supply declarations externally; do not infer missing symbols there.
  if(/\b(?:COPY|EXEC\s+SQL)\b/i.test(source))continue;
  if(/\bPERFORM\s+[A-Z][A-Z0-9-]*\s+USING\b/i.test(source))return {ok:false,reason:`${file.path}: PERFORM de parágrafo não recebe parâmetros USING no GnuCOBOL; use variáveis de trabalho ou CALL com uma interface válida.`};
  const declared=new Set([...source.matchAll(/^\s*\d{1,2}\s+([A-Z][A-Z0-9-]*)\b/gim)].map(m=>m[1].toUpperCase()));
  for(const m of source.matchAll(/\b(?:WS|LK|TST)-[A-Z0-9-]+\b/gi)){
   if(!declared.has(m[0].toUpperCase()))return {ok:false,reason:`${file.path}: identificador ${m[0]} sem declaração neste arquivo; confira a grafia. Verificação estática limitada, sem compilação.`};
  }
 }
 return {ok:true};
}
