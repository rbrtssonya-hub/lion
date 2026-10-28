# 狮头工艺四阶段示意图：2026-10-27历史原稿

本目录顶层的 `zha.png`、`pu.png`、`hua.png`、`zhuang.png` 是 **2026-10-27旧版历史原稿**，原字节保留。2026-10-28按用户“保持画风、四图换景”的要求重新生成了四张图，当前创作源、生成记录与场景说明见 [2026-10-28新版](2026-10-28/README.md)，运行接入与本轮验收见 [换景更新说明](../../references/craft-art-varied-scenes-2026-10-28.md)。不要将顶层旧图当作新版运行副本。

以下保存2026-10-27这一组的生成经过、提示词和当时检查结果。该组为网页“造 → 工艺”的四阶段图文轮播制作，使用 Codex 内置 `image_gen.imagegen`，未使用外部 CLI/API。四图均为 1536 × 1024 PNG（3:2）。2026-10-27交付时，它们与 `source/public/assets/craft/` 的同名部署副本逐字节相同；这一历史结论不用于证明2026-10-28更新后的运行图片。

## 内容与使用边界

| 文件 | 阶段 | 图片所示 |
| --- | --- | --- |
| zha.png | 扎 | 成年尺寸道具狮头竹篾骨架，手在扎结连接部位 |
| pu.png | 扑 | 同一工坊机位，狮头骨架覆纱纸形成浅色纸胚 |
| hua.png | 画 | 同一狮头以红、金、黑色描绘纹样，手持画笔，尚未装绒毛 |
| zhuang.png | 装 | 同一彩绘狮头装眼、镜饰、绒球与白绒，双手正在整理眉毛 |

这是 **AI 辅助绘制的概念工艺示意**，不是纪录照片、实测模型、内部结构验证或制造操作标准。保持工坊与狮头轮廓连续是叙事设计；不能据此认定具体流派或工坊的固定流程。应在网页就近保留“工艺示意 · AI辅助绘制”标识。概念顺序参考南海博物馆《佛鹤狮头制作》（https://www.nhmuseum.org/fei-yi/1575.html）；具体工法和材料随师傅、工坊而异。图片不含文字、标志或水印，不冒用照片作者或 CC 授权。

## 生成来源

| 文件 | 内置工具原生输出 |
| --- | --- |
| zha.png | C:/Users/ALLEN/.codex/generated_images/01a178bd-89c8-77a1-a98e-37f3b7d946dd/exec-771ad413-18e3-4d44-a53f-6ddfc3a52166.png |
| pu.png | C:/Users/ALLEN/.codex/generated_images/01a178bd-89c8-77a1-a98e-37f3b7d946dd/exec-045fc3dd-3dc5-432f-9ca1-b223bc6f6453.png |
| hua.png | C:/Users/ALLEN/.codex/generated_images/01a178ec-eaa9-7832-b93c-d977b8a949b4/exec-8d0c0d93-5243-4053-9c51-c22927256132.png |
| zhuang.png | C:/Users/ALLEN/.codex/generated_images/01a178ec-eaa9-7832-b93c-d977b8a949b4/exec-314ae008-70d6-4291-b1af-ae74c1e91dce.png |

“扎”“扑”文件来自中断任务的现有成品，本次以文件尺寸、原生输出大小和视觉检查恢复；未取得两张原始完整工具提示词，不能将下方接续目标描述冒充原提示词。其接续已知设计目标是：暖色岭南木工作坊、木桌、左窗光、右红柜；成年道具狮头朝右三分之四视角；手绘写实水彩质感；扎只见竹篾与扎结，扑出现纱纸纸胚。

“画”使用扑图为编辑目标；“装”使用画图为编辑目标。首次装图请求因原工作区文件被另一会话切换而报路径不存在，未生成；随后引用画图原生输出成功生成。原生输出均保留，未删除或改写。

## 画阶段完整提示词

