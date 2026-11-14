import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,link,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createProjectService,projectPath} from './local-project.mjs';
const binding={providerId:'google',modelId:'fixture'};
const proposal=changes=>({text:JSON.stringify({summary:'Correção revisável',changes}),finishReason:'stop',usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});
async function fixture(t,generate=async()=>proposal([{path:'src/sum.mjs',content:'export const sum=(a,b)=>a+b;\n',reason:'Somar corretamente'}]),docker,onUsage){
 const dir=await mkdtemp(join(tmpdir(),'ophi-project-')),root=join(dir,'project');await mkdir(join(root,'src'),{recursive:true});await mkdir(join(root,'tests'));
 await writeFile(join(root,'src/sum.mjs'),'export const sum=(a,b)=>a-b;\n');await writeFile(join(root,'tests/sum.test.mjs'),"import {sum} from '../src/sum.mjs';\n");await writeFile(join(root,'package.json'),'{"type":"module"}');
 const service=createProjectService({storageRoot:join(dir,'store'),generate,docker,onUsage});const project=await service.open({path:root,confirmRead:true});t.after(()=>rm(dir,{recursive:true,force:true}));return {dir,root,service,project};
}
const task=(f,extra={})=>f.service.task(f.project.id,{goal:'Corrija sum',mode:'propose',paths:['src/sum.mjs'],binding,confirmSend:true,...extra});
test('path policy rejects traversal, absolute paths, symlinks destinations and secret conventions',()=>{
 for(const p of ['../a.js','/tmp/a.js','C:/a.js','src\\a.js','node_modules/a.js','NODE_MODULES/a.js','.env','src/credentials.json','secrets/config.json','src/a.pem','src/CON.js','src./a.js'])assert.throws(()=>projectPath(p),p);
 assert.equal(projectPath('src/ação.mjs'),'src/ação.mjs');
});
test('opening requires explicit read authorization and valid session',async t=>{
 const f=await fixture(t);await assert.rejects(f.service.open({path:f.root,confirmRead:false}),/autorize/);await assert.rejects(f.service.list('unknown'),/sessão/);await f.service.close(f.project.id);await assert.rejects(f.service.read(f.project.id,'src/sum.mjs'),/sessão/);
});
test('tree omits dependencies, secrets, binary files, links and ignored paths',async t=>{
 const f=await fixture(t);for(const folder of ['node_modules','dist','credentials','ignored','nested'])await mkdir(join(f.root,folder));
 await writeFile(join(f.root,'.env'),'SECRET=1');await writeFile(join(f.root,'node_modules/a.js'),'private');await writeFile(join(f.root,'credentials/config.json'),'private');await writeFile(join(f.root,'ignored/a.js'),'private');await writeFile(join(f.root,'.gitignore'),'ignored/\n*.generated.js\n');await writeFile(join(f.root,'code.generated.js'),'private');await writeFile(join(f.root,'nested/.gitignore'),'omit.js\n');await writeFile(join(f.root,'nested/omit.js'),'private');await writeFile(join(f.root,'binary.js'),Buffer.from([1,0,2]));
 await symlink(join(f.root,'src/sum.mjs'),join(f.root,'linked.mjs'));const list=await f.service.list(f.project.id);const paths=list.files.map(f=>f.path);assert.ok(paths.includes('src/sum.mjs'));for(const p of ['.env','node_modules/a.js','credentials/config.json','ignored/a.js','code.generated.js','nested/omit.js','binary.js','linked.mjs'])assert.ok(!paths.includes(p),p);
 await assert.rejects(f.service.read(f.project.id,'ignored/a.js'),/ignorado/);
});
test('search returns bounded literal content matches and safe reads',async t=>{
 const f=await fixture(t);const r=await f.service.search(f.project.id,'sum');assert.ok(r.hits.some(h=>h.path==='src/sum.mjs'&&h.line===1));assert.match((await f.service.read(f.project.id,'src/sum.mjs')).content,/a-b/);await assert.rejects(f.service.read(f.project.id,'../out.mjs'));
});
test('analysis transmits selected snapshot only with authorization and does not edit originals',async t=>{
 let captured;const f=await fixture(t,async args=>{captured=args;return {text:'src/sum.mjs: subtração indevida',finishReason:'stop',usage:{total_tokens:25}};});
 await assert.rejects(task(f,{confirmSend:false}),/Autorize/);assert.equal(captured,undefined);
 const result=await task(f,{mode:'analyse'});assert.match(result.summary,/subtração/);assert.deepEqual(result.contextPaths,['src/sum.mjs']);assert.match(captured.messages[1].content,/a-b/);assert.doesNotMatch(captured.messages[1].content,/import \{sum\}/);assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);
});
test('proposal creates isolated copy, diff and immutable baseline before apply',async t=>{
 const f=await fixture(t),r=await task(f),c=r.draft.changes[0];assert.equal(c.applied,false);assert.ok(c.diff.lines.some(l=>l.kind==='add'));
 assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);const store=join(f.dir,'store',f.project.id,'drafts',r.draft.id);assert.match(await readFile(join(store,'worktree/src/sum.mjs'),'utf8'),/a\+b/);assert.match(await readFile(join(store,'base/src/sum.mjs'),'utf8'),/a-b/);
});
test('apply and undo require per-action consent and preserve exact original',async t=>{
 const f=await fixture(t),r=await task(f),opts={path:'src/sum.mjs',confirmWrite:true};await assert.rejects(f.service.apply(f.project.id,r.draft.id,{...opts,confirmWrite:false}),/Aprovação/);
 await f.service.apply(f.project.id,r.draft.id,opts);assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a\+b/);
 await f.service.undo(f.project.id,r.draft.id,opts);assert.equal(await readFile(join(f.root,'src/sum.mjs'),'utf8'),'export const sum=(a,b)=>a-b;\n');
});
test('apply never overwrites changes made after snapshot',async t=>{
 const f=await fixture(t),r=await task(f);await writeFile(join(f.root,'src/sum.mjs'),'manual edit');await assert.rejects(f.service.apply(f.project.id,r.draft.id,{path:'src/sum.mjs',confirmWrite:true}),/Conflito/);assert.equal(await readFile(join(f.root,'src/sum.mjs'),'utf8'),'manual edit');
});
test('undo never overwrites changes made after applying draft',async t=>{
 const f=await fixture(t),r=await task(f),opts={path:'src/sum.mjs',confirmWrite:true};await f.service.apply(f.project.id,r.draft.id,opts);await writeFile(join(f.root,'src/sum.mjs'),'new manual edit');await assert.rejects(f.service.undo(f.project.id,r.draft.id,opts),/Conflito/);
});
test('new file can be applied and undone without deleting an existing original',async t=>{
 const f=await fixture(t,async()=>proposal([{path:'src/new.mjs',content:'export const n=1;'}])),r=await task(f),opts={path:'src/new.mjs',confirmWrite:true};await f.service.apply(f.project.id,r.draft.id,opts);await access(join(f.root,'src/new.mjs'));await f.service.undo(f.project.id,r.draft.id,opts);await assert.rejects(access(join(f.root,'src/new.mjs')));
});
test('ignored existing files and files absent from model context cannot be overwritten',async t=>{
 const f=await fixture(t,async()=>proposal([{path:'tests/sum.test.mjs',content:'new code'}]));await assert.rejects(task(f),/não fornecido/);
});
test('proposal to a new path ignored by gitignore is rejected',async t=>{
 const f=await fixture(t,async()=>proposal([{path:'ignored/a.mjs',content:'new code'}]));await writeFile(join(f.root,'.gitignore'),'ignored/');await assert.rejects(task(f),/ignorado/);
});
test('symlink swapped into an original path blocks applying draft',async t=>{
 const f=await fixture(t),r=await task(f),outside=join(f.dir,'outside.mjs');await writeFile(outside,'keep');await rm(join(f.root,'src/sum.mjs'));await symlink(outside,join(f.root,'src/sum.mjs'));await assert.rejects(f.service.apply(f.project.id,r.draft.id,{path:'src/sum.mjs',confirmWrite:true}));assert.equal(await readFile(outside,'utf8'),'keep');
});
test('hard-linked source is excluded',async t=>{
 const f=await fixture(t);await link(join(f.root,'src/sum.mjs'),join(f.dir,'hardlink'));const r=await f.service.list(f.project.id);assert.ok(!r.files.some(f=>f.path==='src/sum.mjs'));
});
test('truncated or malformed model output never creates a source change',async t=>{
 const f=await fixture(t,async()=>({text:'{"summary":',finishReason:'length',usage:{total_tokens:12}}));await assert.rejects(task(f),/truncada/);assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);
});
test('draft tests use only isolated snapshot in Docker with explicit execution authorization',async t=>{
 let captured;const f=await fixture(t,undefined,async(args)=>{captured=args;return {passed:true,exitCode:0,output:'test fixture passed'};}),r=await task(f);
 await assert.rejects(f.service.test(f.project.id,r.draft.id,{confirmExecute:false}),/Autorize/);assert.equal(captured,undefined);const d=await f.service.test(f.project.id,r.draft.id,{confirmExecute:true});assert.ok(captured.includes('none'));assert.ok(captured.includes('--read-only'));const mount=captured.find(x=>x.includes('dst=/workspace'));assert.ok(mount.includes('worktree'));assert.ok(!mount.includes('src='+f.root+','));assert.equal(d.test.scope,'ISOLATED_DRAFT');assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);
});
test('closed sessions and foreign draft IDs cannot apply changes',async t=>{
 const f=await fixture(t),r=await task(f);await assert.rejects(f.service.apply(f.project.id,'foreign',{path:'src/sum.mjs',confirmWrite:true}),/inválido/);await f.service.close(f.project.id);await assert.rejects(f.service.apply(f.project.id,r.draft.id,{path:'src/sum.mjs',confirmWrite:true}),/sessão/);
});
test('automatic context finds a relevant source and stays bounded',async t=>{
 let captured;const f=await fixture(t,async args=>{captured=args;return {text:'Análise com contexto parcial',finishReason:'stop',usage:{total_tokens:8}};});
 const r=await task(f,{mode:'analyse',paths:[],goal:'Encontre sum no projeto'});assert.ok(r.contextPaths.includes('src/sum.mjs'));assert.ok(captured.messages[1].content.length<50000);
});
test('context size, duplicate paths and missing files fail without model calls',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return proposal([])});await writeFile(join(f.root,'src/large.js'),'x'.repeat(25000));await assert.rejects(task(f,{paths:['src/large.js']}),/contexto/);await assert.rejects(task(f,{paths:['missing.js']}),/catálogo/);await assert.rejects(task(f,{paths:['src/sum.mjs','src/sum.mjs']}),/Seleção/);assert.equal(calls,0);
});
test('model usage is reported even when a proposal is malformed',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ophi-usage-'));t.after(()=>rm(dir,{recursive:true,force:true}));const root=join(dir,'repo');await mkdir(root);await writeFile(join(root,'a.mjs'),'export const a=1;');let usage;
 const service=createProjectService({storageRoot:join(dir,'store'),onUsage:async report=>{usage=report},generate:async()=>({text:'not JSON',finishReason:'stop',usage:{total_tokens:99}})});const p=await service.open({path:root,confirmRead:true});await assert.rejects(service.task(p.id,{goal:'melhore a.mjs',mode:'propose',paths:['a.mjs'],confirmSend:true,binding}),/JSON/);assert.equal(usage.usage.total_tokens,99);
});
test('project write policy blocks new source after an existing parent becomes a link',async t=>{
 const f=await fixture(t,async()=>proposal([{path:'src/new.mjs',content:'x'}])),r=await task(f),outside=join(f.dir,'outside');await mkdir(outside);await rm(join(f.root,'src'),{recursive:true});await symlink(outside,join(f.root,'src'));await assert.rejects(f.service.apply(f.project.id,r.draft.id,{path:'src/new.mjs',confirmWrite:true}));await assert.rejects(access(join(outside,'new.mjs')));
});
test('compact edits preserve the rest of the file and still require explicit apply',async t=>{
 const f=await fixture(t,async()=>proposal([{path:'src/sum.mjs',edits:[{oldText:'a-b',newText:'a+b'}],reason:'Corrigir soma'}]));
 const r=await task(f);assert.equal(r.draft.changes[0].content,'export const sum=(a,b)=>a+b;\n');
 assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);
 await f.service.apply(f.project.id,r.draft.id,{path:'src/sum.mjs',confirmWrite:true});assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a\+b/);
});
test('compact edits reject ambiguous, missing, unseen and mixed full-file replacements',async t=>{
 for(const change of [
  {path:'src/sum.mjs',edits:[{oldText:'a',newText:'x'}]},
  {path:'src/sum.mjs',edits:[{oldText:'absent',newText:'x'}]},
  {path:'tests/sum.test.mjs',edits:[{oldText:'import',newText:'x'}]},
  {path:'src/sum.mjs',content:'oops',edits:[{oldText:'a-b',newText:'a+b'}]}
 ]){const f=await fixture(t,async()=>proposal([change]));await assert.rejects(task(f));assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/)}
});
test('follow-up includes bounded conversation while a fresh chat carries no previous turns',async t=>{
 const captured=[];const f=await fixture(t,async args=>{captured.push(args);return {text:'Análise',finishReason:'stop'}});
 const history=[{role:'user',content:'Analise src/sum.mjs'},{role:'assistant',content:'A soma está subtraindo.'}];
 await task(f,{mode:'analyse',goal:'Agora melhore isso',history});assert.ok(captured[0].messages[1].content.includes('A soma está subtraindo.'));
 await task(f,{mode:'analyse',goal:'Novo assunto',history:[]});assert.ok(!captured[1].messages[1].content.includes('A soma está subtraindo.'));
 await assert.rejects(task(f,{history:[{role:'system',content:'escape'}]}),/Histórico/);
 await assert.rejects(task(f,{history:[{role:'user',content:'x'.repeat(1801)}]}),/Histórico/);
 await assert.rejects(task(f,{history:Array(7).fill({role:'user',content:'x'})}),/Histórico/);
 assert.equal(captured.length,2);
});

