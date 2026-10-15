# 醒狮八态独立形态素材与来源

2026-10-15，用户提供图 2，要求中央醒狮八态各自使用对应的不同形态，替换旧版同一 PNG 加 CSS 姿态变换的实现。本次为图像素材制作，使用内置 `image_gen` 的透明背景编辑模式；每态单独一次调用，共八次。没有使用 Python、CSS 旋转、图像缩放或后处理来构造新形态。

## 原始依据

- 本次图 2 原件归档：`source/design/expression/2026-10-15-eight-poses/reference.jpg`，1697×927，RGB JPEG，224665 字节，SHA256 `6005319e0304fd7e1ac6af52b1c81c251138cec3b345ce715e6bb4df0ad41cca`。
- 桌面 `图2.jpg` 与本次附件 `image-2.jpg` 逐字节相同；归档保留相同原始字节。桌面 `图1.jpg` 与附件 `image-1.jpg` 也逐字节相同，2344×1280、226653 字节，SHA256 `4f0adfb8510d91ddba57e68a325841c320a35ae181f301acb4129e3fd0b8f12c`；图 1 仅作现状对比，未用于生成。
- 图 2 内八态位置：第一行从左到右为喜、怒、哀、乐；第二行从左到右为动、静、惊、疑。下表矩形为原图像素的近似定位范围 `[left, top, right, bottom]`，用于让工具选择对应格子，实际每次输入均为完整原 JPG，未制作裁切输入。
- 原工程 `source/design/expression/eight-states-reference.png` 是较早的单喜态页面，不包含本次八个独立形态；旧 `lion-head-front.png` 为1254方形透明正面狮头，八态原先复用同一个文件。新文件以 `-v2` 独立保存，不覆盖这些旧原件。

## 真实性与制作边界

这是依用户提供的设计参考图进行的 AI 辅助提取及少量补全，不是无损裁切，也不是新增的八套实拍样本。截图内的徽章和标题遮挡了部分边缘，工具会重建被遮挡的少量绒毛和细节；红白金配色、银镜、绣纹、绒毛、八态口型及头部方向以对应格子为依据。生成细节不应被当作经过样本验证的真实八态特征。

只移除页面、圆环、徽章、文字与无关内容；保留各态必要少量颈部或肩部绒毛，便于呈现原参考的俯仰和侧转。网页应继续保留 AI 辅助视觉与定性观察的标注。正式摄影/视频神态研究和样本校核仍未完成。

## 八张运行文件与校验

运行路径规则：`source/public/assets/expression/lion-{key}-v2.png`。八张均为1254×1254 RGBA PNG，未改生成器输出尺寸、颜色或字节。生成原件另有工程内归档，且与运行文件逐字节一致。

| 神态 / key | 图 2 位置 | 原图定位矩形 | 运行文件字节 | SHA256 |
| --- | --- | --- | ---: | --- |
| 喜 / joy | 第1行第1列 | `[270, 185, 515, 423]` | 1973680 | `db755d607d4ea75244d0e89975ce7f183319da6cd24940a266acc46ec5dd688e` |
| 怒 / anger | 第1行第2列 | `[590, 187, 839, 426]` | 2148975 | `3c9b8b091ca8d8e549672c9cc6e0cbbca1e83a5a92d7052999ea04bc470ab37f` |
| 哀 / sorrow | 第1行第3列 | `[917, 194, 1168, 425]` | 2072160 | `d89c62066a6324c215f0c783aba2b2a43bca094d2a94d3cdf63c0b0e219cc27d` |
| 乐 / delight | 第1行第4列 | `[1251, 176, 1490, 427]` | 2210847 | `b8e98ac5437d9735227f47dece7f74273d540590a97c4940383745aa51e563f2` |
| 动 / motion | 第2行第1列 | `[250, 524, 520, 758]` | 2272850 | `aa4d0032fad8faf2462decf90dcb9219ca92890aa567654d8993b885461a3476` |
| 静 / stillness | 第2行第2列 | `[594, 522, 841, 759]` | 2045186 | `8ecbfdd200043946d5e63be21a175e349979c822376c9003c561cdb2893cd886` |
| 惊 / surprise | 第2行第3列 | `[917, 523, 1171, 762]` | 1975024 | `7b167fa62fb0e24afc103e6821322443fd361bd951b5d18ac2a58423f1b97480` |
| 疑 / doubt | 第2行第4列 | `[1251, 529, 1500, 763]` | 1899231 | `872da547c9c3774dbeab0333e13e88455a5573267ff93389791836d83e61177e` |

原始内置工具输出与工程归档对应如下。这里的工具输出文件名用于追溯；工程内归档才是可迁移的原件路径。

