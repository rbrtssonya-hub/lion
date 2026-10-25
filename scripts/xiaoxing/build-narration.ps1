#requires -Version 7.0
param(
  [string]$VoiceName = 'Microsoft Yaoyao'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$archiveRoot = Join-Path $projectRoot 'source/characters/xiaoxing/voice'
$runtimeRoot = Join-Path $projectRoot 'source/public/assets/xiaoxing/voice'
$utf8 = [Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8
[IO.Directory]::CreateDirectory($archiveRoot) | Out-Null
[IO.Directory]::CreateDirectory($runtimeRoot) | Out-Null

Add-Type -AssemblyName System.Speech
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $installed = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Name -eq $VoiceName } | Select-Object -First 1
  if (!$installed) { throw "Requested voice is not installed: $VoiceName" }
  if ($installed.VoiceInfo.Gender.ToString() -ne 'Female' -or $installed.VoiceInfo.Culture.Name -ne 'zh-CN') {
    throw 'The character profile requires an installed zh-CN female voice.'
  }
  $synth.SelectVoice($VoiceName)
  $synth.Volume = 92
  $format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $nodeScript = @'
import { chapterGuides } from './src/features/assistant/knowledge.js';
console.log(JSON.stringify(Object.entries(chapterGuides).map(([chapter, guide]) => ({chapter, text: guide.guide}))));
'@
  Push-Location $projectRoot
  try {
    $raw = & node --input-type=module -e $nodeScript
    if ($LASTEXITCODE -ne 0) { throw 'Could not read current chapter guides.' }
    $chapters = $raw | ConvertFrom-Json
  } finally { Pop-Location }

  $records = @()
  foreach ($chapter in $chapters) {
    $escaped = [Security.SecurityElement]::Escape($chapter.text)
    $voiceXml = [Security.SecurityElement]::Escape($VoiceName)
    $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="' + $voiceXml + '"><prosody pitch="+10%" rate="-3%">' + $escaped + '</prosody></voice></speak>'
    $ssmlPath = Join-Path $archiveRoot ($chapter.chapter + '.ssml')
    $wavePath = Join-Path $runtimeRoot ($chapter.chapter + '.wav')
    [IO.File]::WriteAllText($ssmlPath, $ssml, $utf8)
    $synth.SetOutputToWaveFile($wavePath, $format)
    $synth.SpeakSsml($ssml)
    $synth.SetOutputToNull()
    $records += [ordered]@{
      chapter = $chapter.chapter; text = $chapter.text
      ssml = "source/characters/xiaoxing/voice/$($chapter.chapter).ssml"
      runtime = "source/public/assets/xiaoxing/voice/$($chapter.chapter).wav"
      bytes = (Get-Item -LiteralPath $wavePath).Length
      sha256 = (Get-FileHash -LiteralPath $wavePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }

  $sampleText = '你好呀，我是小醒。让我陪你一起走进醒狮的世界吧。'
  $sampleSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="' + [Security.SecurityElement]::Escape($VoiceName) + '"><prosody pitch="+10%" rate="-3%">' + $sampleText + '</prosody></voice></speak>'
  [IO.File]::WriteAllText((Join-Path $archiveRoot 'sample.ssml'), $sampleSsml, $utf8)
  $samplePath = Join-Path $archiveRoot 'sample.wav'
  $synth.SetOutputToWaveFile($samplePath, $format)
  $synth.SpeakSsml($sampleSsml)
  $synth.SetOutputToNull()
  $metadata = [ordered]@{
    version = 1; generator = 'scripts/xiaoxing/build-narration.ps1'
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    textSource = 'src/features/assistant/knowledge.js#chapterGuides'
    voice = [ordered]@{
      engine = 'Windows System.Speech.Synthesis'; name = $VoiceName
      culture = $installed.VoiceInfo.Culture.Name; gender = $installed.VoiceInfo.Gender.ToString()
      age = $installed.VoiceInfo.Age.ToString(); id = $installed.VoiceInfo.Id
    }
    direction = 'Clear, friendly Chinese female exhibition guide; gently brightened for the chibi mascot, with natural articulation.'
    prosody = [ordered]@{ pitch = '+10%'; rate = '-3%'; volume = 92 }
    audio = [ordered]@{ container = 'WAV'; codec = 'PCM signed 16-bit little-endian'; sampleRate = 22050; channels = 1 }
    records = $records
    sample = [ordered]@{
      text = $sampleText; path = 'source/characters/xiaoxing/voice/sample.wav'
      bytes = (Get-Item -LiteralPath $samplePath).Length
      sha256 = (Get-FileHash -LiteralPath $samplePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  [IO.File]::WriteAllText((Join-Path $archiveRoot 'profile.json'), ($metadata | ConvertTo-Json -Depth 8), $utf8)
  Write-Output ('Generated 4 fixed chapter recordings and a short audition with ' + $VoiceName)
} finally { $synth.Dispose() }
