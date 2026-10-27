param([string]$Destination = (Join-Path (Split-Path $PSScriptRoot -Parent) '..\Backups'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$backupRoot = [IO.Path]::GetFullPath($Destination)
if ($backupRoot.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Save the backup outside the source project.' }
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$archivePath = Join-Path $backupRoot ('Aomiyalingo-complete-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
$skip = @('.git','node_modules','.sites-runtime','dist','tmp','output')
$privateNames = @('.dev.vars','.npmrc','.netrc','.git-credentials')
function Get-ProjectFiles([string]$directory) {
  foreach($item in Get-ChildItem -LiteralPath $directory -Force) {
    if($item.PSIsContainer) { if($skip -notcontains $item.Name) { Get-ProjectFiles $item.FullName } }
    elseif($privateNames -notcontains $item.Name -and $item.Name -notmatch '^\.env(?:\.|$)|\.log$|\.tar\.gz$|\.zip$|\.(?:pem|key|pfx)$') { $item }
  }
}
$files = @(Get-ProjectFiles $projectRoot)
$manifest = [ordered]@{format='aomiyalingo-complete-project';createdAt=(Get-Date).ToUniversalTime().ToString('o');files=@()}
$zip = [IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach($file in $files) {
    $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,('Quiz_Online/'+$relative),[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $manifest.files += [ordered]@{path=('Quiz_Online/'+$relative);size=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
  }
  $extras = @{
    '先生用を開く.html'='<!doctype html><html lang="ja"><meta charset="utf-8"><title>Aomiyalingo</title><body style="font:24px sans-serif;padding:48px"><h1>Aomiyalingo</h1><a href="https://aomiyalingo.minamiyakk.chatgpt.site/">先生用ページを開く</a><p>インターネットに接続して開いてください。</p></body></html>';
    'はじめに.txt'="Aomiyalingo`r`n`r`n先生：インターネットに接続し、先生用を開く.html を開いてください。ブラウザー以外のインストールは不要です。`r`n`r`nQuiz_Online：アプリの全ソース・内蔵画像・音声・説明書です。開発・別環境への配置には Node.js とデータベースの設定が必要です。`r`n`r`n先生が編集した教材・ルール・自作音声は、歯車 → 状態 → バックアップと復元 から別途保存してください。このZIPにオンラインの生徒成績やパスワードは含まれません。`r`n`r`nmanifest.json に全ファイルのSHA-256があります。`r`n";
    'manifest.json'=($manifest | ConvertTo-Json -Depth 5)
  }
  foreach($name in $extras.Keys) { $entry=$zip.CreateEntry($name);$writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false));try{$writer.Write($extras[$name])}finally{$writer.Dispose()} }
} finally { $zip.Dispose() }
$verified=[IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  foreach($file in $manifest.files) {
    $entry=$verified.GetEntry($file.path);if(!$entry -or $entry.Length -ne $file.size){throw ('Backup entry mismatch: '+$file.path)}
    $stream=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create();try{$digest=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose();$stream.Dispose()}
    if($digest -ne $file.sha256){throw ('Backup checksum mismatch: '+$file.path)}
  }
} finally {$verified.Dispose()}
[pscustomobject]@{archive=$archivePath;verifiedFiles=$manifest.files.Count;bytes=(Get-Item -LiteralPath $archivePath).Length}|ConvertTo-Json -Compress
