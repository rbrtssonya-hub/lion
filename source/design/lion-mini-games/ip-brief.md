# 阿南 IP 素材说明

生成日期：2026-10-26。用途：两个桌面醒狮小游戏的角色展示与姿态素材。本目录保存独立阶段的原始设计；用户后续已授权从网站工艺界面进入游戏，现用运行图集为 `source/public/assets/lion-games/lion-poses.png`，与此处原图逐字节相同。

## 设计

工作名“阿南”。本任务采用原创提示词进行 AI 辅助角色设计；形象为南狮舞狮造型的四足吉祥 IP。朱红、米白与少量金色为主，保留南狮的圆旋眼、浓眉、额镜、小角、宽狮口、短狮被与四只狮爪。风格为国潮手绘与轻立体明暗，朝右 3/4 视角，适合电脑横屏画面。

两张文件均是内置 image_gen 工具直接生成的 PNG，按原始字节复制入工程；没有用 Python 或其他工具编辑图像。Python/Pillow 仅用于只读检查尺寸、alpha 与主体边界。原始生成文件保留于下述 Codex 生成目录。

## 交付文件与布局

| 文件 | 像素尺寸 | 透明通道 | 用途 |
| --- | --- | --- | --- |
| [assets/lion-ip.png](assets/lion-ip.png) | 1254 × 1254 | RGBA，真实 alpha | 单体全身立绘 |
| [assets/lion-poses.png](assets/lion-poses.png) | 1254 × 1254 | RGBA，真实 alpha | 2 × 2 四等分姿态图集 |

图集每格为 **627 × 627 px**。以下裁剪矩形按左上原点，使用 x、y、width、height；各格完整且不重叠。

| 姿态 | 位置 | 裁剪矩形 | 每格主体范围（alpha ≥ 128；右/下为不含端点） | 每格脚底 y |
| --- | --- | --- | --- | --- |
| idle 待机 | 左上 | (0, 0, 627, 627) | (90, 107)–(576, 595) | 595 |
| crouch 蓄力 | 右上 | (627, 0, 627, 627) | (62, 220)–(554, 597) | 597 |
| jump 腾跃 | 左下 | (0, 627, 627, 627) | (121, 34)–(598, 457) | 457 |
| land 落地 | 右下 | (627, 627, 627, 627) | (47, 122)–(560, 517) | 517 |

已用 view_image 查看立绘及图集；只读像素检查确认四格主体没有触及中央水平或垂直分割轴，保留透明间隙。全图 alpha 的极值为 0 与 255。

**注册边界：**内置生图已执行留白及注册位置校正，但四格脚底尚未严格处于同一相对 y。应在渲染中使用上述逐帧脚底值作锚点，避免切换时跳位；不能将这张原始图集宣称为已完成严格同线的机械精灵排版。若按整格显示并统一对齐到局部 y=600，四帧向下补偿分别为 5、3、143、83 px。推荐直接按每帧主体范围取样并以脚底居中绘制，保留同一身体缩放系数。

本交付为静态立绘与四姿态图集，不含绑定骨骼或逐帧连贯动作文件。

## 生成方式与原始文件

方式：内置 image_gen；透明参数 transparent_background=true；立绘为新建生成，图集以立绘为角色身份参考，再做一次构图校正。未使用 API/CLI 路径；工具未暴露可核实的具体后端模型名称，因此不另填模型版本。

- 立绘原始文件：C:/Users/ALLEN/.codex/generated_images/01a1742b-50da-79f0-adcf-d4ef5dcec8a4/exec-98b566ad-60e3-452f-b712-9702eac0720b.png
- 图集首版原始文件：C:/Users/ALLEN/.codex/generated_images/01a1742b-50da-79f0-adcf-d4ef5dcec8a4/exec-85e297da-ec90-4f58-bfc3-f32973bb7370.png
- 最终选中图集原始文件：C:/Users/ALLEN/.codex/generated_images/01a1742b-50da-79f0-adcf-d4ef5dcec8a4/exec-f93fdd85-e16e-40d2-9474-a4c944fbb86a.png

后续追加注册校正产生的候选 exec-432896ba-c92e-4330-9a50-c1ccdb28e406.png 仍保留在原始目录；其上下边距小于选中版本，未作为本次交付。

## 立绘提示词

```text
Use case: stylized-concept
Asset type: original character key art for two desktop Chinese Southern lion dance mini games.
Primary request: Create one ORIGINAL full-body quadruped Southern lion-dance mascot named A-Nan. This is a stylized traditional Chinese Nanshi / southern lion DANCE COSTUME character, with four paws under a short decorative lion-dance cloth body. It must immediately read as a Chinese lion-dance creature. It is NOT an African zoological lion and NOT a human standing mascot.
Scene/backdrop: truly transparent background, isolated single character, no floor, no shadow detached from the character, no environment.
Subject and identifying features: oversized exquisitely designed vermilion-and-warm-ivory southern lion dance head; two round spiral pupils within round decorated eyes; thick fluffy ivory brows; a small round brass forehead mirror; one short decorative horn at the top; lively broad lion mouth with layered warm-ivory trim. Short red cloth draped body with restrained curved wave embroidery and delicate pale-gold piping. Four clearly distinguishable short ivory furry paws with red ankle bands. Very short decorative curled tail. A-Nan is playful, alert, friendly, and bold. Keep the classic dance-costume head-to-short-body proportion.
Style/medium: premium Chinese guochao hand-painted illustration with subtle light 3D volume; confident fine painted edge work, beautiful shaped fur clumps, tactile cloth and painted wood, carefully controlled soft shading. Restrained sophisticated competition visual quality. Not plastic 3D rendering, not flat generic vector.
Composition/framing: single complete character, standing idle ready to run, 3/4 side view FACING RIGHT. Broadly side-on body to fit a side-scrolling jumping game; face points right but some near and far eye visible. Camera at character height. All four paws, ears, horn and tail fully in frame, generous clear space all around. Center the full character, occupy about 76 percent of the canvas width and height. A square canvas.
Lighting/mood: soft warm studio light, subtle ambient occlusion within the character, cheerful and energetic.
Color palette: vermilion red, warm rice ivory, tiny tasteful pale-gold highlights, black only for small pupils and painted line details.
Text: no text, no letters, no title.
Constraints: original design; one character only; preserve an unmistakable southern lion dance silhouette; four paws not two; no human hands or feet; no visible human performers; no poles, drums, props, platform, badge, frame, label or watermark; no checkerboard drawn into the image. Actual alpha transparency.
```
## 图集提示词

