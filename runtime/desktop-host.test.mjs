import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {once} from 'node:events';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createDesktopHost} from './desktop-host.mjs';
test('desktop serves the compiled app and proxies same-origin API without development servers',async t=>{
 const dist=await mkdtemp(join(tmpdir(),'ophi-desktop-'));await writeFile(join(dist,'index.html'),'<h1>Ophiuchus</h1>');let captured;
 const api=http.createServer((req,res)=>{captured={url:req.url,origin:req.headers.origin};res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true}))});api.listen(0,'127.0.0.1');await once(api,'listening');
 let callback;const host=await createDesktopHost({dist,apiPort:api.address().port,port:0,onOAuth:url=>callback=url});t.after(async()=>{await host.close();await new Promise(r=>api.close(r));await rm(dist,{recursive:true,force:true})});
 let response=await fetch(host.origin);assert.match(await response.text(),/Ophiuchus/);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
 response=await fetch(host.origin+'/api/health',{headers:{origin:host.origin}});assert.equal(response.status,200);assert.equal(captured.url,'/health');assert.equal(captured.origin,undefined);
 assert.equal((await fetch(host.origin+'/api/health',{headers:{origin:'https://external.example'}})).status,403);assert.equal((await fetch(host.origin+'/unknown.js')).status,404);
 response=await fetch(host.origin+'/?code=sample&state=test');assert.equal(response.status,200);assert.ok(callback.startsWith(host.origin));
});
