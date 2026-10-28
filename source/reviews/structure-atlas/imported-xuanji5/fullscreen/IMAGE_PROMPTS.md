# 全屏主图生成记录

六张图均使用内置 `image_gen` 分别生成。输入 1 是 `reference-wide/<id>.png`：实际 Three.js 在 1920×1020 整窗及该章节登记相机终点的截图，作为构图目标；输入 2 是原 `public/images/chapters/<id>.png`，仅作为材质与艺术风格参考。输出原图复制到 `public/images/fullscreen/`，未对 PNG 裁切、拉伸或重绘。图片是艺术转译，不是模型实测或历史照片。

| 章节 | 原生输出尺寸 | 内置生成原件 |
| --- | --- | --- |
| brows | 1720×914 | `C:/Users/Administrator/.codex/generated_images/01a17dcf-30f9-7022-b454-7c6a5205a4bf/exec-562e9e2d-e697-42fb-80d2-dcaa418bd00f.png` |
| crown | 1720×914 | `C:/Users/Administrator/.codex/generated_images/01a17800-52bb-7571-a427-5385b740f19e/exec-80def045-b121-475a-8ced-1ce213035c6a.png` |
| beard | 1721×914 | `C:/Users/Administrator/.codex/generated_images/01a17800-52bb-7571-a427-5385b740f19e/exec-8ac155ce-2beb-4f80-aad9-9057bbee9b6c.png` |
| body | 1720×914 | `C:/Users/Administrator/.codex/generated_images/01a17dce-9443-75f0-b218-5bd3fcd924c0/exec-c7deb5ce-0631-4a5c-83b3-f74e40920189.png` |
| trim | 1721×914 | `C:/Users/Administrator/.codex/generated_images/01a17dce-9443-75f0-b218-5bd3fcd924c0/exec-eb19a267-7495-4043-ac96-6a662017901c.png` |
| mouth | 1720×914 | `C:/Users/Administrator/.codex/generated_images/01a17800-52bb-7571-a427-5385b740f19e/exec-e6a6955a-c353-40ca-b146-ffbb7bdc20ee.png` |

眉目完整提示见 [brows-wide-prompt.md](candidates/brows-wide-prompt.md)，织锦和云边完整提示见 [BODY_TRIM_PROMPTS.md](candidates/BODY_TRIM_PROMPTS.md)。16:9 眉目试图与记录另保存在 `candidates/`，不是当前网站主图。

额冠、鬃须和口齿采用以下完整共同提示，并分别附加下方构图要求：

```text
Use case: identity-preserve, precise-object-edit. Asset: full-window chapter artwork for a Chinese Southern lion interactive exhibit. INPUT IMAGE 1 is the actual full-window Three.js camera endpoint and is the strict edit target and composition lock. INPUT IMAGE 2 is a previously generated 3:2 artwork and is a material and lighting reference ONLY; never copy its framing or crop. Output an opaque widescreen image with the SAME aspect ratio as image 1 (1920:1020, about 1.882:1). Preserve the entire image-1 frame from edge to edge: exactly the same camera, perspective, lens, view direction, zoom, object scale, silhouette, position and placement of every visible object, and the same natural visible frame edges. Do not recenter, zoom, rotate, mirror, crop, or shrink the subject. Match the normalized coordinates of every prominent object to image 1. All lion parts remain connected. Refine only broken polygon artifacts, lighting and tactile surfaces, following image 2: scarlet velvet, soft ivory fur, coral and antique gold ornaments and brocade, dark polished details. Background is warm ivory paper #eeeae1; delicate pale red/graphite gestures may appear only in existing empty background without obscuring the model. This is an artistic but composition-registered full-screen crossfade from the actual model, not a new design. No text, lettering, labels, charts, borders, UI, watermarks, additional objects or detached pieces.
```

- crown：`Preserve the actual high oblique view of the crown: round stacked ornament near the middle, gold forehead bead below-left, red brows crossing both sides, upper body receding to upper right, broad empty paper left, exactly as image 1.`
- beard：`Preserve the actual low oblique view: mouth and ivory beard dominate the upper-left and middle, face extends past the top edge, brocade body and red-trimmed legs on the right, white claws near the bottom, broad blank paper left, exactly as image 1.`
- mouth：`Preserve the actual extreme close-up: scarlet upper lip across the top, ivory upper and lower teeth surrounding the red tongue with gold motif at center, white beard across the lower portion, all positioned and cropped exactly as image 1.`