test('truncation recovers once with a smaller scope, accounts both calls and discards partial code',async t=>{
 const calls=[];const reports=[];
 const f=await fixture(t,async(args,options)=>{calls.push(args);assert.ok(options.signal);return calls.length===1?{text:'{"summary":"partial","changes":[',finishReason:'length',usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}:proposal([{path:'src/sum.mjs',edits:[{oldText:'a-b',newText:'a+b'}]}]);},undefined,async report=>reports.push(report));
 const r=await task(f,{paths:['src/sum.mjs','package.json']});assert.equal(calls.length,2);assert.equal(reports.length,2);assert.notEqual(reports[0].id,reports[1].id);assert.equal(reports.reduce((n,r)=>n+r.usage.total_tokens,0),60);assert.equal(calls[0].maxOutputTokens,4096);assert.equal(calls[1].maxOutputTokens,4096);
 assert.match(calls[1].messages[1].content,/RECUPERAÇÃO LIMITADA/);assert.doesNotMatch(calls[1].messages[1].content,/"type":"module"/);
 assert.match(r.draft.summary,/Escopo reduzido/);assert.equal(r.draft.usage.total_tokens,60);assert.equal(r.draft.changes[0].content,'export const sum=(a,b)=>a+b;\n');
 assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);
 const dir=join(f.dir,'store',f.project.id,'drafts',r.draft.id);assert.equal(JSON.parse(await readFile(join(dir,'response.json'),'utf8')).finishReason,'length');assert.equal(JSON.parse(await readFile(join(dir,'response-retry.json'),'utf8')).finishReason,'stop');
});

