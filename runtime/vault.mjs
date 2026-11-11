/** Encrypted local credential vault. Passphrase never written to disk. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
const FILE=resolve(process.env.OPHIUCHUS_VAULT_FILE||'./.ophiuchus-local/credentials.enc');
const supported=new Set(['openai','openrouter','google','anthropic','custom']);
const customHosts=new Set(['api.groq.com','api.together.xyz','api.fireworks.ai','api.deepseek.com','api.mistral.ai','api.cerebras.ai']);
let secrets=null;
let password=null;
const derive=(pass,salt)=>scryptSync(pass,salt,32,{N:16384,r:8,p:1});
function encrypt(data,pass){const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',derive(pass,salt),iv);const content=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);return JSON.stringify({version:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:content.toString('base64')});}
function decrypt(raw,pass){const obj=JSON.parse(raw);if(obj.version!==1)throw Error('Formato do cofre não suportado');const cipher=createDecipheriv('aes-256-gcm',derive(pass,Buffer.from(obj.salt,'base64')),Buffer.from(obj.iv,'base64'));cipher.setAuthTag(Buffer.from(obj.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(obj.data,'base64')),cipher.final()]).toString('utf8'));}
async function persist(){const temp=FILE+'.tmp';await mkdir(dirname(FILE),{recursive:true,mode:0o700});await writeFile(temp,encrypt(secrets,password),{mode:0o600});await rename(temp,FILE);}
export async function vaultStatus(){let exists=true;try{await readFile(FILE);}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}return {exists,unlocked:secrets!==null,configured:secrets?Object.keys(secrets):[]};}
export async function unlockVault(pass){if(typeof pass!=='string'||pass.length<12||pass.length>512)throw Error('Senha do cofre deve ter entre 12 e 512 caracteres');let raw;try{raw=await readFile(FILE,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 let next={};if(raw){try{next=decrypt(raw,pass);}catch{throw Error('Senha incorreta ou cofre danificado');}}
 secrets=next;password=pass;if(!raw)await persist();return vaultStatus();}
export function lockVault(){secrets=null;password=null;}
export async function saveCredential(id,key){if(!supported.has(id))throw Error('Provedor inválido');if(!secrets)throw Error('Desbloqueie o cofre primeiro');if(typeof key!=='string'||key.trim().length<8||key.length>8192)throw Error('Chave inválida');secrets[id]=key.trim();await persist();}
export async function removeCredential(id){if(!supported.has(id))throw Error('Provedor inválido');if(!secrets)throw Error('Desbloqueie o cofre primeiro');delete secrets[id];await persist();}
export function getCredential(id){return secrets?.[id]||null;}

export async function saveCustomEndpoint(baseUrl){
 if(!secrets)throw Error('Desbloqueie o cofre primeiro');
 const url=new URL(baseUrl);
 if(url.protocol!=='https:'||!customHosts.has(url.hostname)||url.username||url.password||url.search||url.hash)throw Error('Endpoint não autorizado. Use um dos provedores compatíveis listados.');
 secrets.customEndpoint=url.toString().replace(/\/$/,'');await persist();
}
export function getCustomEndpoint(){return secrets?.customEndpoint||null;}
