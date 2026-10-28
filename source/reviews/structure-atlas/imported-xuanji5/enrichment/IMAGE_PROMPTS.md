# 新增导航艺术图与文化图解：完整生成提示词

本轮十二张资产全部使用内置 image_gen，各自独立生成。以下完整收录三个原始记录文件，包含实际提示词、原始生成路径、最终项目路径与目视检查说明。原始 PNG 未裁切、未缩放，所有十二张 SHA256 互不相同，且均与既有六张章节主图不同；尺寸、字节数与原始副本核对见同目录 asset-manifest.json。

---

来源记录：C:\Users\Administrator\Desktop\炫技5\artifacts\enrichment\PROMPTS_BROWS_CROWN.md

# 眉目与额冠 · 新增艺术素材

生成方式：内置 image_gen / imagegen 技能，四个资产分别独立生成；未使用 CLI、API 脚本或代码绘图。所有最终 PNG 均已复制到项目。

共同参考：此前实际模型视角生成的章节图，仅作主体与材质色彩参考，不是本轮编辑目标。背景均为不透明暖纸色，界面使用完整 contain 显示。

## 眉目导航图

- 原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-241e-7531-9fdd-936f76da40ff\exec-67e98889-8b49-4b40-83c3-a69403aefdff.png
- 项目输出：C:\Users\Administrator\Desktop\炫技5\public\images\navigation\brows.png
- 检查：单眼、象牙白眼圈与朱红眉弧，尺寸1254×1254；主体独立，无文字、无边框。细绒处接近边缘，UI完整展示无二次裁切。

完整提示词：

```text
Use case: stylized-concept.
Asset type: one artistic raster navigation icon for a Chinese southern lion dance cultural atlas, displayed at about 76 by 62 pixels.
Reference image: the provided brows chapter image is visual subject/material reference only, not an edit target.
Create a square 1024x1024 opaque illustration, single isolated eye and plush red curved eyebrow of a traditional southern Chinese lion head. A black lacquer spherical eye nested in an ivory circular eye rim, with a luxuriant cinnabar-red furry sweeping brow above, a tiny restrained antique-gold rim. The brow and eye occupy about 76% of the square with a strong readable silhouette. No whole head, no nose, no extra scene.
Art direction: artisan museum miniature, painterly gouache and refined colored-pencil surface, tactile red velvet fur, ivory and antique gold, soft diffuse lighting, delicate authentic hand-made variation. Fine detail but a simple clear subject at tiny UI size.
Background: flat seamless warm pale paper color #eeeae1, almost no grain, no cast-shadow rectangle, no vignette, no border or frame.
No text, labels, letters, numbers, signatures, watermarks, arrows, chart lines or glyphs. Not a flat vector, not SVG, not line icon. Keep every subject edge within the square.
```

## 额冠导航图

- 原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-241e-7531-9fdd-936f76da40ff\exec-22a67f86-637d-46f1-9848-0ec35e1c3b82.png
- 项目输出：C:\Users\Administrator\Desktop\炫技5\public\images\navigation\crown.png
- 检查：额饰珠盘与金圈，尺寸1254×1254；与眉目图共用纸色和红金材质，轮廓区分清楚，无文字。

完整提示词：

```text
Use case: stylized-concept.
Asset type: one artistic raster navigation icon for the forehead crown chapter of a Chinese southern lion dance cultural atlas, displayed at about 76 by 62 pixels.
Reference image: the provided crown chapter image is only a subject/material visual reference, not an edit target.
Create one square opaque illustration of an isolated traditional lion forehead central ornament: a sculptural vertical stack of three rounded small coral-red and antique-gold circular discs with a round peach-red finial, mounted before a larger round gold halo-like ring. Three-quarter angle with clear volume, not a regal European crown. A tiny ivory flourish at the base. Only this single ornament, no whole head or eyes.
Art direction: artisan museum miniature, painterly gouache with refined colored-pencil texture; tactile brocade coral-red details, ivory accents, muted antique gold, subtle worn handmade gilding. Coherent to an eye/brow red-fur navigation family, but distinctly ornament-shaped. Bold readable silhouette at tiny size. Main subject occupies 74% of square; all ornament within frame, generous clean breathing room.
Background: flat seamless opaque warm pale paper #eeeae1, almost no grain, no rectangle, vignette or border. Soft diffuse lighting.
No text, labels, letters, numbers, signatures, watermarks, arrows or diagram lines. Not a vector, not SVG or line icon. Square aspect ratio.
```

