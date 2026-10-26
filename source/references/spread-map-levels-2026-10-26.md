# 传章地图：广东 → 中国 → 世界

2026-10-26 用户看到原世界地图截图后，明确要求“这个地图需要先有广东，再到中国，再到世界”。在 F:/数媒竞赛/信息可视化codex 的 `codex/nfys-structure-review-2026-10-26`、基线 `72b733d` 上接续；原 App 排版 dirty 与 `.superpowers/` 保留。本轮继续只本地预览／提交，不合main、不推GitHub。

## 实际行为

- 初始为广东：广州、佛山分别点选，分别显示原广州狮头／佛山桩上实景。上一幅／下一幅切照片时，选中点同步改变。
- 点“查看中国范围”到中国：广东和香港是当前已收录案例，中国轮廓中高亮广东。点“走向世界”展开原五地八图世界范围。
- 页签支持点击、左右方向键、Home／End；提供上一级和回看广东。切换范围时保留仍可见的选中案例；不在目标层的选中项回到该层首点，避免显示无选中点或地图与右卡分离。
- 三层均使用同一1000×600视框下的 SVG 与 HTML 标签叠加，按容器可用高度等比适配；短电脑与设置推开保留局部阅读。减少动态直接呈现切换结果。
- 右卡继续引用原八条 story／photo 对象、作者和 CC 许可，没有新增照片或未经核实的国内案例。

## 轮廓与来源

广东／中国来源、原始文件SHA、离线重建及验证见[地理来源说明](spread-map-geography-2026-10-26.md)和[源文件归档](../design/spread-map-geography/README.md)。DataV原页注明高德2021.5、仅供学习交流；本轮继续本地预览，不声称开放许可或经审定标准地图。世界延续原有自绘示意，没有传播路线、迁移先后或全国／全球覆盖统计。

## 实际验证

环境为本机 Windows/Node24.20.0/系统Chrome，开发5173、生产4186；适用于72b733d加本任务工作树。

1. 新 `spread-map-levels.spec.js` 先运行红测试，明确因 `.spread-map` 没有初始广东范围失败。实施后：
   - `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/spread-map-levels.spec.js tests/e2e/spread-journey.spec.js --output=tmp/spread-map-levels-dev`：7/7，22.8秒。
   - `PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PREVIEW_PORT=4186 npx playwright test --config=playwright.preview.config.js tests/e2e/spread-map-levels.spec.js tests/e2e/spread-journey.spec.js tests/e2e/four-chapter-journey.spec.js --output=tmp/spread-map-levels-production`：12/12，28.3秒。
2. `node source/design/spread-map-geography/verify.mjs`：通过。检查地区原始Polygon数量、广州／佛山陆地位置、地理方向、台湾／海南、广东在中国的同投影高亮及模块体积。
3. `npm test`：89/89通过，约5.26秒。原799条资产清单不改，追加地区原始JSON、独立轮廓预览和生产审查共13条至812。
4. `npm run build`：362模块、2.28秒成功；既有大chunk提示保留，无依赖或构建配置变化。
5. `node scripts/review-spread-map-levels.mjs`：9张三尺寸截图、0页面错误、所有地图标签在框内、无横向溢出。1366×768、1440×900、1920×1080的三个范围均逐张查看。[截图数据](../reviews/spread-map-levels/2026-10-26/capture.json)。审查脚本首跑发现局部变量同名导致TDZ，改名后完整运行通过，未影响产品页面。
6. 独立只读审查通过，未留实质问题；额外核查范围切换／照片同步、键盘、五种电脑尺寸和 SVG 端点与 HTML 标签的投影对齐。不是再次声称全仓E2E通过。

旧世界地图专项已显式先选择世界层再测试，保留照片故障、许可、多图与设置推开断言。没有全量迁移或重跑历史E2E、没有新版EXE或远程部署。

## 本地查看

`http://127.0.0.1:4186/#/spread`。如预览进程不在，运行 `npm run build` 后 `npm run preview -- --host 127.0.0.1 --port 4186 --strictPort`。
