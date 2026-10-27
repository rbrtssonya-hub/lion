# 狮相万象 / THE LION ATLAS

基于用户真实醒狮模型的桌面交互展示，使用 React、Vite、Three.js 和 GSAP。首页呈现完整模型及六个艺术图入口，左上角无印章图标；模型节点不拆解、不位移。

点击眉目、额冠、鬃须、织锦、云边或口齿后，相机在整窗三维画面中飞向相应部位，再原地过渡到该镜头对应的宽屏艺术图。模型隐藏并暂停后，图片等比缩小、贴齐左上，底部图标同步左移；右侧保留空白展示区域。返回时按相反顺序回到原整体视角。

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

`dist/` 需通过 HTTP 服务访问，不能直接双击 HTML。运行时资源包括模型、Draco 解码器、字体、六张导航图片和全屏主图；网页无后端或外部运行时 API。

## 全屏图片与构图

六个部位各有四张针对桌面比例生成的独立主图，分别适配 16:10、16:9、约 1.882:1 和约 2.37:1 超宽窗口。文件位于 `public/images/fullscreen/` 及其 `16x10/`、`16x9/`、`ultrawide/` 子目录；六个 PNG 艺术入口位于 `public/images/navigation/`。图片由内置 image_gen 分别生成，构图依据真实模型的各部位镜头终点；完整提示词与生成来源见 [IMAGE_PROMPTS.md](artifacts/fullscreen/IMAGE_PROMPTS.md)。

网站选择与窗口比例最接近的主图，以 `contain` 完整、等比显示，不对主图使用模糊扩边、拖尾或裁切。用户确认：当窗口比例介于素材比例之间时，可以在边缘保留少量纯色留白；若主体延伸到原图边缘，该留白处可能看见图像边界。各图依真实三维参考生成，材质与局部轮廓有艺术转译，不能声称与模型逐像素一致，也不是实测或历史照片。

`src/interaction/layout.mjs` 选择素材比例并计算画幅，`LionWorld.resize()` 以相同登记光圈向窗口边缘扩展三维视口。镜头位置、目标和 FOV 沿用 `public/data/handoff-cameras.json` 的登记终点；窗口缩放时更新投影与画幅。真实模型及生成参考见 `source/`、`public/models/lion.glb` 和 `artifacts/fullscreen/reference*/`。

## 交互与保留资源

- 首页支持拖动旋转、滚轮缩放、点击已映射的模型表面，以及六个底部图标。`Esc` 或“返回整体”回到原整体视角；左右方向键切换章节。
- 图片完全替换模型后才移动至左上；快速改选和返回会取消旧动画。模型只加载一次，图片阶段暂停三维渲染，返回时复用。
- 各章右侧文化面板、标题、页签、文字和图解不再显示；原 `CulturalPanel.jsx`、文化素材及分析算法仍在工程内作为历史资源，并非当前界面。
- 原始 `source/科比blend.blend` 不覆盖，GLB 为网页派生资产。源模型存在破面，部分毛发和程序材质不能原样导出，详见 [MODEL_AUDIT.md](MODEL_AUDIT.md)。

## 项目入口

| 路径 | 作用 |
| --- | --- |
| `src/components/AtlasExperience.jsx` | 章节选择、图像切换、GSAP 交接、返回与空白展示区 |
| `src/components/ModelCanvas.jsx`、`src/model/LionWorld.js` | 三维加载、相机、拾取、渲染和暂停 |
| `src/interaction/layout.mjs` | 桌面比例选择、图像和相机登记、版面计算 |
| `src/content/parts.js`、`src/content/chapters.js` | 部位映射、主图和图注 |
| `artifacts/fullscreen/IMAGE_PROMPTS.md` | 本轮生图提示、来源和原生尺寸 |
| `wiki_memory/README.md`、`AGENTS.md` | 工程记忆协议及逐轮本地提交约束 |

## 检查

```powershell
npm test
npm run build
# 在另一终端启动开发服务后，按服务实际端口设置：
$env:ATLAS_URL = 'http://127.0.0.1:5173'
npm run test:browser
node tests/viewport-browser.mjs
```

开发浏览器脚本可用 `ATLAS_EVIDENCE` 指定输出目录。生产预览可运行 `node tests/production-transition-browser.mjs`，并通过 `ATLAS_URL` 指定预览地址。历史文化页和旧版 3:2 检查记录保留于 `artifacts/enrichment/`、`artifacts/transition/` 和 `artifacts/viewport/`，不代表当前右侧界面。