## 眉目神态图解

- 原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-241e-7531-9fdd-936f76da40ff\exec-c2a1e125-7523-49f8-b2eb-3cf444129df5.png
- 项目输出：C:\Users\Administrator\Desktop\炫技5\public\images\culture\brows.png
- 检查：尺寸1536×1024，三组眉眼横向对照：左半闭、中睁开、右不对称抬眉。图像是当代神态研究，不代表固定传统分类。完整原图的左右末端有自然构图切边，不另行裁切。

完整提示词：

```text
Use case: infographic-diagram.
Asset type: a museum-style educational cultural illustration for a southern Chinese lion dance atlas, shown in a narrow editorial website panel. This image is an artistic study, not measurement or exact reconstruction.
Reference image: provided brow chapter artwork is subject/material/color reference only, not an edit target.
Create a landscape 1536x1024 (3:2) opaque image. Three evenly spaced studies of the SAME traditional southern Chinese lion head's paired eyes and plush eyebrows, arranged left to right across the canvas in one calm horizontal sequence. Crop each study conceptually to its eye/brow area; do not render the whole head or mouth. Each pair should stay fully within the image. Left study: lowered ivory eyelid rims, relaxed curved red brows, calm/resting gaze. Middle study: both eyes wide open with round black lacquer pupils, raised symmetrical red brows, an awakening expression. Right study: eyes directed slightly to one side, brows lifted asymmetrically, an attentive/alert expression. Use the same red-fur lion identity in all three studies. Make those three differences visible at small size; brows/eyelids change, not pupil count. No extra eyes.
Style: refined hand-painted gouache and colored pencil, museum notebook material study, tactile cinnabar-red velvet/fur, ivory eyelid rims, antique-gold accents, restrained dark ink. Soft realistic volume, delicate artisan marks. Small faint pencil gesture sweeps near brows may express direction but no quantitative diagrams.
Background: seamless flat warm pale paper #eeeae1, ample negative space, very faint paper feel, no panels, boxes, dividing lines or elaborate frame. Keep composition simple and legible. Three studies each occupies its own third. No words, letters, numbers, captions, arrows, labels, legends, signatures or watermark. Do not imitate a vector drawing.
```

## 额冠工艺图解

- 原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-241e-7531-9fdd-936f76da40ff\exec-e8cf3e17-88b5-4462-9e94-8e93e3d0ef3f.png
- 项目输出：C:\Users\Administrator\Desktop\炫技5\public\images\culture\crown.png
- 检查：尺寸1536×1024，2×2依次为竹架、裱纸、彩绘、装饰。四阶段辨识清晰，艺术概述工艺，不是某一流派精确结构蓝图，也没有拆动用户模型。

完整提示词：

