# 原神态页面测试归档

2026-10-28，用户明确要求以独立 V7 醒狮八态纵深图鉴替换原 ExpressionPage。原三栏简介/详情、三组神态并排对照、进入页面自动整图反应、原图局部 DOM/WAAPI 五官驱动，已不属于现行页面交互。可调点击缩放已移植为当前 Canvas 狮头反馈，仍有真实参数回归。

本目录保留替换前 7 个专项文件的原始字节。文件从 `tests/e2e/` 移入本目录，不添加 `skip`，不制造旧选择器兼容层。Playwright 的 `testDir` 仍为 `tests/e2e`，因此这些历史契约不会作为现行产品测试执行。Git 可追溯原文件、移动和替换原因；文件名仍保留 `.spec.js`，仅用于查阅旧行为，不应直接作为新页面验收入口。

## 原文件与字节校验

移动前后均计算 SHA-256 并确认一致。以下哈希对应原始归档字节：

| 原 `tests/e2e/` 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| expression.spec.js | 27884 | ad156767eb067d94bc9d2ebc9cbe622d9c427cd4395d4942abac93461590e696 |
| expression-motion.spec.js | 9109 | a6a76bbb06f576b671409d71e385c0d0c292c10e10f615cf8b3a19208b12db0d |
| expression-reactions.spec.js | 10316 | fc30b4da47316480972d8fc6068779c4ad7fa97abb99c68c526a7b17e8557271 |
| expression-click-feedback.spec.js | 13420 | b5e842eb0a2a3fcc7fb3901000de52654beb927001e730822208855df5787320 |
| expression-eight-face.spec.js | 15528 | 2c9014ad1d3514642bddc856b731c8108529fa17c3b7e7a8ab53dd1ac006e264 |
| expression-surprise-face.spec.js | 9730 | 7933538e0d4b0beb9e6b5ccd9ac73732d472dd099ab88b997770b2b11f72f5ae |
| expression-hover.spec.js | 4603 | 643f0f6403a3d6a2a094bb2707b574a89c2f170d0e66c8a789e04e136f5eaf79 |

## 现行 15 项 V7 专项映射

下表说明测试定义和职责，不代表表中所有测试已在某次交付运行通过；实际命令、环境、结果与证据以本轮交付记录为准。以下路径均相对工程根目录。

