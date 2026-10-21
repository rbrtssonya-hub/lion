# 结构页宣纸图鉴与六字书法

本轮在 `C:/Users/Administrator/.codex/worktrees/8e26/lion` 实施，从 detached `ce97297` 建立 `codex/structure-atlas-2026-10-21`。起始仅用户 `model/` 未跟踪，继续保留。用户要求直接重构结构页右栏，并实际逐字调用 ImageGen；此次新授权不受历史 E/F 盘任务的实施位置和结构红底板冻结限制约束，不扩大为合并 main、同步其他工作区或重打 EXE。

实现与适用验收已完成：六张真实书法、浅宣纸图鉴与模型联动均已落地，最终 `npm test` 67/67、332 模块生产构建通过，31 个选定电脑 Chrome 案例分阶段均有通过结果；15 张实景审查图、566 条清单及 130 份 public/dist 字节核对完成。完整阶段、环境、哈希与边界见 [validation.json](structure-atlas-2026-10-21-validation.json)。Git 交付以包含本记录的实际提交、最终 upstream 核对及回复为准，不提前记录提交或推送成功。

## 设计依据与边界

完整用户提示词保存于 [brief.md](../design/structure-atlas/2026-10-21/brief.md)，实际附件保存于 [before-reference.png](../design/structure-atlas/2026-10-21/before-reference.png)。附件展示的是旧深红右栏，没有独立的浅色「喜」字面板图。因此浅宣纸、朱砂书法与留白依据用户明确文字要求，并参考项目首页既有文化阅读气质，不声称逐像素复刻未提供的图片。

保留原页面左侧醒狮、透明画布及水墨背景；只改变结构页阅读布局、局部窄窗导航高度和相关设置默认。原模型、全部毛发、HDRI、视频、动作场景与公共导航源码未重制。资料继续说明模型为可见表面分区，纸扎内部与连接只作工艺资料；「模型与资料说明」明确六幅朱砂书法由 AI 辅助生成，用于展陈视觉。

## 六次真实图像生成

本轮使用当前环境内置 `image_gen.imagegen`，依次执行六次独立生成，均设置真实透明背景。每次只生成一个汉字，未从六字合图裁切，也未以字体、Unicode 文字、SVG text 或 CSS 替代大型艺术字。调用提示词、原工具路径及归档位置见 [imagegen.json](../design/structure-atlas/2026-10-21/imagegen.json)。

| 部件 ID | 部件 | 汉字 | 部署 PNG |
| --- | --- | --- | --- |
| `outer_shell` | 彩绘狮头 | 神 | [shen.png](../public/assets/structure/calligraphy/shen.png) |
| `eyes` | 鼓眼与狮眉 | 威 | [wei.png](../public/assets/structure/calligraphy/wei.png) |
| `mirror` | 额饰与狮角 | 冠 | [guan.png](../public/assets/structure/calligraphy/guan.png) |
| `mouth` | 狮嘴 | 启 | [qi.png](../public/assets/structure/calligraphy/qi.png) |
| `fur_and_bells` | 须毛与边饰 | 灵 | [ling.png](../public/assets/structure/calligraphy/ling.png) |
| `lion_cloth` | 狮被与狮尾 | 势 | [shi.png](../public/assets/structure/calligraphy/shi.png) |

六张 ImageGen 原输出均为 1254×1254，原字节归档于 `source/design/structure-atlas/2026-10-21/originals/`。用户明确要求裁剪透明边缘并协调显示大小，因此 [prepare_structure_calligraphy.py](../../scripts/prepare_structure_calligraphy.py) 只按 alpha 边界裁剪、等比缩放并居中留白，不绘制笔画、不调色、不改写原件。运行图统一 1024×1024 RGBA；alpha 范围 0–255，墨迹四周至少留 72px 透明边缘。尺寸、原裁切范围、alpha 边界、颜色统计及 SHA256 见 [prepared-assets.json](../design/structure-atlas/2026-10-21/prepared-assets.json)。六字已逐张查看并独立复核，未发现错字、额外文字或明显笔画缺损；六份运行 PNG 的实际 SHA 与记录一致，不以透明 padding 代替字形审查。

`assetPaths.js` 登记六个 `calligraphy*` 键，经既有 `media.js` 统一解析部署基址。启动图像预热排除这些图片；`ModelPage` 只有首次激活结构页后才为 `<img>` 赋 `src`，避免首页预挂载请求书法，返回结构继续复用。运行目录只含网页需要的六张 PNG，原输出、提示词、参考图与审查图均不部署。

## 页面与交互

