param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$ReviewDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LionWindowBounds {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
$exe = (Resolve-Path -LiteralPath $Executable).Path
$root = Join-Path ([IO.Path]::GetFullPath($ReviewDirectory)) ('visible-default-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root -Force | Out-Null
$statusFile = Join-Path $root 'status.json'
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = $exe
$info.Arguments = '--status-file="' + $statusFile + '"'
$info.UseShellExecute = $false
$info.WorkingDirectory = Split-Path $exe
$info.EnvironmentVariables['PATH'] = Join-Path $env:WINDIR 'System32'
$outer = [Diagnostics.Process]::Start($info)
$null = $outer.Handle
$status = $null
try {
    $deadline = [DateTime]::Now.AddSeconds(90)
    while ([DateTime]::Now -lt $deadline) {
        if (Test-Path -LiteralPath $statusFile) {
            try { $status = [IO.File]::ReadAllText($statusFile) | ConvertFrom-Json } catch { }
            if ($status.state -in @('ready','error')) { break }
        }
        if ($outer.HasExited) { throw 'Portable wrapper exited before readiness.' }
        Start-Sleep -Milliseconds 100
    }
    if ($status.state -ne 'ready') { throw ('Not ready: ' + ($status | ConvertTo-Json -Compress)) }
    if ($status.debugPort) { throw 'Ordinary launch exposed a debug port.' }
    if (-not $status.runtime.bundled -or $status.runtime.electron -ne '44.9.1') { throw 'Ordinary launch is not the bundled runtime.' }
    $main = Get-Process -Id $status.pid
    # Hold native handles while the process is alive; Get-Process otherwise may
    # lose the exit code when the process closes before WaitForExit opens one.
    $null = $main.Handle
    $deadline = [DateTime]::Now.AddSeconds(30)
    while ([DateTime]::Now -lt $deadline) {
        $main.Refresh()
        if ($main.MainWindowHandle -ne 0 -and $main.MainWindowTitle -match '南风有狮') { break }
        Start-Sleep -Milliseconds 100
    }
    if ($main.MainWindowHandle -eq 0 -or $main.MainWindowTitle -notmatch '南风有狮') { throw 'No ordinary visible app window.' }
    $nativeImage = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $status.pid)
    if ($nativeImage.ExecutablePath -ne $status.runtime.executablePath -or $nativeImage.CommandLine -match 'inspect-ui|remote-debugging') { throw 'Unexpected ordinary process identity/debug mode.' }
    if ($status.runtime.userDataPath -notmatch 'SouthWindLionBundled[\\/]instance-') { throw 'Default launch did not isolate its profile.' }
    $runtimeRoot = Split-Path $nativeImage.ExecutablePath
    $owned = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($runtimeRoot + '\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object ProcessId)
    Start-Sleep -Seconds 8
    $previousDpi = [LionWindowBounds]::SetThreadDpiAwarenessContext([IntPtr](-4))
    $rect = New-Object LionWindowBounds+Rect
    if (-not [LionWindowBounds]::GetWindowRect($main.MainWindowHandle, [ref]$rect)) { throw 'No visible window bounds.' }
    $bitmap = New-Object Drawing.Bitmap(($rect.Right-$rect.Left), ($rect.Bottom-$rect.Top))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try { $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size); $bitmap.Save((Join-Path $root 'ordinary-no-debug-window.png')) }
    finally { $graphics.Dispose(); $bitmap.Dispose(); [LionWindowBounds]::SetThreadDpiAwarenessContext($previousDpi) | Out-Null }
    if (-not $main.CloseMainWindow()) { throw 'Ordinary window close failed.' }
    if (-not $main.WaitForExit(15000) -or -not $outer.WaitForExit(15000)) { throw 'Ordinary app or wrapper did not exit.' }
    if ($main.ExitCode -ne 0 -or $outer.ExitCode -ne 0) { throw ('Ordinary shutdown codes: main=' + $main.ExitCode + ', wrapper=' + $outer.ExitCode) }
    $deadline = [DateTime]::Now.AddSeconds(10)
    do { $remaining = @(Get-Process -Id $owned -ErrorAction SilentlyContinue); if (-not $remaining.Count) { break }; Start-Sleep -Milliseconds 100 } while ([DateTime]::Now -lt $deadline)
    if ($remaining.Count) { throw 'Ordinary close left owned Electron subprocesses alive.' }
    $reachable = $false
    try { Invoke-WebRequest -Uri $status.origin -UseBasicParsing -TimeoutSec 2 | Out-Null; $reachable = $true } catch { }
    if ($reachable) { throw 'Ordinary close left HTTP server alive.' }
    $report = [ordered]@{ verdict='GREEN'; executable=$exe; sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant();
        runtime=$status.runtime; port=$status.origin; noDebugPort=$true; normalVisibleWindow=$true; ordinaryCloseExitCodes=@($main.ExitCode,$outer.ExitCode); allOwnedProcessesExited=$true;
        screenshot=(Join-Path $root 'ordinary-no-debug-window.png') }
    [IO.File]::WriteAllText((Join-Path $root 'gui-report.json'), ($report | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
    $report | ConvertTo-Json -Depth 6
}
finally {
    if (-not $outer.HasExited -and $status.shutdownToken) {
        try { Invoke-WebRequest -Uri ($status.origin + '/_portable/shutdown?token=' + $status.shutdownToken) -Method Post -UseBasicParsing -TimeoutSec 3 | Out-Null } catch { }
    }
}