```text
Use case: infographic-diagram.
Asset type: educational art plate about traditional southern Chinese lion-head craft, for a Chinese cultural atlas website's right editorial panel.
Reference image: the provided crown chapter artwork is palette and finished-lion subject reference only. Make a NEW illustration, not an edit, not an exploded model.
Create a landscape 1536x1024 (3:2) opaque museum hand-painted process-study plate. Four clearly separated lion heads in a balanced 2 by 2 grid, each the same three-quarter-view head shape at equal size, plenty of clean spacing between them and margins. Reading order is upper-left to upper-right, then lower-left to lower-right.
Upper-left: an open lightweight bamboo-strip lattice frame of a traditional southern lion head; thin warm bamboo hoops define face, round eyes and jaw; plainly skeletal artisan frame, no metal, no electronics.
Upper-right: the same lion head's intact shape fully covered with layered ivory paper; subtle overlapping paper edge strips, no bamboo holes.
Lower-left: same intact head being painted in cinnabar coral red and muted antique gold with dark outlined ornamental shapes, smooth paper surface, still NO fur ornaments. No person or hand.
Lower-right: finished decorated traditional southern lion head with red velvet eyebrows and fur trims, ivory eye circles, antique-gold forehead central stacked round disc ornament, very short ivory chin tassels. Use the supplied reference's warm coral/gold/red family while retaining a handcrafted paper-head design.
Style: gouache and delicate colored-pencil artisan notebook drawing with real volume and material texture, restrained fine ink edges. Not photorealistic mass-production, not vector, not wireframe graphics.
Background: flat seamless warm pale paper #eeeae1, barely visible paper texture. No boxes, borders, panel separators, arrows, numbers, labels, words, captions, watermarks or signature. Keep each of the four heads fully visible, not touching image boundary. This is a broad craft-stage illustration, not a technical manufacturing blueprint and not removed pieces of the user's 3D model.
```

---

来源记录：C:\Users\Administrator\Desktop\炫技5\artifacts\enrichment\PROMPTS_BEARD_BODY.md

# 鬃须、织锦：导航与文化图版生成记录

模式：内置 image_gen；每个资产独立调用；不使用代码绘图、裁切或重绘。所有最终 PNG 保留原生完整画幅，已人工目视检查。

风格参考：项目既有 `public/images/chapters/beard.png` 与 `public/images/chapters/body.png` 已通过 view_image 检查，用于材质、纸底、朱金色系参考；四张均为新生成，并非旧图片裁切。

## 鬃须导航图

最终路径：C:/Users/Administrator/Desktop/炫技5/public/images/navigation/beard.png

原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-53f5-79a2-ac21-90f0b7687e62\exec-353b7e27-948e-45a6-8f62-012a8d7a59eb.png

检查：正方形 1254×1254；完整象牙白须束，朱红束绳和古金束口。实物艺术图，不含文字。

完整提示词：

```text
Use case: stylized-concept. Asset type: one square artistic navigation icon for a Chinese southern lion cultural atlas web page. Create a brand NEW 1024x1024 opaque image. Scene/background: perfectly plain warm paper #eeeae1, continuous to every edge, subtle minimal paper grain, no scene. Subject: one large ivory-white flowing lion-beard tassel, thick silky strands fanning gently downwards with a tiny cinnabar-red wrap and a small muted antique-gold collar at the top. Three-quarter sculptural miniature with artisan gouache and finely drawn colored pencil strand detail, tactile yet simplified enough to read clearly at 76x62 pixels. The single tassel occupies about 75 percent of canvas height, centered, gracefully curved silhouette, ivory strands remain distinct against paper with subtle warm grey pencil shading. Palette ivory, restrained cinnabar, muted antique gold. Composition: isolated complete object, no cropped edges, balanced moderate whitespace, soft tiny contact shading only. No head, no humans, no text, no labels, no numbers, no Chinese characters, no calligraphy, no logos, no watermark, no frames, no borders, no vector-code icon look.
```

## 织锦导航图

最终路径：C:/Users/Administrator/Desktop/炫技5/public/images/navigation/body.png

原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-53f5-79a2-ac21-90f0b7687e62\exec-c7487cf9-a7bd-469c-8ea2-be60426433e1.png

检查：正方形 1254×1254；朱金织锦折叠，清晰织物纹理和层次。

完整提示词：

