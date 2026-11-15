param([Parameter(Mandatory=$true)][string]$BuildDirectory,[Parameter(Mandatory=$true)][string]$InstallationRoot,[string]$ShortcutPath)
$ErrorActionPreference='Stop'
$sourcePath=(Resolve-Path -LiteralPath $BuildDirectory).Path
$rootPath=[IO.Path]::GetFullPath($InstallationRoot)
if(!(Test-Path -LiteralPath (Join-Path $sourcePath 'Ophiuchus.exe'))){throw 'Build do aplicativo não encontrado'}
$version=(Get-Content -LiteralPath (Join-Path $sourcePath 'resources\app\package.json') -Raw | ConvertFrom-Json).version
$destination=[IO.Path]::GetFullPath((Join-Path $rootPath ('desktop-app\'+$version+'-'+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds())))
if(!$destination.StartsWith($rootPath.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destino fora da pasta da instalação'}
if(Test-Path -LiteralPath $destination){throw 'Destino já existente; nenhuma pasta será substituída'}
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Copy-Item -LiteralPath $sourcePath -Destination $destination -Recurse
if(!$ShortcutPath){$ShortcutPath=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ophiuchus.lnk'}
if(Test-Path -LiteralPath $ShortcutPath){$backup=Join-Path $rootPath 'desktop-shortcut-backups';New-Item -ItemType Directory -Path $backup -Force | Out-Null;Copy-Item -LiteralPath $ShortcutPath -Destination (Join-Path $backup ('Ophiuchus-'+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+'.lnk'))}
$exe=Join-Path $destination 'Ophiuchus.exe'
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($ShortcutPath)
$link.TargetPath=$exe
$link.Arguments='"--import-data-dir={0}"' -f (Join-Path $rootPath '.ophiuchus-local')
$link.WorkingDirectory=$destination
$link.IconLocation=$exe+',0'
$link.Description='Ophiuchus — estúdio de engenharia multiagente'
$link.WindowStyle=1
$link.Save()
@{executable=$exe;shortcut=$ShortcutPath;importSource=(Join-Path $rootPath '.ophiuchus-local')} | ConvertTo-Json
