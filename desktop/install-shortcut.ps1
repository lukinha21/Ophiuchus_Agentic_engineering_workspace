param(
    [string]$BuildDirectory,
    [string]$InstallationRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ShortcutPath
)

$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path -LiteralPath $InstallationRoot).Path
if (!$BuildDirectory) {
    $latest = Get-Content -LiteralPath (Join-Path $rootPath 'desktop-build\latest.json') -Raw | ConvertFrom-Json
    $BuildDirectory = $latest.directory
    if (!$BuildDirectory) { throw 'Empacote o aplicativo antes de instalar a atualização.' }
}

$sourcePath = (Resolve-Path -LiteralPath $BuildDirectory).Path
$sourceExe = Join-Path $sourcePath 'Ophiuchus.exe'
$manifest = Join-Path $sourcePath 'resources\app\package.json'
$sourceUi = Join-Path $sourcePath 'resources\app\dist\index.html'
if (!(Test-Path -LiteralPath $sourceExe -PathType Leaf) -or
    !(Test-Path -LiteralPath $manifest -PathType Leaf) -or
    !(Test-Path -LiteralPath $sourceUi -PathType Leaf)) {
    throw 'Build desktop incompleto.'
}
$version = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$') { throw 'Versão do build inválida.' }

$installBase = Join-Path $rootPath 'desktop-app'
$destination = Join-Path $installBase ($version + '-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
if (Test-Path -LiteralPath $destination) { throw 'A pasta desta instalação já existe.' }
New-Item -ItemType Directory -Path $installBase -Force | Out-Null
Copy-Item -LiteralPath $sourcePath -Destination $destination -Recurse
$exe = Join-Path $destination 'Ophiuchus.exe'
if (!(Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Falha ao copiar o executável.' }

if (!$ShortcutPath) {
    $desktop = [Environment]::GetFolderPath('DesktopDirectory')
    $ShortcutPath = Join-Path $desktop 'Ophiuchus.lnk'
    $existingName = Join-Path $desktop 'Ophiuchus - Atalho.lnk'
    if (!(Test-Path -LiteralPath $ShortcutPath) -and (Test-Path -LiteralPath $existingName)) {
        $ShortcutPath = $existingName
    }
}
$ShortcutPath = [IO.Path]::GetFullPath($ShortcutPath)
if ([IO.Path]::GetExtension($ShortcutPath) -ne '.lnk') { throw 'O atalho precisa usar a extensão .lnk.' }
$shell = New-Object -ComObject WScript.Shell
$existing = Test-Path -LiteralPath $ShortcutPath -PathType Leaf
$arguments = '"--import-data-dir={0}"' -f (Join-Path $rootPath '.ophiuchus-local')
if ($existing) {
    $previous = $shell.CreateShortcut($ShortcutPath)
    if ([IO.Path]::GetFileName($previous.TargetPath) -ne 'Ophiuchus.exe') {
        throw 'O atalho escolhido pertence a outro aplicativo.'
    }
    $arguments = $previous.Arguments
}

$temporary = Join-Path (Split-Path -Parent $ShortcutPath) ('.ophiuchus-' + [Guid]::NewGuid() + '.lnk')
try {
    $link = $shell.CreateShortcut($temporary)
    $link.TargetPath = $exe
    $link.Arguments = $arguments
    $link.WorkingDirectory = $destination
    $link.IconLocation = $exe + ',0'
    $link.Description = 'Ophiuchus — estúdio de engenharia multiagente'
    $link.WindowStyle = 1
    $link.Save()
    if ($existing) {
        $backups = Join-Path $rootPath 'desktop-shortcut-backups'
        New-Item -ItemType Directory -Path $backups -Force | Out-Null
        $backup = Join-Path $backups ('Ophiuchus-' + [Guid]::NewGuid() + '.lnk')
        Copy-Item -LiteralPath $ShortcutPath -Destination $backup
        [IO.File]::Replace($temporary, $ShortcutPath, [NullString]::Value)
    } else {
        [IO.File]::Move($temporary, $ShortcutPath)
    }
} finally {
    if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
}

@{ executable = $exe; shortcut = $ShortcutPath; version = $version } | ConvertTo-Json
