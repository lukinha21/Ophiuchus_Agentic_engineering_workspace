/** Fixed Windows folder dialog. No user-supplied command, arguments, or shell expansion. */
import {spawn} from 'node:child_process';
const script=`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Ophiuchus - escolha a pasta do projeto para autorizar leitura local'
$dialog.ShowNewFolderButton = $false
$owner = New-Object System.Windows.Forms.Form
$owner.Text = 'Ophiuchus - abrir projeto'
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedToolWindow
$owner.Opacity = 0.01
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
try {
 $owner.Show()
 $owner.BringToFront()
 $owner.Activate()
 [System.Windows.Forms.Application]::DoEvents()
 [Console]::WriteLine('OPHIUCHUS_READY')
 [Console]::Out.Flush()
 if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::WriteLine('OPHIUCHUS_FOLDER:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dialog.SelectedPath)))
 } else { [Console]::WriteLine('OPHIUCHUS_CANCELLED') }
} catch {
 [Console]::Error.WriteLine($_.Exception.Message)
 exit 1
} finally { $dialog.Dispose(); $owner.Dispose() }`;
const pickerError=(message,code='PICKER_UNAVAILABLE')=>Object.assign(Error(message),{code});
export function pickNativeFolder({platform=process.platform,spawnImpl=spawn,timeoutMs=120000,startupTimeoutMs=Math.min(15000,timeoutMs),signal}={}){
 if(platform!=='win32')return Promise.reject(Error('O seletor nativo desta versão está disponível no Windows. Use a opção de informar o caminho neste sistema.'));
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){resolve(null);return;}
  let child,stdout='',stderr='',finished=false,ready=false,selectionTimer;
  const cancel=()=>{child?.kill();done(null,null)};
  const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(startupTimer);clearTimeout(selectionTimer);signal?.removeEventListener('abort',cancel);if(error)reject(error);else resolve(value)};
  const startupTimer=setTimeout(()=>{child?.kill();done(pickerError('O tempo de abertura do seletor do Windows expirou. Use Informar caminho manualmente para abrir seu projeto.','PICKER_TIMEOUT'))},startupTimeoutMs);
  const encoded=Buffer.from(script,'utf16le').toString('base64');
  try{child=spawnImpl('powershell.exe',['-NoLogo','-NoProfile','-STA','-EncodedCommand',encoded],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}catch(e){done(pickerError('Não foi possível abrir o seletor do Windows: '+e.message));return;}
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted){cancel();return;}
  child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.length>16000){child.kill();done(pickerError('Resposta inválida do seletor de pasta'));return;}
   if(!finished&&!ready&&stdout.split(/\r?\n/).includes('OPHIUCHUS_READY')){ready=true;clearTimeout(startupTimer);selectionTimer=setTimeout(()=>{child.kill();done(pickerError('Seleção de pasta expirou. Informe o caminho manualmente ou clique em Abrir pasta para tentar novamente.','PICKER_TIMEOUT'))},timeoutMs);}
  });
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-2000)});
  child.once('error',error=>done(pickerError('Seletor do Windows indisponível: '+error.message)));
  child.once('close',code=>{
   if(code!==0){done(pickerError('O Windows não concluiu a seleção da pasta. Use Informar caminho manualmente. '+stderr.slice(0,700)));return;}
   const line=stdout.split(/\r?\n/).find(s=>s.startsWith('OPHIUCHUS_FOLDER:'));
   if(!line){if(stdout.includes('OPHIUCHUS_CANCELLED'))done(null,null);else done(Error('O seletor não retornou uma pasta válida'));return;}
   const encoded=line.slice('OPHIUCHUS_FOLDER:'.length);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)){done(Error('Caminho inválido do seletor'));return;}
   const value=Buffer.from(encoded,'base64').toString('utf8');if(!value||value.includes('\0')||Buffer.from(value).toString('base64')!==encoded){done(Error('Caminho inválido do seletor'));return;}
   done(null,value);
  });
 });
}
