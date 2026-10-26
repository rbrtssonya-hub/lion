# 惊态五官动作延长到三秒

2026-10-26，用户认可前一版视觉效果，反馈点击后的动作过短，希望持续几秒以便看清。基于同一分支 `codex/lion-motion-breathing-2026-10-26@365f48b`，本轮由Agent选用3000ms总时长，保留已获认可的轮廓、峰值幅度和版面尺寸，章节墨迹仍为原140+540ms。前轮完整两项实现与26项验收见[原记录](surprise-ink-effects-2026-10-26.md)。

## 当前节奏

- 眉0ms、眼120ms、口240ms依次启动，各部位 `duration=3000-delay`，统一在3秒复位，没有末尾拖尾。
- 眉/眼/口约300/408/516ms达到第一峰值；随后停留让观众看清。
- 约1.7秒轻微回收，约2.1秒再次回应，2.4秒后舒缓复位。
- 保留原最大幅度，重复点击从当前完整原图重新播放；切态、对照、离章、后台和减少动态仍立即取消。
- 素材、补绘、AI辅助定性说明及其它七态整图动作沿用前版；没有新增运行素材或依赖。

## 实际验证

Windows / Node24.20.0 / Chrome156.0.8078.47，生产预览4196：

- 构建358模块通过，已有Three538.05kB提示保留。
- 生产惊态专项6项+既有八态整图3项，最终9/9通过（27秒）。实际原生动画时序均为3000ms，快速重播、素材失败、对照、减少动态和离章取消保持通过。
- 新增自然播放测试不暂停动画，连续记录真实RAF矩阵，验证首次展开停留、轻回收、第二次回应及自动复位。最终记录152帧，完成采样约3033.434ms；这用于本机行为验证，未当作实体GPU性能基准。
- 两种桌面1920×1080、1440×900捕获0/900/1680/2250/2850ms原生固定帧与整页，无pageerror和横向溢出。五官图层最大幅度及区域尺寸保持前版。
- 独立代码复查未发现新增阻断问题。
- 最终核心/资产78/78，清单795项；工程记忆131页无错误、4条既有历史来源提示；diff检查通过。

截图/几何与自然播放记录：

- [截图目录](../reviews/surprise-duration/2026-10-26/)
- [固定帧几何](../reviews/surprise-duration/2026-10-26/capture.json)
- [真实三秒播放](../reviews/surprise-duration/2026-10-26/natural-playback.json)

实际命令：

```powershell
npm run build
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PLAYWRIGHT_PREVIEW_PORT='4196'
npx playwright test --config playwright.preview.config.js tests/e2e/expression-surprise-face.spec.js tests/e2e/expression-reactions.spec.js --output tmp/surprise-duration-final-verified
npm test
python wiki_memory/工具/memory.py index --project . --memory-dir wiki_memory --apply
python wiki_memory/工具/memory.py check --project . --memory-dir wiki_memory --require-ready
```

首跑先确认旧版仍为720ms的断言失败。自然播放测试早期单点取样偶尔错过峰值，改为连续记录真实帧；随后发现取消后的Animation.finished属性返回新的等待Promise，调整为在播放开始时保存finished Promise后通过。修订仅针对真实浏览器取样，没有降低阶段幅度、持续时长或尺寸阈值。Git结果以本轮所属提交及upstream实际核对为准。未扩展其它浏览器、手机或重打包EXE。
