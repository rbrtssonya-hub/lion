# 惊态五官与朱红墨迹转场

## 用户范围与工作基线

2026-10-26 用户明确批准两项实现：惊态五官分层短动作、章节朱红墨迹与细金边转场；同轮明确“呼吸感先不改”。没有修改主视觉、面板或文字区域尺寸，没有加入React Bits、图片液态扭曲或结构拆解。

工作区：`F:/数媒竞赛/codex-worktrees/codex-lion-motion-breathing-2026-10-26`；分支 `codex/lion-motion-breathing-2026-10-26`；基线 `37bbecf72fa9d714ba19d64b39c993169446455f`。原工作区 `F:/数媒竞赛/信息可视化codex` 的 `src/App.jsx` 原排版和 `.superpowers/` 保持原位。

## 实现

- `SurpriseLion.jsx` 以1254×1254原图坐标分出左右眉、左右眼和口腔/下牙带五片，保留完整原IMG的ID、src、alt、解码和几何。0/80/160ms依次启动，720ms结束。原图静止时与结束后直接可见；AI补绘底图仅在运动露出的窗口里出现，静态绒球和上牙/上唇遮挡接缝。
- 点击惊态狮头或原操作提示均播放五官动作并延续原详细解读。保留原可调点击放大及其它七态整图动作。快速重播、换态、对照、目标路由改变、后台、减少动态与卸载取消所有原生动画；底图解码失败回到完整原图。
- `ChapterInkTransition.jsx` 使用独立编写的SVG毛边、噪声位移、颗粒及细金边。复用原140ms离场+540ms显现，idle不挂覆盖层，不接管路由或Three。顶栏仍可点击，设置推开时扣除侧栏宽度，首次直接进入章节不播转场。
- `useChapterTransition` 在后台立即收束到最新目标并清计时，保留快速返回当前展示章节的即时收束。
- 新运行图：`assets/expression/lion-surprise-underpaint-v1.png`，1,809,215B；原PNG未修改。完整提示词及参数在[素材说明](../design/expression-surprise/README.md)。没有新增npm依赖。

## 实际验证与证据

- Windows / Node24.20.0 / Chrome156.0.8078.47，桌面1920×1080、1440×900。
- 新五官开发回归最终5/5：实际原生SVG变换矩阵的顺序/幅度、复位尺寸、快速重播、切态/对照、减少动态、补绘失败、离章提交时旧场景仍在但动画已停止。
- 墨迹与导航开发组最终12/12：墨迹6项与迁移导航6项。前组章节身份/剧场准备/原模型画布复用5/5；旧导航另3项在前组通过。
- 独立代码审查发现离章取消原先要等140ms卸载的问题；已加入App→ChapterPage→ExpressionPage活动标志，浏览器先复现 stopped:false，再修复并通过。
- 生产构建：358模块通过，Three538.05kB已有体积提示保留。
- 生产预览4196：五官5项、墨迹6项、章节身份5项、既有神态文字动效3项、整图动作3项、点击反馈4项，共26/26通过（2.0m）。跳过含640px窗口的120%峰值旧用例；未声称全仓E2E通过。
- 最终核心/资产78/78；143份运行资产与dist逐项SHA一致；清单779项。两种桌面生产截图无pageerror、无横向溢出；主狮头播放前后宽高一致。独立审查P2已修复并复查无新增阻断项。

本轮实际核心命令：

```powershell
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PLAYWRIGHT_PREVIEW_PORT='4196'
npx playwright test --config playwright.preview.config.js tests/e2e/expression-surprise-face.spec.js tests/e2e/chapter-ink-transition.spec.js tests/e2e/chapter-identity.spec.js tests/e2e/expression-reactions.spec.js tests/e2e/expression-motion.spec.js tests/e2e/expression-click-feedback.spec.js --grep-invert '120%峰值' --output tmp/surprise-ink-production
python wiki_memory/工具/memory.py index --project . --memory-dir wiki_memory --apply
python wiki_memory/工具/memory.py check --project . --memory-dir wiki_memory --require-ready
```

原生Chrome帧与几何在[截图目录](../reviews/surprise-ink/2026-10-26/)和[capture.json](../reviews/surprise-ink/2026-10-26/capture.json)。静止、0/120/300/490ms帧、两种桌面整页均逐项审查；捕获实际画面，不以CSS声明替代视觉。截图脚本仅暂停应用创建的真实动画来固定取样时刻。

## 首轮问题与修复

1. 下颚初始环形轮廓只带动半段牙带，峰值出现双牙线；改为完整口腔/下牙带闭合路径，并将顶部停在原图y786以下，保留上牙与上唇静态。上方小绒球加入原图静态遮挡，最终中间帧无双线。
2. 早期整条时间轴缓动使峰值过早，改为各关键段分别缓动，0/80/160ms顺序和预期峰值可直接由实际变换核对。尺寸复位检查需要等待已有220ms hover退出，保留尺寸阈值，没有改动产品区域大小。
3. 截图脚本最初对所有iframe写sessionStorage，触发sandbox异常；改为仅顶层初始化后重新捕获。最终捕获无pageerror、无横向溢出。
4. 首次转场测试误复用原工程5173服务，改用本分支独立端口重新验证；开发5189、生产4196。
5. 旧导航6项仍要求Logo移动或靠近首页按钮，与2026-10-25已确认的Logo固定左侧冲突。原目录未接墨迹的37bbecf服务也复现旧direct-open失败：间距1239.375px、旧预期≤48px。仅迁移旧Logo断言，改为宽屏Logo实际矩形逐帧<0.75px，保留标题、图标、缓动、文字和底板阈值。
6. 新worktree的Windows自动CRLF使5份已登记capture.json偏离历史SHA。确认仅换行转换且Git HEAD原blob的SHA完全匹配清单后，恢复原blob字节，未改历史哈希。`.gitattributes`补充capture.json字节保护，防止后续Windows检出再出现。

## 验证边界

当前仅“惊”态五官试作；其它七态保持既有整图动作。媒体/来源仍标AI辅助定性视觉，没有宣称真实表演采样。后台用例控制document.hidden/visibilitychange边界，没有宣称实体操作系统切换实测。手机、其它浏览器、实体GPU性能基准、正式部署及离线EXE重新打包均未在本轮执行。Git交付以所属提交与upstream实际SHA核对为准。
