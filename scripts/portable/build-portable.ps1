param(
    [string]$OutputDirectory = 'F:\数媒竞赛\南风有狮临时展示包'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$deliveryRoot = [IO.Path]::GetFullPath($OutputDirectory)
if ($deliveryRoot.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or $deliveryRoot -eq $projectRoot) {
    throw '交付目录必须在开发工程之外。'
}
$compiler = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw '需要 Windows .NET Framework 编译器；本脚本不安装依赖。' }
function Get-ProtectedSnapshot {
    $roots = @('src', 'source/public', 'dist', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html')
    $snapshot = @{}
    foreach ($relative in $roots) {
        $path = Join-Path $projectRoot $relative
        if (-not (Test-Path -LiteralPath $path)) { continue }
        foreach ($file in @(Get-ChildItem -LiteralPath $path -File -Recurse)) {
            $key = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
            $snapshot[$key] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    return $snapshot
}
$before = Get-ProtectedSnapshot
$buildRoot = Join-Path $projectRoot ('tmp/portable-exe/' + [Guid]::NewGuid().ToString('N'))
$siteRoot = Join-Path $buildRoot 'site'
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
Push-Location $projectRoot
try {
    & node 'node_modules/vite/bin/vite.js' build --outDir $siteRoot
    if ($LASTEXITCODE -ne 0) { throw '隔离生产构建失败。' }
    $entries = @(Get-ChildItem -LiteralPath $siteRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
        [pscustomobject][ordered]@{ path = $_.FullName.Substring($siteRoot.Length + 1).Replace('\', '/'); bytes = $_.Length;
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
    })
    # No filtering: every byte of the production output is included, not just referenced URLs.
    $publicFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'source/public') -Recurse -File)
    foreach ($file in $publicFiles) {
        $relative = $file.FullName.Substring((Join-Path $projectRoot 'source/public').Length + 1).Replace('\', '/')
        $entry = $entries | Where-Object { $_.path -eq $relative }
        if (-not $entry -or $entry.sha256 -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "缺失或不一致的公共资产：$relative" }
    }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $payload = Join-Path $buildRoot 'site.zip'
    # .NET Framework CreateFromDirectory emits Windows backslashes; use canonical
    # manifest paths so the ZIP is portable and the runtime can reject unsafe paths.
    $archive = [IO.Compression.ZipFile]::Open($payload, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($entry in $entries) {
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $siteRoot $entry.path), $entry.path, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    finally { $archive.Dispose() }
    $buildId = (Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant().Substring(0, 20)
    $revision = (& git rev-parse HEAD).Trim()
    $manifestPath = Join-Path $buildRoot 'site.manifest.json'
    $manifest = [ordered]@{ buildId = $buildId; revision = $revision; files = $entries }
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    $stagedExe = Join-Path $buildRoot '南风有狮.exe'
    & $compiler '/nologo' '/target:winexe' '/platform:anycpu' '/optimize+' '/utf8output' "/out:$stagedExe" "/resource:$payload,site.zip" "/resource:$manifestPath,site.manifest.json" '/r:System.IO.Compression.dll' '/r:System.IO.Compression.FileSystem.dll' '/r:System.Web.Extensions.dll' '/r:System.Windows.Forms.dll' '/r:System.Drawing.dll' (Join-Path $PSScriptRoot 'PortableLauncher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'EXE 编译失败。' }
    $after = Get-ProtectedSnapshot
    if ($before.Count -ne $after.Count) { throw '开发文件数量发生变化，停止交付。' }
    foreach ($key in $before.Keys) { if ($before[$key] -ne $after[$key]) { throw "开发文件被改变：$key" } }
    New-Item -ItemType Directory -Path $deliveryRoot -Force | Out-Null
    $exe = Join-Path $deliveryRoot '南风有狮.exe'
    # Preserve an existing delivery instead of silently overwriting it.
    if (Test-Path -LiteralPath $exe) { Move-Item -LiteralPath $exe -Destination (Join-Path $deliveryRoot ('南风有狮-previous-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss') + '.exe')) }
    Copy-Item -LiteralPath $stagedExe -Destination $exe
    $exeHash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
    $info = [ordered]@{ executable = $exe; executableBytes = (Get-Item -LiteralPath $exe).Length; sha256 = $exeHash;
        buildId = $buildId; sourceRevision = $revision; builtAt = [DateTime]::Now.ToString('o');
        fileCount = $entries.Count; publicFileCount = $publicFiles.Count; siteBytes = ($entries | Measure-Object bytes -Sum).Sum;
        expectedDistDir = $siteRoot; developmentProtectedFiles = $before.Count; developmentFilesUnchanged = $true;
        mode = 'complete-production-output-embedded'; runtime = 'Windows .NET Framework + installed Edge/Chrome; no Node/npm required' }
    [IO.File]::WriteAllText((Join-Path $deliveryRoot 'build-info.json'), ($info | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText((Join-Path $deliveryRoot 'SHA256.txt'), "$exeHash  南风有狮.exe`r`n", [Text.UTF8Encoding]::new($true))
    [IO.File]::WriteAllText((Join-Path $deliveryRoot '完整运行文件清单.json'), ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    $readme = @"
南风有狮 · 临时独立展示 EXE

1. 双击“南风有狮.exe”。首次启动会解压并逐个校验全部网页资源，再打开独立 Edge/Chrome 展示窗口。
2. 保持“南风有狮 · 临时展示”控制窗口运行；结束时点击“退出程序”或关闭控制窗口。
3. 可以只复制 EXE 到别的文件夹；运行资源已内嵌，不需要复制开发目录、Node、npm 或 node_modules。
4. 电脑要求：Windows 10/11，已安装 Microsoft Edge 或 Google Chrome，支持 WebGL 的显卡/驱动。使用本机浏览器的视频解码能力。
5. 本地页面、图片、字体、模型和六段视频无需联网。参考资料外链访问原网站时才需要网络。
6. 程序未购买代码签名证书，Windows 可能显示来源提醒；仅在确认文件来源和 SHA256 后运行，不需要关闭安全软件。
7. 仅监听 127.0.0.1，不向局域网开放。默认端口 47851，冲突时自动使用空闲端口，不终止其他服务。
8. 使用单独配置目录和访客模式，避免自动账号登录，不读取或覆盖日常浏览器/开发网页的设置；展示设置仅本次会话保留。
9. 缓存在 %LOCALAPPDATA%\SouthWindLionPortable；再次启动会校验，损坏缓存会原地保留为 quarantine 后重建。关闭程序后可自行清理这个专用目录，不影响工程。
10. 开发继续使用 F:\数媒竞赛\信息可视化codex 的 npm run dev。src、public、package.json、lock、Vite配置和原 dist 均未改变。本 EXE 是构建时快照，后续修改不会自动更新 EXE。

源码基线：$revision
构建编号：$buildId
网页文件：$($entries.Count)（包含 $($publicFiles.Count) 个原 public 文件，全部逐字节核对）
EXE SHA256：$exeHash

重新打包（仅开发者）：
powershell -ExecutionPolicy Bypass -File scripts/portable/build-portable.ps1
验证命令见工程 scripts/portable/README.md。最终验证结果以 verification/ 中的报告为准；build-info.json 仅记录构建事实，不代替验收。

未改变原有 AI示意、照片出处、字体及组件许可；网页资料区仍可查看。
"@
    [IO.File]::WriteAllText((Join-Path $deliveryRoot '使用与交接说明.txt'), $readme, [Text.UTF8Encoding]::new($true))
    $info | ConvertTo-Json -Depth 8
}
finally { Pop-Location }
