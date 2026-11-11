import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,startRun} from './orchestrator.mjs';
import {executeStage,buildMessages} from './executor.mjs';
import {stackContract,validateStageLanguage} from './stack-contract.mjs';
const agents=[{id:'o',role:'ORCHESTRATOR',enabled:true,modelBinding:{providerId:'google',modelId:'test-model'}},{id:'a',role:'ARCHITECT',enabled:true,modelBinding:{providerId:'google',modelId:'test-model'}}];
const response=text=>async ({messages})=>({text,usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200},finishReason:'stop'});
test('contract persists before first call and is included in both prompt roles',()=>{
 const run=startRun(createRun({id:'lang254',prompt:'crie uma função em COBOL para sortear números de 1 a 500',agents}));
 assert.equal(run.languageContract.language,'cobol');
 assert.equal(run.events[0].type,'contract.language.resolved');
 for(const msg of buildMessages(run))assert.match(msg.content,/"language":"cobol"/);
});
test('actual COBOL to Node.js substitution is rejected at discovery before stage advancement',async()=>{
 const run=startRun(createRun({id:'lang254b',prompt:'crie uma função em COBOL para sortear números de 1 a 500',agents}));
 await assert.rejects(executeStage(run,{generate:response('Como o contrato estabelece Node.js, a solução acima utiliza crypto.randomInt e entrega lottery.js')}),/LANGUAGE_CONTRACT_VIOLATION/);
 assert.equal(run.stage,'discovery');assert.equal(run.artifacts.length,0);assert.equal(run.corrections,0);
 assert.equal(run.events.at(-1).type,'contract.language.rejected');
 assert.equal(run.events.at(-2).type,'contract.language.sent');
});
test('correct discovery progresses and specification substitution is rejected',async()=>{
 const run=startRun(createRun({id:'lang254c',prompt:'crie uma função em COBOL para sortear números de 1 a 500',agents}));
 await executeStage(run,{generate:response('Requisitos: gerar inteiro 1 a 500. Linguagem COBOL, arquivo sorteio.cob. Compilação cobc e testes GnuCOBOL.')});
 assert.equal(run.stage,'specification');
 await assert.rejects(executeStage(run,{generate:response('A implementação será em JavaScript/Node.js. Arquivo lottery.js.')}),/LANGUAGE_CONTRACT_VIOLATION/);
 assert.equal(run.stage,'specification');assert.equal(run.artifacts.length,1);assert.equal(run.corrections,0);
});
test('language contract supports unrelated stacks and does not reject explicit warnings',()=>{
 for(const [language,prompt] of [['python','faça em python'],['rust','escreva em Rust'],['java','crie em Java'],['cobol','crie em COBOL'],['kotlin','crie em Kotlin'],['typescript','crie em TypeScript']]){
  const contract=stackContract(prompt);assert.equal(contract.language,language);
  assert.equal(validateStageLanguage('discovery',`Não use JavaScript/Node.js. A implementação deve ser ${language}.`,contract).ok,true);
  assert.equal(validateStageLanguage('specification','Contrato: Node.js. Implementação será em JavaScript.',contract).ok,false);
 }
});
