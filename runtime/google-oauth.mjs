/** Google Generative Language OAuth; user-owned Google Cloud OAuth app required. */
import {getCredential,saveCredential} from './vault.mjs';
const TOKEN='https://oauth2.googleapis.com/token';
export function googleOAuthReady(env=process.env){return Boolean(env.OPHIUCHUS_GOOGLE_CLIENT_ID&&env.OPHIUCHUS_GOOGLE_CLIENT_SECRET);}
export function googleOAuthConfig(env=process.env){return {enabled:googleOAuthReady(env),clientId:googleOAuthReady(env)?env.OPHIUCHUS_GOOGLE_CLIENT_ID:null};}
export async function exchangeGoogleCode({code,redirectUri,verifier},env=process.env,fetchImpl=fetch){
 if(!googleOAuthReady(env))throw Error('Configure OPHIUCHUS_GOOGLE_CLIENT_ID e OPHIUCHUS_GOOGLE_CLIENT_SECRET no backend');
 if(typeof code!=='string'||code.length>2048||code.length<8||typeof verifier!=='string'||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw Error('Código OAuth/PKCE inválido');
 const redirect=new URL(redirectUri);if(!['localhost','127.0.0.1'].includes(redirect.hostname)||redirect.protocol!=='http:'||!['5173','4317'].includes(redirect.port)||redirect.search||redirect.hash)throw Error('Redirect OAuth local inválido');
 const params=new URLSearchParams({code,client_id:env.OPHIUCHUS_GOOGLE_CLIENT_ID,client_secret:env.OPHIUCHUS_GOOGLE_CLIENT_SECRET,redirect_uri:redirect.toString(),grant_type:'authorization_code',code_verifier:verifier});
 const response=await fetchImpl(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Google OAuth recusou a autorização (HTTP ${response.status})`);
 const data=await response.json();if(typeof data.refresh_token!=='string'||!data.refresh_token)throw Error('Google não retornou refresh_token; revogue o consentimento anterior e reconecte com prompt=consent');
 await saveCredential('google',JSON.stringify({type:'oauth',refreshToken:data.refresh_token}));return {ok:true,provider:'google'};
}
export async function googleAccessToken(env=process.env,fetchImpl=fetch){
 const raw=getCredential('google');let cred;try{cred=JSON.parse(raw)}catch{return null}
 if(cred?.type!=='oauth')return null;
 if(!googleOAuthReady(env))throw Error('Credenciais OAuth Google não configuradas no backend');
 const response=await fetchImpl(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({refresh_token:cred.refreshToken,client_id:env.OPHIUCHUS_GOOGLE_CLIENT_ID,client_secret:env.OPHIUCHUS_GOOGLE_CLIENT_SECRET,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Falha ao atualizar token Google OAuth (HTTP ${response.status}). Reconecte o provedor.`);
 const data=await response.json();if(typeof data.access_token!=='string')throw Error('Token Google OAuth inválido');return data.access_token;
}
