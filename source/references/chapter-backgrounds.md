# 章节背景来源

用户于2026-10-12按附件顺序指定以下三张背景，原文件逐字节复制，未重绘、压缩或重新编码。附件扩展名虽为 `.jpg`，文件内容实际为PNG，部署采用正确 `.png` 扩展名。

| 附件 | 页面与路由 | 集中配置 | 运行资产 | 原尺寸 | 字节 |
| --- | --- | --- | --- | --- | --- |
| 第一张 | 狮头与结构 `model`，旧 `structure` 地址同样映射此页 | `modelBackground` | `source/public/assets/backgrounds/lion-structure-background.png` | 2048×1152 | 3296020 |
| 第二张 | 动作 `action` | `actionBackground` | `source/public/assets/backgrounds/lion-action-background.png` | 2048×1152 | 2858010 |
| 第三张 | 神态 `state` | `stateBackground` | `source/public/assets/backgrounds/lion-expression-background.png` | 2048×1152 | 2388839 |

SHA256：

- 第一张：`8ac4641db9fcc037d5ba79134b5be828b79cfb03e5f070d966ab107f817908b5`
- 第二张：`3ea839fe3e2e51f57ef706d5da33841e2ecea6227b975420dc900e2ff6731651`
- 第三张：`45394bab5d53f8f30ae11078c16a3f325416a35f2043c637ba4e491ce8022dbe`

页面使用 `cover` 缩放覆盖视口，按视口比例可能裁掉边缘；原图字节仍完整保留。背景由App路由映射到site-shell，模型/章节stage透明，页脚、顶栏后方及设置推开后的底板共用同图。首页仍用现有视频。四页都由App维护唯一SiteHeader；背景图上的结构线稿仅为用户指定图案，现用GLB仍是合并网格。

清单 `from` 以 `user-provided:2026-10-12/image-1/2/3` 表达附件顺序，不记录下载文件名中的鉴权参数。应用URL由 `assetPaths.js` 和 `media.js` 适配Vite基址。
