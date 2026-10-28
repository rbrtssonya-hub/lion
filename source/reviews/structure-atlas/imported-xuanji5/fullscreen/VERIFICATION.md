# 全屏主图和空白右区验证

2026-10-28 在 Windows 和桌面 Chromium（软件 WebGL）验证，基于 `main / 7a492fe` 加本轮修改。源模型、GLB、原图和登记相机文件没有本轮 Git 修改。生成图是艺术转译，构图参考真实镜头，细节并非逐像素相同。

- `npm test`：12 项通过；`npm run build`：通过，Three 依赖块仍有既有体积提示。
- 开发服务执行 `node tests/handoff-browser.mjs`：六章的各自图像、登记镜头、空右区、转场、模型暂停、返回、中断、三阶段窗口变化、真实模型点击及图片失败恢复通过；见 `final-verification/handoff/browser-results.json`。验证结束后仅修改了一行源码注释。
- 开发服务执行 `node tests/viewport-browser.mjs`：四档素材，以及 1700×1000、2200×1080 的等比图像、相机投影、真实转图及返回中间帧、快速 resize 和备用图片加载失败恢复通过；见 `final-verification/viewport/viewport-results.json`。前景主图无模糊、遮罩、拖尾或裁切。
- 生产预览执行 `node tests/production-transition-browser.mjs`：眉目章实际飞行、交接、完整图像贴角和右侧空区通过；见 `production-final/production-transition.json`。上述浏览器结果中的意外错误与失败请求均为空。
- 用户特别标注的织锦效果见 `final-verification/viewport/screenshots/study-1536x960.png`，画面清晰、右侧留空；前进与返回中间帧以及不同桌面尺寸截图在同目录。

用户选择完整保留图片，并允许比例不匹配时出现少量纯色留白。因此不能声称所有窗口比例都由图像严格铺满：例如 `handoff-1700x1000.png` 的图片与留白之间仍可见细边界。模型层在交接时置于图片上方，以减轻图片边缘对淡出模型的遮挡，不使用模糊填充。

服务地址通过 `ATLAS_URL` 设置、截图目录通过 `ATLAS_EVIDENCE` 设置；本次自启的服务已停止。未验证其他浏览器、手机或通用 GPU 帧率。
