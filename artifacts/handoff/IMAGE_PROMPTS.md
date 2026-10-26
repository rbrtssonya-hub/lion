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


---

# Camera-registered chapter images — body, trim, mouth

Generated on 2026-10-26 using the built-in `image_gen` tool. Each chapter received its own independent image call; no crop, reuse, raster post-edit, resizing, or shared source output was substituted for a new image.

All three final files are opaque PNG images at **1536 × 1024 (3:2)**. Each uses the corresponding real Three.js 1200 × 800 terminal camera frame as its edit target, preserving the original camera perspective, subject placement, scale and border clipping while enhancing material resolution. The source `.blend`, GLB and reference captures are unchanged.

These images are artistic visual interpretations, not measurements or verified historical construction diagrams. The background pencil gestures are non-data design studies.

## Body / 织锦

Final workspace destination: `C:/Users/Administrator/Desktop/炫技5/public/images/chapters/body.png`

Edit target: `C:/Users/Administrator/Desktop/炫技5/artifacts/handoff/references/body.png`.

Material reference only: `C:/Users/Administrator/Desktop/炫技5/public/models/brocade.png`.

### Final prompt

Use case: precise-object-edit / stylized-concept.
Asset type: a camera-registered 3:2 chapter artwork for a Chinese lion-dance interactive digital exhibition. Output 1536x1024 landscape, opaque.
INPUT IMAGE 1 is the exact 1200x800 last frame of a Three.js camera flight, and is the EDIT TARGET. Preserve its entire composition with precise registration: same lens perspective, side viewpoint, all object contours and anatomy, direction, subject position and size in the canvas, and identical clipping at all four borders. Do not zoom out, reframe, rotate, mirror, shift, or rebuild the lion.
INPUT IMAGE 2 is ONLY a material reference for the brocade motif, not a composition reference.
Primary request: transform the imperfect digital render into an exquisitely tactile museum editorial close-up of THIS SAME lion's body brocade, keeping all large geometry exactly where it already is. The left-cropped head and gold/coral fittings remain left-cropped, the horizontal torso and its undulating thick cinnabar borders remain the central subject, and the white tail remains cropped at the far right. Maintain the existing red border contours, body silhouette, leg positions and all border intersections. Within these same surfaces, resolve rich coral-red silk brocade with fine gold floral scrollwork and restrained deep jade-green details following the actual second reference, with tiny woven thread highlights. Replace faceted red trim only with convincing dense deep-red velvet fibers along the very same trim paths. Preserve the actual ivory-white fur masses, coral pink ornaments and warm antique gold. Improve surface artifacts and stray broken polygons without changing shape.
Scene/backdrop: flat warm ivory museum paper color #eeeae1, soft fine grain, softly lit short shadows. Maintain the quiet blank upper-right paper area of the source. Add just a few extremely restrained pale graphite and cinnabar curved sketch gestures in blank background only, evoking warp/weft and floral repetition, not new objects and not an engineering diagram. Do not cover the main material with overlays.
Style: sophisticated photorealistic craft-material study, rich microtexture, nuanced soft light, contemporary exhibition art plate. The composition is already rich and must remain uniquely horizontal, distinct from a rear-angle cloud-trim close-up or a frontal mouth close-up.
Text: none.
Critical invariants: preserve the edited screenshot's camera and pixel-aligned large contours; no isolated fabric swatch, no material still-life rearrangement, no new lion pose, no extra pieces, no exploded components, no extra limbs, no letters, numbers, labels, arrows, dimension marks, charts, rulers, tools, seals, logos, borders, watermark, or fake data. All final content must fit within the same 3:2 canvas.

### Visual QA

- Unique horizontal near-side body composition, with the head still clipped at the left, broad central woven torso, red contour paths and tail still clipped at the far right.
- The central red trim, lower border path, legs and fittings follow the real camera reference. Material rendering is substantially richer, so this is a photographic interpretation rather than a texture-exact render.
- Warm ivory paper background; restrained floral and thread-like graphite/cinnabar gestures occupy the original blank areas.
- No text, numerical claims, dimensions, watermarks, disconnected parts, or invented anatomy.
- Full 3:2 canvas, shown without image cropping by the website.

## Trim / 云边

Final workspace destination: `C:/Users/Administrator/Desktop/炫技5/public/images/chapters/trim.png`

Edit target: `C:/Users/Administrator/Desktop/炫技5/artifacts/handoff/references/trim.png`.

### Final prompt