```text
Use case: stylized-concept. Asset type: one square artistic navigation icon for a Chinese southern lion cultural atlas web page. Create a brand NEW square opaque image. Scene/background: plain continuous warm paper #eeeae1 to all four edges, barely visible minimal paper grain, no scenery. Subject: a single small folded piece of coral-red and antique-gold brocade cloth, lying as a graceful folded ribbon of fabric with a raised central bend, showing a simple repeating gilded floral-scroll motif on cinnabar/coral woven fabric; one muted dark teal accent in the motif. The fabric has obvious folded depth and textile weave. Artisan gouache and finely detailed colored pencil rendering, sculptural miniature, tactile but with a bold recognizable silhouette at 76x62 pixels. Subject centered and fills about 75 percent canvas width and 65 percent height, moderate whitespace, completely within frame, subtle soft contact shade only. Palette restrained cinnabar red, ivory, antique gold, tiny muted teal. No lion head, no humans, no extra objects, no text, no labels, no Chinese characters, no numerals, no calligraphy, no logos, no watermark, no border, no frame, no vector-code graphic style. Do not render a photo; draw a polished museum craft study.
```

## 鬃须文化图

最终路径：C:/Users/Administrator/Desktop/炫技5/public/images/culture/beard.png

原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-53f5-79a2-ac21-90f0b7687e62\exec-7d9d6374-1e12-4bc2-8d91-f974bbe757f9.png

检查：1536×1024，三组低首、昂首、转首示意。须饰形态为艺术性随动研究；并非原模型动画或绑定结果。

完整提示词：

```text
Use case: infographic-diagram. Asset type: cultural information study illustration inside a Chinese southern lion digital museum, landscape 3:2 format. Create a NEW illustration, not a UI screenshot. Opaque plain warm paper #eeeae1 background, continuous to every edge. Exactly THREE separate small studies of the SAME red-and-ivory Chinese SOUTHERN lion dance head, evenly spaced left to right, each head fully visible and slightly three-quarter view. LEFT: head gracefully lowered and long ivory beard falls nearly vertically; CENTER: head lifted and long ivory beard fans gently backward in a soft suspended curve; RIGHT: head turns sideways and ivory beard trails in a flowing curve. Show obvious different orientations of the head and soft ivory strands. All three matching heads have cinnabar red brows, ivory fringes, muted gold/coral ornament and small teal accents, friendly expressive eyes. This is an artistic gesture study of how attached flexible decoration can follow head motion, not an exact engineering drawing, not a model disassembly. Refined hand-painted gouache with fine colored pencil strand detail, restrained museum notebook aesthetic. Pale warm grey pencil motion trails behind beard only, no arrows, no graph, no measurements. Organized horizontal educational comparison with generous separation, heads occupy the middle seventy percent of height, no crop. NO humans or performers, no body, no labels, no text, no words, no letters, no numbers, no calligraphy, no watermark, no borders or frames. No disconnected floating head parts, no exploded anatomy. Landscape 1536x1024.
```

## 织锦文化图

最终路径：C:/Users/Administrator/Desktop/炫技5/public/images/culture/body.png

原始输出：C:\Users\Administrator\.codex\generated_images\01a17862-53f5-79a2-ac21-90f0b7687e62\exec-b124f1d7-ccea-41e0-bee6-7f4a6d6d1803.png

检查：1536×1024；单元—连续—曲面三种观察尺度；图案为当代示意，不指认历史纹样寓意或实际UV。

完整提示词：

```text
Use case: infographic-diagram. Asset type: cultural textile visual-analysis illustration inside a Chinese southern lion digital museum. Create a NEW LANDSCAPE 3:2 illustration 1536x1024, not a website screenshot. Background opaque continuous warm paper #eeeae1, plain clean paper to every edge with minimal subtle grain. Composition: THREE clearly separated studies aligned across one horizontal row, left to right, a visual progression of textile design: LEFT a SINGLE ornate coral-red and antique-gold floral-scroll motif unit drawn flat, clearly isolated with no surrounding repeats, decorative symmetric stylized flower and two curving leaves; CENTER a FLAT rectangular brocade swatch containing a grid of repeated identical smaller floral-scroll motifs, muted gold on cinnabar/coral cloth with tiny dark teal leaves, clearly displays repetition; RIGHT the SAME repeating brocade cloth draped as one gracefully curved folded ribbon, pattern follows folds and perspective, tactile woven threads visible. Each study distinct with generous blank space between. Three study subjects centered vertically and completely visible, no crop. This is a contemporary illustrative unit-repeat-drape concept, no claim of specific historical symbolism or actual UV/mesh mapping. Museum notebook art in hand-painted gouache plus precise fine colored pencil, ivory highlights and muted antique gold, restrained red, no harsh shadows. No lion or humans, no disconnected model parts, no measurements, no arrows, no graphs, no legend, no text, no words, no labels, no letters, no numbers, no Chinese characters, no watermark, no frames or borders. Preserve clean structured educational composition and visible material texture.
```

