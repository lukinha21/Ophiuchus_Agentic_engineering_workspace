/** Fixed Windows folder dialog. No user-supplied command, arguments, or shell expansion. */
import {spawn} from 'node:child_process';
const script=`Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Ophiuchus - escolha a pasta do projeto para autorizar leitura local'
$dialog.ShowNewFolderButton = $false
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
try {
 if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::WriteLine('OPHIUCHUS_FOLDER:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)))
 } else { [Console]::WriteLine('OPHIUCHUS_CANCELLED') }
} finally { $dialog.Dispose(); $owner.Dispose() }`;
export function pickNativeFolder({platform=process.platform,spawnImpl=spawn,timeoutMs=120000}={}){
 if(platform!=='win32')return Promise.reject(Error('O seletor nativo desta versão está disponível no Windows. Use a opção de informar o caminho neste sistema.'));
 return new Promise((resolve,reject)=>{
  let child,stdout='',stderr='',finished=false;
  const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);if(error)reject(error);else resolve(value)};
  const timer=setTimeout(()=>{child?.kill();done(Error('Seleção de pasta expirou. Clique em Abrir pasta para tentar novamente.'))},timeoutMs);
  try{child=spawnImpl('powershell.exe',['-NoLogo','-NoProfile','-STA','-Command',script],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}catch(e){done(Error('Não foi possível abrir o seletor do Windows: '+e.message));return;}
  child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>16000){child.kill();done(Error('Resposta inválida do seletor de pasta'))}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-2000)});
  child.once('error',error=>done(Error('Seletor do Windows indisponível: '+error.message)));
  child.once('close',code=>{
   if(code!==0){done(Error('O Windows não concluiu a seleção da pasta. '+stderr.slice(0,700)));return;}
   const line=stdout.split(/\r?\n/).find(s=>s.startsWith('OPHIUCHUS_FOLDER:'));
   if(!line){if(stdout.includes('OPHIUCHUS_CANCELLED'))done(null,null);else done(Error('O seletor não retornou uma pasta válida'));return;}
   const encoded=line.slice('OPHIUCHUS_FOLDER:'.length);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)){done(Error('Caminho inválido do seletor'));return;}
   const value=Buffer.from(encoded,'base64').toString('utf8');if(!value||value.includes('\0')||Buffer.from(value).toString('base64')!==encoded){done(Error('Caminho inválido do seletor'));return;}
   done(null,value);
  });
 });
}
