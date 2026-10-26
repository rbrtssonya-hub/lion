# 独立章节图版：眉目 / 额冠 / 鬃须

执行模式：内置 `image_gen`，没有 CLI/API fallback。三张均独立新生成，不复用此前的 `gaze-study`、`mane-study` 或 `textile-study`。

输入不是松散的造型参考，而是 Three.js 在固定 3:2 画幅、对应章节相机终点的真实截图。生成输出也保持 3:2，网页应完整显示，不使用 `object-fit: cover` 裁切。

## 最终文件

| 章节 | 编辑目标/构图参考 | 新生成文件 | 输出 |
| --- | --- | --- | --- |
| 眉目 | `artifacts/handoff/references/brows.png` | `public/images/chapters/brows.png` | 1536×1024 PNG，3,015,495 bytes |
| 额冠 | `artifacts/handoff/references/crown.png` | `public/images/chapters/crown.png` | 1536×1024 PNG |
| 鬃须 | `artifacts/handoff/references/beard.png` | `public/images/chapters/beard.png` | 1536×1024 PNG |

绝对目标目录：`C:/Users/Administrator/Desktop/炫技5/public/images/chapters/`。

## 视觉检查与边界

- 三个参考截图与生成图均已实际查看。眉目为斜前双眉眼特写；额冠为高斜视、装饰轴线斜向纵深；鬃须为低侧白须和前爪局部，三个构图互不复用。
- 主体保持相应视角、相近尺度、主要饰件与裁边关系，采用同样的暖米白纸底，配朱红绒、象牙白毛、珊瑚金青绿装饰。
- 生成图细化了网格破面和材质，因此不是逐像素复刻。眉目与额冠主要特征存在约 1–3% 的位置/形状微差；鬃须的柔软纤维、牙齿与前爪有局部视觉转译。网页交接应采用平滑交叉淡化；不能将本图声明为模型实测截图或完全相同的网格。
- 空白处的细线是造型艺术旁注，不是实际测量。额冠左侧的小型轴向/同心图是二维装饰形态研究，中央主模型仍完整相连。
- 没有文字、数字、量具、品牌或水印；没有在主模型上呈现拆开的几何零件。
- 色彩/工艺意象不能用于证明历史制作方法或给图案附会未经验证的寓意。

## 完整最终提示词

### 01 / brows

参考角色：`artifacts/handoff/references/brows.png` 是 EDIT TARGET / 严格构图蓝图。

```text
Use case: identity-preserve / precise-object-edit. Asset type: a complete landscape 3:2 chapter artwork that will seamlessly crossfade from this exact rendered Chinese Southern lion model camera frame. Output 1536x1024, opaque. The supplied image is the EDIT TARGET and strict composition blueprint, not a loose stylistic reference. Preserve EXACTLY the camera perspective, three-quarter front angle, lion face geometry, silhouette, all ornament positions, object scale, framing and every edge crop. The face must stay at the same normalized pixel coordinates: paired large red brows, black-and-ivory eyes, central oval gold forehead bead, coral-gold crown above, green-white nose lower center, gold/coral tassel on image right; bottom lip still cropped at the bottom. Do not enlarge, shrink, rotate, center differently, mirror, or redesign the lion. Refine only broken surface artifacts, rough facet edges, and material appearance into a refined digital museum illustration: tactile thick scarlet velvet, soft ivory fibers, coral-pink and antique-gold brocade, dark reflective eyes, restrained teal accents. Preserve the original ornamental motif and relative proportions rather than inventing a new lion. Warm matte ivory paper background matching #eeeae1. In existing empty background margins only, add very subtle fine graphite and faded cinnabar concentric eye-contour arcs and delicate eyebrow gesture studies, an editorial computational-design atmosphere. They must be faint and secondary, never change the primary face silhouette or cover the face. Rich tactile detail, soft directional studio light, calm artistic image, not a web UI. All the actual object stays fully joined, no dismantling. No text, letters, digits, labels, measurement rulers, fake scientific data, captions, logos, watermark, border, split panels, extra objects or exploded parts.
```

原始生成文件：`C:/Users/Administrator/.codex/generated_images/01a17828-6772-7be1-a0d6-1448486ad84f/exec-5e48c3b4-32fa-432b-a8b0-52ab918b2752.png`。

### 02 / crown

