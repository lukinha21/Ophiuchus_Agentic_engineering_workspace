import test from 'node:test';
import assert from 'node:assert/strict';
import {somarValores} from '../src/somarValores.mjs';
test('soma os valores sem modificar a entrada',()=>{
  for (const [entrada,esperado] of [[[2,3],5],[[],0],[[-2,5],3],[[1.5,2.5],4]]) {
    const copia=[...entrada];
    assert.equal(somarValores(entrada),esperado);
    assert.deepEqual(entrada,copia);
  }
});
test('rejeita entradas inválidas',()=>{
  for (const entrada of [null,'2,3',[NaN],[Infinity],['2']]) {
    assert.throws(()=>somarValores(entrada),TypeError);
  }
});
