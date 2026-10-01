Add-Type -AssemblyName System.Drawing
$srcPath = Join-Path $PSScriptRoot "..\frontend\public\Main_logo.png"
$dstPath = Join-Path $PSScriptRoot "..\frontend\public\Main_logo_web.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
$newWidth = 480
$newHeight = [int]($src.Height * ($newWidth / $src.Width))
$bmp = New-Object System.Drawing.Bitmap $newWidth, $newHeight
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($src, 0, 0, $newWidth, $newHeight)
$src.Dispose()
$g.Dispose()
$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Created $dstPath with size: $((Get-Item $dstPath).Length) bytes"

$dstMobile = Join-Path $PSScriptRoot "..\frontend\public\Main_logo_mobile.png"
$src2 = [System.Drawing.Image]::FromFile($srcPath)
$mobW = 240
$mobH = [int]($src2.Height * ($mobW / $src2.Width))
$bmpMob = New-Object System.Drawing.Bitmap $mobW, $mobH
$gMob = [System.Drawing.Graphics]::FromImage($bmpMob)
$gMob.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gMob.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gMob.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gMob.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$gMob.DrawImage($src2, 0, 0, $mobW, $mobH)
$src2.Dispose()
$gMob.Dispose()
$bmpMob.Save($dstMobile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmpMob.Dispose()
Write-Host "Created $dstMobile with size: $((Get-Item $dstMobile).Length) bytes"