参考角色：`artifacts/handoff/references/crown.png` 是 EDIT TARGET / 严格构图蓝图。

```text
Use case: identity-preserve / precise-object-edit. Asset type: an independent digital museum chapter artwork about the crown and forehead ornament of a Chinese Southern lion. This must be a NEW complete 3:2 landscape image, output 1536x1024 opaque. The supplied image is the EDIT TARGET and exact camera/framing lock. Preserve the oblique overhead viewpoint, every silhouette and edge crop, the diagonal crown-to-forehead axis, exact location/scale/orientation/perspective of the lion head, with the stacked coral-and-gold round crown centered about normalized x.53,y.42, gold oval forehead bead lower-left around x.43,y.86, huge red brows forming diagonal sides, ear curls at top, torso receding toward upper right. Do NOT switch to a frontal eye portrait, move the object, zoom, mirror, straighten the crown, re-center, add missing whole head, or invent a different sculpture. Keep the head intact and all ornaments physically joined. Improve only jagged broken surface artifacts and material shading: sumptuous dense cinnabar velvet, ivory furry edges, coral-pink fabric and antique gold circular ornament, elaborate gold-green-coral brocade, subtle patina, credible fine textile fibers. Retain the actual reference motifs and shape proportions. Background warm matte ivory paper #eeeae1. In the EXISTING wide empty upper-left and left margin only, add a delicate secondary field of pale graphite and faded coral elliptical ornament profile studies, a few nested concentric ring studies and precise artistic axial guide curves, visually suggesting ornament hierarchy without floating pieces or fake measurements. These tiny secondary drawings must never compete with or shift the main crown silhouette. Editorial computational design, rich but calm, tactile museum study, soft studio light. No text, numerals, labels, rulers, measurement marks, false data, captions, typography, logo, watermark, boxed collage, web interface, exploded parts, separate disassembled rings, or new objects.
```

原始生成文件：`C:/Users/Administrator/.codex/generated_images/01a17828-6772-7be1-a0d6-1448486ad84f/exec-a4049fee-b8f8-4453-a612-dc1899043686.png`。

### 03 / beard

参考角色：`artifacts/handoff/references/beard.png` 是 EDIT TARGET / 严格构图蓝图。

```text
Use case: identity-preserve / precise-object-edit. Asset type: an independently composed museum editorial artwork about the flowing ivory beard of a Chinese Southern lion, used as the matched end-frame of a camera-to-image crossfade. Output a complete opaque 1536x1024 landscape 3:2 image. The supplied image is the EDIT TARGET: preserve its exact low oblique close-up camera, every normalized position, size, silhouette and edge crop. Lion face remains cut by the upper image edge, green-white nose toward upper-left center, scarlet upper lip sweeps diagonally from x.23,y.31 to x.67,y.22, open black/red mouth and ivory teeth around x.42,y.38, long ivory beard hanging downward over the left half, red-and-coral body and right foreleg on right half, ivory front paw cropped along lower left edge and another paw at lower right. This is intentionally a low side beard view, NOT a new frontal face portrait. Do not zoom, reframe, rotate, mirror, shrink the body, turn the camera, relocate the head or paws, or put a complete face back into view. Refine only broken facet artifacts and materials, with exceptionally detailed soft long ivory silk-like beard fibers flowing along their original silhouette and path, dense warm scarlet velvet lip, the reference coral-pink/gold/teal brocade and soft ivory claws; preserve the actual model proportions, joined geometry, mouth opening and tongue placement. Soft raking museum studio light creates depth in white fibers, not blown-out white. Background is warm matte ivory paper #eeeae1. In the EXISTING clear left background margin only, weave faint elegant graphite and desaturated cinnabar flowing strand lines and tiny fiber contour gestures that echo downward beard flow, an artistic form study without measurements. Rich tactile image with a clear beard/flow theme and a quiet editorial quality. Main subject never moved to make room for drawings. No lettering, numbers, labels, captions, charts with invented values, rulers, scales, text, logo, watermark, border, boxed collage, detached or exploded parts, extra objects, fantasy redesign.
```

原始生成文件：`C:/Users/Administrator/.codex/generated_images/01a17828-6772-7be1-a0d6-1448486ad84f/exec-99c47eb1-c347-4f59-a909-9b3a055c11c7.png`。
