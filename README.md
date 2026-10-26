# 狮相万象 / THE LION ATLAS

基于用户真实醒狮模型的桌面交互展览。技术栈：React、Vite、Three.js、GSAP。

工程记忆采用 standard 模式，入口为 [wiki_memory/README.md](wiki_memory/README.md)，日常维护遵循项目内协议。根目录 [AGENTS.md](AGENTS.md) 保存“每次完整对话的有效修改都要提交到本地 Git”的约束。

**完整模型首页 → 六个艺术图控件 → 相机移动到部位 → 同构图交叉淡化为独立图片 → 右侧文化图解与形态数据。**

首页只呈现完整醒狮与六个艺术图选择控件，已移除左上角印章图标。进入章节后，完整主图与右侧双页签阅读区共同呈现文化内容；真实模型隐藏并暂停渲染。三维节点始终保持原位。体验重点为桌面浏览器，本轮没有手机端优化。

## 运行

需要 Node.js 22.12+，建议 Node.js 24。当前工作目录已安装依赖。

```powershell
npm install
npm run dev
```

访问终端输出的本地地址。Vite 默认使用 `http://127.0.0.1:5173/`，端口被占用时会递增；本轮开发实例使用 `5175`。也可双击根目录的 `启动网页.cmd`，再打开它显示的地址。

```powershell
npm run build
npm run preview
```

`dist/` 为静态生产文件，需经 HTTP 服务访问。部署时应完整保留 GLB、Draco 解码器、三组共十八张当前图片及字体；仅双击 `dist/index.html` 无法正确载入根路径资源。网页没有后端、账号或外部运行时 API。首次模型载入约 35 MB，之后可由浏览器缓存。

## 使用流程

1. 在首页拖动模型旋转，滚轮缩放；右下角复位按钮恢复整体视角。
2. 点击下方六个控件，或点击模型中已有映射的可识别表面。
3. 相机飞向对应局部，三维画幅同时平移到页面左侧。相机到达为该章节预先确定的终点后，在同一画幅中淡入相应生成图片。
4. 交接完成后，三维层设为 `visibility: hidden`、`opacity: 0`，并调用 `setActive(false)` 停止其 RAF 渲染循环。完整图片以 `object-fit: contain` 显示，不做网页裁切。
5. 右侧标题此时才通过 GSAP 逐字进入。默认“文化图解”页呈现新生成的艺术图、编号点击区、分项解说、文化背景和来源；点击图中编号或图下分项，解说更新并自动滚入阅读区。
6. “形态数据”页呈现实际网格分析、图例、方法、构件数量、宽高比、三轴尺寸及样本口径；织锦另有实际 UV 与按三角表面积估计的贴图色带。右侧内容可独立滚动，页签切换会回到内容顶部。
7. “返回整体”或 `Esc` 反向衔接回真实模型，恢复第一次进入章节前的整体镜头。页签获得焦点时，左右方向键切换页签，`Home / End` 到首尾页签；其他位置的左右方向键切换章节。快速连续选择以最后一次操作为准。

图片为 **AI 造型转译**，不是模型实测截图或历史工艺照片。生成过程保持主要视角、主体位置和尺度，但材质细化及局部形状存在细部视觉差异。相同镜头终点与平滑淡化用于构图衔接，不宣称逐像素完全相同。

## 六个控件与十八张当前图片

每个部位有三种不同用途的图片：底部艺术入口、左侧相机衔接主图、右侧文化图解。本轮新增六张导航图与六张文化图解，分别调用内置 `image_gen` 生成，已接入界面；导航入口使用真实 PNG，不再调用 `PartGlyph` 代码图标。原有六张主图和相机配置保持不变。

| 控件 | 独立图片 | 相机终点构图 | 右侧真实分析 |
| --- | --- | --- | --- |
| 01 眉目 | `public/images/chapters/brows.png` | 斜前眉眼特写 | 眉饰径向包络 |
| 02 额冠 | `public/images/chapters/crown.png` | 高位斜视冠饰与额珠 | 构件中心及相对宽度 |
| 03 鬃须 | `public/images/chapters/beard.png` | 低侧垂须与前部局部 | 分轴采样宽度 |
| 04 织锦 | `public/images/chapters/body.png` | 身体近侧视、横向织锦 | 实际主 UV 样本 |
| 05 云边 | `public/images/chapters/trim.png` | 后上方红色边饰与白尾 | 宽度序列及移动平均 |
| 06 口齿 | `public/images/chapters/mouth.png` | 正前低位牙弧与舌面 | 真实构件中心投影 |

六张输出均为 1536 × 1024 PNG。原始构图参考来自 Three.js 的 1200 × 800 实际相机终点截图。原先的 `gaze-study.png`、`mane-study.png`、`textile-study.png` 作为旧版资产保留，当前界面不引用它们。

