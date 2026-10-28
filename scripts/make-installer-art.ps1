# <-- Dessine les images de l'assistant d'installation à partir des illustrations de web/public/art -->
# Relance ce script après avoir changé configuration.png ou l'icône ; les BMP produits sont versionnés.
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "$PSScriptRoot/.."
$art = Join-Path $root 'web/public/art'
$target = Join-Path $root 'installer'

$milk = [System.Drawing.Color]::FromArgb(0xfb, 0xf7, 0xef)
$mauve = [System.Drawing.Color]::FromArgb(0xd9, 0xc6, 0xe2)
$lilac = [System.Drawing.Color]::FromArgb(0xa9, 0x8b, 0xc4)
$ink = [System.Drawing.Color]::FromArgb(0x2b, 0x1e, 0x30)

function New-Canvas([int]$width, [int]$height) {
    $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($milk)
    return $bitmap, $graphics
}

function Draw-Fitted($graphics, [string]$path, [double]$x, [double]$y, [double]$maxWidth, [double]$maxHeight) {
    $image = [System.Drawing.Image]::FromFile($path)
    $scale = [Math]::Min([double]$maxWidth / $image.Width, [double]$maxHeight / $image.Height)
    $width = $image.Width * $scale
    $height = $image.Height * $scale
    $graphics.DrawImage($image, [single]($x + ($maxWidth - $width) / 2), [single]($y + $maxHeight - $height), [single]$width, [single]$height)
    $image.Dispose()
}

# <-- Panneau de bienvenue : quadrillage de carnet, tache mauve, Ruruka et sa glace, une étoile -->
function Save-WizardImage([double]$scale, [string]$name) {
    $width = [int](164 * $scale); $height = [int](314 * $scale)
    $bitmap, $graphics = New-Canvas $width $height

    $dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, $lilac))
    $step = 14 * $scale
    for ($y = $step / 2; $y -lt $height; $y += $step) {
        for ($x = $step / 2; $x -lt $width; $x += $step) {
            $graphics.FillEllipse($dot, [single]$x, [single]$y, [single](1.6 * $scale), [single](1.6 * $scale))
        }
    }

    $blob = New-Object System.Drawing.SolidBrush $mauve
    $graphics.FillEllipse($blob, [single](-40 * $scale), [single](150 * $scale), [single](240 * $scale), [single](240 * $scale))

    Draw-Fitted $graphics (Join-Path $art 'configuration.png') (12 * $scale) (16 * $scale) (140 * $scale) (290 * $scale)
    Draw-Fitted $graphics (Join-Path $art 'autocollants/etoile.png') (104 * $scale) (14 * $scale) (48 * $scale) (48 * $scale)

    $pen = New-Object System.Drawing.Pen $ink, ([single](2 * $scale))
    $graphics.DrawLine($pen, [single]($width - $scale), 0, [single]($width - $scale), [single]$height)

    $bitmap.Save((Join-Path $target $name), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $graphics.Dispose(); $bitmap.Dispose()
    Write-Host "Saved $name ($width x $height)"
}

# <-- Vignette des pages suivantes : le logo de l'app -->
function Save-SmallImage([double]$scale, [string]$name) {
    $size = [int](55 * $scale)
    $bitmap, $graphics = New-Canvas $size $size
    Draw-Fitted $graphics (Join-Path $root 'assets/icon.png') (3 * $scale) (3 * $scale) (49 * $scale) (49 * $scale)
    $bitmap.Save((Join-Path $target $name), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $graphics.Dispose(); $bitmap.Dispose()
    Write-Host "Saved $name ($size x $size)"
}

Save-WizardImage 1 'wizard-image.bmp'
Save-WizardImage 2 'wizard-image@2x.bmp'
Save-SmallImage 1 'wizard-small.bmp'
Save-SmallImage 2 'wizard-small@2x.bmp'
