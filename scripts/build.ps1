# Builds a release of Ruruka into ./dist: checks the UI, runs host tests, then publishes.
# The output needs the .NET 8 Desktop Runtime, which keeps it a few MB instead of ~150.
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/.."

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
dotnet publish "$root/src/Ruruka.Desktop" -c Release -r win-x64 --self-contained false `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "$root/dist"

Write-Host "Done: $root\dist\Ruruka.exe"
