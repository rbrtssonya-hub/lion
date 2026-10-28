# 狮相万象 / THE LION ATLAS

基于用户真实醒狮模型的交互式信息可视化展示，使用 React、Vite、Three.js 和 GSAP。首页呈现完整模型及六个艺术图入口，左上角无印章图标；模型节点不拆解、不位移。

点击眉目、额冠、鬃须、织锦、云边或口齿后，相机在整窗三维画面中飞向相应部位，再原地过渡到该镜头对应的宽屏艺术图。模型隐藏并暂停后，图片等比缩小、贴齐左上，底部图标同步左移；右侧显示当前部位对应的一张纵向信息可视化图。点击整张图打开文化讲解浮窗；关闭后仍停留在原章节和相机状态。网页没有拆动或爆炸原始模型。

## 运行

需要 Node.js 22.12 以上，建议 Node.js 24：

```powershell
npm install
npm run dev
```

也可双击 `启动网页.cmd`。以终端输出的本地地址为准，端口被占用时 Vite 会递增。构建和预览：

```powershell
npm run build
npm run preview
```

`dist/` 需通过 HTTP 服务访问，不能直接双击 HTML。运行时资源包括模型、Draco 解码器、字体、六张导航图、六个部位各四档全屏主图和六张信息可视化图；网页无后端或外部运行时 API。

## 全屏图片与构图

六个部位各有四张针对桌面比例生成的独立主图，分别适配 16:10、16:9、约 1.882:1 和约 2.37:1 超宽窗口。文件位于 `public/images/fullscreen/` 及其 `16x10/`、`16x9/`、`ultrawide/` 子目录；六个 PNG 艺术入口位于 `public/images/navigation/`。图片由内置 image_gen 分别生成，构图依据真实模型的各部位镜头终点；完整提示词与生成来源见 [IMAGE_PROMPTS.md](artifacts/fullscreen/IMAGE_PROMPTS.md)。

网站选择与窗口比例最接近的主图，以 `contain` 完整、等比显示，不对主图使用模糊扩边、拖尾或裁切。用户确认：当窗口比例介于素材比例之间时，可以在边缘保留少量纯色留白；若主体延伸到原图边缘，该留白处可能看见图像边界。各图依真实三维参考生成，材质与局部轮廓有艺术转译，不能声称与模型逐像素一致，也不是实测或历史照片。

`src/interaction/layout.mjs` 选择素材比例并计算画幅，`LionWorld.resize()` 以相同登记光圈向窗口边缘扩展三维视口。镜头位置、目标和 FOV 沿用 `public/data/handoff-cameras.json` 的登记终点；窗口缩放时更新投影与画幅。真实模型及生成参考见 `source/`、`public/models/lion.glb` 和 `artifacts/fullscreen/reference*/`。

## 信息可视化与讲解浮窗

六张独立的 ImageGen 竖版图片位于 `public/images/lion-info/`，分别对应眉目、额冠、繁须、织锦、云边和口齿。研究态右侧仅显示当前图版，不叠加可见标题、图注或提示；图像以 `object-fit: contain` 完整呈现，不做模糊扩边、裁切或拉伸。逐张生图提示、模型参考视图和生成记录见 [IMAGE_PROMPTS.md](artifacts/lion-info/IMAGE_PROMPTS.md)。

点击整张图可打开居中文化浮窗，包含形态构成、造型作用、材质与工艺边界、文化资料及细节观察；来源链接位于正文末尾。浮窗支持关闭按钮、遮罩点击、Escape、键盘焦点循环和背景滚动锁定，窄屏改为纵向布局。生成信息图明确标为艺术示意，文化资料与模型观察分开陈述。

## 交互与保留资源

- 首页支持拖动旋转、滚轮缩放、点击已映射的模型表面，以及六个底部图标。`Esc` 或“返回整体”回到原整体视角；左右方向键切换章节。
- 图片完全替换模型后才移动至左上；快速改选和返回会取消旧动画。模型只加载一次，图片阶段暂停三维渲染，返回时复用。
- 文化正文不直接铺在右侧展位上；内容由 `LionDetailModal.jsx` 在用户点击信息图后按需呈现。旧 `CulturalPanel.jsx` 和分析算法仍保留在工程中，但不挂载到当前页面。
- 原始 `source/科比blend.blend` 不覆盖，GLB 为网页派生资产。源模型存在破面，部分毛发和程序材质不能原样导出，详见 [MODEL_AUDIT.md](MODEL_AUDIT.md)。

## 项目入口

| 路径 | 作用 |
| --- | --- |
| `src/components/AtlasExperience.jsx` | 章节选择、图像切换、GSAP 交接、信息图与浮窗状态 |
| `src/components/LionBreakdownStage.jsx`、`LionDetailModal.jsx` | 右侧整图入口与文化讲解浮窗 |
| `src/components/ModelCanvas.jsx`、`src/model/LionWorld.js` | 三维加载、相机、拾取、渲染和暂停 |
| `src/interaction/layout.mjs` | 桌面比例选择、图像和相机登记、版面计算 |
| `src/content/parts.js`、`src/content/chapters.js`、`src/content/lionBreakdowns.js` | 部位映射、主图、图注、文化讲解与资料来源 |
| `artifacts/fullscreen/IMAGE_PROMPTS.md` | 本轮生图提示、来源和原生尺寸 |
| `artifacts/lion-info/IMAGE_PROMPTS.md` | 六张右侧信息可视化图的逐张提示与模型参考 |
| `wiki_memory/README.md`、`AGENTS.md` | 工程记忆协议及逐轮本地提交约束 |

## 检查

```powershell
npm test
npm run build
# 在另一终端启动开发服务后，按服务实际端口设置：
$env:ATLAS_URL = 'http://127.0.0.1:5173'
npm run test:browser
node tests/viewport-browser.mjs
node tests/lion-breakdown-browser.mjs
```

开发浏览器脚本可用 `ATLAS_EVIDENCE` 指定输出目录。生产预览可运行 `node tests/production-transition-browser.mjs`，并通过 `ATLAS_URL` 指定预览地址。历史文化页和旧版 3:2 检查记录保留于 `artifacts/enrichment/`、`artifacts/transition/` 和 `artifacts/viewport/`。
