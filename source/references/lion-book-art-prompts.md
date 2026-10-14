# 《岭南醒狮志》插画提示词与生成记录

- 日期：2026-10-14。
- 工具：内置 `image_gen.imagegen`，编辑模式；所有调用 `transparent_background: true`，未使用 API/CLI 后备。
- 共同输入：原 ThreeUI Sketchbook 展开书页 `tmp/threeui-research/package/lib-dist/assets/sketchbook/marina-bay-sands.png`。该文件作为纸张轮廓、书脊、页叠、纸纹和水彩笔墨参照，不沿用新加坡插画内容；组件来源与授权记录由整合文档保存。
- 最终文件：`source/public/assets/lion-book/` 下七幅 RGBA PNG。均直接从内置工具官方输出复制，没有绘图脚本、裁切、重绘或后期像素编辑。
- 性质：AI 辅助创作的文化叙事插画，属于主题示意；不是历史现场影像、出土文物图录或经考据复原图。场景不能单独用来证明历史年代与传播路线；页面可读文字和来源以站点的历史资料说明为准。
- 画面比例米白50%、醒狮红30%、墨黑15%、金5%是创作提示的视觉配比，并非图像统计结果。

## 文件与实际检查

逐张检视了内置工具的完整输出：七个主题、中文主副题、双页展开、水彩墨线、红色主体、无新加坡地标、无外部场景或棋盘底。起源页为古代瑞兽与民俗场景，不出现现代醒狮；传播页为港口和海外节庆，不使用地图。封面与终章的品牌字句正确。

工具实际输出约1494×1052，未严格服从提示的1760×1240像素要求。二者纵横比差小于0.1%，书本主体采用相同归一化范围；没有把文件伪称为1760×1240。以下由 Python/Pillow **只读检查**得到，alpha包围盒为左上含、右下不含的 `(left,top,right,bottom)`：

| 文件 | 尺寸 | 字节 | alpha>240主体包围盒 | 检视字句 |
| --- | --- | ---: | --- | --- |
| cover.png | 1495×1052 RGBA | 1818502 | (78,228,1415,820) | 岭南醒狮志／一狮一鼓，百年传承 |
| origin.png | 1494×1052 RGBA | 1876763 | (78,232,1420,820) | 起源 · 瑞兽文化／汉唐渊源 |
| formation.png | 1495×1052 RGBA | 1949885 | (78,229,1418,823) | 南狮形成 · 民间技艺／明清时期 |
| martial.png | 1494×1052 RGBA | 1963362 | (78,230,1415,822) | 武术融合 · 醒狮兴盛／清末民初 |
| spread.png | 1494×1052 RGBA | 1876971 | (78,231,1416,819) | 岭南传播 · 走向世界／20世纪 |
| modern.png | 1495×1052 RGBA | 1946279 | (80,232,1416,820) | 非遗传承 · 今日醒狮／现代 |
| ending.png | 1494×1052 RGBA | 1793794 | (79,230,1415,820) | 南风有狮／鼓声未远，狮魂长存 |

总大小 13225556 字节。四角alpha均为0。主体不透明轮廓约横向5.2%—95%、纵向21.7%—78.2%，书脊在50%。模型在极远透明留白区有极淡低alpha散点：顶部0—149行和底部900行以后最大alpha为1（终章为2），不能用alpha>0包围盒当作书页主体边缘；没有用后期脚本去除这些点。alpha>16包围盒均贴近书页轮廓。最终运行效果仍须结合真实翻页组件作浏览器验收。

## 官方输出与运行资源映射

