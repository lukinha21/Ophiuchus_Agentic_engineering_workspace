import test from 'node:test';
import assert from 'node:assert/strict';
import {IMAGES,cobolDockerArgs,languageDockerArgs,retryableInfrastructureFailure,classifyTestFailure} from './test-runner.mjs';
import {compactHistory} from './optimization.mjs';
test('COBOL defaults to locally buildable image, never nonexistent upstream',()=>{
 assert.equal(IMAGES.cobol,'ophiuchus-gnucobol:local');
 assert.ok(cobolDockerArgs('/tmp',['src/a.cob','tests/test_a.cob'],['tests/test_a.cob']).includes('ophiuchus-gnucobol:local'));
});
test('nonretryable image errors are infrastructure failures',()=>{
 const r={passed:false,exitCode:125,output:'pull access denied for gnucobol/gnucobol, repository does not exist'};
 assert.equal(classifyTestFailure(r),'infrastructure');
 assert.equal(retryableInfrastructureFailure(r),false);
 assert.equal(retryableInfrastructureFailure({output:'resource temporarily unavailable'}),true);
});
test('Go honors modules and limits parallel compilation',()=>{
 const cmd=languageDockerArgs('/tmp','go',['sorter_test.go']).at(-1);
 assert.match(cmd,/GOMAXPROCS=1/);assert.match(cmd,/go test -p 1/);assert.doesNotMatch(cmd,/GO111MODULE=off/);
});
test('history never resends full code blocks or implementation duplicates',()=>{
 const artifacts=[{stage:'discovery',text:'## Requisitos\n- sortear entre 1 e 500'},{stage:'implementation',text:'```go\nSECRET_LONG_SOURCE\n```'},{stage:'review',text:'## Revisão\n- sem bloqueadores\n```go\nSECRET_LONG_SOURCE\n```'}];
 const result=compactHistory(artifacts,{mode:'off'});
 assert.match(result,/Requisitos/);assert.doesNotMatch(result,/SECRET_LONG_SOURCE/);assert.doesNotMatch(result,/\[implementation/);
});
