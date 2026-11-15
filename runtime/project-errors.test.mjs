import test from 'node:test';
import assert from 'node:assert/strict';
import {projectError} from './project-errors.mjs';
test('timeout diagnostics state observed stage and deadline without inventing a provider cause',()=>{
 const d=projectError(new DOMException('The operation was aborted due to timeout','TimeoutError'),{stage:'Arquiteto',timeoutMs:90000});
 assert.equal(d.code,'MODEL_TIMEOUT');assert.equal(d.retryable,true);assert.match(d.message,/Arquiteto excedeu 90 segundos/);assert.doesNotMatch(d.message,/alta demanda|sem créditos/);
});
test('transport errors can resume while invalid results and source conflicts fail closed',()=>{
 for(const status of [429,503])assert.equal(projectError(Error('Falha HTTP '+status)).retryable,true);
 assert.equal(projectError(Error('fetch failed')).code,'NETWORK_ERROR');assert.equal(projectError(Error('JSON inválido')).retryable,false);assert.equal(projectError(Error('Conflito: arquivo mudou')).code,'SOURCE_CONFLICT');
});
test('user cancellation is distinct from a timeout',()=>{
 const d=projectError(new DOMException('operation aborted','AbortError'),{cancelled:true});assert.equal(d.code,'CANCELLED');assert.equal(d.retryable,false);
});