| 部位 | 新导航图 | 新文化图解与交互分项 |
| --- | --- | --- |
| 眉目 | `public/images/navigation/brows.png` | `public/images/culture/brows.png`：静观、睁眼、凝视，横向三组神态 |
| 额冠 | `public/images/navigation/crown.png` | `public/images/culture/crown.png`：扎架、裱糊、彩绘、装饰，2×2工艺图 |
| 鬃须 | `public/images/navigation/beard.png` | `public/images/culture/beard.png`：垂落、牵引、回摆，横向三种须势 |
| 织锦 | `public/images/navigation/body.png` | `public/images/culture/body.png`：单元、重复、披覆，横向纹样研究 |
| 云边 | `public/images/navigation/trim.png` | `public/images/culture/trim.png`：舒展、折叠、起伏，上中下三行 |
| 口齿 | `public/images/navigation/mouth.png` | `public/images/culture/mouth.png`：敛口、微启、张口，横向状态对照 |

所有新图均保留原始生成 PNG 字节，通过 `contain` 完整显示。编号、交互区域、精确文字、数据图与图例由代码实现。图像中的状态变化为艺术示意；工艺图概述传统制作，不表示拆开当前模型。十二张新增图的完整提示词、原始路径与最终路径见 [IMAGE_PROMPTS.md](artifacts/enrichment/IMAGE_PROMPTS.md)，大小、尺寸和 SHA-256 见 `artifacts/enrichment/asset-manifest.json`。