- `cover.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-201d7745-4195-44ef-955c-867ed1c014ba.png` → `source/public/assets/lion-book/cover.png`。
- `origin.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-0f3b93cd-bf2d-4772-b6d1-563c49bdcc4c.png` → `source/public/assets/lion-book/origin.png`。
- `formation.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-a72b97a4-2bc6-43cb-8a55-8a0dd14bc26f.png` → `source/public/assets/lion-book/formation.png`。
- `martial.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-31a2d390-dffa-4be5-be8e-61a3d3e627a0.png` → `source/public/assets/lion-book/martial.png`。
- `spread.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-99fc5a2d-466f-4ba5-bcc4-8c4614f885ee.png` → `source/public/assets/lion-book/spread.png`。
- `modern.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-01f88a5c-8bf7-4123-94cd-36b870d7eefa.png` → `source/public/assets/lion-book/modern.png`。
- `ending.png`：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-ac6c2419-896d-48ec-8c3d-14a0e4b32d4d.png` → `source/public/assets/lion-book/ending.png`。

封面初次生成的未采用版本：`C:/Users/Administrator/.codex/generated_images/01a13920-b80c-7c20-bf38-0021084de966/exec-f7721d50-db0a-41b6-bdae-acb4ae78b394.png`；随后通过内置工具作纸边/几何定向修订，最终采用上表版本。

## 完整原始提示词

每次调用都单独生成一种页面主题，`referenced_image_paths` 指向共同输入原书页。封面修订额外参考初次生成封面。以下保留实际发送的原文。

### cover

```text
Use case: precise-object-edit, illustration-story.
Asset type: transparent double-page illustration texture for the real ThreeUI Sketchbook page engine.
Input image 1 is the EXACT edit target and immutable paper geometry template. Preserve its original 1760 by 1240 RGBA canvas, transparency, book silhouette, edge curves, page stack, spine fold and paper grain. The open book exists ONLY between x90 and x1671 and between y270 and y970, spine exactly x880. Keep 22% completely transparent empty margin above and below; never enlarge or move the book. Keep both pages flat and almost front facing, same perspective and dimensions as reference. Edit only the INK AND PAINT printed on these paper pages: completely erase all Singapore buildings, waterfront, old text and stamp.
New illustration: the frontispiece of a Lingnan lion-dance heritage hand-painted archive. A magnificent traditional southern Chinese red lion head, fine muted gold trim, flowing vermilion silk, a red festival barrel drum, distant subtle Lingnan grey tile rooftops, small cinnabar seal. Spacious two-page composition with title on the left and lion head on the right; all paint fully inside the paper. Primary colors: unpainted warm ivory paper 50%, vermilion lion red 30%, delicate charcoal ink drawing 15%, muted antique gold 5%. Low-saturation watercolor, irregular translucent pigment blooms, loose precise pen hatching and handmade archival travel-sketchbook character exactly like reference, not a commercial poster. A beautiful old museum manuscript.
Text exactly, natural dark brush handwriting: "岭南醒狮志" as the main title, "一狮一鼓，百年传承" as the smaller subtitle. No other writing, no English, no date, no watermark. The words must be correct. Real transparent background outside paper, not black/white/checkerboard. Do not change the actual shape, scale, placement or paper texture of the open book. No background scene outside the book. No 3D rendered lion, no game concept art, no photoreal animals, no neon, no saturated commercial guochao poster.
```

### cover_refine

```text
Precise-object-edit. Use the first image as exact original paper silhouette template and the second image as completed cover artwork to keep. Fix ONLY geometry and transparency of image 2: final PNG resolution exactly 1760 pixels wide and 1240 pixels tall. Place the open book paper within x90..1671, y270..970, middle fold x880, as in image 1, with 270 transparent pixel rows above and below the book. Match every outer edge and paper curve to image 1. Clean all detached watercolor flecks outside the paper; paint must remain on the paper surface. Preserve image 2's beautiful red-gold lion head, red drum, Lingnan architecture, correct Chinese title "岭南醒狮志" and subtitle "一狮一鼓，百年传承", all watercolor textures, positions relative to pages, and paper grain. Do not redraw or change content. The only change is size and exact original book geometry against real alpha transparency. No environment, floor, shadow outside the paper, no checkerboard, no black or white background. No extra text.
```

### origin

```text
Use case: precise-object-edit, historical-scene.
Asset type: transparent double-page illustration texture for the real ThreeUI Sketchbook book engine.
Input image 1 is the EXACT edit target, geometry and style template. Keep its original canvas aspect ratio 1760:1240; preserve original book silhouette, outer page curves, page stack, paper grain and spine fold. Book paper normalized bounds x5.1%..94.9%, y21.8%..78.2%, central crease x50%. Transparent blank margin above and below book, nothing printed or floating outside paper. Do NOT crop, zoom, shift, enlarge, tilt or shrink the book. Keep nearly front-facing spread and same perspective. Replace only all ink and paint on the paper; erase every Singapore building, original text, original date and stamp.
New illustration for page 01 of "Lingnan Lion Dance Chronicle": origins and auspicious beast culture before and during Han/Tang, shown as an interpretive heritage sketch, not modern lion dance. Across the left page misty Lingnan karst hills and river in pale ink washes, an ancient stone/pottery-style auspicious beast with curled mane in cinnabar red and antique gold, small red folk talismans. Across the right page a small ancient village offering scene with red ritual banners and simple figures, ink sketches of early auspicious beast motifs, red ribbons suggesting a conceptual progression from beast legends to folk custom. No modern southern lion head, no contemporary uniforms or buildings. Calm scholarly historical imagination, not a factual archaeological reconstruction.
Style: the same beautiful restrained watercolor and hand-ink travel sketch as reference, irregular transparent pigment and light pen hatching, warm fibrous rice paper. Fifty percent open ivory, thirty percent muted vermilion red, fifteen percent black ink, five percent muted gold. Red is the strongest color, no green plants as subject.
Exact dark Chinese brush handwritten heading: "起源 · 瑞兽文化"; small secondary line: "汉唐渊源". Correct Chinese only; no paragraphs, no other text or date. Everything painted inside paper. Output PNG with real alpha transparency outside paper, not white/black/checkerboard. No 3D render, game art, modern guochao poster, photorealism or complex external scenery.
```

### formation

```text
Use case: precise-object-edit, historical-scene.
Asset type: transparent double-page watercolor illustration texture, real ThreeUI Sketchbook.
Input image 1 is an EXACT immutable paper geometry and medium template. Preserve canvas aspect ratio 1760:1240, original open book silhouette and position, curving outer corners, page stack, paper grain and central fold x50%. The opaque paper must occupy only x5.1%..94.9%, y21.8%..78.2%; preserve transparent top and bottom margins. Do not enlarge, crop, zoom, tilt or reposition book. Edit ONLY ink and watercolor printed inside pages; erase all Singapore waterfront content, text, date and stamp.
Page 02: emergence of southern lion craft in Ming-Qing era folk life. A traditional Lingnan workshop occupies both pages. On the left an elderly artisan in simple late-imperial cloth clothes, carefully weaving a rounded bamboo lion-head frame on a worn wooden worktable. Bamboo strips, scissors, paper brushes, mineral pigment bowls in vermilion and muted gold. On the right a beautiful completed RED southern Chinese lion head, decorative antique-gold eye sockets and fluffy ivory trim, a half-finished bamboo armature beside it, loosely draped red silk. A subtle traditional brick wall and window only as watercolor hints printed on paper, no external background. Let the tools and construction process tell the story; handmade craftsmanship is the focus.
Maintain reference's refined low-saturation hand-painted watercolor and black pen hatching. Warm ivory rice-paper negative space50%, deep vermilion red30%, black ink15%, aged gold5%. A scholarly folk-craft sketchbook, not 3D nor a glossy commercial poster. Accurate anatomical traditional lion head, not real lion animal.
Handwritten Chinese text only: main title "南狮形成 · 民间技艺", secondary small line "明清时期". Both correct. No other text, no English, no watermark. Real alpha transparency OUTSIDE book, not black/white/checkerboard. No paint flecks beyond paper edges.
```

### martial

```text
Use case: precise-object-edit, historical-scene.
Asset type: real transparent double-page illustration texture for ThreeUI Sketchbook.
Input image 1 is the exact edit target and immutable paper geometry template. Preserve original canvas aspect ratio 1760:1240, book size/position, open spread shape, rounded corners, page stack, paper texture and spine x50%. Opaque book occupies normalized x5.1%-94.9%, y21.8%-78.2%. Top and bottom margins must be completely transparent, no flecks or background. Do not crop, zoom, enlarge, tilt or reposition. Replace ONLY ink and watercolor on paper, remove every Singapore scene, original text/date/stamp.
Create page 03 of a Chinese Lingnan southern lion heritage archive: late Qing/early Republic martial-arts hall training. Two-page watercolor ink scene. On the left a traditional grey brick martial hall with a simple unlettered dark plaque and a red festival drum, one young Chinese drummer in red cloth jacket, two trainees practicing grounded southern kung-fu stances. On the right a RED and ivory southern Chinese lion carried by a two-person lion team practicing a strong energetic low-to-high dancing move; one trainee's legs visible beneath red embroidered lion cloth. Flowing red flags, red sashes, red clothing suggest rhythm and power. Keep historical everyday cloth uniforms, no modern sneakers, no fantasy martial weapons. Dynamic paint gesture but archival realism, careful respectful depiction.
Style must match reference: low-saturation hand-drawn black ink linework with loose vermilion watercolor blooms, warm handmade rice paper, charming quiet sketchbook. Unpainted ivory50%, vermilion red30%, black ink15%, antique gold5%. Dramatic red accents, not flashy commercial design.
Exact handwritten Chinese main heading "武术融合 · 醒狮兴盛"; smaller subheading "清末民初". No other writing, no English, no watermark. Paint only inside original paper. Output true alpha transparency outside book (not black/white/checkerboard), no 3D rendering, video game art, neon, commercial guochao poster.
```

### spread

```text
Use case: precise-object-edit, historical-scene.
Asset type: true-alpha transparent double-page illustration texture used by original ThreeUI Sketchbook.
Input image 1: exact edit target and invariant book paper geometry template. Preserve original canvas aspect ratio 1760:1240, book placement and scale, page stack, soft curved corners, central spine exactly50%, paper grain and perspective. Normalized paper bounds x5.1..94.9%, y21.8..78.2%. Keep top/bottom transparent margin. Do not zoom, crop, enlarge, tilt or reposition the book. Change ONLY ink and watercolor painted inside the original paper; remove original Singapore skyline/buildings/date/stamp/text.
New historical page 04: twentieth-century Lingnan southern lion traditions traveling overseas. Tell story without any map. Left page: a modest southern Chinese port with old wooden sailing and early steam vessels, simple dock, travelers carrying trunks and carefully packed lion head, red silk ribbon. Right page: an overseas Chinese street festival with low shophouse facades, strings of vermilion red lanterns, a red-gold southern Chinese lion dance team and red barrel drum among a few onlookers. Make period early-to-mid twentieth-century, subtle diverse street setting, no modern skyscrapers or Singapore landmarks. Harbor on left transitions poetically into red lantern street on right. No national flags, no maps, no map lines/globes.
Original refined sketchbook medium: loose delicate black ink drawing, transparent low-saturation watercolor blooms, handmade fibrous ivory paper. Composition breathes, ivory50%, strongest color vermilion30%, ink15%, quiet gold5%. Hand-painted cultural archive, not colorful commercial poster, no 3D render.
Exact Chinese handwritten heading "岭南传播 · 走向世界"; small subtitle "20世纪". Correct words only, no English, no other text/date/watermark. No external background, no paint flecks beyond paper. PNG with genuine alpha transparency outside book, not a black/white/checkerboard background.
```

### modern

```text
Use case: precise-object-edit, illustration-story.
Asset type: true-transparent double-page watercolor art for original ThreeUI Sketchbook.
Input image 1 is the EXACT immutable paper geometry and medium template. Preserve original canvas aspect1760:1240, placement and scale of book, paper outline, rounded corners, page stack, fibrous paper texture and central fold x50%. Opaque paper normalized bounds x5.1..94.9%,y21.8..78.2%. Keep completely empty transparent top and bottom margins. Never crop, zoom, reposition, enlarge or tilt the book. Replace ONLY printed artwork inside the pages; entirely remove Singapore waterfront, original text, date and stamp.
Page 05 of Lingnan lion-dance cultural history: living heritage and young inheritors today. A vivid RED southern Chinese lion with muted gold ornaments and ivory fur is the central subject on right page, animated by young adult performers in contemporary red training shirts and plain dark trousers. Left page: a kindly older teacher guiding a school-age boy and girl holding a small red lion head, another young person learning a red barrel drum. On-page background combines faint grey Lingnan tiled roofs and a modern city skyline softly drawn in ink wash, showing tradition in present daily urban life, not a huge metropolis photograph. A red sash joins both scenes. Small tasteful red lantern accents. Young team learning together, active joyful respectful transmission.
Retain reference's delicate handmade watercolor notebook aesthetic: irregular transparent pigment, fine charcoal ink hatching, generous warm ivory rice paper50%, vermilion red30%, black15%, subtle old gold5%. Red clearly dominant chromatic identity. Not a commercial poster nor flashy game concept illustration.
Exact handwritten Chinese title "非遗传承 · 今日醒狮"; small subtitle "现代". Correct simple readable Chinese, no other text/English/date/watermark. Paint contained strictly inside book paper. Real alpha transparency outside book, not black/white/checkerboard, no shadow or environment outside book, no 3D rendering or photorealism.
```

### ending

```text
Use case: precise-object-edit, illustration-story.
Asset type: alpha-transparent double-page finale illustration texture for ThreeUI Sketchbook.
Input image 1 is the exact invariant paper and book geometry template. Preserve original image aspect ratio1760:1240, book silhouette, scale and placement, central fold x50%, rounded page corners, paper thickness stack and grain. Normalized opaque book occupies x5.1..94.9%,y21.8..78.2%; keep upper/lower margins fully transparent with no detached flecks. No crop, no zoom, no movement, no tilt, no resized book. Change ONLY ink and paint on the paper; erase original Singapore skyline, text/date/stamp.
Final spread of "Lingnan Lion Dance Chronicle", a calm uplifting brand close. A WHOLE traditional southern Chinese lion, head through tail and four cloth-covered performer legs, in vermilion red with softly aged gold ornaments and ivory fluffy trim, performs a proud elegant alert stance across the lower middle of both open pages. The lively expressive round lion head is on the right, long red-and-ivory embroidered lion cloth body flows left, the complete tail visible; clearly a handmade festival lion costume, not a real lion animal. Red silk sweeps gently around it, a modest red drum and small cinnabar seal, very faint Lingnan roofline ink wash. Leave generous ivory paper above for beautiful legible Chinese brush lettering. Respect original restrained watercolor travel-sketch character.
Palette: ivory50%, vermilion30%, charcoal15%, antique gold5%; low saturation watercolor with transparent pigment blooms and fine expressive pen lines, warm fibrous rice paper. Quiet museum archive, no commercial poster, no photo-real animal, no 3D or game art.
Exact Chinese main title: "南风有狮". Exact smaller closing line: "鼓声未远，狮魂长存". Both must be perfect, no other text, no date, no English or watermark. All drawing inside paper edges. Output PNG with genuine transparent alpha outside original paper, not black/white/checkerboard, no external environment.
```