```text
Use case: precise-object-edit. Asset type: educational process illustration for a southern Chinese lion-head craft web exhibit, third of four matching images.
Input image is the edit target: preserve the exact same warm Lingnan workshop, weathered wooden tabletop, left lattice window, red cabinet on right, artisan's indigo sleeves, soft golden sunlight, delicate realistic watercolor/gouache hand-painted medium, camera angle, and the adult-sized hollow southern lion-head prop facing three-quarter right.
Primary edit: advance this exact same prop to the PAINTING stage (画). The paper shell is now fully covered, dry, smooth ivory papier-mâché. Paint the brow, forehead, nose and cheeks with elegant traditional vermilion-red, warm-gold, ivory and black curved southern-lion patterns, with visible layered pigment and fine painted lines. Keep the exact big round eye sockets, mouth silhouette and head shape. One artisan hand from the left steadies the head and the other holds a small traditional brush touching a fresh red/gold painted line beside the large near eye. Small plain ceramic dishes of red, gold and black paint and two brushes sit on the front edge of the same table instead of the paper-paste bowl and strips. This is a crafting stage, not a finished decorated head: NO white or colored fur, no fur brows or beard, no pompoms, no mirror or added accessories yet. Most head surfaces are already richly painted, a few ivory regions can remain. Natural believable hands and wrist posture. No body or person face.
Composition: one continuous landscape 3:2 frame, 1536x1024 intended, match reference cropping and prop size. No collage or multiple panels, no type, no caption, no logos or watermarks. Conceptual hand-painted illustration, not documentary photograph.
```

工具参数：`referenced_image_paths` 指向已视检的扑图；`transparent_background=false`。

## 装阶段完整提示词

```text
Use case: precise-object-edit. Asset type: fourth educational process illustration for a southern Chinese lion-head craft web exhibit.
Input image is the edit target. Preserve the exact same adult-sized southern-lion HEAD prop, same red/gold/black/ivory painted patterns, same three-quarter-right orientation, same warm Lingnan workshop and weathered wooden tabletop, same window and red cabinet, same hand-painted watercolor/gouache realism, same sunlight and framing.
Primary edit: advance this same prop to the finishing DECORATION stage (装). It now resembles a richly decorated traditional southern lion head, fully covered shell with no exposed bamboo lattice. Preserve the head/mouth silhouette and painted designs. Install large expressive dark black-and-gold round eyes within the circular sockets, one round small silver mirror ornament on the forehead, modest red pompoms at the ears/forehead, and thick ivory-white fur outlining the eyes and upper brow and lip, plus a short ivory beard along the lower jaw (head only). The artisan's two hands emerge from the same left side and are visibly fitting the final strip of long ivory brow fur above the near large eye: one holds the edge of the fur, the other presses it into place. No paintbrush being used. On the table front: a loose tuft/strip of clean ivory fur and a small red pompom with plain craft scissors, replacing the paint dishes. Keep the finished head prop clearly adult size and on the table. Anatomically believable two hands, natural wrists. No person face, no animal body, no four-legged mascot.
One continuous 3:2 landscape image, 1536x1024 intended. Match composition, color atmosphere and head scale exactly. Fine craft textures, soft restrained highlights. NO text, numbers, labels, watermarks, logos, collage or multiple panels. Conceptual painted illustration, not documentary photo.
```

成功工具参数：`referenced_image_paths` 为上表画阶段原生输出；`transparent_background=false`。

## 2026-10-27实际检查（历史）

2026-10-27已逐张打开视检：当时四张具有一致的工坊、光向、狮头轮廓、成年道具尺寸和手绘媒介；阶段从扎结、覆纸、彩绘到装饰分别可辨；没有人脸、狮身、拼贴面板、文字或水印。四图解码为 1536 × 1024。非部署的 README 仅放设计目录，不放 public。2026-10-28新版采用不同机位、背景与操作姿势，旧版“同一工坊／同机位”属于此前叙事设计。
