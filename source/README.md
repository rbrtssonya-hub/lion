# 工程资源目录

`source/` 统一管理媒体、模型、创作源文件、设计文档、审查截图与参考资料。应用代码位于根 `src/`。

| 分类 | 存放内容 | 网页构建 |
| --- | --- | --- |
| `public/assets/entry/` | 首页循环视频、封面、图片标题与透明书法按钮字图 | 复制到 `dist/assets/entry/` |
| `public/assets/intro/` | 当前入场视频与运行海报 | 复制到 `dist/assets/intro/` |
| `public/assets/models/` | 当前网页使用的 GLB 模型 | 复制到 `dist/assets/models/` |
| `public/assets/culture/` | 首页文化图文的四张实拍照片，许可与署名见来源文档 | 复制到 `dist/assets/culture/` |
| `public/assets/lion-book/` | 《岭南醒狮志》七幅透明水彩展开页，AI辅助历史主题示意 | 复制到 `dist/assets/lion-book/` |
| `public/assets/licenses/` | Codrops及ThreeUI运行许可、ThreeUI共享样式内嵌字体的OFL声明 | 复制到 `dist/assets/licenses/` |
| `public/assets/fonts/` | 导航毛笔字体WOFF及随部署保留的OFL许可 | 复制到 `dist/assets/fonts/` |
| `public/assets/backgrounds/` | 用户指定的结构、动作、神态三张PNG背景 | 复制到 `dist/assets/backgrounds/` |
| `public/assets/poster/` | 网页使用的预览与海报 | 复制到 `dist/assets/poster/` |
| `public/assets/live2d/` | 保留的 Live2D 运行包、本地库与许可说明 | 随 publicDir 复制，当前首页不加载 |
| `models/` | 旧运行狮头归档、保留的优化与面部绑定模型版本 | 不复制 |
| `fonts/` | 字体来源、授权说明及子集生成脚本 | 不复制 |
| `live2d/` | 分层图、PSD、Cubism 工程与原始导出 | 不复制 |
| `video/intro/` | 入场视频制作版本、对照海报 | 不复制 |
| `video/entry/` | 替换前的首页循环视频归档 | 不复制 |
| `reviews/homepage/` | 首页视觉审查图 | 不复制 |
| `reviews/video/` | 视频抽帧、接触表、尾帧与动作审查图 | 不复制 |
| `reviews/react-entry/` | 迁移前 React 入口及章节审查截图 | 不复制 |
| `reviews/model/` | 模型页视觉审查图 | 不复制 |
| `reviews/navigation/` | 本轮顶栏、侧栏及拖动交互各版审查图；最终通过版为 `2026-10-12-larger-typography/` | 不复制 |
| `reviews/backgrounds/` | 章节背景及共用导航、推开布局的审查图 | 不复制 |
| `design/` | 设计稿、方案说明与历史实施计划 | 不复制 |
| `references/` | 资料来源说明 | 不复制 |

根 `texture_00.png` 与 Cubism 导出文件归入 `live2d/root-export/`；根首页审查 PNG、视频审查 JPG 和抽帧目录归入 `reviews/`；原 `output/` 中的模型及分层创作文件归入对应 `models/`、`live2d/` 或 `design/`。资源位置以当前目录为准，旧方案中的 `site/`、`output/`、`data/` 路径只供历史追溯。

`public/` 是 Vite 静态资产根目录。相对网页地址 `assets/entry/home-lion-loop.mp4` 对应 `source/public/assets/entry/home-lion-loop.mp4`；文件路径集中维护在 `src/config/assetPaths.js`，`media.js` 补上 Vite 基址。新增素材先区分运行版与创作版，只有需要随网页交付的文件放入 `public/`。

2026-10-19 结构页运行模型为 `public/assets/models/lion-structure-optimized.glb`，从用户指定的 `model/醒狮_保留UV_三角转四边_优化.blend` 导出，通过 `assetPaths.model`/`media.model` 加载。旧 `public/assets/models/lion-overall.glb` 原字节移至 `models/lion-head-overall-v1.glb` 归档，不再进入网页构建。用户原始 Blender 文件仍保留在根 `model/` 作为本次外部输入，未改写、未迁移或提交，不能把它放入运行目录。模型转换、复现和显示边界见 [导出说明](references/lion-structure-model.md)，数值见 [模型记录](references/lion-structure-model.json)，实际交付及验证以 [本轮任务日志](../wiki_memory/日志/功能添加/2026-10-19-结构新模型与部件聚焦.md) 为准。

