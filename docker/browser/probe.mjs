import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root='/workspace',errors=[],blocked=[],checks=[];
const recordError=value=>{if(errors.length<30)errors.push(value)};
const safe=value=>{if(typeof value!=='string'||value.length>500||value.includes('\\')||value.split('/').some(p=>p==='..')||value.startsWith('/'))throw Error('Caminho de teste inválido');return value};
const server=http.createServer(async(req,res)=>{try{const path=resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');const actual=await realpath(path);if(!actual.startsWith(root+sep)||(await stat(actual)).size>2e6)throw Error('Arquivo indisponível');const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'content-type':types[extname(actual)]||'application/octet-stream'});res.end(await readFile(actual));}catch{res.writeHead(404);res.end('Not found')}});
let browser,result;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 let suite;try{const raw=await readFile(root+'/ophiuchus.browser-tests.json','utf8');if(raw.length>64000)throw Error('Roteiro muito grande');suite=JSON.parse(raw)}catch(e){if(e.code!=='ENOENT')throw e}
 if(suite&&(!Array.isArray(suite.cases)||!suite.cases.length||suite.cases.length>20))throw Error('Roteiro exige 1 a 20 casos');
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin||['data:','blob:'].includes(u.protocol))return route.continue();if(blocked.length<20)blocked.push(u.origin);return route.abort()});
 const cases=suite?.cases||[{name:'Abertura HTML',path:process.argv[2]||'index.html',steps:[]}];
 for(const test of cases){
  if(!test||typeof test.name!=='string'||test.name.length>200||!Array.isArray(test.steps)||test.steps.length>50)throw Error('Caso inválido');
  const page=await context.newPage();page.setDefaultTimeout(3000);
  page.on('pageerror',e=>recordError(e.message.slice(0,1000)));page.on('console',m=>{if(m.type()==='error')recordError(m.text().slice(0,1000))});
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===origin)recordError('HTTP '+r.status()+' '+new URL(r.url()).pathname)});
  try{
   const response=await page.goto(origin+'/'+safe(test.path||'index.html'),{waitUntil:'load',timeout:10000});if(!response?.ok())throw Error('HTML não abriu');
   if(!await page.locator('body').count())throw Error('Página sem body');
   for(const step of test.steps){
    if(!step||typeof step.selector!=='string'||step.selector.length>500)throw Error('Seletor inválido');const loc=page.locator(step.selector);
    if(step.action==='click')await loc.click();
    else if(step.action==='fill'&&typeof step.value==='string'&&step.value.length<=2000)await loc.fill(step.value);
    else if(step.action==='press'&&typeof step.value==='string'&&step.value.length<=80)await loc.press(step.value);
    else if(step.action==='visible'){await loc.waitFor({state:'visible'})}
    else if(step.action==='text'&&typeof step.value==='string'&&step.value.length<=2000){await loc.filter({hasText:step.value}).first().waitFor({state:'visible'})}
    else if(step.action==='count'&&Number.isInteger(step.value)){if(await loc.count()!==step.value)throw Error('Quantidade diferente do esperado')}
    else throw Error('Ação de teste inválida');
   }
   await page.waitForTimeout(250);
   const canvases=await page.locator('canvas').evaluateAll(nodes=>nodes.map(n=>({width:n.width,height:n.height})));if(canvases.some(c=>!c.width||!c.height))throw Error('Canvas sem dimensões');
   checks.push({name:test.name,passed:true,steps:test.steps.length,canvases:canvases.length});
  }catch(e){checks.push({name:test.name,passed:false,error:String(e.message).slice(0,1500)})}finally{await page.close()}
 }
 result={kind:suite?'BROWSER_ASSERTIONS':'BROWSER_SMOKE',passed:checks.every(c=>c.passed)&&!errors.length&&!blocked.length,checks,errors:errors.slice(0,30),blocked:[...new Set(blocked)].slice(0,20),limitation:suite?'Somente as interações declaradas no roteiro foram verificadas.':'Verifica abertura, erros de JavaScript, recursos locais e dimensões do Canvas; não comprova regras do jogo nem resultado visual.'};
}catch(e){result={passed:false,kind:'BROWSER_SETUP_ERROR',error:String(e.message)}}
finally{await browser?.close();await new Promise(r=>server.close(r))}
console.log('OPHIUCHUS_BROWSER_RESULT='+JSON.stringify(result));process.exitCode=result.passed?0:1;
