# 艺术入口与文化图解 · 最终核验

日期：2026-10-26。代码及生产文件来自当前工作目录；本轮无外部发布。

| 用户要求 / 保留约束 | 当前实现 | 直接证据 |
| --- | --- | --- |
| 底部图标使用 image-gen 艺术图 | 六个控件均为独立 PNG；当前入口无 SVG 图标 | `src/components/AtlasExperience.jsx`；开发与生产浏览器逐项解码、检查 DOM；`screenshots/home-art-navigation.png` |
| 不要左上图标 | 左上角印章及品牌块已从渲染树移除 | 首页与六个章节 `.corner-sign` 数量均为 0；开发、生产截图 |
| 各部件右侧有更丰富的文化内容 | 六个章节分别提供文化主题、3/4项交互解释、背景、语汇关系与资料链接 | `src/content/culture.js`；浏览器遍历全部 19 个图解分项，文本均不同，点击后解释完整滚入阅读区 |
| 加入图文信息可视化 | 六张文化图分别为眉眼神态、四道制作工序、须饰动势、纹样铺展、布边节律、开口状态；全部可按编号阅读 | `public/images/culture/`；六章默认视图、分项及滚动截图 |
| 结合生图与代码数据图 | 文化页使用生成图与 HTML 标签；数据页保留真实几何图、三轴尺度，织锦另有真实 UV 和贴图面积色带 | 两套浏览器遍历六章数据页，检查非空有效 SVG、正数尺度、真实构件数及织锦多色色带 |
| 模型保持整体 | 源文件不变；节点位置不变；只沿既有镜头交接图片 | SHA-256 见 `production-assets.json`；`artifacts/handoff/browser-results.json` 最新回归 |
| 首页模型、六张主图与平滑交接保留 | 六个相机终点仍匹配登记记录；主图完整 contain；结束后模型隐藏并暂停 | 最新完整 `tests/handoff-browser.mjs` 通过六章、返回、中断、拾取及失败恢复 |
| 桌面展示 | 1280×800、1536×960、1920×1080 交互与版面核验，阅读区独立滚动 | `browser-results.json`、`production/browser-results.json` 与各尺寸截图 |

## 已完成检查

- `npm test`：10/10，覆盖真实几何采样算法、画幅约束及六张既有主图唯一性。
- `node tests/handoff-browser.mjs`：六章全流程回归通过，`quick: false`，无错误。其证据范围为相机与主图交接。
- `node tests/enrichment-browser.mjs`：开发环境 `http://127.0.0.1:5175`，六章及十二张新增素材通过，错误与失败资源均为空。
- 同一增强脚本检查生产预览 `http://127.0.0.1:4175`：六章全通过，包含编号点击后解释可见、页签键盘操作及桌面布局；错误与失败资源均为空。
- `npm run build`：通过。Three.js 块体积警告仍存在，不影响构建；未变更模型加载方案。
- 十二张新增 PNG 均与原始 image_gen 输出字节相同，十二个 SHA 不同，且区别于六张既有主图；生产副本与 public 原图逐字节一致。
- 原始 `.blend` SHA-256 仍为 `CC5F72C3E1A5C330DD64DAF6842720A91A8E21B6909A01B6F6200A8834545F53`。

主代理已目视检查十二张新图、首页、文化页、数据页、分项解释及生产截图；独立代理也检查了六章桌面效果。完整文化图在阅读区内保持 3:2 与 contain，较矮窗口可滚动阅读全文。

## 素材与资料

本轮使用内置 image_gen，分别生成六张 1254×1254 导航艺术图和六张 1536×1024 文化图解。完整实际提示词、生成源路径及项目路径见 [IMAGE_PROMPTS.md](IMAGE_PROMPTS.md)，逐图尺寸及 SHA 见 [asset-manifest.json](asset-manifest.json)。全部原图已保存在项目 `public/images/navigation/` 和 `public/images/culture/`。

文化转述核对了[中国非物质文化遗产网](https://www.ihchina.cn/project_details/12869)、[澳门政府新闻局](https://www.gcs.gov.mo/news/detail/zh-hans/M24AXfoWOo)、[南海博物馆制作资料](https://www.nhmuseum.org/fei-yi/1575.html)和[采青资料](https://www.nhmuseum.org/fei-yi/1580.html)。图解标作艺术示意，不将生图推为历史照片、实测运动或当前数字模型的内部构造；生成图与真实测量分别说明。

当前结果文件 `browser-results.json` 和 `production/browser-results.json` 是本轮界面证据；相机回归以最新 `artifacts/handoff/browser-results.json` 为准。更早根目录 artifacts 的同名记录不用于证明本轮完成。
