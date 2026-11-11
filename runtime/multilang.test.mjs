import test from 'node:test';
import assert from 'node:assert/strict';
import {stackContract,stageContractInstructions,validateProposals} from './stack-contract.mjs';
import {testFiles,languageDockerArgs,IMAGES} from './test-runner.mjs';
for(const [prompt,language,filename] of [['Crie API em Go','go','main_test.go'],['Faça um programa Python','python','test_main.py'],['Crie app Rust','rust','Cargo.toml'],['Crie app C#','csharp','Tests.csproj']]){
 test(`${language} contract, test discovery and secure docker image`,()=>{
  const c=stackContract(prompt);assert.equal(c.language,language);
  assert.ok(stageContractInstructions(c).includes('CONTRATO OBRIGATÓRIO'));
  assert.equal(validateProposals([{path:'src/a.js'}],c).ok,false);
  assert.deepEqual(testFiles([{path:filename}],c),[filename]);
  const args=languageDockerArgs('/tmp/workspace',language,[filename]);
  assert.ok(args.includes(IMAGES[language]));
  for(const flag of ['--network','none','--read-only','--cap-drop','--memory','--pull','missing'])assert.ok(args.includes(flag));
 });
}
