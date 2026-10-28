# 全屏运镜与左上贴图验证

2026-10-26，基于 `5128962` 加本轮源码修改，在 Windows 本地 Chromium / SwiftShader 验证。最终 revision 为包含本记录的提交；开发地址5176、生产预览4175均为本轮临时验证服务。

## 需求与证据

| 要求 | 实现与实测证据 |
| --- | --- |
| 先全屏运镜，再转换图片 | `travel` 与 `handoff` 中画幅保持屏幕可容纳的最大完整3:2，位置与尺寸固定；六章 rAF 采样及原登记相机终点核对通过。 |
| 转换完成后才移动图片 | `arranging` 前图片已完全不透明，模型层隐藏且 `active=false`；此阶段实际记录 GSAP 缩放、左移与导航移动，文化栏仍隐藏。 |
| 图片左侧、上侧无预留空位 | 最终图片 `x=0 / y=0`，保留完整3:2、`contain`，无二次裁切；五种桌面截图与几何断言通过。 |
| 为右栏腾出更多空间 | 左图通常为屏宽62%，右栏约三分之一宽度，并独立使用顶72px到底24px的高度。1536×960时左图951×634，右栏约517px宽；文化/数据、来源和长内容均可操作。 |
| 底部图标左移 | 六个原艺术PNG同步GSAP左移，最终在左图区居中，不侵入右栏。 |
| 保留完整模型、原主图与对应构图 | 六个独立主图URL、登记相机端点、节点原位断言通过；原模型、GLB、十八张图片及相机配置均无Git修改。 |

全屏画幅保持原来的精确3:2光学范围；与屏幕比例不同的部分为纸底，不为阅读栏预留空间。图片替换完成后才改变显示比例。变换采用固定内部尺寸加 `x/y/scale`，避免移动图片时触发连续三维重绘。

## 已执行检查

- `npm test`：10/10，包含最大完整画幅、左上位置、宽栏和导航几何，以及真实模型分析算法/六张独立主图检查。
- `npm run build`：通过；Three依赖块超过500KB的既有提示仍存在。
- `ATLAS_URL=http://127.0.0.1:5176 ATLAS_EVIDENCE=artifacts/transition node tests/handoff-browser.mjs`：非quick六章通过，见 `browser-results.json`。包含真实相机运动、原端点、四阶段连续采样、模型隐藏与RAF暂停、GSAP文字、未移动节点、返回、中断、真实拾取、1280版面、503恢复。
- travel / handoff / arranging 中分别调整窗口：终点、返回画布及GPU缓冲尺寸通过，见同JSON的 `resizes`。`LionWorld.resize()` 已修复为使用未缩放的 `clientWidth / clientHeight`，防止返回时画布重复缩小。
- 另以force点击定点补验 handoff / arranging 中改选，避免Playwright等待导航动画稳定造成假中断；点击前实际阶段、最后章节胜出及原镜头恢复均通过，见 `forced-interruptions.json`。对应断言已并入当前主浏览器脚本。
- 开发与生产分别执行 `tests/enrichment-browser.mjs`：六章、19个图解分项、12张独立导航/文化图、数据图、键盘、滚动和来源通过；1280×800、1536×960、1600×800、1920×1080、2560×1440均通过。结果分别为 `enrichment/browser-results.json`、`production/browser-results.json`。
- `ATLAS_URL=http://127.0.0.1:4175 ATLAS_EVIDENCE=artifacts/transition/production node tests/production-transition-browser.mjs`：普通动态生产黑盒通过，不依赖开发诊断对象；采样travel56、handoff27、arranging30、study66，见 `production/production-transition.json`。

上述浏览器结果的意外错误及失败资源均为空。503是主动注入的恢复测试，不纳入意外失败。截图位于各结果旁的 `screenshots/`，已目视最终布局、淡化中间态和图片移动阶段。

## 范围

桌面展示，本轮没有手机适配、源模型修补或公开部署。六张主图的艺术转译差异与原几何限制沿用既有审计；本轮未修改相机、模型尺度或生成图片。历史 `artifacts/handoff/`、`artifacts/enrichment/` 的证据保留，不能替代本轮结果。