| 序号 | 现行 `tests/e2e/` 用例 | 替换后的验收契约 |
| ---: | --- | --- |
| 1 | expression-depth.spec.js：V7八态目录只移动镜头，保持原站距、40px路线标记和唯一主站顶栏 | 八态目录保持主站路由和唯一顶栏；只导航相机，不触发入场五官播放；保持原空间距离与路线标记。 |
| 2 | expression-depth.spec.js：八态均由真实Canvas点击触发原三秒五官，再打开仅本态解读 | 8 态逐一验证真实 Canvas 命中、眉眼狮口 3 秒播放、完成后仅打开本态解读。 |
| 3 | expression-depth.spec.js：五官播放期间实际合成帧保持完整红色狮头，没有整幅消失闪烁 | 检查真实合成截图中的狮头像素，覆盖原局部动画静态图/分层图衔接风险。 |
| 4 | expression-depth.spec.js：原顶栏可在播放期间离开，返回无旧解读、音轨、WAAPI驱动，返回戏台有效 | 章间导航与卸载释放、重入无旧动画/音轨/弹层、返回戏台闭环。 |
| 5 | expression-depth.spec.js：滚轮正向推进与反向回退沿同一镜头和空间路线，不改变主站hash | 实际滚轮的正反向镜头、空间路径及不改 Hash，替代旧三栏的“一手势切一态”。 |
| 6 | expression-depth-settings.spec.js：八态七项设置驱动真实场景、巡游时序和设置保存取消事务 | 运镜/阅读时间、图像/文字比例、节点尺寸、指针强度、滚轮速度均验证真实效果；预览、保存、刷新、取消恢复。 |
| 7 | expression-depth-layout.spec.js：电脑纵深排版 1440x900 | 卷首标题字图、喜怒图文、回望、当前态弹层的真实边界和可读性。 |
| 8 | expression-depth-layout.spec.js：电脑纵深排版 1920x1080 | 同上，在常用大屏尺寸验收。 |
| 9 | expression-depth-layout.spec.js：电脑纵深排版 1366x768 | 同上，在笔记本常用尺寸验收。 |
| 10 | expression-depth-layout.spec.js：电脑纵深排版 1280x720 | 同上，在较低电脑窗口验收。 |
| 11 | expression-depth-layout.spec.js：电脑纵深排版 715x616 | 同上，验证较窄电脑窗口中模块实际 700×500 可用边界；不扩为手机专项。 |
| 12 | expression-depth-layout.spec.js：设置推开后保留完整八态；简介与详情16→32字号实际增大 | 原设置侧栏推开与真实字号缩放继续覆盖，使用新 project-copy 和 gallery。 |
| 13 | expression-depth-tour.spec.js：默认巡游从卷首走完八态，真实3秒五官、12秒解读、6秒运镜及八段自然完播旁白 | 完整巡游八站，真实点击、五官、阅读、运镜与原生旁白自然结束的时序。 |
| 14 | expression-depth-tour.spec.js：reduced兜底可打开本态解读，visibilitychange暂停读秒且手动继续后恢复 | 减少动态降级可读、模拟文档可见性事件暂停与显式恢复；该事件不等同真实 OS 切窗。 |
| 15 | expression-depth-tour.spec.js：static兜底可打开本态解读，visibilitychange暂停读秒且手动继续后恢复 | 无 WebGL 静态降级的同等阅读与巡游恢复契约。 |

## 保留的主站混合测试

- `tests/e2e/chapter-identity.spec.js`：四章章号保持；神态使用 V7 卷首标题、八态侧轨和主站“舞”章高亮识别，后台模型等待不能遮挡图鉴。
- `tests/e2e/content-comparison.spec.js`：造章类型对照用例保留。旧三组神态对照改为仅当前态解读、背景滚动锁、键盘焦点圈定、Escape/背板关闭恢复焦点；结构观察跳转、返回部位、浏览器历史、相机/滚动恢复的旧断言保留，当前执行限制见下节。
- `tests/e2e/developer-settings.spec.js`：只迁移神态相关入口与断言。原底板六参数、简介/解读字号边界、保存/刷新/恢复默认，以及透明材质下文字保留，继续作用于真实 project-copy / gallery；顶栏字体和视频/模型实例要求保留。

现行专项命令示例：`npx playwright test tests/e2e/expression-depth.spec.js tests/e2e/expression-depth-settings.spec.js tests/e2e/expression-depth-layout.spec.js tests/e2e/expression-depth-tour.spec.js --grep-invert 手机`。生产预览使用 `--config playwright.preview.config.js` 与适用的 `PLAYWRIGHT_PREVIEW_PORT`；执行结果必须另外记录。

## 保留的旧模型前置与验证边界

2026-10-28 在 Chrome、生产预览 4187 运行混合回归时，7 项保留用例在到达新神态断言之前被原模型前置阻断：四章综合识别的 2 种窗口、后台模型等待、3 项结构观察往返，以及设置/视频/模型实例综合用例。它们依赖的 `.chapter-identity[data-chapter-identity="model"]`、`#modelStatus`、`#modelHotspots` 等属于旧模型界面，当前 `ModelPage` 已使用 atlas 界面。旧 `StructureReadingPanel` 的观察按钮源码仍在，但不能据此声称当前页面可达或已经验证模型返回闭环。

这些模型断言没有在本次 V7 迁移中删除、跳过或伪造兼容选择器，也不计作通过。神态本身的章节归属与卷首/目录识别另以 1920、1440 的独立用例执行，避免被上述旧模型前置遮蔽。本目录归档范围仅是前述 7 个纯旧神态专项文件，不包含这 7 项模型混合用例。