Use case: precise-object-edit / stylized-concept.
Asset type: one unique camera-registered chapter image for the cloud-like velvet edging of a Chinese lion-dance costume. Landscape 1536x1024, opaque, 3:2.
The supplied image is the EXACT EDIT TARGET and the final frame of a real 3D camera move. The image must remain registered to this reference, because it crossfades directly over the same geometry. Do not change camera angle, perspective, crop, subject position, scale, silhouette, curvature paths, or border intersections. Keep the same high rear oblique view along the lion's back, with the cropped back of the head at upper-left, undulating red velvet bands running diagonally through the center, and the large long ivory-white tail at lower-right. Preserve all red trim paths and their branching, their attachment to the coral floral cloth, the paired pale coral pendant near the tail, and their exact relative positions.
Primary request: enhance this rough digital render into a rich, refined tactile museum art plate about rhythm and continuous contour. Replace faceting and stray torn triangles inside the same silhouette with exquisitely convincing dense dark-cinnabar velvet fibers. Preserve the existing coral-red/gold/jade floral brocade as a softly textured woven base, the coral/gold rear head decoration at upper-left, and the flowing ivory-white tail mass in its original location. Texture and nuanced lighting may improve substantially; no rearrangement or dismantling is permitted.
Warm ivory paper backdrop #eeeae1, subtle paper grain and soft short shadows. In the existing quiet upper-right background, add a few very delicate nested graphite and muted cinnabar wave-contour strokes that echo the REAL red border curves, like elegant contemporary design-research pencil gestures. These are purely artistic flow studies, without numerical data or measuring conventions. Keep them restrained so the original back-and-tail subject stays dominant. No disconnected fabric swatches or collage boxes.
Composition identity: uniquely high, rearward and diagonal, explicitly unlike a side-on body textile picture or frontal mouth picture. Retain the source's whole 3:2 canvas and all its original clipping.
No text, letters, numbers, symbols, labels, arrows, rulers, measurement ticks, dimension lines, chart axes, tools, seals, logos, watermarks, borders, exploded pieces, floating parts, new anatomy, or additional objects. Do not shift, mirror, zoom or straighten the original view.

### Visual QA

- Unique high rear oblique diagonal framing, unlike the side body image.
- The rear head at upper-left, red velvet paths across the torso, pale pendants and ivory tail mass retain the actual reference placement and perspective.
- Velvet and woven details are enriched without showing exploded or separated components.
- Faint rhythmic contour gestures stay in the original upper-right paper area and contain no measurements or text.
- Full opaque 1536 × 1024 canvas; no post-generation crop or resize.

## Mouth / 口齿

Final workspace destination: `C:/Users/Administrator/Desktop/炫技5/public/images/chapters/mouth.png`

Edit target: `C:/Users/Administrator/Desktop/炫技5/artifacts/handoff/references/mouth.png`.

### Final prompt

Use case: precise-object-edit / stylized-concept.
Asset type: one unique camera-registered close-up chapter image of the mouth of a Chinese lion-dance costume. Landscape 1536x1024, 3:2, opaque.
The supplied image is the EXACT EDIT TARGET: the terminal frame of a real Three.js camera movement. Preserve its composition and geometry registration precisely for a direct crossfade. Keep the same extremely close, low frontal camera view; identical perspective; exact subject scale, horizontal placement and cropping at all four edges. The huge dark-cinnabar upper velvet lip occupies the top of the canvas and curves down at left; a curved row of ivory-white upper teeth sits beneath it; the coral-red tongue with its gold scrolling motif remains centered inside the dark-red mouth; the lower curved row of ivory teeth and thin red lower lip keep the same positions; long white beard fibers fill the bottom and side margins. Do not reframe to show a whole face or change the mouth's opening angle.
Primary request: enhance only surface quality and lighting of this precise rendered scene into a sophisticated photorealistic museum editorial mouth-and-expression study. Resolve the existing upper lip into dense refined red plush without changing its outline, replace polygonal white teeth with subtly crafted ivory enamel surface in the exact same tooth boundaries, preserve black tooth divisions and both arcs, and retain the coral tongue's gold floral scroll on its existing central surface. Keep the costume mouth artificial and crafted, never biological animal anatomy. Resolve the existing beard as beautiful fine ivory-white fibers following the existing overall mass and downward flow. Fix broken-face artifacts inside the same silhouette, with nuanced warm shadows in the original mouth cavity. No new teeth or accessories and no jaw parts separated from the original.
Background only where it exists remains very light warm ivory paper #eeeae1. The frame is already filled by this unique dramatic frontal close-up; do not add collage panels or steal space from the subject. Only a few extremely faint graphite exploratory arcs may appear through the quieter pale beard-edge background at the very bottom corners, if they can fit without covering the teeth, tongue, lips or central beard.
This composition must stay entirely distinct from side textile or rear cloud-trim studies. Preserve all original geometry alignment, crop and 3:2 canvas.
Absolutely no words, letters, numerals, labels, arrows, dimensions, rulers, measuring tools, logos, seals, watermark, poster borders, fake data, exploded components, disconnected teeth, blood, biological gums, people or hands. Do not zoom, mirror, rotate, shift or redesign the subject.

### Visual QA

- Unique extremely close low frontal mouth framing, distinct from both textile and rear trim views.
- The large upper lip, two ivory tooth arcs, central gold-decorated coral tongue, lower lip and surrounding white beard retain the reference's position, perspective, scale and clipping.
- Enhanced velvet, ivory enamel and beard fiber detail; no whole-head reframe or new opening angle.
- No biological anatomy, gore, detached teeth, labels, numerical data, watermarks, or exploded parts.
- Full opaque 1536 × 1024 canvas; no post-generation crop or resize.


