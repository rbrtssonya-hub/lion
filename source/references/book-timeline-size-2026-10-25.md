# 书册翻页导航放大补验

用户2026-10-25指出底卡图标过小，并补充允许书页适当缩小、让出下方空间。本次基于b707d3b，在当前`codex/exhibit-screen-2026-10-25`分支调整，不修改共享导航动效或资源。

| 项目 | 原尺寸 | 当前尺寸 |
| --- | --- | --- |
| 当前狮子角色 | 32×32px | 64×64px |
| 七站平台 | 42×10px | 64×16px |
| 标签 / 编号 | 16 / 9px | 20 / 12px |
| 时间线行高 | 44px | 76px |
| 合并底卡高度 | 168px | 200px |

角色margin-top45px与减少动态top18px同步原有平台中心定位，避免压住标签；正文18px不变。书册按可用高度适当缩小，标题、完整纸面和底卡仍共用边界。旧1366最小940px测试随用户新取舍改为890px下限，其他纸面完整性、边界、正文与七页断言保留。

实际验证：`npm run build`354模块通过；Chrome生产`book-screen.spec.js`和`home-reading.spec.js`共12/12通过，52.0秒，包含三尺寸逐七页、真实卷曲、iframe滚轮、早进入及材质/设置事务。1920×1080、1440×900、1366×768三张正常动态生产截图已逐张查看，角色/平台/文字实际几何均与上表一致，无页面错误或横向溢出；记录在`source/reviews/book-timeline-size/2026-10-25/capture.json`。

复跑：`npx playwright test --config playwright.preview.config.js tests/e2e/book-screen.spec.js tests/e2e/home-reading.spec.js --output=tmp/book-timeline-size`，Windows上使用`PLAYWRIGHT_CHANNEL=chrome`。核心资产、记忆与Git结果以本记录所属提交及最终核对为准；原App底部格式和`.superpowers/`继续保留。
