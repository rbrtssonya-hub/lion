---
type: knowledge
status: active
updated: 2026-10-28
topic: lion-info-image-generation
sources:
  - "prompt/prompt_01.txt"
  - "artifacts/handoff/references/brows.png"
  - "artifacts/handoff/references/crown.png"
  - "artifacts/handoff/references/beard.png"
  - "artifacts/handoff/references/body.png"
  - "artifacts/handoff/references/trim.png"
  - "artifacts/handoff/references/mouth.png"
  - "public/models/brocade.png"
---

# 信息可视化图版：生成记录

六张图均由内置 ImageGen 分开调用，每次一张，使用实际模型对应部位的渲染近景作为形态参考。织锦图额外使用项目现有纹理图。所有图为艺术示意，不是模型拆件、测量图或历史照片。原始 `.blend` 和网页三维模型均未因生图而改变。

共同标准：竖版约 2:3、暖象牙纸背景、红绒/暖白/金饰的当前模型视觉体系；无文字、编号、图例、UI、水印、模糊带和裁切主体。右侧展位使用 `contain` 完整显示。

| 图版 | 项目资源 | 模型参考 | ImageGen 输出 |
| --- | --- | --- | --- |
| 眉目 | `public/images/lion-info/01-mei-mu.png` | `artifacts/handoff/references/brows.png` | `exec-c89daa26-5d8f-4255-a145-cac57266dcd6.png` |
| 额冠 | `public/images/lion-info/02-e-guan.png` | `artifacts/handoff/references/crown.png` | `exec-2c744c67-5a04-4f16-a418-be1ee09e5138.png` |
| 繁须 | `public/images/lion-info/03-fan-xu.png` | `artifacts/handoff/references/beard.png` | `exec-0ab28cbe-55f8-453c-897b-b000c6dca104.png` |
| 织锦 | `public/images/lion-info/04-zhi-jin.png` | `artifacts/handoff/references/body.png`、`public/models/brocade.png` | `exec-875ab83f-fee5-4c0c-8c6a-33c6bd5be637.png` |
| 云边 | `public/images/lion-info/05-yun-bian.png` | `artifacts/handoff/references/trim.png` | `exec-6821d154-28b7-4e4b-9c06-a6cff8a2f7a9.png` |
| 口齿 | `public/images/lion-info/06-kou-chi.png` | `artifacts/handoff/references/mouth.png` | `exec-dccf9ea2-f5c7-40f4-b56e-3ecf3d9b66d2.png` |

生成源文件保留在当前用户的 `.codex/generated_images/01a17800-52bb-7571-a427-5385b740f19e/`。以下为本轮实际生图输入的中文归档整理版，按语义记录主要约束；原始英文任务提示见 `prompt/prompt_01.txt` 附录及本轮 ImageGen 调用。

## Prompt 01 — 眉目

参考 `artifacts/handoff/references/brows.png`，这是实际醒狮眉眼近景；以它作为造型身份和形状参考，不照搬截图。制作一张约 2:3 竖版、高端博物馆文化展览信息图，聚焦这只广府醒狮的眉眼：深色亮面眼球、红白眼眶、厚实朱红绒眉、附近小型金色环饰与珠饰。保留原有设计关系，不增加无关构件。暖象牙手工纸背景，朱红构造线和克制旧金色；细腻真实的绒毛、眼面、金属和绘饰质感。一个主眼部组合配少量圆形材质放大窗，用克制的空间层次和引线帮助理解，但不要呈现破损或被机械拆坏的实物。主体完整入画并留出边距。柔和方向展陈光。图片是基于模型视图的艺术转译，不是实测图。禁止任何文字、字母、数字、标注、图例、标志、水印、UI、网页截图、绿色块、拼贴网格、模糊带、运动模糊、拖尾、裁切主体、卡通质感、过塑料质感和虚构解剖结构。只生成一张完整图片。

## Prompt 02 — 额冠

参考 `artifacts/handoff/references/crown.png`，使用实际狮头额冠近景作为主要造型参考。制作一张约 2:3 竖版、高端博物馆信息图，表现模型可见的圆形层叠冠饰、暖金与珊瑚色环件、珠状细节、中心饰件及织锦底层；维持其比例和颜色关系，不添加无关饰件。暖象牙手工纸背景，朱红放射辅助线和克制旧金色。以一处完整、可辨认的额冠为主体，配少量环面、珠饰、织锦材质近景；用优雅径向构图说明视觉层次，不制造虚构机械结构或破损拆件。真实且精致的 3D 材质、柔和展陈光、留白。艺术性视觉研究，不是工程测量图。禁止文字、字符、编号、标签、标志、水印、UI、网页截图、绿色块、拼贴网格、模糊/拖尾、裁切主体、幻想珠宝和卡通塑料质感。只生成一张完整图片。