| key | 内置工具输出文件名 | 原始输出工程归档 |
| --- | --- | --- |
| joy | `exec-7b85fc83-e42e-4d47-a6cf-848c0bb0d300.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-joy-original.png` |
| anger | `exec-935d1f74-93fb-42ff-bfbd-26b86c69ed3a.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-anger-original.png` |
| sorrow | `exec-6211e069-2c13-4035-87db-8012475014fd.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-sorrow-original.png` |
| delight | `exec-30beabb2-d271-4644-93c4-f09b45184c8f.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-delight-original.png` |
| motion | `exec-c1344692-0a6f-42d2-bbd8-d75b6dd7f09a.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-motion-original.png` |
| stillness | `exec-b529646c-cbac-436a-aec0-2f0dcd3a6e7b.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-stillness-original.png` |
| surprise | `exec-ee9c8220-c547-4155-8687-9a0208baa701.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-surprise-original.png` |
| doubt | `exec-a5c916fd-744e-40d9-a208-7cdeac18446e.png` | `source/design/expression/2026-10-15-eight-poses/generated/lion-doubt-original.png` |

## 实际检查

- 八个输出均分别通过 `view_image` 目视对照图 2，确认仅含各自单狮、无文字/页面/圆环，未以同一正面图旋转代替侧转。
- 喜：直立正面、上扬眉眼、中等开口；怒：眉眼集中下压、较浅口型；哀：低首、眉眼收敛、近闭口；乐：仰首、明显竖向大开口。
- 动：实际三分之四侧转、冠顶向画面左偏，右侧颈毛可见；静：稳定正面、平缓眉眼与较小口型；惊：抬首圆眼、明显张口；疑：冠顶向画面右偏、下颌偏左，眉眼与嘴部透视不对称。
- 使用 Pillow 只读验证文件解码、RGBA、透明通道和 SHA256。八图的 alpha 最小值均0，四角均0，主体 alpha 集中在252–253；其中乐和静最大254，其他六张最大255，保留这些原始生成 alpha，不重写通道。
- 八个 SHA256 两两不同；每个运行文件与对应 `generated/` 原件逐字节一致。
- 本页记录的是素材验收；网页接线、电脑端交互和最终生产构建结果由对应工程日志记录，不能以素材检查替代浏览器验证。

## 内置 imagegen 实际提示词

使用 `referenced_image_paths` 指向本次完整图 2 原件，并设置 `transparent_background: true`。先生成喜态并目检，再提交其余七个独立调用。以下保留实际提示词；其余七态的完整提示词由“公共段”、两个换行和各自“专用段”拼接，未附加其他内容。

### 喜 / joy 完整提示词

```text
Use case: background-extraction.
Asset type: one transparent PNG subject for an interactive Southern Chinese lion dance exhibition.
Input image: the provided local JPG is the EDIT TARGET. It is a 1697 by 927 reference sheet containing eight different white-fur, vermilion-red and gold lion poses in a two-row, four-column grid.
Primary request: extract ONLY the JOY / 喜 lion in ROW 1 COLUMN 1, centered approximately at x385,y305, with its subject roughly inside x270..515,y185..423. Do not select the lion used as the corner logo and do not select another cell.
Preserve the exact identity and this cell's particular anatomy and pose: near-frontal upright head, symmetrically lifted white eyebrows and ears, alert large black-red spiral eyes, forehead silver mirror, red pompom crown and three nose pompoms, gold/red painted details, moderately open smiling red mouth with the curved row of white teeth and patterned dark inside. Keep the original facial proportions, facing direction, mouth opening and head inclination; do not reinterpret it as another emotion and do not just rotate an unrelated frontal head.
Output composition: a single complete detached lion HEAD, centered on a square canvas, with all fluffy ears, crown and white beard intact; include only minimal neck fur if needed. Make the isolated subject fill about 86 percent of the canvas with a transparent margin on all four edges. Recover only tiny beard areas hidden by the red 喜 label naturally in the same reference style.
Remove absolutely all page background, peach brush circle, label badge, text, ornamental cloud lines, navigation, scenery, other lions and body below the beard. No text, logo, ring, UI, pedestal or cast shadow.
Style: faithful reference extraction, realistic silky white fur, original red/white/gold/silver color identity and soft lighting. Background must be genuinely transparent alpha, not white or a checkerboard painted into the bitmap. This request is just this one JOY lion, not a grid.
```

### 其余七态公共段

```text
Use case: background-extraction.
Asset type: an individually isolated transparent PNG lion head for an interactive Southern Chinese lion dance exhibition.
Input image: the attached local JPG is the EDIT TARGET, a 1697x927 page with eight white-fur, vermilion-red and gold lion poses arranged in two rows and four columns. Extract the one specified cell only.
Identity invariants: faithfully preserve THAT cell's own face silhouette, ear and brow geometry, black/white/red spiral eyes, round silver forehead mirror, gold and red painted ornament, red-white pompoms and silky white fur. Preserve the cell's actual direction, perspective, head inclination, brow/eyelid tension and exact degree of mouth opening. A correct new pose is the source pose's anatomy, not the generic frontal lion rotated.
Composition: one complete detached lion HEAD on a square transparent canvas, filling about 86% with clear transparent margins at every edge, entire crown, both ears, cheeks and beard intact. Include only minimal neck/shoulder fur if naturally visible in this specific pose; no full body or legs. Naturally recover only tiny fur areas obscured by the cell's label.
Remove ALL page/background pixels, peach circular brush frame, labels, Chinese characters, ornamental lines, clouds, navigation, other lions and scenery. No text, logo, ring, UI, pedestal, cast shadow or multiple heads. Genuinely transparent alpha background, no white rectangle or painted checkerboard. Faithful reference style and colors; this is one pose, not an invented variant or contact sheet.
```

