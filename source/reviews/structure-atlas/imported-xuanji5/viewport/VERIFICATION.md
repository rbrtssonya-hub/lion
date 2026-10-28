# 整窗三维视口与转图验证

2026-10-27，Windows，基于 `main / 2a781ac` 加本轮未提交改动。使用桌面 Chromium 和软件 WebGL；本记录不代表其他浏览器或 GPU 的性能。

- `npm test`：10 项通过。`npm run build`：通过，Three 依赖块仍有超过 500 kB 的既有提示。
- 开发服务 `http://127.0.0.1:5191`：`node tests/viewport-browser.mjs` 在 1920×1080 下核对织锦的登记相机终点。实际 WebGL 像素在旧 3:2 画幅左、右外侧分别检测到 74、99 个采样；对照无扩展的 3:2 相机，六个部位中心的中央投影误差均小于 0.01 像素。结果见 `viewport-results.json`。
- 同一脚本减速并暂停真实交接动画，截取织锦转图和返回各三个中间帧；人工检查旧左右边缘处模型连续过渡。模型和图片的透明度随同一进度变化。截图见 `screenshots/`。
- `node tests/handoff-browser.mjs`：开发服务上的六章普通动态、登记终点、完整图版、模型隐藏暂停、返回、中断、三个阶段窗口变化、真实模型选取、1280px 桌面及图片失败恢复均通过。结果见 `handoff/browser-results.json`。
- 生产预览 `http://127.0.0.1:4191`：`node tests/production-transition-browser.mjs` 检查眉目章整窗画布、图版边缘羽化、图像完整后再移动和文化文字进入，通过；结果见 `production/production-transition.json`。
- 三个浏览器脚本的语法检查通过，上述浏览器结果中的意外错误和失败请求均为空。测试服务已停止。浏览器脚本使用 `ATLAS_URL`、`ATLAS_EVIDENCE` 指定服务和输出位置。

源 `.blend`、网页 GLB、十八张图片及相机登记文件没有本轮 Git 修改。图片是艺术转译，转图并非逐像素配准。
