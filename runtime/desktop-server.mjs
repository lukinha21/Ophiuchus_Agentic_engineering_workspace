import {once} from 'node:events';import {fileURLToPath} from 'node:url';import {createDesktopHost} from './desktop-host.mjs';
process.env.OPHIUCHUS_PORT='0';process.env.OPHIUCHUS_DESKTOP='1';
const {server,shutdown}=await import('./server.mjs');if(!server.listening)await once(server,'listening');
const host=await createDesktopHost({dist:fileURLToPath(new URL('../dist/',import.meta.url)),apiPort:server.address().port,port:Number(process.env.OPHIUCHUS_DESKTOP_PORT||4318),onOAuth:url=>process.send?.({type:'oauth-callback',url})});
process.env.OPHIUCHUS_DESKTOP_ORIGIN=host.origin;process.send?.({type:'ready',origin:host.origin});
let stopping=false;async function stop(){if(stopping)return;stopping=true;await Promise.allSettled([host.close(),shutdown()]);process.exit(0)}
process.on('message',message=>{if(message?.type==='shutdown')void stop()});process.on('disconnect',()=>void stop());process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