test('repeated truncation stops after two attempts without a draft',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return {text:'',finishReason:'length',usage:{total_tokens:12}}});
 await assert.rejects(task(f),/Resposta truncada/);assert.equal(calls,2);assert.equal((await f.service.info(f.project.id)).drafts.length,0);assert.match(await readFile(join(f.root,'src/sum.mjs'),'utf8'),/a-b/);
});

test('recovery rejects full files and changes outside its reduced scope',async t=>{
 for(const change of [{path:'src/sum.mjs',content:'replacement'},{path:'package.json',edits:[{oldText:'module',newText:'commonjs'}]}]){
  let calls=0;const f=await fixture(t,async()=>++calls===1?{text:'partial',finishReason:'length'}:proposal([change]));
  await assert.rejects(task(f,{paths:['src/sum.mjs','package.json']}),/escopo reduzido/);assert.equal(calls,2);assert.equal((await f.service.info(f.project.id)).drafts.length,0);
 }
});

test('analysis truncation and provider errors do not trigger automatic retries',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return {text:'partial',finishReason:'length'}});await assert.rejects(task(f,{mode:'analyse'}),/truncada/);assert.equal(calls,1);
 const g=await fixture(t,async()=>{calls++;throw Error('HTTP 429')});await assert.rejects(task(g),/429/);assert.equal(calls,2);
});

test('cancellation during first attempt prevents recovery',async t=>{
 const controller=new AbortController();let calls=0;const f=await fixture(t,async()=>{calls++;controller.abort();return {text:'partial',finishReason:'length'}});
 await assert.rejects(f.service.task(f.project.id,{goal:'melhore',mode:'propose',paths:['src/sum.mjs'],binding,confirmSend:true},{signal:controller.signal}),/abort/i);assert.equal(calls,1);
});
