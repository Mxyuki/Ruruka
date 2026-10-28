# Regenerates assets/ruruka.ico and web/public/ruruka.png from assets/icon.png.
# Run again whenever the source icon changes.
param(
    [string]$Source = "$PSScriptRoot/../assets/icon.png"
)

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path "$PSScriptRoot/.."
$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

function Resize-Png([System.Drawing.Image]$image, [int]$size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($image, 0, 0, $size, $size)
    $graphics.Dispose()
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    return , $stream.ToArray()
}

# ICO entries are stored as embedded PNGs, which Windows Vista+ supports at every size.
$sizes = 16, 24, 32, 48, 64, 128, 256
$images = $sizes | ForEach-Object { , (Resize-Png $sourceImage $_) }

$ico = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $ico
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)

$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $dimension = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
    $writer.Write([Byte]$dimension)
    $writer.Write([Byte]$dimension)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$images[$i].Length)
    $writer.Write([UInt32]$offset)
    $offset += $images[$i].Length
}
foreach ($bytes in $images) { $writer.Write($bytes) }
$writer.Flush()

[System.IO.File]::WriteAllBytes("$root/assets/ruruka.ico", $ico.ToArray())
[System.IO.File]::WriteAllBytes("$root/web/public/ruruka.png", (Resize-Png $sourceImage 256))
$sourceImage.Dispose()

Write-Host "Wrote assets/ruruka.ico and web/public/ruruka.png"
