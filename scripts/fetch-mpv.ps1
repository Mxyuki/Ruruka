# <-- Récupère le mpv embarqué dans le lecteur Ruruka, une seule fois, dans .tools/mpv -->
# La version est figée et vérifiée par son empreinte : mpv embarqué change seulement quand ce script change.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/.."
$release = '20261104'
$archiveName = 'mpv-x86_64-20261104-git-46787be250.7z'
$expectedHash = '84397be53b37945b9dccdb7e8d8579eb431091d26ab362d111da68c3d4482ffa'
$targetDir = Join-Path $root '.tools/mpv'
$versionFile = Join-Path $targetDir 'version.txt'

if ((Test-Path $versionFile) -and (Get-Content $versionFile -Raw).Trim() -eq $archiveName) {
    Write-Host "mpv $release est déjà là."
    return
}

$archive = Join-Path $root ".tools/$archiveName"
New-Item -ItemType Directory -Force (Split-Path $archive) | Out-Null
Invoke-WebRequest "https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/$release/$archiveName" -OutFile $archive

$actualHash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
    Remove-Item $archive
    throw "Empreinte inattendue pour $archiveName : $actualHash"
}

# <-- Le tar de Windows 11 lit le 7z, donc aucun outil en plus -->
if (Test-Path $targetDir) { Remove-Item -Recurse -Force $targetDir }
New-Item -ItemType Directory -Force $targetDir | Out-Null
& "$env:SystemRoot/System32/tar.exe" -xf $archive -C $targetDir
if ($LASTEXITCODE -ne 0) { throw 'Extraction de mpv impossible.' }
Remove-Item $archive
Set-Content $versionFile $archiveName -Encoding utf8

Write-Host "mpv $release prêt dans $targetDir"
