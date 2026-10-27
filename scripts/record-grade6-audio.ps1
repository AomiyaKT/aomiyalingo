param([string]$Voice = 'Microsoft Zira Desktop')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskContent = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../server/editor/grade6-content.mjs') -Raw
$taskProfiles = ($taskContent -replace '(?s)^.*?export const gradeSixContent = ', '' -replace ';\s*$', '') | ConvertFrom-Json -AsHashtable
$taskWords = $taskProfiles.Values | ForEach-Object { $_ } | Sort-Object -Property word -Unique
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice($Voice)
$taskSynth.Rate = -1
$taskCount = 0
try {
    foreach ($taskWord in $taskWords) {
        $taskSlug = ($taskWord.word.ToLower() -replace '[^a-z]+', '-').Trim('-')
        $taskOutput = Join-Path $PSScriptRoot "../public/assets/words/$taskSlug.wav"
        if (Test-Path -LiteralPath $taskOutput) { continue }
        $taskSynth.SetOutputToWaveFile($taskOutput)
        $taskSynth.Speak($taskWord.word)
        $taskSynth.SetOutputToNull()
        $taskCount++
        if ($taskCount % 10 -eq 0) { Write-Output "Recorded $taskCount new English clips" }
    }
} finally { $taskSynth.Dispose() }
Write-Output "Finished: $taskCount new English clips ($Voice). Run import-grade6.mjs again to refresh audio paths."
