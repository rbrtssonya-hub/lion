# Windows 离线展示 EXE

## 小醒智能问答（2026-10-26）

桌宠通过同源 `/api/xiaoxing/chat` 访问包内 Node 问答处理器，渲染器仍只允许本地资源。发布端可通过进程环境 `XIAOXING_GATEWAY_URL` 指向自己的固定 HTTPS 问答网关，模型密钥保存在网关服务器；打包脚本只复制显式服务器代码与本地讲解资料，不复制任何 `.env`。未配置、网络故障或 `--offline` 时返回本地讲解，后者会在任何模型请求前强制离线。接入及独立服务配置见 [小醒问答说明](../../docs/XIAOXING_AI.md)。旧 EXE 不自动更新，需重新打包后验收。

## 当前：内置 Chromium、指定图标与 ZIP（2026-10-23）

用户追加要求不依赖目标电脑的浏览器。新的 `build-bundled.mjs` 采用 Electron 44.9.1 自带 Chromium/Node 和 electron-builder 26.15.3 原生 portable 封装；运行不再需要已安装的 Edge、Chrome、Node、npm 或 .NET。旧 C# 方案保留为历史替代，不应再用它代表内置内核版。

```powershell
node scripts/portable/build-bundled.mjs
node --test scripts/portable/bundled-server.test.mjs
node scripts/portable/verify-delivery.mjs '<exe>' '<build-info中的expectedSiteDir>' '<reviewDir>'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable/verify-bundled-gui.ps1 -Executable '<exe>' -ReviewDirectory '<guiReviewDir>'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/portable/finalize-delivery.ps1 -DeliveryDirectory '<解压目录>'
```

可选的 `--icon=<png路径>` 会同时设置 EXE 图标和应用窗口图标；省略时继续使用工程内默认狮头图。例如：

```powershell
node scripts/portable/build-bundled.mjs 'F:/交付目录' '--icon=F:/素材/狮头图标.png'
```

每次构建会将图标源文件的路径标识和 SHA-256 写入 `build-info.json`，并将同一 PNG 随运行文件一并打包。

默认输出在 `%USERPROFILE%/Desktop/南风有狮/`：构建先生成 `南风有狮-离线版/南风有狮.exe` 与说明/清单，验收后运行 finalize 脚本生成同内容的 `南风有狮-离线版.zip`。两个脚本均拒绝覆盖已有同名交付，需另选输出位置或自行归档。finalize 包含顶层目录，逐条解压读取 ZIP 并核对大小和 SHA256 后才命名为正式 ZIP。构建依赖只安装到 ignored `tmp/portable-toolchain`；不把工具链/FFmpeg编码工具放进最终程序，也不修改应用的 package.json/lock/入口/dist。npm 12 跳过 FFmpeg 安装脚本时，构建脚本仅执行该包声明的二进制下载，不改全局 npm 策略。

默认图标为 `source/public/assets/entry/nav-lion-head.png`；也可用 `--icon=<png路径>` 指定外部图标。builder 会把所选 PNG 转为多尺寸 ICO，设置外层 portable 图标；内部 EXE 在 `afterPack` 中编辑图标和版本后再生成运行清单，避免后续图标编辑导致启动 SHA 校验失败。应用窗口使用同一 PNG，源图保持原字节。

- 网页生产输出全部保留，文件数以本次清单为准。仅发布副本中的 HEVC 视频转 H.264/AAC（保留分辨率，奇数边仅补至偶数，CRF18），原 H.264 保持字节；源视频不改。转换记录保存原/派生字节及 SHA256；六段发布视频逐帧解码，随后在内置浏览器再次验收。
- 完整 Electron 官方 ZIP 内核、所有语言包、软件图形库和两份 Electron/Chromium 许可由打包器全量携带。`runtime-manifest.json` 在内核组装后生成，启动逐SHA核对整个运行目录（清单自身除外），不依赖旧版本 DLL 名单。
- 保留 loopback 白名单/Host/Range/令牌停服；渲染器沙盒、context isolation 开启，Node 集成关闭。正常运行无 CDP；仅明确 `--inspect-ui` 验收才开放本地调试端口。HTTP 公共状态不暴露私有路径或停服令牌。
- 按锁定的 builder 26.15.3 实际源码，`portable.unpackDirName: true` 才省略 `UNPACK_DIR_NAME` 并使用每次启动唯一 `$PLUGINSDIR`；不能照其他版本文档把 false 当唯一目录。此选择必须用同 TEMP 多实例验收。
- 每次启动使用专用根目录下的 `instance-PID-random` profile，展示设置仅会话内保留，彼此不会共用 Chromium 数据库；这些自有缓存不自动删除，可在关闭后由用户清理，不读取日常浏览器 profile。
- 窗口可用 F11 全屏；`Ctrl+Shift+S` 或 Alt 显示的“展示→兼容模式”经原始外层 EXE 重新解包启动软件渲染，不指向即将被旧便携壳清理的内部进程。此路径需要真实快捷键重启验证，不能仅用启动参数冒充。
- 引用链接仅允许无凭证 HTTPS；先弹原生确认，用户明确选择“用系统浏览器打开”才调用系统外链。也可只复制链接；`--offline` 拒绝该出口，网页内部网络始终限本地资源。

支持范围为 **Windows 10/11 x64**。内核内置不等于任意 OS/硬件都能运行：Windows 7/8、32位 Windows、macOS/Linux、未经验证的 ARM 和特定安全策略不作保证。提供 `--software-rendering` 兼容模式降低 GPU 依赖，但不承诺任意旧 CPU/驱动、极低内存或实体扬声器已验收。源站外链需要网络；本地展示无组件下载/登录需求。单EXE未签名，可能有来源提示，不应关闭系统安全保护。

当前 `verify-delivery.mjs` 只用 CDP 连接 EXE 自己的内置窗口，不启动系统浏览器；核对真实 Electron PID、内核/网页/HTTP 全文件 SHA、所有 public 资产、六视频 Range、动画→短片→首页自然顺序、七书页、模型/WebGL/毛发、八态、四视频及离线阻断和退出回收。旧 `verify-bundled.mjs` 留存2026-10-20的固定revision/文件数和旧UI验收，不适用于现行页面。共 TEMP 多实例与真实兼容模式快捷键重启属于旧版当时覆盖，本轮范围以新报告为准。HDRI 使用内置或本地文件；本壳拒绝网页的远程HDRI请求，资料原文外链仍可由用户明确打开。

GUI脚本另外以无inspect/serve-only的普通模式打开实际窗口，按EnumWindows/PID/可见尺寸选择真实窗口，经原生AttachThreadInput取得前台后核对有效像素截图，检查默认独立profile、正常关闭后的main/包装器退出码、子进程和HTTP回收；高DPI截图使用物理窗口坐标。验证脚本使用开发机工具，不能据此把开发工具写成成品运行依赖。2026-10-23最终结果与阶段失败边界见[本轮记录](../../source/references/offline-exe-delivery-2026-10-23.md)；2026-10-20的历史结果见[前次记录](../../source/references/bundled-browser-exe-2026-10-20.md)。

---

## 历史：依赖已安装浏览器的 C# 版

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
