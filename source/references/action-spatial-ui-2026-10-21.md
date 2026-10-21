# 四面观狮：实时空间悬浮界面

本轮在 E:/数字媒体竞赛/张钧儒/lion 的 `codex/huangzhi_ARUI`、基线 `a3898e5` 上按用户[参考图](../design/action-theater/2026-10-21-floating-ui-reference.png)与[提示词](../design/action-theater/2026-10-21-floating-ui-brief.md)修改动作页。沿用完整醒狮、四个真实视频、红金建筑与 HDRI；新增界面用 React/CSS/SVG 绘制，参考图不进入网页运行资产，也不作为背景。

## 界面与坐标

- 左侧“四面观狮”标题牌固定在前方世界坐标；四面巨幕各有编号、动作名称和可点击播放牌。每面对应一张固定位置的解读牌，只有当前激活巨幕的解读牌显示。
- 深茶色透明底、双层金边、四角云纹、宋体和章印沿参考图设计；底部左侧操作提示、中央椭圆罗盘、右侧自转和视角切换为随观看者移动的近身控制。罗盘方向在相机帧同步更新。
- 保留原顶栏、四站导航、视频进度/音轨/全屏/平面回退。只针对电脑窗口验收；窄桌面及设置推开后的小画布有紧凑排列。
- `actionTheaterSpatialUI.js` 初始化时缓存各屏真实网格中心、法线和边界，构造固定的世界面板矩阵。单一场景 RAF 中在相机更新后计算 `viewport × projection × view × world`，写 CSS `matrix3d`；浏览器命中使用相同透视。法线、视锥与面板四角负责显隐，不让面板追着相机转。
- CSS 世界坐标的深度方向与 WebGL 相反，viewport 的 Z 轴翻转；不叠加 CSS `backface-visibility:hidden`，避免浏览器将完整投影矩阵误判为背面。背面由真实法线显式剔除。
- 仅在窗口尺寸改变时重新布置缓存世界锚点：小于1100px画布向内收拢标题/解读牌，短于800px画布提高解读牌，避免900px裁切与1366px底部遮挡。转动相机不改变世界锚点。共享设置只在推开后仍有至少900px页面时采用push，否则按原逻辑overlay；<=560px紧凑控制仅为极窄电脑窗口的防御布局。

## 响应与生命周期

`chooseScreen` 使用相机世界方向、巨幕中心、真实法线、当前视锥资格与当前/候选角度差，默认 **7°角优势迟滞**。它不是固定切换角，不等待停止或停留时间；候选满足条件即在同一渲染帧提交。

取消原 180ms 识别停留、OrbitControls 惯性、450ms 主辅亮度过渡和 460ms 旧解说残留。相机拖动无人工延迟；主动点站的镜头导航缩短为 120ms，UI 始终读取实际相机。面板没有位置或文字过渡。只在激活 ID 变化时 `flushSync` 提交 React 当前标题、编号、导航和解说；高频矩阵由引用写入，不逐帧重绘 React。

原稳定四视频与每路 revision 机制继续隔离异步播放：UI 不等待加载或 `play()` 成功，过期操作不能覆盖当前音轨/状态。自转开关只控制醒狮，不旋转相机。世界 DOM 与场景同生命周期，离页清理；平面模式隐藏世界层并暂停 3D，回到巨幕复用同组面板。

`frame-id` / `spatial-frame-id`、面板 `data-spatial-frame` 是每帧轻量诊断；原 `data-composition` / 模型统计的 180ms 采样只用于审查，不参与识别、投影或 UI 反馈。

## 验收入口

```powershell
npm test
npm run build
npx playwright test tests/e2e/action-spatial-ui.spec.js
npx playwright test --config playwright.preview.config.js tests/e2e/action.spec.js tests/e2e/action-player.spec.js tests/e2e/action-theater.spec.js tests/e2e/action-theater-ornate.spec.js tests/e2e/action-theater-integrated.spec.js tests/e2e/action-spatial-ui.spec.js
node scripts/audit_action_spatial_ui.mjs
```

新增专项以真实 `page.mouse` 输入测试 90°/180°、边界反复、第一帧矩阵变化、同帧内容/导航/高亮、透视命中、不误拖、自转隔离、迟到播放和离页释放。相机静止/移动以数值位移判断，排除约 1e-14 米浮点舍入；不是延迟或视觉放宽。

最终实际结果、环境与未覆盖范围见[验收记录](action-spatial-ui-2026-10-21-validation.json)；截图在 [本轮图集](../reviews/action-theater/2026-10-21-floating-ui/)。历史测试与首轮失败不计入最终通过。完整模型与全部毛发保持，不用删减数据换取帧率；本机 RAF 间隔不是所有硬件的 60FPS 保证。

2026-10-21最终实际结果：资产/核心60/60、330模块构建；Chrome生产相关30个不同用例分批通过（首批27、修正媒体资格与姿态假设的两项各重复两次共4/4、布局修复后7/7含新增第30项）。7张最终生产图已逐张查看，实际90°/180°鼠标拖动与288帧采样均无相机/UI帧号错配。RTX5070Ti本机实际绘制约132FPS，中位帧间隔5.6ms、P95为11.2ms；只描述本机观测，不替代其他设备/60Hz端到端延迟验收。538条资产保留全部530条原记录，仅新增参考图与7张审查图；124份public/dist原字节一致。

首轮失败已单独保留：尾段seek曾持续readyState=1约14秒，期间UI继续逐帧绘制；循环测试改以真实呈现尾帧→回绕→后续推进锁存证明，媒体资格单独限30秒，播放器产品逻辑未改。两次呈现PTS均为7.666667→0→0.083333秒。倾角标题从90°仍可见符合实际空间，最终检查固定锚点与270°背面隐藏。最初审查脚本误把小于900px的设置推开当实际场景、并在sandbox内读存储，已修脚本且最终audit错误为空。
