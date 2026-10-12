# 首页“探索更多”书法素材

2026-10-12用户提供金色毛笔字图片，要求替换首页探索按钮的字样。透明运行图由内置 image_gen 编辑生成，保留“探索更多”四字的浅金色笔锋与飞白；生成式提取会有纹理差异，不是逐像素抠图。

| 版本 | 项目路径 | 尺寸 / 类型 | SHA256 |
| --- | --- | --- | --- |
| 用户原图，原字节归档 | `source/design/entry/explore-more-calligraphy-reference.png` | 1448×1086，RGB PNG | `5b11432227a64f8a53d2ce26209c56a6388a1d99bfc058f11f85f8ef82e0e99e` |
| 网页透明图 | `source/public/assets/entry/explore-more-calligraphy.png` | 2022×778，RGBA PNG | `63c86eee452d750c070bc047316fde34ecf3ba65581f82a7beb2270b1af4ece0` |

原图来源：用户指定 `D:/04_EdgeDownload/探索更多金色书法.png`。模式：built-in image_gen / image edit，`transparent_background: true`，仅引用该用户原图。最终选用第二轮工具 PNG 原输出，未使用 Python 或其他程序进行裁剪、背景去除或图像编辑。源工具输出：`C:/Users/Administrator/.codex/generated_images/01a13033-426c-7643-a018-cc16fe938fd8/exec-4d5bd5d5-62ed-4132-999a-cdb4d6e024d9.png`。

只读检查确认 alpha 范围0–255，924920个全透明像素；alpha>32的主要笔画范围为 `(72,69,1943,759)`，有外缘留白。初轮输出底边触字，已弃用；本轮最终文件实际载入后在红色按钮上没有白底，四字完整。

最终编辑提示词：

```text
Precisely isolate the original golden calligraphy lettering from the supplied reference. Read and preserve EXACTLY these four characters: 探索更多. Perform background removal, not redesign: preserve the existing original hand-drawn shapes, pale champagne gold color, surface grain, negative-space dry brush texture, stroke lengths and each character's original position and proportions. Do NOT substitute a similar font, exaggerate the texture, darken or saturate the gold. The only changes are to turn all white paper/background into genuine transparent alpha and to crop away the large blank top and bottom margins. Output a wide horizontal transparent PNG, approximately 2.6:1 aspect ratio, containing the complete original lettering. Keep 3 percent transparent padding on ALL four sides, especially under the trailing lowest stroke of 多 and 探. No stroke may touch the image edge or be cut off. No added glow, yellow or red edge, embossing, shadow, frame, paper, white rectangle or new content.
```

运行 URL 由 `assetPaths.exploreMoreCalligraphy` 和 `media` 统一管理，兼容 Vite 相对基址。按钮保留可访问名称“探索更多”和滚动到文化区的行为；字图在框中独立居中，箭头不参与其位置分配。标题、按钮、中文辅助文字和英文辅助文字共用同一中线；普通桌面中线选在原题图与按钮中线之间，让标题向左、按钮及辅助文字向右。图片保持原始比例，不以普通字体模拟笔锋。

审查图在 `source/reviews/homepage/2026-10-12-centered-calligraphy/`，含1024、1366、1920、2560、390视口与1920推开设置。桌面导航完整单行回归包含1024–3440及900px剩余页面宽度；窄电脑将品牌放到第一行、五项导航放到第二行，导航文案保持完整单行。
