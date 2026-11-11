import test from 'node:test';
import assert from 'node:assert/strict';
import {stackContract,validateStageLanguage} from './stack-contract.mjs';
import {googleOAuthConfig} from './google-oauth.mjs';
test('explicit languages never fall back to JavaScript',()=>{
 for(const [name,prompt] of [['cobol','crie em COBOL'],['kotlin','crie em Kotlin'],['typescript','escreva em TypeScript'],['swift','função em Swift'],['php','programa em PHP'],['cpp','em C++'],['fortran','em Fortran']])assert.equal(stackContract(prompt).language,name);
});
test('planning guard rejects JS artifacts in COBOL request',()=>{
 const contract=stackContract('crie função em cobol');
 assert.equal(validateStageLanguage('discovery','Contrato: JavaScript/Node.js. ```javascript file:index.js',contract).ok,false);
 assert.equal(validateStageLanguage('specification','Implementação: COBOL em sorteio.cob.',contract).ok,true);
});
test('Google OAuth requires server credentials',()=>{
 assert.equal(googleOAuthConfig({}).enabled,false);
 assert.equal(googleOAuthConfig({OPHIUCHUS_GOOGLE_CLIENT_ID:'id',OPHIUCHUS_GOOGLE_CLIENT_SECRET:'secret'}).enabled,true);
});
