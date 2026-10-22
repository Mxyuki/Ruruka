# <-- Redimensionne les illustrations déposées dans Exemple/ et les range dans web/public/art/ -->
# Relance ce script après avoir remplacé une image : les tailles visent 2 à 3 fois l'affichage réel.
param(
    [string]$Source = "$PSScriptRoot/../Exemple"
)

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "$PSScriptRoot/.."
$target = Join-Path $root 'web/public/art'

# <-- Fichier source, fichier publié, hauteur maximale en pixels -->
$images = @(
    @{ From = 'accueil-portrait.png'; To = 'accueil-portrait.png'; MaxHeight = 480 },
    @{ From = 'vide.png'; To = 'vide.png'; MaxHeight = 640 },
    @{ From = 'configuration.png'; To = 'configuration.png'; MaxHeight = 1200 },
    @{ From = 'dos-de-carte.png'; To = 'dos-de-carte.png'; MaxHeight = 640 },
    @{ From = 'autocollants/Star.png'; To = 'autocollants/etoile.png'; MaxHeight = 200 },
    @{ From = 'autocollants/Loupe.png'; To = 'autocollants/loupe.png'; MaxHeight = 200 },
    @{ From = 'autocollants/Heart.png'; To = 'autocollants/coeur.png'; MaxHeight = 200 },
    @{ From = 'autocollants/Candy.png'; To = 'autocollants/bonbon.png'; MaxHeight = 200 },
    @{ From = 'autocollants/Moon.png'; To = 'autocollants/lune.png'; MaxHeight = 200 },
    @{ From = 'autocollants/Ribbon.png'; To = 'autocollants/ruban.png'; MaxHeight = 200 }
)

foreach ($image in $images) {
    $sourcePath = Join-Path $Source $image.From
    if (-not (Test-Path $sourcePath)) {
        Write-Host "Missing: $($image.From)"
        continue
    }

    $original = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))
    $scale = [Math]::Min([double]1, [double]$image.MaxHeight / $original.Height)
    $width = [int][Math]::Round($original.Width * $scale)
    $height = [int][Math]::Round($original.Height * $scale)

    $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($original, 0, 0, $width, $height)
    $graphics.Dispose()
    $original.Dispose()

    $outPath = Join-Path $target $image.To
    New-Item -ItemType Directory -Force (Split-Path $outPath) | Out-Null
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Host ("{0} -> {1} ({2}x{3}, {4} KB)" -f $image.From, $image.To, $width, $height, [int]((Get-Item $outPath).Length / 1KB))
}
