# 南风有狮临时单文件 EXE 交付记录

核实时间：2026-10-20。唯一实施位置：`F:/数媒竞赛/信息可视化codex`，网页源码基线 `main@60ab71cff0d2e1e8d7fdcf44d04481c08b8aca30`。本任务只新增发布/验收脚本及工程记录，不改当前网页功能、资源、依赖或普通 dist。

## 交付与完整性

- 成品：`F:/数媒竞赛/南风有狮临时展示包/南风有狮.exe`，**209005568 bytes**（约199.32 MiB）。
- SHA256：`f16f7e68d9a86405427901f107b9a42c14c9a7f69c047beda1ed149bfe4d2a2c`。
- 构建ID：`21a899c9f2ed49244e2d`。
- 网页完整输出100文件、230975546 bytes；包括89份原 public 资产、全部6段视频、2个GLB、图片、书页、字体、运行HTML/CSS/JS及现有许可。
- 构建前后270份源码/配置/原public/普通dist文件逐SHA256无变化。`package.json`、lock、Vite入口不改，不安装新依赖。`tmp/portable-exe/14d9286ee03a44c29f9ca006ea54ad2d/site` 为本次独立构建。
- EXE嵌入完整ZIP和文件清单；从仅含EXE的中文/空格目录、子进程PATH仅System32启动，原输出、嵌入manifest、解包及HTTP100文件大小/SHA一致。不是必须依赖开发目录的快捷方式。
- 仅部署运行资产；不把PSD/Blender源工程/历史素材/未许可人像/审查图混入网页。成品、测试缓存及历史尝试不进Git。

## 实现选择与边界

Agent基于临时展示及“不影响后续开发”要求，选择原生产构建＋Windows .NET Framework包装＋loopback静态服务＋本机Edge/Chrome访客应用窗口；不引入Electron或桌面npm依赖。源码在[封装目录](../../scripts/portable/README.md)。

服务只绑定127.0.0.1，提供白名单静态文件和视频Range；默认47851冲突自动换端口，拒绝目录穿越、错误Host、错误HTTP方法及无令牌停服。缓存按构建ID校验并复用，损坏缓存保留后重建。唯一profile加guest避免Windows隐式登录，控制窗口结束后有界等待并仅回收自己浏览器PID树，不批量杀浏览器。

仅宣称当前Windows及系统Chrome155.0.8059.80、Edge155.0.4283.62已验收；仍要求目标Windows10/11有.NETFramework、兼容浏览器及WebGL/视频解码能力。不是内置浏览器/安装器，不保证未经验证的系统、GPU、驱动或音频设备。未签名，可能出现来源提醒；不要求关安全软件。本地内容离线运行，资料外链本身需要网络。访客设置仅会话内保存，不覆盖日常开发设置。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| `npm test` | 51/51通过，1136.5877ms |
| 隔离Vite生产构建 | 320模块，1.98秒，普通dist不改；原Three大包提示保留 |
| 最终EXE冒烟 | 通过，100文件，build21a899c9f2ed49244e2d |
| 完整独立EXE/HTTP/Chrome/Edge专项 | **153/153通过**，0失败、0未验收，2026-10-20 03:55:43.599Z–03:57:47.533Z |
| 实际可见GUI/生命周期 | 4/4通过：缓存复用、受控损坏留存及修复、共享缓存双实例独立启停、Edge访客app窗口与控制窗退出后浏览器/HTTP关闭 |
| 后续开发 | 原`npm run dev`在独立5197启动，根页及src/main.jsx实际HTTP200；测试后只停止自有5197，不操作其他服务 |
| 代码/语法 | 两MJS `node --check`、WindowsPS5.1解析、适用diff检查通过；提交前还须再次核对 |

153为本EXE专项，不冒称原全量E2E全部运行。Chrome/Edge均在阻止非loopback页面请求下检查：首页HEVC入场自然结束与循环回绕、七页原书册、居中点击展开三类型、四栏目侧轨、九类设置及公共材质应用、结构WebGL实际画面、八态联动、四段巨幕视频实际解码和时间进度、离页释放。26张真实截图加可见GUI图已保存；不是仅访问首页或只检查编译成功。

## 失败、修正及审查

- 先有真实EXE缺件RED；WindowsPS5.1误按ANSI读取无BOM中文脚本，增加UTF8 BOM；旧.NETFramework ZIP默认反斜杠被安全白名单拒绝，改builder规范路径，不放宽边界。
- 冒烟测试URL对象规范化穿越路径导致假失败，改为原始path请求，复验通过。
- 独立只读审查3项P2：raw path、关闭浏览器确认、x86 Chrome发现，均已修正并复验。审查不代替运行结果。
- 人工查看实际GUI发现Edge隐式Windows账号提示挡屏，追加guest。最终GUI图确认无提示；全部153项基于最终f16f7e68重新运行，前构建结果不代替最终验证。
- 早期ZIP、旧EXE、测试缓存及含账号提示的审查图只保留ignored临时取证，不随最终精简交付目录/Git公开。

最终用户目录包含EXE、中文交接说明、SHA256、完整文件清单、build-info和精简verification报告/截图。原验收run名`便携验收 FQU2rt`、GUI`launcher-e6a5a77a3c224fd0b70faf9e6095baa4`可由脚本重新运行；成品快照不随后续网页自动变化。Git最终提交/推送以本记录所属main提交及实际upstream核对，禁止强推和纳入其他worktree/`.superpowers/`。

交付目录整理时，将原verification（含完整测试副本/缓存/早期图）和4个旧EXE原样移至ignored `tmp/portable-delivery-attempts/819c1e8d4d7641cebf06750a23009aa5`，不删除任何开发或用户材料；最终2份报告及27图复制回交付verification，共29文件。原报告保留验收当时绝对路径与事实，原始fixture现位于上述归档的verification同名run内，不伪造重新运行位置。成品目录仅保留最后1个EXE，总大小266118146B；整个目录无需测试缓存也能展示。
