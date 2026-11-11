import test from 'node:test';
import assert from 'node:assert/strict';
import {stackContract,stageContractInstructions,validateProposals} from './stack-contract.mjs';
import {testFiles,cobolDockerArgs,IMAGES} from './test-runner.mjs';
import {buildMessages} from './executor.mjs';
test('COBOL must never fall back to JavaScript',()=>{
 const c=stackContract('crie uma função em cobol para sortear números');
 assert.equal(c.language,'cobol');
 assert.equal(validateProposals([{path:'src/sorteio.js',content:'x'},{path:'test/sorteio.test.js',content:'x'}],c).ok,false);
 assert.equal(validateProposals([{path:'src/sorteio.cob',content:'x'},{path:'tests/test_sorteio.cob',content:'x'}],c).ok,true);
 assert.deepEqual(testFiles([{path:'test/sorteio.test.js'},{path:'tests/test_sorteio.cob'}],c),['tests/test_sorteio.cob']);
 assert.match(stageContractInstructions(c),/Não use Node\.js/);
 const m=buildMessages({stage:'implementation',prompt:'crie uma função em COBOL',artifacts:[]});
 assert.match(m[0].content,/CONTRATO OBRIGATÓRIO: COBOL/);
});
test('COBOL Docker runner is isolated and invokes cobc',()=>{
 const args=cobolDockerArgs('/tmp/test',['src/sorteio.cob','tests/test_sorteio.cob'],['tests/test_sorteio.cob']);
 assert.ok(args.includes(IMAGES.cobol));
 assert.ok(args.includes('--network'));assert.ok(args.includes('none'));
 assert.ok(args.includes('--read-only'));
 assert.match(args.at(-1),/cobc -x -free/);
 assert.match(args.at(-1),/\/tmp\/cobol_test_0/);
});
