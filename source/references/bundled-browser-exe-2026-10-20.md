# 南风有狮内置浏览器便携包

## 要求、位置与交付边界

用户在旧 C# 临时包交付后明确追加：浏览器内核也必须随EXE携带，不应依赖目标电脑安装浏览器。唯一实现位置仍为F:/数媒竞赛/信息可视化codex，网页基线main@3207edab6c7011f8e5506c6cd51026ba046874e3；C盘仅存独立验收/失败构建归档，不使用旧worktree实现。

Agent采用Electron44.9.1（Chromium152.0.7977.167、内置Node24.22.0）+electron-builder26.15.3 portable x64。运行不需要已安装Edge/Chrome、Node/npm、.NET或在线下载组件；目标为Windows10/11 x64，不承诺任意OS、老CPU、32位Windows、未知ARM模拟或特殊系统策略。软件渲染降低GPU依赖，不表示任意硬件性能已验证。保留原网页布局/功能，不将发布壳作为新的开发入口。

## 构建结果与完整性

- EXE：`F:/数媒竞赛/南风有狮内置浏览器展示包/南风有狮-内置内核-x64.exe`，275730795B。
- SHA256：`9b55e8366c3ae5980955f1d8fed8a00c481d225db99e1c059ba1966bd7c89e7e`；网页buildId `522a3e281ec234a53b39`。
- 网页完整100文件；含内核/语言包/软件图形库/许可证/包装器附加helper共176运行文件，175项SHA清单加清单自身。启动读取物理文件校验，不因ASAR虚拟文件系统误判。
- 原工程270份源码/配置/public/普通dist构建前后SHA不变，package.json、lock、Vite配置不改。工具链/FFmpeg编码工具只在ignored tmp，最终程序不携带构建工具链。
- 仅发布副本两段HEVC首页视频转H.264/AAC、yuv420p、CRF18，不缩放分辨率（奇数边补偶数）；四段H.264动作视频字节不变。六段发布视频经FFmpeg全帧解码；原始用户视频、网页公开资产不改。逐片原/派生哈希见成品`视频兼容转换记录.json`。
- 最新装包工作目录`tmp/bundled-exe/79cacaa4-80b0-45b6-8b6a-5cb29765325c`；复用同一HEAD且产品Git状态干净、文件清单逐SHA验证过的发布副本，避免重复转码，不接受其他revision或已改变的站点。

## 运行与安全选择

main为沙盒BrowserWindow，contextIsolation=true、nodeIntegration=false、webSecurity=true。仅loopback HTTP白名单，包含HEAD/Range/Host验证及停服令牌；公共状态不泄露私有路径/令牌。会话内部网络只允许本地资源；引用HTTPS须无凭证且经原生用户确认，才可复制或用系统浏览器打开，offline验收时直接拒绝外链。

正常运行无CDP，只有显式inspect-ui诊断模式启用本地调试。普通启动逐次生成instance-PID-random profile，不碰日常浏览器，也不让并发实例共享Chromium数据库。NSIS按实际锁定版本使用unpackDirName=true以省略UNPACK_DIR_NAME，保证同TEMP启动仍各用唯一PLUGINSDIR。Ctrl+Shift+S通过PORTABLE_EXECUTABLE_FILE重新启动外层EXE，不重启即将被旧包装器清理的内部文件；重入防重复。

## 验证与已修问题

