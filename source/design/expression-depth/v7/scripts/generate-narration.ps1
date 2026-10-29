param(
  [string]$Voice = 'Microsoft Huihui Desktop',
  [int]$Rate = 3
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'src\data\projects.ts'
$audioDirectory = Join-Path $projectRoot 'public\audio'
$referenceDirectory = Join-Path $projectRoot 'reference'
New-Item -ItemType Directory -Force -Path $audioDirectory, $referenceDirectory | Out-Null

$source = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8
$match = [regex]::Match($source, '(?s)export const projects: Project\[\] = (\[.*?\])\s*export const chapterIds')
if (-not $match.Success) { throw 'Cannot extract the projects array from the source.' }
$projects = $match.Groups[1].Value | ConvertFrom-Json

Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synthesizer.SelectVoice($Voice)
$synthesizer.Rate = $Rate
$synthesizer.Volume = 100
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$entries = @()
try {
  foreach ($project in $projects) {
    $text = $project.title + '态，' + $project.subtitle + '。' + ($project.description -replace '\r?\n', '')
    $escapedText = [System.Security.SecurityElement]::Escape($text)
    $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><break time="200ms"/>' + $escapedText + '<break time="300ms"/></speak>'
    $audioPath = Join-Path $audioDirectory ($project.id + '.wav')
    $synthesizer.SetOutputToWaveFile($audioPath, $format)
    $synthesizer.SpeakSsml($ssml)
    $synthesizer.SetOutputToNull()
    $entries += [ordered]@{
      id = $project.id
      file = 'public/audio/' + $project.id + '.wav'
      text = $text
      sourceTitle = $project.title
      sourceSubtitle = $project.subtitle
      sourceDescription = $project.description
      sourceFields = @('title', 'subtitle', 'description')
      transformation = 'Prepend the source title followed by 态; join the original subtitle and all three description lines with punctuation. No new historical or recognition claims.'
    }
    Write-Output ('Generated ' + $project.id)
  }
} finally {
  $synthesizer.Dispose()
}

$manifest = [ordered]@{
  schemaVersion = 1
  generatedAt = [DateTimeOffset]::Now.ToString('o')
  disclosure = 'AI合成语音：使用本机 Microsoft System.Speech / SAPI 普通话音色离线合成；非真人录音，未克隆真人声音。'
  engine = 'Microsoft System.Speech.Synthesis.SpeechSynthesizer / Windows SAPI'
  voice = $Voice
  language = 'zh-CN'
  speechRate = $Rate
  speedMethod = 'Native SAPI synthesis rate; no digital time-stretching or resampling for speed.'
  targetDurationSeconds = @(8, 12.5)
  format = [ordered]@{ container = 'WAV'; codec = 'PCM signed 16-bit little endian'; sampleRateHz = 24000; channels = 1 }
  pauseMilliseconds = [ordered]@{ leading = 200; trailing = 300 }
  music = $false
  externalService = $false
  qwen3TtsAvailability = 'Not installed: no qwen3-tts command, no C:/Users/ALLEN/Projects/qwen3-tts-cli/.venv, and no default HuggingFace model cache. No models or dependencies downloaded.'
  source = [ordered]@{
    file = 'src/data/projects.ts'
    sha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    scope = 'The original subtitle and all three description lines for each of the eight states, plus each source title.'
    boundary = 'The source labels these passages as qualitative observation prompts for AI-assisted visuals, pending checks against real image/video samples. Narration does not turn them into verified historical or recognition conclusions.'
  }
  entries = $entries
  validation = 'review/v3/audio-validation.json'
  regeneration = 'powershell -ExecutionPolicy Bypass -File scripts/generate-narration.ps1; python scripts/generate-narration.validate.py'
}
$manifest | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $referenceDirectory 'NARRATION-SOURCES.json') -Encoding UTF8
