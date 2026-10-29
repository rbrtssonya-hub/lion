# V7 验证与交付记录

日期：2026-10-28。范围：`F:\数媒竞赛\醒狮八态纵深独立版`，电脑端Chrome。此目录为无Git元数据的独立工程，主网站未接入本轮代码、未对主站其他任务改动提交或推送。

## 已落实的用户要求

- 到站保持静止；点当前主狮头或“观狮头”按钮才播放约3秒原五官动作，自然完成后打开对应解读。离站不自动播放，重复点击不叠加。
- 自动巡游沿原滚动路线缓慢前行，约6秒/站；抵达八态后等点击，解读停留12秒，自动收起再前往下一态。面板内可提前继续，关闭/Esc亦提前继续。
- 解读只显示当前一态；去掉上一态/下一态、底部八态tabs及左右键切态。
- 页面隐藏暂停巡游与阅读倒计时，回到页面后明确继续；动效中滚轮/隐藏/导航接管取消请求，不会弹旧态，恢复后可重新点。
- 路径图标先生成审稿。第一版印记未获批准；用户要求Q版后生成新候选，收到“通过，替换成这张”才替换。真实透明PNG、40px屏幕尺寸、原轨迹和反向追踪保留。
- 暖纸背景、朱砂飞白标题、八态主图片、侧栏选态对应缩略图、原相机空间和站距保持。

## 闪烁根因与修复

Card的JSX每次重渲染都会重新赋入`userData.opacity=0`，Face在Card更新之前读取此值，造成五官材质透明；逻辑playing仍true，因此仅检查状态会漏报。现将userData稳定化，Card更新优先级设为-0.5，保证在Camera(-2)、路径(-1)之后、Face(0)之前计算当帧透明度。保留原五官分层、补绘、轮廓、枢轴、幅度和原生WAAPI时序。

旧版RED实跑未点击playCount=1，预期0，失败证据`v7/tour-reading-red.json`。修复后正式构建通过点击、矩阵、实际截图像素与自然完成链路。

## 实际运行的验证

发布预览：http://127.0.0.1:5198/（随包dist静态服务）。三个测试组累计40项通过、0失败、0 flaky、0 skipped；开发版中间失败未作为发布结果。

| 组 | 实际命令/配置 | 结果与证据 |
| --- | --- | --- |
| 全路线和纵深 | `V7_BEHAVIOR_BASE_URL=http://127.0.0.1:5198 npx playwright test --config review/v7/behavior.config.ts` | 13 passed；`v7/behavior-build.json` |
| 支持功能 | `npx playwright test tests/tour-reading.spec.ts tests/tour-narration.spec.ts tests/narration.spec.ts tests/gallery-current-only.spec.ts tests/interaction-cancel.spec.ts tests/v4.spec.ts tests/journey.spec.ts tests/culture.spec.ts tests/v5-presentation.spec.ts --reporter=list,json` | 24 passed；`v7/support-build-results.json` |
| 面部专项 | `npx playwright test tests/face-motion.spec.ts --reporter=list,json`（FACE_TEST_URL未设，默认5198） | 3 passed；`v7/face-build-results.json` |
| 构建 | `npm run build` | tsc通过、605 modules构建通过；保留Three核心736.69KB原体积提示 |
| 资产 | `node scripts/verify-assets.mjs` | 图片/背景/3套字体/8段旁白/已审Q图标/字谱/补绘 public与dist SHA一致；来源快照通过 |
| 字体 | `python scripts/update-font-subsets.py --update`之后`--check` | 3套官方本地字体补齐新提示语字符；当前源码汉字缺字0；Noto全部551请求字符覆盖，毛笔符号后备记录保留 |
| 最终浏览器 | `node scripts/review-v7.mjs` | 最终新字体实际解码、HTTP字体哈希一致、到站播放次数0、Q图标40px、点后本态弹窗、pageerror0；`v7/final-browser-smoke.json` |

全八态真实阶段计时：动作3004–3008ms，阅读12000–12082ms；旁白均自然结束后离站。证据`v7/auto-tour-stations.json`包括8站camera、点击、阶段、音频记录。原八站Z：-28/-64/-100/-136/-172/-208/-244/-280，终点-318；原36单位站距和FOV40、透视、逆滚、相邻两态过渡回归通过。

面部专项正式构建实际截16帧，约113–2438ms，5个部件每帧rendered=true；红像素20421–21078、静态19144，没有整头消失。`v7/face-visible-frames.json`、`v7/eight-state-face-motion.json`和8态现场截图可核验。此前开发版更长范围15帧也通过，最终发布JSON以最近正式构建运行结果为准。

画面实测1920×1080、1440×900、1366×768；最终新字体后又目视1920主页面及当前态解读，无切态入口。截图：`v7/final-home-1920.png`、`v7/final-joy-q-marker-1920.png`、`v7/final-current-reading-1920.png`。字体更新后的最终构建JS/CSS哈希与完整流程验证时一致，仅字体字节刷新；最终HTTP哈希和浏览器解码另行核验。

## 修改与来源审查

主要实现：App请求去重与当前解读；useAutoTour的moving/viewing/animating/reading阶段；useScrollExperience可选巡游timing；Scene/LionFace显式token和可见性；ProjectGallery当前态；SpatialThread批准的Q图标。未新增npm依赖。

`motion.ts`原字节相同，原绝对滚动采样函数与手动导航默认参数均保留；useScrollExperience因增加可选timing不再声明整文件字节相同。相机坐标/路径以公式回归和实际浏览器证据核验。

Q图标SHA-256：`75e844450406311cb43c3e47931bd8c7d6696ba3dac9b1c5fd45e7c2ab08cf26`。提示词与用户审核记录在`reference/UI-MARKER-SOURCE.json`。内置image_gen未提供模型版本选择，因此未确认“Image2”具体版本。原用户图片与旧路线图标保留。

回归中两个旧辅助测试仍向v5目录输出：已将本轮结果保存v7，从V6.1交付包恢复5份历史文件原字节，相关测试输出已统一V7；处理清单`v7/historical-evidence-restoration.json`。以V7报告作为当前验收，不混用V5/V6历史结论。

## 使用与边界

双击根runStart.cmd，或打开5198。先点目录任一态，点击大狮头看动作和当前解读；测试巡游时点击顶部自动巡游，到每态后点狮头继续流程。静态/减少动态/WebGL后备保留可读图片，点击直接解读，不模拟五官运动。

本轮验证只针对电脑Chrome，不保证所有显卡性能。主图和Q图标均属AI辅助示意，八态仍是本项目定性观察框架，等待真实表演样本校核。开发依赖不入ZIP；随包源码、运行资产、dist、说明和验证证据可独立交接。
