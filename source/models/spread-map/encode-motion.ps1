param(
  [Parameter(Mandatory=$true)][string]$FrameDirectory,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [string]$Ffmpeg = 'ffmpeg'
)
$ErrorActionPreference = 'Stop'
$frames = (Resolve-Path -LiteralPath $FrameDirectory).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
foreach ($frame in 1..204) {
  $path = Join-Path $frames ('{0:D4}.png' -f $frame)
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing frame: $path" }
}
foreach ($name in @('motion-forward.mp4', 'motion-reverse.mp4')) {
  if (Test-Path -LiteralPath (Join-Path $output $name)) { throw "Output already exists: $name" }
}
$inputPattern = Join-Path $frames '%04d.png'
& $Ffmpeg -n -v warning -framerate 24 -start_number 1 -i $inputPattern -frames:v 204 -c:v libx264 -preset slow -crf 17 -g 24 -pix_fmt yuv420p -movflags +faststart (Join-Path $output 'motion-forward.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Forward encoding failed' }
& $Ffmpeg -n -v warning -framerate 24 -start_number 1 -i $inputPattern -vf reverse -frames:v 204 -c:v libx264 -preset slow -crf 17 -g 24 -pix_fmt yuv420p -movflags +faststart (Join-Path $output 'motion-reverse.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Reverse encoding failed' }