结构页使用左模型、右部件与资料卡的电脑双栏；六组可见结构由真实网格名前缀和头壳表面区域共同映射，视口内的标签与连线随三维聚焦点投影更新。眼部表面语义不等于独立内部零件，须毛导出外观也不代表原 Blender 毛发系统在网页中运行。旧屏幕百分比热点和结构滑杆不再使用。

同日材质与性能修复已恢复源材质的绒面反射权重，并优化网页几何；贴图原字节和原始 Blender 文件保持。当前 GLB 为20,238,640B、513,600三角，统计及复现以导出记录为准。[同机性能对照](references/2026-10-19-structure-performance.json)记录实际测试方法与设备；最终验证及交付见[修复日志](../wiki_memory/日志/Bug处理/2026-10-19-结构材质与旋转性能修复.md)。

未启用的 Live2D 包保留供后续接入，不代表其视觉问题已解决；继续制作前读 [Live2D 说明](public/assets/live2d/README.md)。动作和神态资料尚未完整补齐，评分章节已移除；历史资料保留，来源边界见 [资料说明](references/sources.md)。

`asset-manifest.json` 逐文件登记二进制素材与审查记录的来源、路径、大小及 SHA256，当前总数以该文件和实际检查为准。2026-10-14史册任务当时登记187条，保留原177条并增加7幅运行PNG与3张电脑审查图；此计数仅为历史快照。七幅内置imagegen插画总13,225,556字节，提示词、实际尺寸和透明边界见 [插画记录](references/lion-book-art-prompts.md)，历史依据、ThreeUI源码与许可见 [史册说明](references/lion-book.md)。审查图在 `reviews/homepage/2026-10-14-lion-book/`。

2026-10-12历史书法任务将清单从137条增至145条，新增书法用户原图、透明运行图及6张首页/导航尺寸审查图，来源、编辑提示词与哈希见 [书法素材说明](references/explore-more-calligraphy.md)。此前背景替换保留原129条，仅新增用户3张原图与5张背景审查图，来源与SHA256见 [章节背景说明](references/chapter-backgrounds.md)。此前45张导航图和字体子集保持不变。字体来源与再生成方式见 [毛笔字体说明](fonts/navigation-brush/README.md)，原版权和OFL许可随WOFF部署。原首页视频已归档到 `video/entry/home-lion-loop-v1.mp4`。运行首页视频来自用户提供的 `E:/数字媒体竞赛/张钧儒/首页/首页.mp4`，原样复制到现有 `home-lion-loop.mp4` 应用路径。文化照片的原始来源、作者和许可见 [文化图文来源](references/home-culture-sources.md)。来源路径、现路径、大小和 SHA256 都需可核对，生成截图使用 `generated:chrome-review/` 标识。`npm test` 检查这些资源是否完整保留；后续主动替换素材时应审核并同步对应记录，保留变更原因。

2026-10-12历史书法与自适应导航审查图在 `reviews/homepage/2026-10-12-centered-calligraphy/`，覆盖1024、1366、1920、2560、390与推开设置；正式浏览器输出为 `tmp/e2e-calligraphy-responsive-dev-final/`、`tmp/e2e-calligraphy-responsive-preview-final/`。此前背景浏览器验收输出在 `tmp/e2e-chapter-backgrounds-dev/`、`tmp/e2e-chapter-backgrounds-preview/`，5张审查图在 `reviews/backgrounds/2026-10-12-chapter-backgrounds/`。此前导航输出为 `tmp/e2e-unified-navigation-dev/`、`tmp/e2e-unified-navigation-preview/`，通过UI图在 `reviews/navigation/2026-10-12-larger-typography/`；首页融合三图仍在 `reviews/homepage/2026-10-12-unified-entry/`。tmp/test-results等运行产物不纳入历史素材快照。

历史方案与设计资料保存原文；当前工程状态由 [工程记忆](../wiki_memory/README.md) 统一维护。
