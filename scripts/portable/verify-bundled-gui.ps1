param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$ReviewDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class LionWindowBounds {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    public sealed class AppWindow { public long Handle; public string Title; public Rect Bounds; }
    private delegate bool EnumWindowCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int maximum);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint from, uint to, bool attach);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll", SetLastError=true)] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    public static bool FocusOwnedWindow(IntPtr window, uint expectedPid) {
        uint owner, foregroundPid;
        uint targetThread = GetWindowThreadProcessId(window, out owner);
        if (owner != expectedPid || !IsWindowVisible(window)) return false;
        uint foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out foregroundPid);
        uint ownThread = GetCurrentThreadId();
        bool attachedForeground = foregroundThread != 0 && foregroundThread != ownThread && AttachThreadInput(ownThread, foregroundThread, true);
        bool attachedTarget = targetThread != 0 && targetThread != ownThread && targetThread != foregroundThread && AttachThreadInput(ownThread, targetThread, true);
        try {
            ShowWindow(window, IsIconic(window) ? 9 : 5);
            SetForegroundWindow(window);
        }
        finally {
            if (attachedTarget) AttachThreadInput(ownThread, targetThread, false);
            if (attachedForeground) AttachThreadInput(ownThread, foregroundThread, false);
        }
        return GetForegroundWindow() == window;
    }
    public static AppWindow[] FindVisibleAppWindows(uint processId) {
        var windows = new List<AppWindow>();
        EnumWindows(delegate(IntPtr window, IntPtr parameter) {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            if (owner != processId || !IsWindowVisible(window)) return true;
            Rect rect;
            if (!GetWindowRect(window, out rect)) return true;
            var title = new StringBuilder(2048);
            GetWindowText(window, title, title.Capacity);
            windows.Add(new AppWindow { Handle = window.ToInt64(), Title = title.ToString(), Bounds = rect });
            return true;
        }, IntPtr.Zero);
        return windows.ToArray();
    }
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
    # Electron also creates small titled utility windows. Select the real visible
    # browser window by its owning PID and physical bounds, not MainWindowHandle.
    $previousDpi = [LionWindowBounds]::SetThreadDpiAwarenessContext([IntPtr](-4))
    try {
        $selectedWindow = $null
        $deadline = [DateTime]::Now.AddSeconds(30)
        while ([DateTime]::Now -lt $deadline) {
            $selectedWindow = [LionWindowBounds]::FindVisibleAppWindows([uint32]$status.pid) |
                Where-Object { $_.Title -match '南风有狮' -and ($_.Bounds.Right-$_.Bounds.Left) -ge 900 -and ($_.Bounds.Bottom-$_.Bounds.Top) -ge 600 } |
                Sort-Object { ($_.Bounds.Right-$_.Bounds.Left) * ($_.Bounds.Bottom-$_.Bounds.Top) } -Descending | Select-Object -First 1
            if ($selectedWindow) { break }
            if ($main.HasExited) { throw 'Electron main exited before its visible browser window appeared.' }
            Start-Sleep -Milliseconds 100
        }
    }
    finally { [LionWindowBounds]::SetThreadDpiAwarenessContext($previousDpi) | Out-Null }
    if (-not $selectedWindow) { throw 'No visible browser window at least 900 x 600 owned by the Electron main PID.' }
    $windowHandle = [IntPtr]$selectedWindow.Handle
    $nativeImage = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $status.pid)
    if ($nativeImage.ExecutablePath -ne $status.runtime.executablePath -or $nativeImage.CommandLine -match 'inspect-ui|remote-debugging') { throw 'Unexpected ordinary process identity/debug mode.' }
    if ($status.runtime.userDataPath -notmatch 'SouthWindLionBundled[\\/]instance-') { throw 'Default launch did not isolate its profile.' }
    $runtimeRoot = Split-Path $nativeImage.ExecutablePath
    $owned = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($runtimeRoot + '\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object ProcessId)
    $deadline = [DateTime]::Now.AddSeconds(10)
    while ([DateTime]::Now -lt $deadline) {
        if ([LionWindowBounds]::FocusOwnedWindow($windowHandle, [uint32]$status.pid)) { break }
        Start-Sleep -Milliseconds 100
    }
    if ([LionWindowBounds]::GetForegroundWindow() -ne $windowHandle) { throw 'The selected browser window could not be brought to the foreground for capture.' }
    Start-Sleep -Seconds 8
    $previousDpi = [LionWindowBounds]::SetThreadDpiAwarenessContext([IntPtr](-4))
    $bitmap = $null; $graphics = $null
    try {
        [uint32]$windowOwner = 0
        [LionWindowBounds]::GetWindowThreadProcessId($windowHandle, [ref]$windowOwner) | Out-Null
        if ($windowOwner -ne $status.pid -or -not [LionWindowBounds]::IsWindowVisible($windowHandle) -or [LionWindowBounds]::GetForegroundWindow() -ne $windowHandle) { throw 'Selected window ownership, visibility or foreground changed before capture.' }
        $rect = New-Object LionWindowBounds+Rect
        if (-not [LionWindowBounds]::GetWindowRect($windowHandle, [ref]$rect)) { throw 'No visible browser window bounds.' }
        if (($rect.Right-$rect.Left) -lt 900 -or ($rect.Bottom-$rect.Top) -lt 600) { throw 'Browser window is smaller than the required capture area.' }
        # Maximized windows can extend beyond monitor edges. Capture the visible
        # physical intersection, and use RGB so GDI alpha cannot create an empty PNG.
        $screenLeft = [LionWindowBounds]::GetSystemMetrics(76); $screenTop = [LionWindowBounds]::GetSystemMetrics(77)
        $captureLeft = [Math]::Max($rect.Left, $screenLeft); $captureTop = [Math]::Max($rect.Top, $screenTop)
        $captureRight = [Math]::Min($rect.Right, $screenLeft + [LionWindowBounds]::GetSystemMetrics(78))
        $captureBottom = [Math]::Min($rect.Bottom, $screenTop + [LionWindowBounds]::GetSystemMetrics(79))
        $captureWidth = $captureRight-$captureLeft; $captureHeight = $captureBottom-$captureTop
        if ($captureWidth -lt 900 -or $captureHeight -lt 600) { throw 'Browser window has insufficient visible screen area.' }
        $bitmap = New-Object Drawing.Bitmap($captureWidth, $captureHeight, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($captureLeft, $captureTop, 0, 0, $bitmap.Size)
        $colors = New-Object 'Collections.Generic.HashSet[int]'
        $samples = 0; $opaque = 0; $darkest = 255; $brightest = 0
        for ($row = 0; $row -lt 24; $row++) {
            for ($column = 0; $column -lt 32; $column++) {
                $pixel = $bitmap.GetPixel([int](($column+.5)*$captureWidth/32), [int](($row+.5)*$captureHeight/24))
                $samples++; if ($pixel.A -ge 250) { $opaque++ }
                $colors.Add($pixel.ToArgb()) | Out-Null
                $light = ($pixel.R+$pixel.G+$pixel.B)/3
                $darkest = [Math]::Min($darkest, $light); $brightest = [Math]::Max($brightest, $light)
            }
        }
        if ($opaque -lt $samples*.95 -or $colors.Count -lt 16 -or ($brightest-$darkest) -lt 30) { throw 'Browser screenshot is transparent, blank or has insufficient visual content.' }
        $screenshotEvidence = [ordered]@{ width=$captureWidth; height=$captureHeight; samples=$samples; opaqueSamples=$opaque; distinctColors=$colors.Count; luminanceRange=($brightest-$darkest); pixelFormat='Format24bppRgb' }
        $windowEvidence = [ordered]@{ handle=$windowHandle.ToInt64(); ownerPid=$windowOwner; title=$selectedWindow.Title; bounds=$rect; captureBounds=@{ left=$captureLeft; top=$captureTop; right=$captureRight; bottom=$captureBottom }; foreground=$true; visible=$true; focusMethod='Win32 AttachThreadInput/SetForegroundWindow' }
        $bitmap.Save((Join-Path $root 'ordinary-no-debug-window.png'))
    }
    finally {
        if ($graphics) { $graphics.Dispose() }; if ($bitmap) { $bitmap.Dispose() }
        [LionWindowBounds]::SetThreadDpiAwarenessContext($previousDpi) | Out-Null
    }
    # WM_CLOSE targets only the validated app window, bypassing Electron's small
    # utility window that Process.CloseMainWindow can select instead.
    if (-not [LionWindowBounds]::PostMessage($windowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)) { throw 'Ordinary browser window close failed.' }
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
        window=$windowEvidence; screenshotEvidence=$screenshotEvidence; screenshot=(Join-Path $root 'ordinary-no-debug-window.png') }
    [IO.File]::WriteAllText((Join-Path $root 'gui-report.json'), ($report | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
    $report | ConvertTo-Json -Depth 6
}
finally {
    if (-not $outer.HasExited -and $status.shutdownToken) {
        try { Invoke-WebRequest -Uri ($status.origin + '/_portable/shutdown?token=' + $status.shutdownToken) -Method Post -UseBasicParsing -TimeoutSec 3 | Out-Null } catch { }
    }
}
