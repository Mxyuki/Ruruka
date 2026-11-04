# <-- Construit l'installateur Ruruka-Setup-<version>.exe dans ./dist -->
# L'app est publiée en autonome (runtime .NET inclus) pour que l'installation n'ait aucun prérequis.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/.."
$innoVersion = '7.1.0'
$innoCompiler = Join-Path $root ".tools/innosetup/tools/ISCC.exe"

[xml]$project = Get-Content "$root/src/Ruruka.Desktop/Ruruka.Desktop.csproj"
$version = ($project.Project.PropertyGroup | Where-Object { $_.Version } | Select-Object -First 1).Version
$appDir = Join-Path $root 'dist/app'

# <-- Interface et tests -->
Push-Location "$root/web"
try {
    if (-not (Test-Path node_modules)) { npm ci }
    npm run check
    npm run build
}
finally {
    Pop-Location
}
dotnet test "$root/tests/Ruruka.Desktop.Tests" -c Release
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }

# <-- Le mpv du lecteur Ruruka doit être là avant la publication, qui le copie -->
& "$PSScriptRoot/fetch-mpv.ps1"

# <-- Publication autonome : Inno Setup compresse mieux que le bundle .NET, donc pas de compression ici -->
if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir }
dotnet publish "$root/src/Ruruka.Desktop" -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none -o $appDir
if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }

# <-- Le lecteur doit rester en fichiers à côté de l'exe : Ruruka lance mpv et mpv lit sa config depuis le disque -->
foreach ($requiredFile in 'player/mpv.exe', 'player/config/mpv.conf', 'player/config/scripts/ruruka-osc.lua', 'player/config/fonts/nunito-extrabold.ttf') {
    if (-not (Test-Path (Join-Path $appDir $requiredFile))) { throw "Lecteur incomplet : $requiredFile manque." }
}

# <-- Inno Setup portable, téléchargé une fois depuis NuGet dans .tools/ -->
if (-not (Test-Path $innoCompiler)) {
    $package = Join-Path $root '.tools/innosetup.zip'
    New-Item -ItemType Directory -Force (Split-Path $package) | Out-Null
    Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/tools.innosetup/$innoVersion/tools.innosetup.$innoVersion.nupkg" -OutFile $package
    Expand-Archive $package -DestinationPath (Join-Path $root '.tools/innosetup') -Force
}

& $innoCompiler "/DAppVersion=$version" "/DSourceDir=$appDir" "/DOutputDir=$root\dist" "$root/installer/Ruruka.iss"
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }

Write-Host "Done: $root\dist\Ruruka-Setup-$version.exe"
