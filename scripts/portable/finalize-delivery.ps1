param([Parameter(Mandatory=$true)][string]$DeliveryDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$delivery = (Resolve-Path -LiteralPath $DeliveryDirectory).Path
$parent = Split-Path -Parent $delivery
$archive = Join-Path $parent ((Split-Path -Leaf $delivery) + '.zip')
if (Test-Path -LiteralPath $archive) { throw "Preserve the existing archive: $archive" }
$temporary = Join-Path $parent ('archive-' + [Guid]::NewGuid().ToString('N') + '.tmp')
$files = @(Get-ChildItem -LiteralPath $delivery -Recurse -File -Force)
if ($files.Count -eq 0) { throw 'Cannot archive an empty delivery.' }
# Use explicit UTF-8 names and standard separators across .NET runtimes.
$archiveStream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew)
$writer = [IO.Compression.ZipArchive]::new($archiveStream, [IO.Compression.ZipArchiveMode]::Create, $false, [Text.Encoding]::UTF8)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($parent.Length + 1).Replace('\', '/')
        $entry = $writer.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
        $input = [IO.File]::OpenRead($file.FullName)
        $output = $entry.Open()
        try { $input.CopyTo($output) }
        finally { $input.Dispose(); $output.Dispose() }
    }
}
finally { $writer.Dispose(); $archiveStream.Dispose() }
$zip = [IO.Compression.ZipFile]::OpenRead($temporary)
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $entries = @($zip.Entries | Where-Object { -not $_.FullName.EndsWith('/') })
    if ($entries.Count -ne $files.Count) { throw 'ZIP file count differs from delivery.' }
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($parent.Length + 1).Replace('\', '/')
        $entry = $zip.GetEntry($relative)
        if (-not $entry -or $entry.Length -ne $file.Length) { throw "ZIP entry missing or truncated: $relative" }
        $input = $entry.Open()
        try { $insideHash = [BitConverter]::ToString($sha.ComputeHash($input)).Replace('-', '').ToLowerInvariant() }
        finally { $input.Dispose() }
        $outsideHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($insideHash -ne $outsideHash) { throw "ZIP SHA256 mismatch: $relative" }
    }
}
finally { $zip.Dispose(); $sha.Dispose() }
Move-Item -LiteralPath $temporary -Destination $archive
[PSCustomObject]@{
    Directory = $delivery
    Archive = $archive
    FileCount = $files.Count
    Bytes = (Get-Item -LiteralPath $archive).Length
    SHA256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    AllEntriesVerified = $true
} | ConvertTo-Json