---

来源记录：C:\Users\Administrator\Desktop\炫技5\artifacts\enrichment\PROMPTS_TRIM_MOUTH.md

# 云边与口齿新增图像：生成提示词及来源

全部使用内置 image_gen 生成，每张独立调用。没有使用代码绘制、裁切或拼贴。生成图像已逐张视觉检查，并原样复制入项目；原始生成文件仍保留。参考现有 chapters/trim.png 和 chapters/mouth.png 的材料与配色，但本次均为全新构图。

## 云边入口艺术图

- 保存路径：`C:/Users/Administrator/Desktop/炫技5/public/images/navigation/trim.png`
- 原始路径：`C:\Users\Administrator\.codex\generated_images\01a17862-7c45-7421-9e23-058f0e20c8db\exec-a355446f-6a9c-4ae0-907a-fb37b32f5b2f.png`
- 尺寸：1254 × 1254
- 检查：红绒波浪边饰，象牙描边与少量金线；主体完整可见，无文字。

完整提示词：

```text
Use case: stylized-concept. Asset type: one square artistic navigation thumbnail for a Chinese southern lion cultural atlas. Primary request: an artisan gouache and colored-pencil sculptural miniature of a broad cinnabar red scalloped textile edging ribbon with a narrow ivory edge, forming two to three clear rolling waves, inspired by the red velvet edging on a southern Chinese lion costume. Opaque square canvas, seamless uniform warm paper background #eeeae1 with very subtle paper grain. Centered bold readable silhouette, occupying roughly 75 percent of canvas width and 60 percent height, no clipping. Rich tactile red velvet fibers, ivory piping, restrained muted antique-gold touches, soft subtle contact shadow. Beautiful hand-painted museum study, dimensional but not glossy plastic, coherent with warm traditional craft illustrations. It will be displayed small around76x62pixels so make the wave shape clear and simple. NO text, no numerals, no letters, no glyphs, no borders or frames, no badge, no watermark, no vector icon appearance, no UI mockup. Generate one image only.
```

## 口齿入口艺术图

- 保存路径：`C:/Users/Administrator/Desktop/炫技5/public/images/navigation/mouth.png`
- 原始路径：`C:\Users\Administrator\.codex\generated_images\01a17862-7c45-7421-9e23-058f0e20c8db\exec-0aa05e5f-1c5e-494a-9047-bce932ee4a63.png`
- 尺寸：1254 × 1254
- 检查：红色绒面狮口，象牙牙弧和舌面；可识别为狮头道具而非人嘴，无文字。

完整提示词：

```text
Use case: stylized-concept. Asset type: a single square artistic navigation thumbnail for a southern Chinese lion cultural atlas. Primary request: centered sculptural miniature of ONLY a traditional Chinese southern lion costume mouth, a friendly broad red velvet upper muzzle with one clear row of flat ivory block teeth, a lower red velvet jaw curved like a crescent with lower ivory teeth, and a small coral red tongue inside. Distinctly Southern lion costume, not a human mouth and not realistic animal mouth. Opaque square warm paper background #eeeae1, uniform and seamless, subtle paper fibers. Artisan gouache with fine colored-pencil detail, gently dimensional, tactile red velvet and ivory wood/paint, restrained antique gold accent on tongue, soft contact shadow. Large bold readable silhouette occupying 78 percent width and55 percent height, entire miniature visible with margin. Will be used around76x62pixels, so avoid excessive tiny decoration. No eyes, no full head, no beard obscuring the mouth. No text, numerals, letters, glyphs, borders, frames, badge, logo, watermark or code-vector appearance. One image only.
```

