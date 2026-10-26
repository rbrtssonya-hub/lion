# 入场标题四字横排补验（2026-10-26）

用户明确将当前“南风／有狮”两行标题改为四字横排。本轮基于 `codex/exhibit-screen-2026-10-25@554ed73`，仅替换入场HTML的标题引用、比例和宽度；复用既有 `assets/loading/title-ink.png`（2172×724），保持黑色笔刷、透明飞白与3:1原始比例。普通窗口标题宽度上限560px，短窗口上限460px，同时受实际宽高限制。前次放大的辅助文字、跳过按钮、背景、图片失败文字回退和入场流程保留。

实际验证：354模块生产构建通过（3.01秒）；Chrome通道运行 `npx playwright test --config playwright.preview.config.js tests/e2e/loading-brush-title.spec.js tests/e2e/home-video-replacement.spec.js --output=tmp/entry-brush-horizontal`，5/5通过（51.6秒）。其中3项核对复用横排字稿的既有独立加载页，2项验证真实动画、视频自然结束与循环、跳过、重播、路由及刷新。

现用入场HTML另外采样1920×1080、2040×1148、1440×900、1366×768、1024×768、1024×560、1920×400七种电脑窗口，标题均以原比例四字横排，文案无重叠、越界或横溢。图片失败回退后动画继续，实际React宿主跳过有效。5张截图已逐张查看，记录见 `source/reviews/entry-brush-horizontal/2026-10-26/capture.json`。独立只读复核未发现必须修正项。

核心／资产 `npm test` 78/78通过；清单保留原757项，仅新增5图及采样至763项。记忆 `check --require-ready` 检查129页、无错误，保留四条既有历史来源提示。`git diff --check`通过。

前次两行排版记录保留于 `source/references/entry-brush-type-2026-10-26.md`，现行排版以本记录为准。保留原App格式与`.superpowers/`；未新增运行资产、依赖、手机适配或重新打包EXE。
