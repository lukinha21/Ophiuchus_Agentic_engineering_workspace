import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import {resolve,sep,extname} from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2'};
export async function createDesktopHost({dist,apiPort,port=4318,onOAuth=()=>{}}){
 const root=resolve(dist);await stat(resolve(root,'index.html'));
 let origin='';
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!==new URL(origin).host)return end(res,403,'Host inválido');
  if(req.headers.origin&&req.headers.origin!==origin)return end(res,403,'Origem não autorizada');
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){
   const headers={...req.headers,host:'127.0.0.1:'+apiPort};delete headers.origin;
   const upstream=http.request({hostname:'127.0.0.1',port:apiPort,path:url.pathname.slice(4)+url.search,method:req.method,headers},response=>{res.writeHead(response.statusCode,{'cache-control':'no-store',...response.headers});response.pipe(res);});upstream.on('error',()=>end(res,502,'API local indisponível'));req.on('aborted',()=>upstream.destroy());req.pipe(upstream);return;
  }
  if(!['GET','HEAD'].includes(req.method))return end(res,405,'Método não permitido');
  if(url.pathname==='/'&&url.searchParams.has('code')){onOAuth(url.href);return end(res,200,'Autorização recebida. Volte à janela do Ophiuchus.');}
  let path;try{path=decodeURIComponent(url.pathname)}catch{return end(res,400,'Caminho inválido')}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep))return end(res,403,'Caminho fora do aplicativo');
  let data;try{data=await readFile(file)}catch{return end(res,404,'Arquivo não encontrado')}
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self';script-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data:;connect-src 'self';font-src 'self' data:;object-src 'none';base-uri 'none';frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:data);
 }catch{end(res,500,'Falha ao carregar aplicativo')}});
 for(let candidate=port;candidate<port+12;candidate++){try{await new Promise((ok,fail)=>{server.once('error',fail);server.listen(candidate,'127.0.0.1',()=>{server.removeListener('error',fail);ok()})});origin='http://127.0.0.1:'+server.address().port;break}catch(e){if(e.code!=='EADDRINUSE')throw e;}}
 if(!origin)throw Error('Não há porta local disponível para o aplicativo');
 return {server,origin,close:()=>new Promise(resolve=>server.close(resolve))};
}
function end(res,status,message){if(!res.headersSent)res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(message)}