## 云边文化图解

- 保存路径：`C:/Users/Administrator/Desktop/炫技5/public/images/culture/trim.png`
- 原始路径：`C:\Users\Administrator\.codex\generated_images\01a17862-7c45-7421-9e23-058f0e20c8db\exec-cac76a3f-6b89-4940-a34c-c5346ce1cfbe.png`
- 尺寸：1536 × 1024
- 检查：三行边饰，浅起伏、曲折和深褶连续变化；图像为造型与布料节律示意，不指认传统云纹谱系。

完整提示词：

```text
Use case: infographic-diagram. Asset type: landscape3:2 cultural illustration for the right-hand editorial panel of a Chinese southern lion atlas. Primary request: a beautiful museum hand-painted study sheet about continuity and folding rhythm of the red scalloped velvet hem of a southern lion costume. Exactly three distinct horizontal ribbon studies arranged top to bottom on opaque warm ivory paper #eeeae1, evenly spaced with clean margins. Top study: a long gently stretched cinnabar-red scalloped hem with thin ivory piping, 4 shallow repeating scallops, with a narrow coral-and-gold brocade strip behind. Middle study: the same red hem and coral-gold brocade drape folded in a soft S curve, illustrating how a continuous edging follows fabric. Bottom study: the same hem flowing in 3 deep folded waves, rich dimensional cloth shading. All three entire ribbon studies visible, not clipped. Refined artisan gouache, colored-pencil fibers, subtle graphite construction lines, antique gold and coral, museum field-note illustration. Flat warm paper behind, no frame. This is an artistic visual study of costume edges, not a historical cloud-symbol genealogy or a measured geometry chart. No text, letters, numerals, labels, arrows, ticks, fake measurements, watermark, UI elements, exploded anatomy, or code-vector drawing. Do not draw a full lion or people. One single landscape3:2 image.
```

## 口齿文化图解

- 保存路径：`C:/Users/Administrator/Desktop/炫技5/public/images/culture/mouth.png`
- 原始路径：`C:\Users\Administrator\.codex\generated_images\01a17862-7c45-7421-9e23-058f0e20c8db\exec-011fb949-e3a9-42a2-8577-ef49ae1d9344.png`
- 尺寸：1536 × 1024
- 检查：同一狮头的闭口、微启、张口三态，左至右顺序清楚，完整可见；艺术表演概念，不声称源模型可绑定活动。

完整提示词：

```text
Use case: infographic-diagram. Asset type: a landscape3:2 museum editorial culture illustration for a Chinese southern lion atlas. Primary request: three separate matching Chinese southern lion costume heads arranged evenly in ONE horizontal row left to right, showing expressive mouth opening, with each entire head visible and unobscured. All three have the EXACT SAME friendly traditional Southern lion design, red velvet brow/muzzle, ivory fur beard and ear fringe, small antique gold forehead ornament, round lively eye, coral and gold painted patterns; viewed in the same mild side/three-quarter angle facing right. Left: mouth fully closed with upper and lower jaw meeting, almost no dark opening. Center: mouth slightly open, small dark gap with ivory teeth visible. Right: mouth widely open, lower jaw lowered visibly with ivory tooth row and small coral tongue, revealing larger dark red mouth cavity. Keep same head size, same head silhouette above jaw, each separate with clear warm paper negative space between; no clipping. Refined hand-painted gouache and colored-pencil museum craft study, soft dimensional shading, tactile velvet/fur, restrained cinnabar, ivory and muted antique gold. Opaque seamless warm paper background #eeeae1. This is an artistic performance expression sequence, not a disassembled model, measured anatomy or actual rig illustration. No human or animal realism, no full bodies, no bones, no exploded components, no arrows, labels, text, characters, numerals, ticks, watermark, border, frame or UI. Generate one complete3:2 landscape illustration.
```

