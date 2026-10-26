# 入场加载画面笔刷标题与文字可读性（2026-10-26）

用户要求：实际入场加载动画的“南风有狮”采用参考图二的黑色笔刷风格，其他小字放大。本轮基于 F 盘 `codex/exhibit-screen-2026-10-25@28fa59c`，仅调整现用 `source/public/assets/loading/entry-transition.html` 和宿主跳过按钮的 `src/styles/home.css`。原 `src/App.jsx` 底部格式和 `.superpowers/` 保留。

使用参考图同一张透明字稿 `assets/entry/title-nanfeng-youshi.png`，614×548，保留“南风／有狮”两行错落、笔锋和飞白；CSS `brightness(0)` 将笔画显示为黑色，原主视觉金色 PNG 不改。标题按原比例显示，宽度受窗口宽、高共同约束。保留语义 h1，图片未完成或失败时显示真实文字，不出现破图。沿用原静态加载页的图片完成／失败切换方式，没有新增依赖或运行图片。

| 文案 | 原实际字号 | 当前普通电脑窗口 | 高度不超过 700px |
| --- | --- | --- | --- |
| 英文副题 | 9px | 16px | 16px |
| 墨韵入场，静候狮醒 | 11px | 20px | 18px |
| 进度状态 | 10px | 18px | 18px |
| 进度数字／百分号 | 25／12px | 36／18px | 32／18px |
| 墨染南风，狮醒岭南 | 9px | 18px | 16px |
| 左下角落款 | 9px | 18px | 16px |
| 宿主跳过动画按钮 | 12px | 18px | 18px |

小字同时加深为灰墨色；两行标题、笔触动画和进度区域重新分配高度。较矮窗口收紧间距及笔触区，仍显示所有辅助文案。既有 6.2 秒水墨动画、减少动态时长、完成消息、跳过与“动画→短片→首页”流程不变。当前动画引用既有共享标题 PNG，独立复制此 HTML 时需要保留相对标题路径；若标题缺失则显示文字回退。旧 `assets/loading/index.html` 是另一套横排字稿及资源进度页面，本轮不修改。

实际验证（Windows、Node 24.20.0、Chrome 156）：

- `npm run build`：354 模块，2.44 秒通过，保留既有 Three.js 包大小提示。142 份 `source/public/assets` 与构建产物逐字节一致。
- `PLAYWRIGHT_CHANNEL=chrome`，`npx playwright test --config playwright.preview.config.js tests/e2e/loading-brush-title.spec.js tests/e2e/loading-typography.spec.js tests/e2e/home-video-replacement.spec.js --output=tmp/entry-brush-type`：12/12 通过（1.5 分钟）。其中 10 项是既有独立加载页回归，2 项验证现用真实入场动画、视频自然结束与循环、跳过、重播、路由暂停和刷新行为；不把独立页回归当作当前入场排版证据。
- 当前入场 HTML 专项浏览器采样：1920×1080、2040×1148、1440×900、1366×768、1024×768、1024×560、1920×400 共 7 组；所有辅助文字至少 16px，完整在窗内，标题比例正确，无相互遮挡与横溢。图片请求失败后文字回退且笔触进度继续；真实 React 宿主确认 18px 跳过按钮、入场 iframe 覆盖导航并可实际跳过至首页。5 张原生截图均已查看，采样及结果见 `source/reviews/entry-brush-type/2026-10-26/capture.json`。
- 首次采样误把被 fixed iframe 覆盖的底层导航 DOM 可见性作为画面隐藏断言；确认覆盖关系后改为实际命中检查并重跑通过，产品没有因此改动。独立只读复核已查看两个产品文件、5张截图和采样，未发现必须修正项。
- `npm test` 核心／资产 78/78 通过。资产清单原751项保留，只追加5张审查图和采样至757项；现有主视觉PNG及其他运行二进制原字节保留。记忆 `check --require-ready` 检查129页、无错误，保留四条既有历史来源提示。`git diff --check` 通过。

仅按本轮范围验收，未重跑全仓浏览器用例或重新打包离线 EXE。Git 提交与 upstream 一致性以最终交付核对为准。
