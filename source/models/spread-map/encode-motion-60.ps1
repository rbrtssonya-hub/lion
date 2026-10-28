param(
  [Parameter(Mandatory=$true)][string]$FrameDirectory,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [string]$Ffmpeg = 'ffmpeg'
)
$ErrorActionPreference = 'Stop'
$frames = (Resolve-Path -LiteralPath $FrameDirectory).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
foreach ($frame in 1..510) {
  $path = Join-Path $frames ('{0:D4}.png' -f $frame)
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing frame: $path" }
}
foreach ($name in @('motion-forward-60.mp4', 'motion-reverse-60.mp4')) {
  if (Test-Path -LiteralPath (Join-Path $output $name)) { throw "Output already exists: $name" }
}
$inputPattern = Join-Path $frames '%04d.png'
& $Ffmpeg -n -v warning -framerate 60 -start_number 1 -i $inputPattern -frames:v 510 -c:v libx264 -preset slow -crf 17 -g 60 -pix_fmt yuv420p -movflags +faststart (Join-Path $output 'motion-forward-60.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Forward encoding failed' }
& $Ffmpeg -n -v warning -framerate 60 -start_number 1 -i $inputPattern -vf reverse -frames:v 510 -c:v libx264 -preset slow -crf 17 -g 60 -pix_fmt yuv420p -movflags +faststart (Join-Path $output 'motion-reverse-60.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Reverse encoding failed' }
