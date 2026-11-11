import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretQA} from './executor.mjs';
const qa={verdict:'pass',kind:'code',summary:'Compilou',evidence:'Docker exit 0'};
test('QA JSON puro, fence e texto com objeto',()=>{
 for(const t of [JSON.stringify(qa),'```json\n'+JSON.stringify(qa)+'\n```','Parecer:\n'+JSON.stringify(qa)+'\nFim.'])assert.deepEqual(interpretQA(t),qa);
});
test('QA não inventa aprovação de prosa e rejeita objeto incompleto',()=>{
 for(const t of ['Aprovado!','{"verdict":"pass"}','{"verdict":"pass","kind":"code","summary":"ok","evidence":""}'])assert.throws(()=>interpretQA(t),/JSON válido/);
});

test('QA accepts literal newlines and tabs inside JSON strings without inventing approval',()=>{
 const malformed='```json\n{"verdict":"pass","kind":"code","summary":"Testes executaram\n com sucesso","evidence":"Docker\t exit 0"}\n```';
 assert.deepEqual(interpretQA(malformed),{verdict:'pass',kind:'code',summary:'Testes executaram\n com sucesso',evidence:'Docker\t exit 0'});
 assert.throws(()=>interpretQA('{"verdict":"pass","summary":"x\ny"}'),/JSON válido/);
});
