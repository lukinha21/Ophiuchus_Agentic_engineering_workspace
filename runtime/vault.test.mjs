import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const folder=await mkdtemp(join(tmpdir(),'ophi-vault-'));
process.env.OPHIUCHUS_VAULT_FILE=join(folder,'credentials.enc');
const {unlockVault,lockVault,saveCredential,removeCredential,getCredential,vaultStatus}=await import('./vault.mjs');
test('encrypted vault does not persist plaintext and can lock/unlock',async()=>{
 try{
  await unlockVault('senha-mestra-super-forte');await saveCredential('google','gemini-test-secret');
  assert.equal(getCredential('google'),'gemini-test-secret');
  const raw=await readFile(process.env.OPHIUCHUS_VAULT_FILE,'utf8');assert.doesNotMatch(raw,/gemini-test-secret/);
  lockVault();assert.equal(getCredential('google'),null);
  await assert.rejects(unlockVault('senha-mestra-incorreta'));
  await unlockVault('senha-mestra-super-forte');assert.equal(getCredential('google'),'gemini-test-secret');
  await removeCredential('google');assert.equal((await vaultStatus()).configured.length,0);
 }finally{lockVault();await rm(folder,{recursive:true,force:true});}
});