- [StructureReadingPanel.jsx](../../src/features/model/StructureReadingPanel.jsx) 以题签、真实书法图片、部件标题/诗性副标题、引言、三个文化小节和底部翻阅导航组成一页图鉴。取消原两列 01–06 网格与结构/文化标签切换。
- [structure-atlas.js](../../src/data/structure-atlas.js) 按原稳定部件 ID 关联六字、指定副标题和编辑性引言；[lion-structure.json](../../src/data/lion-structure.json) 原结构、材料、连接、文化资料完整保留，通过「形制之美」「匠心之艺」「狮韵之意」及原生 `<details>` 阅读。
- [ModelPage.jsx](../../src/features/model/ModelPage.jsx) 保持唯一 `selectedId`。模型真实表面点选、投影标签与前后翻阅均走 `selectHotspot`，同步图片、资料、选中态和原相机聚焦。选部件停止自转、重置右栏阅读位置；「复原整体」恢复首部件与整体镜头，「自动旋转」及载入状态移到左侧轻工具栏。原眉眼/狮嘴去神态观察与返回保留。
- [model.css](../../src/styles/model.css) 将右栏限制在桌面约 380–420px，题签和页脚固定，中部独立纵向滚动。容器余宽 850px 以上保持双栏；更窄的电脑缩放/设置余宽改为模型在上、图鉴在下，避免挤压模型。书法仅有 160ms、4px 淡入，减少动态偏好关闭动画。此处窄窗防御不等同于手机专项验收。
- 左侧标题增加低对比宣纸题签，投影标签按标题真实高度避让；合法 40% 自定义纸页宽度下，题签、汉字图片、阅读与翻阅导航继续可用。683px 电脑缩放窗口仅在结构路由固定品牌占用 44px、导航使用剩余高度，并核对导航图标及子文字的真实 bounds，避免按钮外框正常但文字越出。

## 材质设置与旧偏好

结构默认材料改为 `#F7F4ED`、透明度 5%、blur 0、圆角 10px，高度最小值 0；宽度原默认 100% 保留。材质通过既有 `--modelOverlay-surface-*` 变量生效，不让面板透明度影响文字和图片。

[surfaceSettings.js](../../src/features/developer-settings/surfaceSettings.js) 新增独立 `structureAtlasVersion: 1` 与 `migrateStructureAtlas`；只有仍等于历史深红默认的各字段才逐项升级，包括旧 `#68170f / 20 / 12 / 24 / 620px`。其他自定义字段保留。标记持久化后，用户再次手选历史值不会重复升级；已有 `readingPaperVersion` 迁移仍保持原来不修改 modelOverlay 的范围。

[useDeveloperSettings.js](../../src/features/developer-settings/useDeveloperSettings.js) 的实际存储恢复链调用新迁移，`restoreDeveloperSettings` 为可验证的纯恢复入口；没有新增依赖或第二套设置存储。

## 实际验证与交付范围

环境为 Windows、Node 24.16.0、npm 12.0.1、Chrome 156.0.8078.47，ANGLE/NVIDIA RTX 5070 Ti/Direct3D11；生产预览为 `http://127.0.0.1:4188`，浏览器单 worker 独占运行。

- `npm ci` 已完成，未修改依赖声明与锁文件。
- 最终 `npm test`：67/67 通过、0 skip/fail，4704.2154ms；包含新增 7 项结构材质/迁移测试。首次核心为 67/67（5219.7612ms），前期结构、旧宣纸与 HDRI 三文件实际 14/14（64.6711ms）。
- 最终 `npm run build`：332 模块成功，输出 CSS `index-BhL_tTxq.css`、模型块 `ModelPage-B9HwzldB.js`；既有 Three.js 大于 500kB chunk 提示保留。
- 原资产清单 538 个记录对象完整保留，新增六张运行字图、六张原输出、一张参考图和十五张审查图，共 566 条；130 份 public 文件与 dist 逐字节一致。模型、全部毛发、HDRI、原视频与原结构资料未改。

浏览器保留全部阶段，不能描述为单轮 31/31：

| 阶段 | 实际结果与处理 |
| --- | --- |
| 图鉴首轮 | 10/11；一项在局部聚焦视锥内错误要求所有发丝都被绘制。测试改为先区分全量载入与视锥绘制、复原整体后核对全量，不删减模型/毛发。 |
| 图鉴复验 | 11/11，138146.63ms。覆盖六张真实 PNG/alpha、真实表面点选与镜头放大、前后循环、自转复原、完整原资料、900/1366/1920、683px、迁移、首页请求隔离和跨章保持。 |
| 旧相关兼容子集 | 18/19；一项对持续移动的投影标签使用 locator.click，因等待 stable 资格超时。改为真实 mouse 坐标点击，并保留实际选中断言。 |
| 最终增量 | 9/9，112187.771ms。包含上述兼容修正、标题/标签避让、合法40%纸宽与桌面布局等受影响范围。 |
| 最终683px导航复验 | 1/1，14916.226ms。目视发现按钮框内子文字溢出后，补结构局部高度预算和图标/文字 bounds，再实际重跑并查看两张 viewport 图。 |

31 个独立选定案例均已有最终通过结果，0 剩余已确认产品缺陷。该范围是结构/完整模型/设置/观察往返/阅读材质相关电脑子集，不是全工程 E2E。完整命令、原失败与最终报告、保护资产哈希和截图见 [机器可读验证](structure-atlas-2026-10-21-validation.json)。十五张真实截图已查看，保存在 [审查目录](../reviews/model/2026-10-21-structure-atlas/)，含六部件、完整资料末尾、三种桌面尺寸、683px上下阅读与40%纸宽。

Git 按根 AGENTS 只提交本任务路径并普通推送当前分支；实际包含本记录的 commit、upstream 与推送结果在最终交付核对，不预编哈希。保留用户 `model/`，不合 main、不改其他 worktree、不打 EXE。未将本机局部 Chrome 结果扩大为其他设备/GPU、手机、其他浏览器、公开托管或 EXE 验收。
