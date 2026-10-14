# 跨页探头醒狮生成与鼻部修正记录

- 执行方式：内置 imagegen；全流程保持 transparent_background=true，没有CLI或Python图像处理。
- 构图参考：用户提供的小红书图片，只参考狮头探出与双爪搭边的姿势；没有编辑或去除该参考的文字、水印。
- 首次生成：`exec-ca20103b-ce1a-4b91-aac9-d92caf852756.png`。用户指出鼻子奇怪，不作为网页最终素材。
- 局部编辑：`exec-ab148310-6a50-4dc9-a532-be6d5d647cbf.png`。只修正鼻部，最终部署为 `source/public/assets/decor/lion-peeking-divider.png`。
- 新背景另用用户PNG原字节，不属于生成结果。

## 首次生成提示词（原文）

```text
Use case: stylized-concept
Asset type: transparent decorative cutout for a Chinese lion heritage website section divider.
Primary request: Create ONE original cute red Guangdong lion-dance head peeking over an imaginary horizontal page boundary, with two red furry paws resting on that same boundary. Front view, head above the boundary and claw tips/muzzle just below it.
Scene/backdrop: genuinely transparent alpha background; there must be NO physical ledge or wall drawn.
Subject: a charming traditional southern Chinese lion head, rich scarlet fluffy eyebrows and mane, large lively glossy amber-brown eyes looking directly forward, expressive friendly curiosity, modest finely painted gold and jade-green ornaments, soft white muzzle/beard, two small symmetrical red furry paws with subtle dark claw tips. No body or humans.
Style/medium: refined softly dimensional illustrated mascot, tactile fluffy fur, clean polished edges suitable for compositing over warm cream rice paper; not photorealistic and not an emoji.
Composition/framing: wide approximately 3:2 canvas; head centered between both paws, all fur and paws fully inside the image, tight but sufficient transparent padding. Paws at about three quarters of the composition height, so the head crosses a webpage divider naturally.
Lighting/mood: soft warm diffuse light, gentle shadows on the subject only, welcoming lively expression.
Constraints: ORIGINAL design, not a reproduction of any artist's image. No text, Chinese characters, stamp, logos, watermark, signature, background, horizontal line, page, border or extra decorations. No extra paws, limbs or eyes. Genuine transparency, no checkerboard painted into the image.
```

## 最终鼻部编辑提示词（原文）

```text
Use case: precise-object-edit
Input image: the provided transparent peeking lion cutout is the edit target.
Primary request: Correct ONLY the awkward central NOSE assembly of this Chinese lion-dance mascot.
Replace the protruding central red pompom with green bead, and the two flanking ball-like red/green nose decorations, with ONE coherent flatter, wider vermilion red painted lion-dance nose. It should be an elegant stylized broad double-lobed ruyi-inspired nose with TWO clearly readable small dark oval nostrils, understated gold painted curved outlines, and a slim soft white fur trim joining the existing white muzzle. The nose has modest shallow depth, not a spherical ball or pet-dog snout. Remove the green bead from the nose tip. No bead cluster or stacked nose ornaments.
Keep the existing forehead jade ornaments UNCHANGED; the no-green rule applies ONLY to the nose.
Invariants: keep the same red fluffy fur, eyes, ears, eyebrows, forehead decoration, white beard, mouth, two paws, framing and original transparent alpha. Do not redesign or recolor the rest of the head. The paired paws still rest at the same imaginary horizontal divider. Preserve all fur and paws, no cropping.
Background: genuinely transparent alpha, no added backdrop, red halo, dark shadow field, ledge or floor.
Avoid: text, stamp, logo, watermark, extra facial parts, pig nose, human nose, plastic ball nose.
```
