import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pickNativeFolder} from './native-folder.mjs';
function fake(start){return (...args)=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.killed=true};queueMicrotask(()=>start(child,args));return child}}
test('fixed Windows picker uses STA, no shell and returns Unicode folder without command interpolation',async()=>{
 const path='C:\\Projetos\\Ação & dados';let captured;
 const result=await pickNativeFolder({platform:'win32',spawnImpl:fake((child,args)=>{captured=args;child.stdout.emit('data',Buffer.from('OPHIUCHUS_FOLDER:'+Buffer.from(path).toString('base64')+'\r\n'));child.emit('close',0)})});
 assert.equal(result,path);assert.equal(captured[0],'powershell.exe');assert.equal(captured[2].shell,false);assert.ok(captured[1].includes('-STA'));assert.ok(captured[1].includes('-NoProfile'));assert.doesNotMatch(captured[1].join(' '),/ExecutionPolicy|Bypass/);assert.ok(!captured[1].join(' ').includes(path));
});
test('cancelling native folder selection returns null and does not fabricate a directory',async()=>{
 assert.equal(await pickNativeFolder({platform:'win32',spawnImpl:fake(child=>{child.stdout.emit('data',Buffer.from('OPHIUCHUS_CANCELLED\n'));child.emit('close',0)})}),null);
});
test('unsupported OS never starts a Windows process',async()=>{
 await assert.rejects(pickNativeFolder({platform:'linux',spawnImpl:()=>{throw Error('must not spawn')}}),/Windows/);
});
test('picker rejects process errors, malformed output and expiry',async()=>{
 await assert.rejects(pickNativeFolder({platform:'win32',spawnImpl:fake(child=>child.emit('error',Error('not installed')))}),/indisponível/);
 await assert.rejects(pickNativeFolder({platform:'win32',spawnImpl:fake(child=>{child.stdout.emit('data',Buffer.from('OPHIUCHUS_FOLDER:not-base64!'));child.emit('close',0)})}),/inválido/);
 await assert.rejects(pickNativeFolder({platform:'win32',timeoutMs:5,spawnImpl:fake(()=>{})}),/expirou/);
});
