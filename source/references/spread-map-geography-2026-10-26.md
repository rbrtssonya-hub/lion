# 传章三级地图：广东与中国地理来源

2026-10-26，在 `codex/nfys-structure-review-2026-10-26` 本地工作区获取阿里云官方 DataV.GeoAtlas `areas_v3` 广东与中国 GeoJSON，用于广东 → 中国 → 世界的前两层位置索引。世界层继续使用现有自绘示意轮廓。原始下载、SHA-256、生成脚本、检查脚本和使用范围说明集中在[轮廓归档](../design/spread-map-geography/README.md)。

原始数据：[广东省 440000.json](https://geo.datav.aliyun.com/areas_v3/bound/440000.json)、[中国 100000.json](https://geo.datav.aliyun.com/areas_v3/bound/100000.json)。官方入口：[DataV.GeoAtlas 区域选择器](https://datav.aliyun.com/portal/school/atlas/area_selector)。官方页脚说明数据来自高德开放平台，版本为 2021.5，仅供学习交流。未取得开放数据许可证或源图审图号，衍生图不作经审定标准地图声明。

实现为 [spread-map-geography.js](../../src/data/spread-map-geography.js)，无新依赖和运行时网络请求。广东 65 个、中国 277 个原始 Polygon 全部保留；中国含台湾、海南和源文件海岛/南海断续线图形。使用同一 Mercator 规则、1000×600 视框和等比例 fit，1.2 视图像素简化再取整。额外导出 `guangdongInChinaPaths`，用同一广东原始数据在中国图上高亮广东，不虚构省界。

两级广州/佛山/香港投影位置分别为：

| 地点与近似经纬度 | 广东层 x,y | 中国层 x,y |
| --- | --- | --- |
| 广州 `[113.26,23.13]` | `[487.02,279.37]` | `[567.80,373.77]` |
| 佛山 `[113.12,23.02]` | `[475.94,288.84]` | `[566.74,374.67]` |
| 香港 `[114.17,22.3]` | `[559.06,350.60]` | `[574.68,380.57]` |

2026-10-26 实跑 `node source/design/spread-map-geography/verify.mjs` 通过；模块 22353 字节，检查源 Polygon 数量、方向、视框、广州/佛山位于陆地及台湾/海南可见多边形。这里只证明数据模块，界面、键鼠与章节回归由主任务补验。本轮不合 main、不推 GitHub。
