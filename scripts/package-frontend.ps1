param([string]$ArchivePath = '.deployment/frontend.zip')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = (Resolve-Path (Join-Path $projectRoot 'dist')).Path
if (-not [System.IO.Path]::IsPathRooted($ArchivePath)) { $ArchivePath = Join-Path $projectRoot $ArchivePath }
$archiveDirectory = Split-Path -Parent $ArchivePath
New-Item -ItemType Directory -Force $archiveDirectory | Out-Null
$stream = [System.IO.File]::Open($ArchivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $distPath -Recurse -File | ForEach-Object {
    # ZIP entry paths are URLs on the host: they must use / even on Windows.
    $entryName = $_.FullName.Substring($distPath.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
try {
  if (-not ($check.Entries | Where-Object FullName -eq 'index.html')) { throw 'Archive has no root index.html.' }
  if ($check.Entries | Where-Object { $_.FullName.Contains('\') }) { throw 'Invalid Windows separators in ZIP paths.' }
} finally { $check.Dispose() }
Write-Host 'Frontend ZIP created with portable URL paths.'
