# Generate Chrome Web Store graphic assets for ToolMKT AI.
# PNG 24-bit (NO alpha) as required. All Vietnamese text comes from assets-text.json
# (read as UTF-8) so this script stays pure ASCII and is safe under Windows PowerShell 5.1.
# Run: powershell -ExecutionPolicy Bypass -File make-assets.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$extDir = Split-Path -Parent $outDir
$txt = ConvertFrom-Json ([System.IO.File]::ReadAllText((Join-Path $outDir 'assets-text.json'), [System.Text.Encoding]::UTF8))

# ----- Brand palette -----
$cDark   = [System.Drawing.Color]::FromArgb(11, 17, 33)
$cDeep   = [System.Drawing.Color]::FromArgb(30, 27, 75)
$cAccent = [System.Drawing.Color]::FromArgb(99, 102, 241)
$cWhite  = [System.Drawing.Color]::White
$cMuted  = [System.Drawing.Color]::FromArgb(148, 163, 184)
$cLight  = [System.Drawing.Color]::FromArgb(226, 232, 240)
$cCard   = [System.Drawing.Color]::FromArgb(23, 31, 51)
$cBar    = [System.Drawing.Color]::FromArgb(51, 65, 85)

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'ClearTypeGridFit'
  $g.InterpolationMode = 'HighQualityBicubic'
  return @{ bmp = $bmp; g = $g; w = $w; h = $h }
}

function Fill-Bg($c) {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $c.w, $c.h)
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cDark, $cDeep, 35.0)
  $c.g.FillRectangle($br, $rect); $br.Dispose()
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gx = [int]($c.w * 0.72); $gy = [int]($c.h * 0.05); $gr = [int]($c.h * 0.9)
  $glow.AddEllipse($gx, $gy, $gr, $gr)
  $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
  $pgb.CenterColor = [System.Drawing.Color]::FromArgb(70, 99, 102, 241)
  $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 99, 102, 241))
  $c.g.FillPath($pgb, $glow); $pgb.Dispose(); $glow.Dispose()
}

function Round-Rect($g, [int]$x, [int]$y, [int]$w, [int]$h, [int]$r, $brush) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r, $r, 180, 90)
  $p.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $p.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
  $p.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $p.CloseFigure(); $g.FillPath($brush, $p); $p.Dispose()
}

function Text($g, [string]$s, [single]$size, [int]$style, $color, [int]$x, [int]$y) {
  $f = New-Object System.Drawing.Font('Segoe UI', $size, $style)
  $b = New-Object System.Drawing.SolidBrush($color)
  $g.DrawString($s, $f, $b, [single]$x, [single]$y)
  $f.Dispose(); $b.Dispose()
}

function Logo($c, [int]$x, [int]$y, [int]$sz, [single]$wordSize) {
  $br = New-Object System.Drawing.SolidBrush($cAccent)
  Round-Rect $c.g $x $y $sz $sz ([int]($sz*0.28)) $br; $br.Dispose()
  $f = New-Object System.Drawing.Font('Segoe UI', [single]($sz*0.5), [System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment='Center'; $sf.LineAlignment='Center'
  $wb = New-Object System.Drawing.SolidBrush($cWhite)
  $c.g.DrawString('T', $f, $wb, (New-Object System.Drawing.RectangleF($x, $y, $sz, $sz)), $sf)
  $f.Dispose(); $wb.Dispose()
  $tx = $x + $sz + [int]($sz*0.35); $ty = $y + [int](($sz - $wordSize*1.35)/2)
  Text $c.g 'ToolMKT ' $wordSize ([System.Drawing.FontStyle]::Bold) $cWhite $tx $ty
  $fw = New-Object System.Drawing.Font('Segoe UI', $wordSize, [System.Drawing.FontStyle]::Bold)
  $m = $c.g.MeasureString('ToolMKT ', $fw); $fw.Dispose()
  Text $c.g 'AI' $wordSize ([System.Drawing.FontStyle]::Bold) $cAccent ($tx + [int]$m.Width) $ty
}

function Save-Canvas($c, [string]$name) {
  $path = Join-Path $outDir $name
  $c.g.Dispose(); $c.bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $c.bmp.Dispose()
  Write-Output ("  {0}  ({1}x{2})" -f $name, $c.w, $c.h)
}

Write-Output 'Generating...'
$bold = [System.Drawing.FontStyle]::Bold
$reg  = [System.Drawing.FontStyle]::Regular

# 1) Small promo tile 440x280
$c = New-Canvas 440 280
Fill-Bg $c
Logo $c 32 30 48 22
Text $c.g $txt.promoSmall.l1 32 $bold $cWhite 32 110
Text $c.g $txt.promoSmall.l2 32 $bold $cWhite 32 152
Text $c.g $txt.promoSmall.sub 15 $reg $cMuted 33 212
Save-Canvas $c 'promo_small_440x280.png'

# 2) Marquee promo tile 1400x560
$c = New-Canvas 1400 560
Fill-Bg $c
Logo $c 90 70 84 40
Text $c.g $txt.marquee.l1 56 $bold $cWhite 90 220
Text $c.g $txt.marquee.l2 56 $bold $cAccent 90 298
Text $c.g $txt.marquee.sub 26 $reg $cLight 92 420
Save-Canvas $c 'promo_marquee_1400x560.png'

# 3) Screenshots 1280x800 (3 feature graphics)
$i = 1
foreach ($s in $txt.shots) {
  $c = New-Canvas 1280 800
  Fill-Bg $c
  Logo $c 70 56 52 24
  $y = 200
  foreach ($line in $s.title) { Text $c.g $line 46 $bold $cWhite 76 $y; $y += 60 }
  $y += 40
  foreach ($b in $s.bullets) {
    $dot = New-Object System.Drawing.SolidBrush($cAccent)
    $c.g.FillEllipse($dot, 80, ($y + 14), 14, 14); $dot.Dispose()
    Text $c.g $b 26 $reg $cLight 110 $y
    $y += 62
  }
  $brCard = New-Object System.Drawing.SolidBrush($cCard)
  Round-Rect $c.g 730 200 470 470 22 $brCard; $brCard.Dispose()
  $brAcc = New-Object System.Drawing.SolidBrush($cAccent)
  Round-Rect $c.g 762 232 180 26 8 $brAcc; $brAcc.Dispose()
  for ($r = 0; $r -lt 6; $r++) {
    $brBar = New-Object System.Drawing.SolidBrush($cBar)
    $rw = 406 - ($r % 3) * 40
    Round-Rect $c.g 762 (290 + $r*58) $rw 30 8 $brBar; $brBar.Dispose()
  }
  Save-Canvas $c ("screenshot_{0}_1280x800.png" -f $i)
  $i++
}

# 4) Store icon 128x128 (reuse existing)
$icon = Join-Path $extDir 'icons\icon128.png'
if (Test-Path $icon) { Copy-Item $icon (Join-Path $outDir 'store_icon_128x128.png') -Force; Write-Output '  store_icon_128x128.png  (128x128)' }

Write-Output ('Done. Folder: ' + $outDir)
