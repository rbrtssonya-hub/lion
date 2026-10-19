# 导航与书籍细节整改（2026-10-19）

用户按顺序追加五项：固定完整导航底板、品牌归位、书下节点即时反馈、神态云纹不裁切、传播书页去黑边。本轮在 e0b7 worktree 的 codex/navigation-stable-background 分支、1f8f206 基线上执行，仅电脑验收。

## 导航与交互

- 唯一 `SiteHeader > NavigationSurface` 始终覆盖整栏。路由变化不改变底板位置、面积、渐变、透明、模糊或圆角，不再拆成两个移动背景。
- WAAPI仅作用于 `.site-nav-icon` 和品牌胶囊；文案和短标题不做压缩/移动动画。章节品牌右移至“首页”左侧。原PNG、品牌名“南风有狮”、路由、设置及首页完整文字保留。
- 所有路由先按首页实际字宽预算计算栏高，窄电脑需要116px时章节也保持116px；切换本身不改变面积。支持缩放、设置推开、快速中断、Hash/history、减少动态和卸载清理。
- 书册宿主把最新手动目标与引擎提交页分开：点击/宿主方向键立即更新狮头目标和节点选中；正文、年代和书页继续跟随真实提交index。目标提交后解除待确认状态，旧消息不会回拉最新目标。错误、重试清除目标；实际焦点进入纸面时把控制权交回纸面，保留拖拽和iframe键盘。650ms移动、粒子、离屏暂停与原引擎均保留。
- 点击起点实测首动7–15ms（电脑Chrome），覆盖相邻/跨页/反向、快速回选和纸面接管；这不是所有设备的性能保证。

## 神态云纹

共享Cloud的路径最小y=-1.211，3px描边保守上界=-2.711，原viewBox从0开始，确实裁切。仅把viewBox从 `0 0 100 56` 改成 `0 -4 100 60`，两处云纹同步补足顶部空间；路径、CSS尺寸与图形语义不变。两处描边边界均位于新视区内，截图已审查。

## 传播书页修图

黑外轮廓来自图片自身，隐藏引擎投影后仍存在；静止书面只有一个spread.png，没有旧页叠露。使用内置imagegen作局部编辑，没有裁切纸面或修改官方18层卷曲引擎。

| 项目 | 原图v2归档 | 新运行图v3 |
| --- | --- | --- |
| 路径 | `source/design/lion-book/spread-v2.png` | `source/public/assets/lion-book/spread.png` |
| 尺寸 | 1494×1053 | 1493×1053 |
| 字节 | 1901476 | 1762761 |
| SHA256 | 2b9b6b37d53dfe072c46c8f235ed0f95851ab91e644cf95327687ccbfc1e76a8 | 331c4fcd89b0beb765543ce890fd8c3baaed432a857b4de07a783d07702b2839 |

工具原始输出 `generated_images/01a152b1-81d6-7af3-ac11-62628e4d0bb3/exec-6ef9c329-9cb7-4b3d-b754-2de2016e42c1.png` 原字节复制。保留原生尺寸，未重新编码/拉伸；与原1760/1240纸面比例差小于既有0.01门槛。alpha四角均0，alpha>240范围为x76..1420/y230..819。上缘抽样深色列322→42，剩余主要位于右侧画内屋顶，不能将“深色为0”当作要求。生产视觉确认外围硬黑描线已去除，题字“岭南传播 · 走向世界 / 20世纪”、连续港口街景、书沟和透明留白保持。AI局部修图不宣称逐像素完全相同；其他六幅PNG相对1f8f206逐字节一致。

生产4176静止传播页与正、反向真实鼠标拖拽（18条strip/18front/18back）已验证，均正确提交index4；HTTP响应SHA与运行资产相同。AI辅助历史主题示意标注与来源保持，本轮不新增史实。

## 内置imagegen实际提示词

```text
Use case: precise-object-edit.
Asset type: transparent open-book watercolor illustration used as an existing website's physical flipbook texture.
Input image: the referenced spread.png is the EXACT edit target. Make one strictly local repair: remove the thin dark/black drawn contour around the OUTER perimeter of the two cream paper pages (top edge, bottom edge, outside left and right rounded corners). The perimeter should end as a clean softly antialiased warm ivory paper edge against genuine transparency, like an unoutlined paper cutout, with NO dark ink halo, hard grey border, double border or detached paint flecks. Do not remove or lighten the central vertical book fold/spine shading.
Preserve everything else as faithfully as possible: the continuous harbor-to-shophouse watercolor scene across the central fold; boats, travelers, foreground stone quay, buildings, palm trees, red lanterns, lion dance, drum, people, colors and fine ink details INSIDE the paper; all paper grain; exactly the same composition, book shape, curved corners, scale, position, center fold at x50%, and transparent top/bottom/side margins. Do NOT crop, zoom, rotate, enlarge, reposition or reframe. Keep the full original canvas and aspect ratio (1494 by 1053 pixels requested, original paper approximately x5.1%..94.9%, y21.8%..78.2%).
Keep the exact Chinese heading "岭南传播 · 走向世界" and small subtitle "20世纪" perfectly intact in their original positions and brush lettering. No new text, no watermark, no new background, no shadow outside the paper. Change only the unwanted outside dark outline; keep the rest of the existing art unchanged. Output true PNG alpha transparency outside the book.
```

## 审查与验证入口

审查图位于 `source/reviews/navigation/2026-10-19-feedback-fixes/`，只归档、不部署。实际开发/生产回归、初次失败与复验范围见 [任务日志](../../wiki_memory/日志/UI修改/2026-10-19-导航反馈与书页细节整改.md)。旧两块底板、文字压缩与v2黑边记录仅作历史。