文化内容以 [中国非物质文化遗产网](https://www.ihchina.cn/project_details/12869)、[澳门政府新闻局](https://www.gcs.gov.mo/news/detail/zh-hans/M24AXfoWOo)、南海博物馆的[佛鹤狮头制作](https://www.nhmuseum.org/fei-yi/1575.html)与[采青技艺](https://www.nhmuseum.org/fei-yi/1580.html)为依据。“静观、凝视”等为本页读图标签，不作为固定传统套路；佛鹤制作和南海采青的地方资料不扩大为所有流派的统一规则。

## 画幅与相机交接

`src/interaction/layout.mjs` 令画幅宽度取 3 的整数倍、高度取对应 2 的整数倍；Three.js 相机使用精确 `aspect = 1.5`。首页与章节状态保持画幅宽高一致，仅改变其页面位置。生成图片、三维终点与显示容器因此共享一个 3:2 光学取景范围。

`LionWorld.js` 中的 `HANDOFF_FRAMINGS` 为六部位指定方向、按真实部位包围盒计算的目标偏移及观察距离。`public/data/handoff-cameras.json` 保存生成参考时的实际 `position / target / fov / aspect`，用于复核镜头与图片的构图关系。修改模型、镜头、FOV 或这些配置后，应重新抓取参考并生成对应图片。

主要交接 API：

```js
await world.flyToPart(id, { duration: 2.15 }); // 返回 { completed: boolean }
world.cancelFlight();                      // 旧 Promise 完成为 false
world.setInteractive(false);                // 禁拾取、拖动并清除悬停材质
world.setActive(false);                     // 暂停三维 RAF，保留资源用于返回
await world.restoreOverview({ duration: 1.65 });
```

`AtlasExperience` 用递增 `epoch`、可取消 GSAP tween 和相机 Promise 隔离过期任务。返回途中再次选章节时，始终保留第一次进入前的整体镜头。图片读取失败会取消过期过渡，回到居中、可操作的完整模型。

## 工程组织

```text
source/                              原始 Blender 与视频，保留不覆盖
public/models/lion.glb                真实模型的网页派生资产
public/images/chapters/               六张当前章节图片，逐控件独立
public/images/navigation/             六张新增 image_gen 艺术入口图
public/images/culture/                六张新增 image_gen 文化图解
public/data/handoff-cameras.json       生成参考时的实际终点与画幅记录
public/data/                          模型审计及预计算资料
public/draco/                         本地 Draco WASM 解码器
public/fonts/                         霞鹜文楷子集与 OFL 许可证
src/components/AtlasExperience.jsx    选择、相机、图片与返回的状态流程
src/components/ModelCanvas.jsx        唯一真实模型画布
src/components/CulturalPanel.jsx      GSAP 标题、文化分项、双页签与真实数据图
src/interaction/layout.mjs            固定 3:2 画幅与桌面版面
src/content/chapters.js               六张独立图片 URL、叙事与图形标签
src/content/culture.js                六章图解步骤、文化背景、方法与机构来源
src/content/parts.js                  模型部位匹配及文化来源
src/model/LionWorld.js                Three.js、相机飞行、暂停和资源释放
src/model/PartRegistry.js             真实部位测量与缓存
src/analysis/                        几何、UV、纹理采样算法
scripts/capture-handoff.mjs            1200×800 相机参考捕获脚本
artifacts/handoff/references/          六个终点原始截图
artifacts/handoff/PROMPTS_ONE.md       眉目、额冠、鬃须完整生图提示词
artifacts/handoff/PROMPTS_TWO.md       织锦、云边、口齿完整生图提示词
artifacts/handoff/screenshots/         相机交接阶段的截图与回归记录
artifacts/enrichment/                 本轮新增素材、提示词与图文界面验证
tests/enrichment-browser.mjs          六章导航图、文化分项与数据页检查
```

`parts.js` 决定测量范围，`chapters.js` 决定主图和标题，`culture.js` 决定文化图解与资料。glTF 多材质 Mesh 的元数据从父组传给 primitive；构件按 `sourceName` 聚合，避免把材质 primitive 当作多个原始对象。眼部与头壳融合，头壳点击进入眉目章节，但测量只取真实眉饰。

## 模型和数据边界

- 原场景有 53 个原生 Mesh、49 个轴心，无骨骼和动画；原文件 SHA-256 与完整清单见 `MODEL_AUDIT.md`。
- 网页 GLB 约 35.16 MB，含原生几何与从真实曲线、父毛路径派生的毛发，约 162 万三角面。Blender 的全部子毛与程序化微织纹没有逐根还原。
- 原模型的共面发射面使用运行时材质 `polygonOffset` 减轻闪烁，原生顶点和部件位置保持不变。未重新制作或修复所有源破面。
- 几何分析按章节缓存；完整包围盒逐原生顶点测量，轮廓和分箱最多采用 7,000 个顶点样本。织锦 UV 数据来自实际网格，读取纹理时使用原始材质，避免受显示状态污染。
- 图片展示阶段停止三维渲染。返回时复用已加载模型，不重新下载 GLB。渲染期使用 DPR 上限 1.6、1024 阴影和 BVH 拾取。
- 图片中的铅笔曲线、材料细化和工艺意象不作为测量或历史证据；文化资料从机构来源作简短转述，各章节保留链接。

详细说明见 [MODEL_AUDIT.md](MODEL_AUDIT.md) 与 [VISUALIZATION_DESIGN.md](VISUALIZATION_DESIGN.md)。主图生成记录位于 `artifacts/handoff/`，本轮新增图标及文化图解记录位于 `artifacts/enrichment/`。

## 检查

```powershell
npm test
npx playwright install chromium
# 先在另一个终端启动 npm run dev：
npm run test:browser
```

`npm run test:browser` 执行 `tests/handoff-browser.mjs`，默认访问 `http://127.0.0.1:5175`。若终端提供其他端口：

```powershell
$env:ATLAS_URL = 'http://127.0.0.1:5173'
npm run test:browser
```

`handoff-browser.mjs` 覆盖首页无文化内容、六个独立主图 URL、真实相机运动、登记终点、完整画幅、模型隐藏与暂停、GSAP 文字变化、返回与中断、真实表面点击、桌面窗口及图片失败恢复。这部分用于保留既有镜头交接的回归证据。

新增图文界面检查：

```powershell
$env:ATLAS_URL = 'http://127.0.0.1:5175'
$env:ATLAS_EVIDENCE = 'artifacts/enrichment'
node tests/enrichment-browser.mjs
# 同一脚本检查本轮生产预览（先另开终端运行 npm run preview -- --port 4175）：
$env:ATLAS_URL = 'http://127.0.0.1:4175'
$env:ATLAS_EVIDENCE = 'artifacts/enrichment/production'
node tests/enrichment-browser.mjs
```

新增脚本默认访问 `5175`，检查六张艺术入口图、六章文化图解、编号/分项解说、自动滚动、页签与键盘、数据图、桌面版面和十二张新增资产。`ATLAS_EVIDENCE` 可指定证据目录。构建运行 `npm run build`；`tests/production.mjs` 仍可用于主图静态加载回归，其地址变量为 `ATLAS_PRODUCTION_URL`，默认 `4173`。

相机交接阶段记录见 [handoff 验证记录](artifacts/handoff/VERIFICATION.md)。本轮新增界面的结果以 `artifacts/enrichment/browser-results.json`、`artifacts/enrichment/production/browser-results.json` 及相应截图为准；只将对应版本、对应范围内实际完成的检查作为通过证据。旧版 `artifacts/browser-results.json`、旧性能读数与旧面板截图属于历史版本。

六张相机主图的完整提示词已汇总于 [主图 IMAGE_PROMPTS.md](artifacts/handoff/IMAGE_PROMPTS.md)，路径、大小与 SHA-256 见 `artifacts/handoff/asset-manifest.json`。十二张新增图标与文化图解使用独立的 [新增素材 IMAGE_PROMPTS.md](artifacts/enrichment/IMAGE_PROMPTS.md) 和清单。

字体为 LXGW WenKai / 霞鹜文楷，SIL OFL。修改文案后可用 `python scripts/subset_font.py` 更新子集，或保留系统字体回退。