### 怒 / anger

```text
SPECIFIC EDIT TARGET: 怒 / ANGER, ROW 1 COLUMN 2. Approximate original-source bounding rectangle x590..839,y187..426.
Pose to preserve: Near-frontal, strong intimidating downward-focused brow and concentrated eyes, head slightly pitched forward/down, forehead mirror facing forward, mouth a shallow compressed open grin with a clearly visible curved red lower rim and white teeth. Keep this lower, tighter mouth opening and converging brow geometry; do not use the wide joyful open mouth.
Only isolate this exact 怒 lion from this exact grid cell.
```

### 哀 / sorrow

```text
SPECIFIC EDIT TARGET: 哀 / SORROW, ROW 1 COLUMN 3. Approximate original-source bounding rectangle x917..1168,y194..425.
Pose to preserve: The low, subdued, drooping head pose: head bowed, asymmetrical heavy eyebrows, one eye more hooded/obscured, muzzle and lips drawn close with almost no dark mouth cavity or teeth visible. The chin is tucked and white cheek/beard fur dominates the lower face. Preserve the source's bowed subtle oblique head geometry and nearly closed mouth. Do NOT make a symmetric upright smiling head.
Only isolate this exact 哀 lion from this exact grid cell.
```

### 乐 / delight

```text
SPECIFIC EDIT TARGET: 乐 / DELIGHT, ROW 1 COLUMN 4. Approximate original-source bounding rectangle x1251..1490,y176..427.
Pose to preserve: The obviously different joyful upward-looking pose: chin lifted high, muzzle pointing upward, perspective reveals underside of muzzle and a BIG vertically open oval mouth with a dark patterned interior and red lip, lower jaw lowered far away from upper muzzle. Eyes look upward and are partly foreshortened above the lifted muzzle. Preserve the tall gaping mouth and upward tilt; do NOT replace with a frontal circular smiling mouth.
Only isolate this exact 乐 lion from this exact grid cell.
```

### 动 / motion

```text
SPECIFIC EDIT TARGET: 动 / MOTION, ROW 2 COLUMN 1. Approximate original-source bounding rectangle x250..520,y524..758.
Pose to preserve: The dynamic three-quarter oblique pose in the lower-left cell: head is turned and canted with crown displaced to the LEFT of the nose in image coordinates, and the lion's red-and-gold side/neck is visible to the RIGHT of its face. Left/right eyes differ in perspective, muzzle line slopes, mouth is actively open showing a curved red rim and teeth. Preserve the source's genuine three-dimensional turn and lean, including a little necessary side/shoulder fur; do NOT just rotate a symmetric frontal head.
Only isolate this exact 动 lion from this exact grid cell.
```

### 静 / stillness

```text
SPECIFIC EDIT TARGET: 静 / STILLNESS, ROW 2 COLUMN 2. Approximate original-source bounding rectangle x594..841,y522..759.
Pose to preserve: The calm, steady, upright near-frontal lower-row second head: balanced forward gaze, relaxed heavy white brows, lower centered forehead mirror and three close muzzle pompoms. The mouth is modestly open as a low horizontal curved smile with a small dark interior and white teeth; jaw sits close to the muzzle and beard falls evenly. Preserve this calm closed-down shape, substantially less open than 喜 or 惊 and far less than 乐; do NOT invent anger or a head tilt.
Only isolate this exact 静 lion from this exact grid cell.
```

### 惊 / surprise

```text
SPECIFIC EDIT TARGET: 惊 / SURPRISE, ROW 2 COLUMN 3. Approximate original-source bounding rectangle x917..1171,y523..762.
Pose to preserve: The alert surprised near-frontal head in the lower-row third cell: lifted head and lifted arched white eyebrows, both eyes visibly round and wide, muzzle lifted over a noticeably open dark oval mouth with red lower rim and white tooth arc. This is more vertically open and alert than the calm 静 cell, with its own brow/eye shape and upright crown. Preserve the exact source's forehead, open-mouth proportions and slightly raised chin; do NOT reuse a generic joy head.
Only isolate this exact 惊 lion from this exact grid cell.
```

### 疑 / doubt

```text
SPECIFIC EDIT TARGET: 疑 / DOUBT, ROW 2 COLUMN 4. Approximate original-source bounding rectangle x1251..1500,y529..763.
Pose to preserve: The clearly sideways, questioning lower-right head: crown displaced to the RIGHT of the nose in image coordinates, chin and open mouth displaced to the LEFT, head tilts diagonally, one spiral eye looks out from beneath the tipped brow while the other is at another height. The muzzle and open red/white-toothed mouth are diagonally slanted, with long white beard following the tilt. Preserve this genuine asymmetric oblique perspective, opposite lean from 动. Do NOT just rotate an upright symmetric head.
Only isolate this exact 疑 lion from this exact grid cell.
```