## Prompt 03 — 繁须

参考 `artifacts/handoff/references/beard.png`，使用实际狮头繁须和绒饰近景作为主要造型、颜色和材质依据。制作一张约 2:3 竖版文化展览信息图，表现模型中的暖白长须、脸侧层叠毛束、朱红绒边及它们的交界，不要换成普通动物胡须。暖象牙纸背景、细朱红流向线与克制旧金色，统一展览编辑风格。主图以垂落曲线展示毛束长短、疏密和方向；附一个纤维细节放大窗和一个白须/红绒交界放大窗。显示柔软体量和天然阴影，但方向线只帮助阅读静态形态，不伪装成实测运动或动力学。主体完整入画。禁止文字、字母、数字、标注、水印、UI、网页截图、绿色块、拼贴网格、模糊带、拖尾、裁切须束、猫狗解剖、虚构机构、卡通或塑料毛。只生成一张完整图片。

## Prompt 04 — 织锦

参考 `artifacts/handoff/references/body.png` 中真实狮身布面近景，并以 `public/models/brocade.png` 的现有纹理图保留可见纹样语言和颜色。制作一张约 2:3 竖版高端文化展览图版，研究模型身体的曲面织锦：一块主要弯曲布面、与其相关的平面重复样本，以及一处表面细节放大窗。保留参考里红/珊瑚底色、金色花形和低饱和青绿，不添加无关纹样或历史徽记。暖象牙手工纸、朱红细线、旧金色点缀、写实布料和褶皱，留白清晰，三部分视觉关联。不要宣称精确 UV 提取或特定织造工艺；这是基于模型贴图的艺术研究。禁止文字、字母、数字、标签、水印、UI、网页截图、绿色块、拼贴网格、模糊带、拖尾、裁切布面、龙凤、现代标志、泛化替换纹样或过多金箔。只生成一张完整图片。

## Prompt 05 — 云边

参考 `artifacts/handoff/references/trim.png` 中狮身朱红绒边与花纹布面的真实近景。制作一张约 2:3 竖版信息图，研究此模型连续起伏的圆厚朱红绒边、重复弯曲、轮廓和它与布面、白须的关系。暖象牙纸背景、留白、克制朱红轮廓线和旧金色。让一段可辨认的 S 形边饰成为主体，并配一个简洁轮廓研究和一处绒面/布边微距；说明观察到的曲线节奏，不把所有波浪都称作传统云纹。细腻纤维和清晰阴影。艺术性视觉研究，不是精确截面数据。禁止文字、字符、编号、标签、水印、UI、网页截图、绿色块、拼贴、模糊、拖尾、裁切主体、参考中没有的云符号、卡通和塑料质感。只生成一张完整图片。

## Prompt 06 — 口齿

参考 `artifacts/handoff/references/mouth.png`，这是实际狮头静态张口的口齿、舌饰和繁须近景。制作一张约 2:3 竖版高端展览信息图，保留朱红口框、浅象牙色分段牙列、带金边的珊瑚红舌面装饰和周围白色须毛。一个较大的静态口部研究配两处牙缘和舌面材质放大窗，用空间层次说明可见关系，所有部分仍属于一张统一狮面。暖象牙纸背景、克制朱红辅助线和旧金色；真实细腻的材质与柔和方向光。模型当前没有可验证的开合动画，不得添加铰链、齿轮、活动机构或动作序列。禁止文字、字符、编号、标注、水印、UI、网页截图、绿色块、拼贴网格、模糊带、拖尾、裁切口部、真实动物头骨、人类牙齿或舌头、卡通。只生成一张完整图片。

## 文化内容来源

浮窗的资料链接仅支持其对应的概括性文化内容；造型观察来自项目实际模型截图，生成图明确为艺术示意。资料链接：

- [中国非物质文化遗产网：狮舞（广东醒狮）](https://www.ihchina.cn/project_details/12869)
- [南海博物馆：佛鹤狮头制作](https://www.nhmuseum.org/fei-yi/1575.html)
- [南海博物馆：南海醒狮（采青技艺）](https://www.nhmuseum.org/fei-yi/1580.html)
