param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string]$ReviewDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$exePath = [IO.Path]::GetFullPath($Executable)
$reviewRoot = [IO.Path]::GetFullPath($ReviewDirectory)
$runRoot = Join-Path $reviewRoot ('launcher-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
$dataDir = Join-Path $runRoot 'private-cache'
$checks = @()
$processes = @()
function Assert-That($condition, $message) { if (-not $condition) { throw $message } }
function Launch-Display([string]$label, [bool]$gui) {
    $statusPath = Join-Path $runRoot ($label + '.json')
    $arguments = @('--port=0', ('--status-file="' + $statusPath + '"'), ('--data-dir="' + $dataDir + '"'))
    if (-not $gui) { $arguments += '--serve-only' }
    $taskProcess = Start-Process -FilePath $exePath -ArgumentList $arguments -PassThru -WorkingDirectory (Split-Path $exePath) -WindowStyle $(if ($gui) { 'Normal' } else { 'Hidden' })
    $deadline = [DateTime]::Now.AddSeconds(60)
    $status = $null
    while ([DateTime]::Now -lt $deadline) {
        if (Test-Path -LiteralPath $statusPath) {
            try { $status = [IO.File]::ReadAllText($statusPath) | ConvertFrom-Json } catch { }
            if ($status.state -eq 'ready' -or $status.state -eq 'error') { break }
        }
        Assert-That (-not $taskProcess.HasExited) 'EXE exited before readiness.'
        Start-Sleep -Milliseconds 100
    }
    Assert-That ($status.state -eq 'ready') ('EXE was not ready: ' + ($status | ConvertTo-Json -Compress))
    return [pscustomobject]@{ process = $taskProcess; status = $status; gui = $gui }
}
function Stop-Display($run) {
    if (-not $run.process.HasExited) {
        Invoke-WebRequest -Uri ($run.status.origin + '/_portable/shutdown?token=' + $run.status.shutdownToken) -Method Post -UseBasicParsing | Out-Null
        Assert-That ($run.process.WaitForExit(10000)) 'EXE did not stop within 10 seconds.'
    }
    Assert-That ($run.process.ExitCode -eq 0) 'EXE returned a nonzero exit code.'
}
try {
    $first = Launch-Display 'first' $false; $processes += $first
    $index = Join-Path $first.status.siteRoot 'index.html'
    $originalHash = (Get-FileHash -LiteralPath $index -Algorithm SHA256).Hash
    $createdAt = (Get-Item -LiteralPath $index).LastWriteTimeUtc.Ticks
    Stop-Display $first
    $second = Launch-Display 'reuse' $false; $processes += $second
    Assert-That ($second.status.siteRoot -eq $first.status.siteRoot) 'Unchanged cache must be reused.'
    Assert-That ((Get-Item -LiteralPath $index).LastWriteTimeUtc.Ticks -eq $createdAt) 'Cache was rewritten unnecessarily.'
    Stop-Display $second
    $checks += [ordered]@{ name = 'verified-cache-reuse'; status = 'passed' }

    # Only mutate the uniquely created test cache; never source or normal dist.
    Assert-That ($index.StartsWith($runRoot + '\', [StringComparison]::OrdinalIgnoreCase)) 'Unsafe cache test target.'
    [IO.File]::AppendAllText($index, '<!-- controlled corruption test -->')
    $damagedHash = (Get-FileHash -LiteralPath $index -Algorithm SHA256).Hash
    $third = Launch-Display 'repair' $false; $processes += $third
    Assert-That ((Get-FileHash -LiteralPath $index -Algorithm SHA256).Hash -eq $originalHash) 'Damaged cache not repaired.'
    $quarantine = @(Get-ChildItem -LiteralPath $dataDir -Directory | Where-Object { $_.Name -like 'site-*.quarantine-*' })
    Assert-That ($quarantine.Count -eq 1) 'Expected one recoverable quarantined cache.'
    Assert-That ((Get-FileHash -LiteralPath (Join-Path $quarantine[0].FullName 'index.html') -Algorithm SHA256).Hash -eq $damagedHash) 'Original damaged cache must be preserved.'
    Stop-Display $third
    $checks += [ordered]@{ name = 'corruption-quarantine-and-complete-repair'; status = 'passed' }

    $concurrentA = Launch-Display 'concurrent-a' $false; $processes += $concurrentA
    $concurrentB = Launch-Display 'concurrent-b' $false; $processes += $concurrentB
    Assert-That ($concurrentA.status.origin -ne $concurrentB.status.origin) 'Concurrent processes must own independent ports.'
    Assert-That ($concurrentA.status.siteRoot -eq $concurrentB.status.siteRoot) 'Concurrent processes should safely share verified immutable site.'
    Stop-Display $concurrentA
    Assert-That ((Invoke-WebRequest -Uri $concurrentB.status.origin -UseBasicParsing).StatusCode -eq 200) 'Stopping one instance affected another.'
    Stop-Display $concurrentB
    $checks += [ordered]@{ name = 'independent-concurrent-launch-and-shutdown'; status = 'passed' }

    $guiRun = Launch-Display 'actual-visible-gui' $true; $processes += $guiRun
    $deadline = [DateTime]::Now.AddSeconds(30)
    $ownedBrowser = @()
    while ([DateTime]::Now -lt $deadline) {
        $ownedBrowser = @(Get-CimInstance Win32_Process -Filter ('ParentProcessId = ' + $guiRun.process.Id) | Where-Object {
            $_.Name -match '^(msedge|chrome)\.exe$' -and $_.CommandLine.Contains($dataDir)
        })
        $guiRun.process.Refresh()
        if ($ownedBrowser.Count -eq 1 -and $guiRun.process.MainWindowHandle -ne 0) { break }
        Start-Sleep -Milliseconds 100
    }
    Assert-That ($ownedBrowser.Count -eq 1) 'Actual GUI did not create one private-profile browser root.'
    $browserProcess = Get-Process -Id $ownedBrowser[0].ProcessId
    $deadline = [DateTime]::Now.AddSeconds(20)
    while ([DateTime]::Now -lt $deadline) {
        $browserProcess.Refresh()
        if ($browserProcess.MainWindowHandle -ne 0) { break }
        Start-Sleep -Milliseconds 100
    }
    Assert-That ($browserProcess.MainWindowHandle -ne 0) 'The launched browser must have a real visible application window.'
    Assert-That ($ownedBrowser[0].CommandLine.Contains('--app=' + $guiRun.status.origin)) 'Browser was not opened on the EXE origin.'
    Assert-That ($ownedBrowser[0].CommandLine.Contains('--user-data-dir=')) 'Browser profile must be isolated.'
    Assert-That ($ownedBrowser[0].CommandLine.Contains('--guest')) 'Display browser must not implicitly sign in with a Windows account.'
    $deadline = [DateTime]::Now.AddSeconds(30)
    while ([DateTime]::Now -lt $deadline) {
        $browserProcess.Refresh()
        if ($browserProcess.MainWindowTitle -match '南风有狮') { break }
        Start-Sleep -Milliseconds 100
    }
    Assert-That ($browserProcess.MainWindowTitle -match '南风有狮') 'Visible browser never reached the actual webpage title.'
    # Let the first GPU-composited frame paint after the document title arrives.
    Start-Sleep -Seconds 3
    $bounds = [Windows.Forms.SystemInformation]::VirtualScreen
    $capture = New-Object Drawing.Bitmap($bounds.Width, $bounds.Height)
    $graphics = [Drawing.Graphics]::FromImage($capture)
    try { $graphics.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size); $capture.Save((Join-Path $runRoot 'actual-exe-window.png')) }
    finally { $graphics.Dispose(); $capture.Dispose() }
    $guiRun.process.Refresh()
    Assert-That ($guiRun.process.CloseMainWindow()) 'Unable to close the actual launcher control window.'
    Assert-That ($guiRun.process.WaitForExit(15000)) 'GUI launcher failed to exit.'
    Assert-That ($browserProcess.WaitForExit(10000)) 'Private browser was left behind by GUI shutdown.'
    Assert-That ($guiRun.process.ExitCode -eq 0) 'GUI returned nonzero exit.'
    $closed = $false
    try { Invoke-WebRequest -Uri $guiRun.status.origin -UseBasicParsing -TimeoutSec 2 | Out-Null } catch { $closed = $true }
    Assert-That $closed 'GUI shutdown left HTTP server alive.'
    $checks += [ordered]@{ name = 'actual-visible-app-window-and-owned-browser-shutdown'; status = 'passed'; browser = $ownedBrowser[0].Name; browserPid = $ownedBrowser[0].ProcessId; launcherPid = $guiRun.process.Id; screenshot = (Join-Path $runRoot 'actual-exe-window.png') }
    $report = [ordered]@{ status = 'passed'; executable = $exePath; sha256 = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash.ToLowerInvariant(); checks = $checks; runRoot = $runRoot }
    [IO.File]::WriteAllText((Join-Path $runRoot 'lifecycle-report.json'), ($report | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    $report | ConvertTo-Json -Depth 8
}
finally {
    foreach ($run in $processes) { if (-not $run.process.HasExited) { try { Stop-Display $run } catch { $run.process.Kill() } } }
}
