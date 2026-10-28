# 当前交接版本验证

日期：2026-10-26。验证以本目录的当前记录为准；上一版 `artifacts/VERIFICATION.md` 是历史版本。

| 用户要求 | 当前实现与核验依据 |
| --- | --- |
| 六控件各有一张新图，构图不同 | `public/images/chapters/` 六张 1536×1024 PNG；分别以六个不同角度的实际终点截图调用内置 image_gen。静态测试核对六个 SHA 唯一且与旧三图不同；生成参考、完整提示词和实际成图均已查看 |
| 首页只呈现模型，无文化解释 | `home-model-only.png`；浏览器断言首页没有文化栏、没有章节图片，保留六个控制入口 |
| 点选后真实相机运动 | 六组浏览器记录均比较移动前、移动中、移动后的 camera.position；终点 position/target 与 `public/data/handoff-cameras.json` 比较，误差阈值 1e-5 |
| 最终构图匹配对应图版 | 六张图直接使用各自真实相机终点作为编辑蓝图；运行时同样使用这些镜头、34° FOV 和精确 3:2 取景。主要位置、角度、尺度逐图查看，细部材质与轮廓属于艺术转译，不宣称像素级重合 |
| 连续交接，最终不显示模型 | 在同一 DOM 画幅上淡入图片；图像完全不透明后，模型 opacity=0、visibility=hidden、active=false。六章均核对这些状态及渲染 frame 停止递增；`brows-mid-dissolve.png` 记录真实交接中间状态 |
| 图片完整显示，不裁切 | 六章都核对 object-fit=contain、自然尺寸 1536×1024、图片 DOM 宽高等于完整 3:2 画幅；1280 和 1536 桌面截图已查看 |
| 图片主题鲜明、画面丰富 | 六张分别为斜前眉目、高斜额冠、低侧垂须、横向织锦、后上斜云边、近距离口齿。成图与六个最终页面实际查看，保留完整画面与材质/艺术轮廓内容 |
| 右侧 GSAP 文化文字 | 右栏仅 study 状态可见；真实 GSAP timeline 逐字、分段和描线。六章都比较标题字符的动画变换，并核对最终 root opacity=1、visibility=visible；不以 aria-hidden 单一属性替代可见性证据 |
| 模型保持完整 | 六章每次核对所有网格 position 与载入时相同；相机动画不移动节点。源 `.blend` SHA-256 复核与初审相同 |
| 可返回、可连续改选 | 验证返回途中改选、向外飞行途中改选、直接点击三维表面和 Esc。最终返回原始整体镜头；图片失败时恢复居中且可操作的模型 |

`npm test` 当前 10 项通过：8 项几何计算，以及桌面固定取景与六张新资产的唯一性/尺寸检查。

`npm run test:browser` 全六章流程通过，记录为 `browser-results.json`。无页面错误、无意外资源失败。人为注入的 503 仅用于验证失败恢复，不作为真实资源失败计入。

生产静态构建及 `tests/production.mjs` 的记录位于 `production-results.json`，生产 UI 检查眉目与织锦两种分支，另外独立读取并解码全部六张成图；开发环境中已检查完整六章。

原始 Blender SHA-256：`CC5F72C3E1A5C330DD64DAF6842720A91A8E21B6909A01B6F6200A8834545F53`。

主要画面：`screenshots/home-model-only.png`、`screenshots/<id>-final.png`、`screenshots/desktop-1280.png`、`screenshots/production-brows.png`、`screenshots/production-body.png`。