实际生成结果保留主要视角、主体比例与位置，但材质和局部形态有变化，不能声称与模型逐像素配准。

## 其他桌面比例

为避免使用模糊边带，按真实镜头分别生成另外三套全屏图：`public/images/fullscreen/16x10/`、`16x9/` 和 `ultrawide/`。每套均包含六个部位，分别使用 `reference-16x10/`、`reference/` 和 `reference-ultrawide/` 下的对应真实画面作为构图参考。16:10 原生 PNG 均为 1586×992，16:9 均为 1672×941；超宽版为 1930×815 或 1931×814。图像未裁切、拉伸或在生成后重绘。

16:9 眉目提示见 [brows-prompt.md](candidates/brows-prompt.md)，其额冠、鬃须、口齿见 [16x9-crown-beard-mouth-prompts.md](16x9-crown-beard-mouth-prompts.md)；超宽六张见 [ULTRAWIDE_PROMPTS.md](ULTRAWIDE_PROMPTS.md)。

16:10 六张及 16:9 织锦、云边使用以下共同提示，再附对应章节说明和参考画面比例：

```text
Use case: identity-preserve / precise-object-edit. Asset: a complete full-screen chapter artwork for a Chinese Southern lion interactive exhibit. IMAGE 1 is an actual full-window 3D camera endpoint and is the strict EDIT TARGET and composition lock; IMAGE 2 is ONLY a tactile style and material reference, NOT a framing reference. Preserve IMAGE 1's ENTIRE exact camera frame, subject position, camera perspective, geometry silhouette, scale, every major ornament, natural intersections at viewport boundaries, and all negative space. Do not zoom, recenter, rotate, mirror, redesign, crop or rearrange the model. Output exactly the same image aspect ratio as IMAGE 1. Keep the entire scene physically connected. Refine only broken surfaces and material rendering, using rich tactile scarlet velvet, soft ivory fur, warm coral and antique gold, red-gold brocade, dark polished details, matching IMAGE 2. Maintain IMAGE 1's warm ivory paper background. A subtle graphite gesture may occur only in blank areas and never over the subject. No text, lettering, UI, panels, labels, charts, borders, logos, watermarks, new objects, or detached parts. The image must occupy the complete canvas.
```

- brows：`The red brows frame the eyes, central gold forehead disc and upper stacked ornament, nose near lower center, ornaments at the right.`
- crown：`High oblique crown view with stacked central ornament, gold forehead disc below, red brows and body receding toward upper right.`
- beard：`Low oblique view of mouth and hanging white beard, brocade body and red-trimmed legs on the right, claws near the bottom.`
- body：`Partial lion head at left, ornate gold-red brocade across the center, scarlet wavy trim, white tail on the right and feet at the bottom.`
- trim：`Lion head upper left, brocade body receding diagonally, repeating red trim, white tail to the right and tassel below.`
- mouth：`Extreme close-up of crimson upper lip, curved ivory upper and lower teeth surrounding a red tongue with gold motif, white beard below.`

16:10 原件目录为 `C:/Users/Administrator/.codex/generated_images/01a17800-52bb-7571-a427-5385b740f19e/`，按上表顺序文件名为：`exec-838a614c-d1bc-41f5-8712-dc97a59a696e.png`、`exec-051a4a7c-853d-4e9a-af18-1370d33f826e.png`、`exec-54ff4fa5-307a-493b-a4b5-7bf3eb786dcc.png`、`exec-530e06a3-399f-4201-baf5-486d86bdd35c.png`、`exec-2d2c5467-af2b-4bce-9023-a473878b298e.png`、`exec-8630989b-edcc-496a-b906-714de5d82a0e.png`。同目录 16:9 织锦与云边原件为 `exec-4e44e62a-5a90-4874-9d88-48145989dc4c.png`、`exec-038600a5-bfd4-442e-acb0-1e8729cdaf58.png`。
