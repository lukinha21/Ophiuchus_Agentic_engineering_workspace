import test from 'node:test';
import assert from 'node:assert/strict';
import {stackContract,validateProposals} from './stack-contract.mjs';
import {testFiles,javaDockerArgs,JAVA_IMAGE} from './test-runner.mjs';
import {buildMessages} from './executor.mjs';
test('Java requested by user is immutable against JS artifacts',()=>{
 const c=stackContract('crie uma função em java para sortear numeros de 1 a 500');
 assert.equal(c.language,'java');
 assert.equal(validateProposals([{path:'src/LotteryUtils.js',content:'x'},{path:'package.json',content:'{}'}],c).ok,false);
 assert.equal(validateProposals([{path:'src/LotteryUtils.java',content:'class LotteryUtils{}'},{path:'src/LotteryUtilsTest.java',content:'class LotteryUtilsTest{}'}],c).ok,true);
});
test('Java test discovery does not run JS tests',()=>{
 assert.deepEqual(testFiles([{path:'src/LotteryUtilsTest.java'},{path:'src/lottery.test.js'}],stackContract('Java')),['src/LotteryUtilsTest.java']);
});
test('Java runner uses JDK and offline Docker isolation',()=>{
 const args=javaDockerArgs('/tmp/12345678',['src/LotteryUtils.java','src/LotteryUtilsTest.java'],['LotteryUtilsTest']);
 assert.ok(args.includes(JAVA_IMAGE));assert.ok(args.includes('none'));assert.ok(args.some(x=>x.includes('javac -encoding UTF-8')));
 assert.ok(args.includes('--read-only'));assert.ok(args.includes('/build:rw,nosuid,size=64m'));
});
test('Java instructions replace hardcoded Node instructions',()=>{
 const messages=buildMessages({stage:'implementation',prompt:'Crie uma função em Java',artifacts:[],testResults:[]});
 assert.match(messages[0].content,/CONTRATO OBRIGATÓRIO: JAVA/);
 assert.match(messages[0].content,/NÃO use npm/);
});