参考图为 assets/lion-ip.png。

```text
Use case: identity-preserve
Asset type: transparent 2-by-2 game sprite pose sheet.
Input image 1 is the EXACT character reference. Preserve this SAME original A-Nan southern lion dance creature: identical oversized vermilion and ivory dance head, gold forehead mirror and short curved decorative horn, concentric decorated eye design, heavy ivory fluffy eyebrows and moustache, mouth design, layered embroidered vermilion lion cloth, four short ivory paws with red embroidered anklets, curled short tail, and identical premium hand-painted guochao light-volume rendering. Do not redesign or simplify the character.
Create a SINGLE SQUARE transparent PNG containing EXACTLY FOUR separate FULL-BODY images of this SAME character, one in each equal quadrant of a STRICT 2 x 2 grid, no drawn dividing lines. Four equal square cells; top-left idle, top-right crouch, bottom-left jump, bottom-right land. No text labels anywhere.
Every character faces RIGHT at the same 3/4 side-view angle as the reference, with the tail on the left and nose on the right. The characters never touch or overlap. Keep the head and body the same physical size across all four cells. Position each character around the same RELATIVE center within its cell. Leave generous transparent safe margins: the ENTIRE silhouette including fur, horn, paws and tail must stay within the inner 76% width and 76% height of its own cell; leave at least 12% margin on all sides. Four FULL bodies, nothing cut off at image edges or quadrant boundaries.
Pose details:
TOP LEFT = IDLE, alert ready standing pose, all four paws grounded, mouth softly open and lively eyes.
TOP RIGHT = CROUCH, lower head and compressed short body, four bent legs preparing to jump, eyes focused; noticeably lower than idle.
BOTTOM LEFT = JUMP, airborne bounding pose, raised head, folded forepaws and tucked hind paws under its body, dynamic short cloth shape. No effects or cloud. Keep the head size identical to the other poses. Do not raise its overall placement: normalize the LOWEST PAW tip to the SAME relative vertical baseline as the standing poses so the game can translate the sprite upward.
BOTTOM RIGHT = LAND, paws spread forward and back, bent legs absorbing landing, body leaning a little forward and head lower, focused lively face, short cloth settling. No dust or effects.
REGISTRATION: in all four equal cells, the lowest paw tip is at exactly 88% of the cell height, with the full character contained above this baseline. Character center and body scale consistent. Frame all four sprites with equal safety margins.
Style and color: retain the reference's warm hand-painted detailing and subtle 3D volume, vermilion red + rice ivory + restrained gold.
Background: true alpha transparency everywhere between silhouettes, no white backdrop, no checkerboard texture, no floor or ground shadows. No props, human performers, watermark, labels, lettering, decorative frame, grid, divider, UI, or extra poses. Request a high-resolution square sheet suitable for equal-quadrant cropping.
```

## 选中版本的构图校正提示词

参考图为首版图集。

```text
Use case: precise-object-edit
Input image 1 is the EDIT TARGET: a 2x2 sheet of four poses of A-Nan the red-and-ivory Chinese southern lion dance mascot. Keep ALL FOUR designs and pose ordering exactly: idle top left, crouch top right, jump bottom left, land bottom right. Keep the face, red/ivory/gold material and hand-painted light-volume style exactly.
Change ONLY the composition and sprite registration of this sheet. The current sprites are too large and touch their cell boundaries. FIX THIS by scaling down every complete sprite to approximately 68% of its CURRENT width and height, while keeping all four sprites at one consistent physical scale. Redraw any clipped fur or nose so every sprite is fully complete.
The final image must still be a square 2x2 sheet with four equal square quadrants. Treat the four cells as fixed. Place each scaled sprite centered horizontally inside its own cell, with at least 15% EMPTY TRANSPARENT PADDING on left and right and at least 12% on top and bottom. In each cell the LOWEST PAW TIP must align to exactly 85% of cell height, including the tucked jumping paws. Keep the jumps/crouch differences through the internal pose, not by placing the full sprite at different registration heights. There must be a large transparent cross-shaped gap between all four silhouettes.
Each sprite occupies no more than 70% of its cell width. NO part of any character may touch the outer canvas boundary or central x/y dividing axes. Keep the same orientation facing right. FOUR complete characters total.
Retain actual alpha transparency. Remove any free-floating colored speckles or debris that are not part of the character silhouettes. No props, shadows on the floor, grid lines, labels, text, checkerboard, watermarks or effects. Output ONLY the clean transparent four-pose sheet.
```
