# 首页传播跨页图重制记录（2026-10-15）

用户要求保留“岭南传播 · 走向世界 / 20世纪”主题，修复原码头与街景在书脊两侧空间不连续的问题。使用内置 imagegen 编辑原书页，不以网页遮挡、拉伸或调整翻页几何掩盖断裂。

## 素材与实际尺寸

- 输入/原图归档：`source/design/lion-book/spread-v1.png`，1494×1052，1876971字节，SHA256 `592f8d5f27b4df3b52dc36019aa574965e0dcdd7167c99a28f0680bc258326da`。归档与基线338fd39的原运行图逐字节一致；用户文件不改。
- 新运行图：`source/public/assets/lion-book/spread.png`，1494×1053，1901476字节，SHA256 `2b9b6b37d53dfe072c46c8f235ed0f95851ab91e644cf95327687ccbfc1e76a8`。
- 工具原始输出：`generated_images/01a12bd9-7f09-70b3-9b45-92dd32acdc97/exec-80915f92-aeaf-401f-aec2-5ad8e50af07e.png`，复制原字节，不作后处理或重新编码。
- 实际alpha四角均0；alpha>240的纸面边界x76–1419、y231–820，中央书沟在50%附近，纸边保持；高度比原图多1像素，保持工具原生比例，满足原1760/1240几何宽高比校验（差约0.00055，阈值0.01），没有拉伸/改变几何来迁就。
- 其他六幅运行书页与基线哈希保持，原翻页函数、18条曲面与依赖包未改。

## 视觉检查

生产预览Chrome实查：一条连续水岸石板路和远岸建筑连接左侧船只/行李与右侧骑楼/灯笼/醒狮；折页处为连贯地面及淡远景，无人脸或狮头被书脊切开。保留题字与年代。正/反方向真实18条卷曲中间帧、整图与书脊局部已存 `source/reviews/homepage/2026-10-15-reading-panels/`，不部署审查图。

本图仍为AI辅助历史主题示意，非历史照片、文物或特定传播事件证据；既有资料/来源说明保持，未新增史实、精确路线或事件。

## 实际生成提示词

```text
Use case: precise-object-edit / illustration-story.
Asset type: transparent open-book double-page illustration texture for the existing ThreeUI Sketchbook engine.
Image 1 is the edit target and EXACT geometry template. Preserve the original front-facing open-book silhouette, paper grain, curved paper corners, central spine exactly at 50% width and transparent outer canvas. The book must occupy normalized x=.051 to .949 and y=.218 to .782, leaving about22% transparent margin above and below. Keep the original canvas aspect1760:1240 (input1494x1052), never crop, enlarge or move the book. No new perspective or second spine.
Replace ONLY the painting on the pages with ONE coherent panoramic overseas Chinese waterfront town scene about20th-century Lingnan lion-dance cultural transmission.
CRITICAL: this is ONE continuous location viewed from ONE viewpoint, not two separate scenes joined at the fold. A continuous stone waterfront promenade runs from the LEFT foreground through the CENTER fold into the RIGHT background. Waterline, paving courses, perspective and warm daylight must connect exactly across the fold with no sudden cut in horizon, ground, scale or buildings. Across x46%-54% use calm connected paving, gentle water and pale distant scenery; do NOT put faces, lion head, buildings chopped in half or text across the spine.
On the far LEFT: modest harbor ships and a pier, small luggage and a few travelers suggesting migration. On the RIGHT: a connected row of old shophouses facing the same promenade, hanging red lanterns and a traditional red-and-gold southern lion-dance performance with a small drum ensemble. Keep main lion and human faces entirely right of the fold. The shore connects harbor to town naturally. Do not make a collage, side-by-side diptych, split screen, map, symbolic journey arrow or identifiable historical event.
Match the original loose refined watercolor washes, warm ivory handmade paper, thin charcoal pen details, restrained gold and rich cinnabar red. Plenty of unpainted paper; not photoreal or a shiny3D mascot.
Keep EXACT existing brush text in the upper LEFT page: "岭南传播 · 走向世界" and "20世纪". No other lettering, seal, logo or watermark.
Outside the existing paper: genuine transparent alpha. Keep paper boundaries and geometry unchanged. No backdrop, floor, black/white rectangle or painted checkerboard.
```
