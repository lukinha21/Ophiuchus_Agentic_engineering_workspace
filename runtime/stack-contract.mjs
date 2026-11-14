import {checkCobolSources} from './cobol-static.mjs';
/** Deterministic language contract: user request outranks generated prose. */
export function stackContract(prompt=''){
 const p=String(prompt);
 // Explicit user-selected languages must never silently become JavaScript.
 const explicit = [
  ['typescript',/\b(?:typescript|type\s*script)\b/i,['.ts','.tsx']],
  ['kotlin',/\b(?:kotlin)\b/i,['.kt','.kts']],
  ['swift',/\b(?:swift)\b/i,['.swift']],
  ['php',/\b(?:php)\b/i,['.php']],
  ['ruby',/\b(?:ruby)\b/i,['.rb']],
  ['scala',/\b(?:scala)\b/i,['.scala']],
  ['dart',/\b(?:dart)\b/i,['.dart']],
  ['elixir',/\b(?:elixir)\b/i,['.ex','.exs']],
  ['haskell',/\b(?:haskell)\b/i,['.hs']],
  ['lua',/\b(?:lua)\b/i,['.lua']],
  ['perl',/\b(?:perl)\b/i,['.pl']],
  ['r',/\b(?:linguagem\s+r|em\s+r|r\s+language)\b/i,['.r']],
  ['fortran',/\b(?:fortran)\b/i,['.f90','.f95','.f']],
  ['pascal',/\b(?:pascal|delphi)\b/i,['.pas']],
  ['cpp',/(?:\bc\+\+(?!\w)|\bcpp\b)/i,['.cpp','.cc','.hpp']],
  ['c',/\b(?:linguagem\s+c(?![+#])|em\s+c(?![+#])|c\s+language)\b/i,['.c','.h']],
  ['sql',/\b(?:sql|postgresql|plpgsql)\b/i,['.sql']],
  ['shell',/\b(?:bash|shell\s+script|powershell)\b/i,['.sh','.ps1']],
 ];
 // Detect explicit unsupported stacks before applying the JavaScript fallback.
 const named=explicit.find(([,re])=>re.test(p));
 if(named)return {language:named[0],tests:'unsupported',extensions:named[2]};
 // Future/unknown languages: retain the requested name and fail closed instead of silently choosing JS.
 const unknown=p.match(/\b(?:linguagem|language)\s+(?:de\s+programa(?:ção|cao)\s+)?([A-Za-z][A-Za-z0-9+#.-]{1,30})/i);
 if(unknown&&!/^(?:para|que|mais|natural|original|solicitada|escolhida|principal|do|da|de|em|com|e|ou)$/i.test(unknown[1])){
  const language=unknown[1].toLowerCase();if(!['javascript','node.js','cobol','gnucobol','java','python','csharp','rust','go'].includes(language))return {language,tests:'unsupported',extensions:[]};
 }

 if(/\b(cobol|gnucobol|\.cob|\.cbl)\b/i.test(p))return {language:'cobol',tests:'cobol',extensions:['.cob','.cbl']};
 if(/\b(java|javac|junit|maven|gradle)\b/i.test(p)&&!/\b(javascript|typescript|node\.?js)\b/i.test(p))return {language:'java',tests:'java-main',extensions:['.java']};
 if(/\b(python|pytest)\b/i.test(p))return {language:'python',tests:'unittest',extensions:['.py']};
 if(/(?<!\w)(c#|csharp|\.net)(?!\w)/i.test(p))return {language:'csharp',tests:'dotnet',extensions:['.cs','.csproj','.sln']};
 if(/\b(rust|cargo)\b/i.test(p))return {language:'rust',tests:'cargo',extensions:['.rs']};
 if(/\b(golang|em\s+go|go language|go\s+(?:api|app|programa|função|funcao|projeto|service|serviço|codigo|código))/i.test(p))return {language:'go',tests:'go',extensions:['.go']};
 return {language:'javascript',tests:'node',extensions:['.js','.mjs','.cjs']};
}
export function validateProposals(proposals,contract,{partial=false}={}){
 if(!proposals?.length)return {ok:false,reason:'Nenhum arquivo de código proposto'};
 const paths=proposals.map(p=>p.path);
 if(contract.language==='java'){
  const wrong=paths.filter(p=>/\.(?:js|mjs|cjs|ts|tsx)$/.test(p)||/(^|\/)package\.json$/.test(p));
  if(wrong.length)return {ok:false,reason:`Contrato Java violado: arquivos incompatíveis (${wrong.join(', ')}). Gere somente .java e testes *Test.java.`};
  if(!paths.some(p=>p.endsWith('.java')))return {ok:false,reason:'Contrato Java exige código .java'};
  if(!partial&&!paths.some(p=>/Test\.java$/.test(p)))return {ok:false,reason:'Contrato Java exige ao menos um *Test.java executável com public static void main(String[] args)'};
 }
 if(contract.language==='cobol'){
  const staticCheck=checkCobolSources(proposals);if(!staticCheck.ok)return staticCheck;
  const wrong=paths.filter(path=>/\.(?:js|mjs|cjs|ts|tsx|py|java|go|rs|cs)$/.test(path)||/(^|\/)package\.json$/.test(path));
  if(wrong.length)return {ok:false,reason:`Contrato COBOL violado: ${wrong.join(', ')}. Não crie wrappers JavaScript.`};
  if(!paths.some(path=>/\.(cob|cbl)$/i.test(path)))return {ok:false,reason:'Contrato COBOL exige um arquivo .cob ou .cbl'};
  if(!partial&&!paths.some(path=>/(test|teste|spec)[^/]*\.(cob|cbl)$/i.test(path)))return {ok:false,reason:'Contrato COBOL exige teste executável test*.cob ou teste*.cob'};
 }
 if(['go','python','rust','csharp'].includes(contract.language)||contract.tests==='unsupported'){
  const wrong=paths.filter(path=>/\.(?:js|mjs|cjs|ts|tsx)$/.test(path)||/(^|\/)package\.json$/.test(path));
  if(wrong.length)return {ok:false,reason:`Contrato ${contract.language} violado: ${wrong.join(', ')}`};
  if(!partial&&!paths.some(path=>contract.extensions.some(ext=>path.endsWith(ext))))return {ok:false,reason:`Contrato ${contract.language}: nenhum arquivo fonte compatível`};
 }
 return {ok:true};
}
export function stageContractInstructions(contract){
 if(contract.language==='cobol')return 'CONTRATO OBRIGATÓRIO: COBOL/GnuCOBOL em formato livre. Na implementação, proponha arquivos .cob/.cbl completos e ao menos um teste COBOL executável, com status de saída diferente de zero em falha. Declare dados antes de PROCEDURE DIVISION; parágrafos PERFORM não recebem USING. Use MOVE em variáveis de trabalho e PERFORM simples para reutilizar asserções. Evite DISPLAY de sucesso para cada caso. Escolha nomes e interfaces a partir do pedido atual. Não imponha algoritmo, intervalo, aleatoriedade ou regra de negócio. Não use Node.js como wrapper. Sem wrappers de outra linguagem ou dependências externas.';
 if(contract.language==='java')return 'CONTRATO OBRIGATÓRIO: JAVA JDK 21. NÃO use npm, package.json ou wrappers JavaScript. Gere arquivos .java e ao menos um *Test.java autocontido com public static void main(String[] args) e AssertionError em falha. Sem dependências externas. Nomes, interfaces e regras vêm somente do pedido atual.';
 if(contract.language==='go')return 'CONTRATO OBRIGATÓRIO: GO. Gere arquivos .go e pelo menos um *_test.go com package correto, import testing e TestXxx(t *testing.T). Testes via go test ./... sem rede; evite dependências externas. Nunca gere JavaScript ou npm.';
 if(contract.language==='python')return 'CONTRATO OBRIGATÓRIO: PYTHON. Gere arquivos .py e testes test_*.py com unittest padrão (sem pytest/dependências externas). Testes via python -m unittest discover. Nunca gere JavaScript ou npm.';
 if(contract.language==='rust')return 'CONTRATO OBRIGATÓRIO: RUST. Gere Cargo.toml, src/lib.rs e testes #[test] ou tests/*.rs. Testes via cargo test --offline; sem dependências externas. Nunca gere JavaScript ou npm.';
 if(contract.language==='csharp')return 'CONTRATO OBRIGATÓRIO: C#/.NET. Gere .csproj e testes autocontidos sem NuGet externo; o executor compila e roda projetos executáveis de teste via dotnet run --no-restore (ou dotnet test quando framework pré-instalado). Nunca gere JavaScript ou npm.';
 if(contract.tests==='unsupported')return `CONTRATO OBRIGATÓRIO: ${contract.language}. Nunca substitua por JavaScript. O executor automático ainda não suporta esta stack; informe a limitação sem inventar testes.`;
 return 'CONTRATO: JavaScript/Node.js. Inclua código e pelo menos um .test.js/.spec.js com node:test.';
}

/** Reject actual cross-language planning deliverables, not mere warnings about other stacks. */
export function validateStageLanguage(stage,text,contract){
 if(!['discovery','specification','architecture'].includes(stage)||contract.language==='javascript')return {ok:true};
 const body=String(text||'');
 const problems=[];
 const foreignArtifact=/(?:```\s*(?:javascript|js|typescript|tsx)\b|(?:^|\n)\s*(?:javascript\s+)?file:[^\n]*\.(?:js|mjs|cjs|ts|tsx)\b|(?:^|\n)\s*#{1,6}\s*`?[^\n`]*\.(?:js|mjs|cjs|ts|tsx)`?)/im;
 if(foreignArtifact.test(body))problems.push('artefato JavaScript/TypeScript proposto');
 // Match affirmative declarations, even if another paragraph says "não use JavaScript".
 const statements=body.replace(/node\.js/gi,'nodejs').split(/[\n.!?]+/).map(s=>s.trim()).filter(Boolean);
 const target=/(?:javascript|node\.?js|commonjs|ecmascript|\bnode:test\b)/i;
 const declarations=/(?:contrato|implementa(?:ção|cao)|artefato|entrega|linguagem|stack|ambiente|tecnologia|requisito|utilizaremos|usaremos|ser[aá] implementad|desenvolveremos|transposi(?:ção|cao)|equivalente)/i;
 const negative=/(?:n[aã]o|sem|evitar|proibido|jamais|never|rejeit(?:ar|ado)|incorreto|inv[aá]lido|em vez de|ao inv[eé]s de)\s+(?:(?:se\s+)?(?:deve|podemos|usar|utilizar|implementar|gerar|produzir|substituir|converter|em|o|a|para)\s+){0,4}(?:javascript|node\.?js|commonjs|ecmascript)/i;
 if(statements.some(line=>target.test(line)&&declarations.test(line)&&!negative.test(line)))problems.push('declaração de stack de entrega incompatível');
 if(problems.length)return {ok:false,reason:`Desvio de linguagem na etapa ${stage}: ${problems.join('; ')}. Linguagem obrigatória: ${contract.language}.`};
 return {ok:true};
}
