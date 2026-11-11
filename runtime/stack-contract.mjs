/** Deterministic language contract: user request outranks generated prose. */
export function stackContract(prompt=''){
 const p=String(prompt);
 if(/\b(java|javac|junit|maven|gradle)\b/i.test(p)&&!/\b(javascript|typescript|node\.?js)\b/i.test(p))return {language:'java',tests:'java-main',extensions:['.java']};
 if(/\b(python|pytest)\b/i.test(p))return {language:'python',tests:'unittest',extensions:['.py']};
 if(/(?<!\w)(c#|csharp|\.net)(?!\w)/i.test(p))return {language:'csharp',tests:'dotnet',extensions:['.cs','.csproj','.sln']};
 if(/\b(rust|cargo)\b/i.test(p))return {language:'rust',tests:'cargo',extensions:['.rs']};
 if(/\b(golang|em\s+go|go language|go\s+(?:api|app|programa|função|funcao|projeto|service|serviço|codigo|código))/i.test(p))return {language:'go',tests:'go',extensions:['.go']};
 return {language:'javascript',tests:'node',extensions:['.js','.mjs','.cjs']};
}
export function validateProposals(proposals,contract){
 if(!proposals?.length)return {ok:false,reason:'Nenhum arquivo de código proposto'};
 const paths=proposals.map(p=>p.path);
 if(contract.language==='java'){
  const wrong=paths.filter(p=>/\.(?:js|mjs|cjs|ts|tsx)$/.test(p)||/(^|\/)package\.json$/.test(p));
  if(wrong.length)return {ok:false,reason:`Contrato Java violado: arquivos incompatíveis (${wrong.join(', ')}). Gere somente .java e testes *Test.java.`};
  if(!paths.some(p=>p.endsWith('.java')))return {ok:false,reason:'Contrato Java exige código .java'};
  if(!paths.some(p=>/Test\.java$/.test(p)))return {ok:false,reason:'Contrato Java exige ao menos um *Test.java executável com public static void main(String[] args)'};
 }
 if(['go','python','rust','csharp'].includes(contract.language)){
  const wrong=paths.filter(path=>/\.(?:js|mjs|cjs|ts|tsx)$/.test(path)||/(^|\/)package\.json$/.test(path));
  if(wrong.length)return {ok:false,reason:`Contrato ${contract.language} violado: ${wrong.join(', ')}`};
  if(!paths.some(path=>contract.extensions.some(ext=>path.endsWith(ext))))return {ok:false,reason:`Contrato ${contract.language}: nenhum arquivo fonte compatível`};
 }
 return {ok:true};
}
export function stageContractInstructions(contract){
 if(contract.language==='java')return 'CONTRATO OBRIGATÓRIO: JAVA (não JavaScript/Node). Produza exclusivamente arquivos .java em blocos ```java file:src/LotteryUtils.java. Inclua pelo menos um *Test.java autocontido com public static void main(String[] args), que lance AssertionError se falhar. Use javac/java JDK 21 sem dependências externas; NÃO use npm, package.json, node:test nem JUnit que dependa de downloads. Inclua todos os arquivos completos, sem truncamento.';
 if(contract.language==='go')return 'CONTRATO OBRIGATÓRIO: GO. Gere arquivos .go e pelo menos um *_test.go com package correto, import testing e TestXxx(t *testing.T). Testes via go test ./... sem rede; evite dependências externas. Nunca gere JavaScript ou npm.';
 if(contract.language==='python')return 'CONTRATO OBRIGATÓRIO: PYTHON. Gere arquivos .py e testes test_*.py com unittest padrão (sem pytest/dependências externas). Testes via python -m unittest discover. Nunca gere JavaScript ou npm.';
 if(contract.language==='rust')return 'CONTRATO OBRIGATÓRIO: RUST. Gere Cargo.toml, src/lib.rs e testes #[test] ou tests/*.rs. Testes via cargo test --offline; sem dependências externas. Nunca gere JavaScript ou npm.';
 if(contract.language==='csharp')return 'CONTRATO OBRIGATÓRIO: C#/.NET. Gere .csproj e testes autocontidos sem NuGet externo; o executor compila e roda projetos executáveis de teste via dotnet run --no-restore (ou dotnet test quando framework pré-instalado). Nunca gere JavaScript ou npm.';
 if(contract.tests==='unsupported')return `CONTRATO OBRIGATÓRIO: ${contract.language}. Nunca substitua por JavaScript. O executor automático ainda não suporta esta stack; informe a limitação sem inventar testes.`;
 return 'CONTRATO: JavaScript/Node.js. Inclua código e pelo menos um .test.js/.spec.js com node:test.';
}
