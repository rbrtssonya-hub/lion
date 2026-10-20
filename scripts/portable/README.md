# 临时 Windows 展示 EXE

这是现有 React/Vite 网页的**发布封装**，不引入 Electron、后端服务或 npm 依赖，不修改产品页面、`package.json`、锁文件和 Vite 配置。开发仍使用原来的 `npm run dev` / `npm run build`。

## 构建

在工程根目录，已有 npm 依赖的 Windows 电脑上执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable/build-portable.ps1
```

可指定工程外的输出目录：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable/build-portable.ps1 -OutputDirectory 'F:\数媒竞赛\南风有狮临时展示包'
```

构建使用 Windows 自带的 .NET Framework C# 编译器，不下载 SDK。PowerShell 源码保留 UTF-8 BOM，以兼容 Windows PowerShell 5.1 的中文读取。

构建步骤：

1. 记录 `src`、`source/public`、`package.json`、锁文件、Vite 配置、入口及已有 `dist` 的 SHA256。
2. 将 Vite 全量生产输出写入新建的 `tmp/portable-exe/<唯一ID>/site`，不覆盖日常 `dist`。
3. 核对每个 public 资产在隔离输出中的大小及 SHA256，记录**所有输出文件**，不按使用情况裁剪。
4. 用标准 ZIP 路径全量打包，将 ZIP 与文件清单作为资源嵌入一个 Windows EXE。
5. 再次核对受保护文件没有增减或改写，向工程外输出 EXE、完整清单、SHA256、构建记录和中文交接说明。已有同名 EXE 会保留为 previous，不静默覆盖。

EXE 和验证缓存不提交到 GitHub。源工程只维护封装/验证脚本及证据说明；创作源文件、PSD、历史版本、审查图和未授权照片不是网页运行资产，不会混入程序。

## 运行

用户只需复制 `南风有狮.exe` 并双击。程序先解包和逐个校验资源，然后在独立 Edge（其次 Chrome）应用窗口中打开网页；控制窗口的“退出程序”停止本实例服务并关闭其专用浏览器。日常浏览器、开发服务与其他展示实例不会被按名称批量终止。

- 环境范围：Windows 10/11、.NET Framework、已安装 Edge 或 Chrome，支持 WebGL 的显卡/驱动。媒体解码使用安装浏览器的能力。未内置浏览器，不保证所有系统版本、驱动和编解码组合。
- 本地网页、字体、图片、模型及视频不需要联网；点击资料原网站链接时仍需联网。
- 默认只监听 `127.0.0.1:47851`，端口冲突自动换用空闲端口，无需管理员 URL ACL，不对局域网开放。
- 默认缓存 `%LOCALAPPDATA%\SouthWindLionPortable`。缓存以构建 ID 分隔，每次启动按文件数、大小和 SHA256 校验。损坏/不完整缓存保留为 `quarantine-*` 后重新提取，不递归删除用户目录。
- 浏览器使用本实例独立的 profile 加访客模式，不读取正常浏览器/开发页面的持久化偏好，并避免 Edge 弹出 Windows 账号自动登录提示。展示设置仅本次会话保留；退出后可由用户自行清理专用缓存，不需要改开发工程。
- 本 EXE 未购买代码签名证书。首次从其他电脑/下载渠道运行可能有来源提醒；应核对来源及 SHA256，不应关闭系统安全保护。
- EXE 是构建快照。后续网页开发不会被它覆盖，也不会自动更新到现有 EXE；需要新快照时重新运行构建脚本。

## 实际验收

先从 `build-info.json` 取得本次 `expectedDistDir`，不要用其他构建的目录替代：

```powershell
node scripts/portable/smoke-portable.mjs 'F:/数媒竞赛/南风有狮临时展示包/南风有狮.exe'
node scripts/portable/verify-portable.mjs '<exePath>' '<expectedDistDir>' '<reviewOutputDir>'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable/verify-launcher-lifecycle.ps1 -Executable '<exePath>' -ReviewDirectory '<reviewOutputDir>'
```

验证工具使用开发机已有的 Node、Playwright 和系统 Chrome/Edge，**运行 EXE 本身不需要这些开发依赖**。完整验证器只复制 EXE 到独立中文/空格路径，仅给子进程 System32 的 PATH；核对原输出、manifest、解包文件和 HTTP 所有文件的 SHA256，并检查 HEAD、Range、Host、越界路径、停服令牌、端口冲突及 IPv4 loopback 绑定。浏览器拦截非本地网络后检查首页自然播放、书册、狮谱、设置、结构模型、八态、四屏剧场和离页回收，保存真实截图。

生命周期脚本另验实际可见应用窗口（不是只启动 headless 页面）、退出清理、缓存复用、受控损坏修复及共享缓存实例隔离。受控损坏只发生于唯一测试缓存，不改变源码或正式运行文件。

诊断参数（普通用户无需填写）：

```text
--serve-only                  不打开界面，只运行本地服务
--port=0                      请求系统空闲端口
--status-file=<绝对文件路径>   写入准备结果及仅本实例使用的停服令牌
--data-dir=<绝对目录路径>      指定专用缓存/独立浏览器目录
```

状态文件中的停服令牌不可当公开网页资料；公共 `/_portable/status` 与 manifest 不暴露令牌。服务只允许白名单静态文件；不存在的媒体返回 404，不返回伪装为媒体的首页。

只有实际最终产物的完整验证、GUI 验证与人工截图审查均完成，才能宣布交付；`build-info.json` 中的构建事实本身不表示浏览器验收通过。原网页已知范围及许可保持不变。

实现依据：[C# 编译器嵌入资源选项](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/resources)、[CloseMainWindow 的异步关闭及返回值语义](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.closemainwindow)。
