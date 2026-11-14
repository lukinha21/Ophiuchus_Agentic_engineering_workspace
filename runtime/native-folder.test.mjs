import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pickNativeFolder} from './native-folder.mjs';
function fake(start){return (...args)=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{child.killed=true};queueMicrotask(()=>start(child,args));return child}}
test('fixed Windows picker uses STA, no shell and returns Unicode folder without command interpolation',async()=>{
 const path='C:\\Projetos\\Ação & dados';let captured;
 const result=await pickNativeFolder({platform:'win32',spawnImpl:fake((child,args)=>{captured=args;child.stdout.emit('data',Buffer.from('OPHIUCHUS_FOLDER:'+Buffer.from(path).toString('base64')+'\r\n'));child.emit('close',0)})});
 assert.equal(result,path);assert.equal(captured[0],'powershell.exe');assert.equal(captured[2].shell,false);assert.ok(captured[1].includes('-STA'));assert.ok(captured[1].includes('-NoProfile'));assert.doesNotMatch(captured[1].join(' '),/ExecutionPolicy|Bypass/);assert.ok(!captured[1].join(' ').includes(path));
 assert.equal(captured[2].windowsHide,true);assert.ok(captured[1].includes('-EncodedCommand'));
 const script=Buffer.from(captured[1].at(-1),'base64').toString('utf16le');
 assert.ok(script.indexOf('$owner.Show()')<script.indexOf('$dialog.ShowDialog($owner)'));assert.match(script,/\$owner\.Activate\(\)/);assert.match(script,/OPHIUCHUS_READY/);
});

test('startup and selection timeouts have a machine-readable code and kill the helper',async()=>{
 let child;
 await assert.rejects(pickNativeFolder({platform:'win32',startupTimeoutMs:5,spawnImpl:fake(c=>child=c)}),e=>e.code==='PICKER_TIMEOUT'&&/abertura/.test(e.message));assert.equal(child.killed,true);
 await assert.rejects(pickNativeFolder({platform:'win32',startupTimeoutMs:500,timeoutMs:5,spawnImpl:fake(c=>{child=c;c.stdout.emit('data',Buffer.from('OPHIUCHUS_RE'));c.stdout.emit('data',Buffer.from('ADY\n'));})}),e=>e.code==='PICKER_TIMEOUT'&&/Seleção/.test(e.message));assert.equal(child.killed,true);
});

test('cancelling an outstanding picker resolves as cancellation and ends the process',async()=>{
 const controller=new AbortController();let child;
 const result=pickNativeFolder({platform:'win32',signal:controller.signal,spawnImpl:fake(c=>{child=c;c.stdout.emit('data',Buffer.from('OPHIUCHUS_READY\n'));controller.abort();})});
 assert.equal(await result,null);assert.equal(child.killed,true);
});

test('an already cancelled request never starts a helper',async()=>{
 const controller=new AbortController();controller.abort();
 assert.equal(await pickNativeFolder({platform:'win32',signal:controller.signal,spawnImpl:()=>{throw Error('must not spawn')}}),null);
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