- HTTP真实最小测试先RED（新server缺失），实现后GREEN：发布白名单、GET/HEAD、正/倒/开放区间Range、416、Host/traversal/错误方法/令牌。产品资产核心51/51通过，隔离Vite320模块构建通过，FFmpeg六视频解码通过。原Three.js大包提示保留。
- 最终9b55 EXE的普通默认启动（无serve-only、无inspect、默认独立profile、子PATH仅System32）已实际打开窗口，main/外壳退出码0/0，所属Electron子进程全退、HTTP停止，无调试端口。GUI工具曾因Get-Process未持有原生Handle而丢失ExitCode，修正工具后同EXE复验通过；高DPI截图另按物理坐标处理，不改产品。
- 完整独立验证器只用CDP连接EXE本身，不使用安装浏览器代替内置内核。最终ACFi4B（2026-10-20 14:54:38–14:58:40北京时间）在同一9b55 EXE上178/178、0失败、0未验证，所有coverage=true。176运行文件三方逐SHA，100网页manifest/解包/HTTP逐SHA；GET/HEAD/Range/Host/traversal/loopback/端口回退/私有令牌、中文空格纯EXE目录与System32-only子PATH均通过。
- 内置Electron真实窗口完成首页两视频自然推进/循环、七书页、三形制收展、四栏目侧轨、九设置公共材质、结构WebGL及交互、八态同步、四视频巨幕及离页回收、出处/许可、离线阻断。同TEMP两实例独立解包/profile，关闭peer后原窗口/原CDP target不换仍能视频/模型；真实Win32 Ctrl+Shift+S只启动一次新外层EXE，重启软件渲染后视频/模型正常，旧main/包装器0退出且不残留监听。四阶段pageErrors/意外HTTP失败/外部页面请求均0，进程审计无外部浏览器/Node/.NET或未知进程。
- 初批PuHuQ2 153/7、iDsZNq 146/12、bp4JyH 163/3、cif3xk 177/1的RED原件保留在C盘review，不挪作最终通过。CDP定点复现证明disconnect关闭Playwright侧Page对象、不会关闭Electron原生target，重新附着可成功；旧bp4JyH那次原生target消失未复现，触发源仍未确证，不虚报为detach已致产品故障。最终验收贯穿peer前后保持原CDP连接/原Page/原target，不刷新或新建替代页面，四阶段native窗口/target不变，随后视频/模型/菜单均通过。
- 早期模型路由断言不符既有预热设计，改为核对保留模型的隐藏/暂停，动作剧场的GPU/media离页释放断言仍保留。输入法宿主以签名/路径/版本作为系统输入法证据单列，不隐藏；PID33708在退出后被Codex node_repl复用，改用原生CREATE/EXIT+GetProcessTimes出生代际及父进程生存期验证，定点回归仍拒绝真实短命Node/未知System32子进程。修正验收工具后完整重跑，不放宽成品断言或修改网页。
- 独立源码复核2026-10-20 14:41结论Approve、remaining findings 0；该审查不代替上述二进制实际验收。最终20张内置窗口截图加1张普通GUI截图已抽查，精简副本与report/gui-report在成品verification；结构化摘要见[validation.json](bundled-browser-exe-2026-10-20-validation.json)。

构建/审查期间修正：旧版DLL假设（官方44 ZIP已不含libEGL/libGLESv2）；Windows重定向C缓存同目录rename实际EXDEV（F探针成功），改用本任务F盘工具缓存；ASAR物理校验须original-fs；NSIS会在afterPack后加elevate.exe，先复制官方同字节helper再生成完整清单。审查的固定解包目录/内部重启/profile共用/自动外链/大小写根目录问题均已按代码证据修正，并经最终同SHA二进制回归。

## 交接、许可与恢复

成品为单EXE，旁附使用说明、SHA256、网页与内核清单、转换记录、build-info及精简验证截图/报告。Electron/Chromium等许可随内核携带，旧网页摄影、字体、组件及AI说明不删。未购买签名证书，真实Authenticode为NotSigned，可能有系统来源提示，不要求关闭安全软件。出处外链仍需网络。

源码与命令见[scripts/portable/README.md](../../scripts/portable/README.md)。五份早期构建577030df、8990fced、58fbb907、7b0b7880、13050e05的文件及三份previous EXE已非破坏性移到本会话C盘visualizations下bundled-build-archive，保留可恢复，旧F构建目录为空；未删除任何原始素材、正式包、依赖或开发源码。最终79cac构建与本任务工具链仍在ignored tmp保留用于复现；精简交付不携带这些历史尝试。

依据：[Electron安全建议](https://www.electronjs.org/docs/latest/tutorial/security)、[ASAR与original-fs](https://www.electronjs.org/docs/latest/tutorial/asar-archives)、锁定工具链实际NSIS源码与生成定义；正式Git按本任务所属提交及交付时重新fetch核对，禁止强推或纳入临时二进制/.superpowers。
