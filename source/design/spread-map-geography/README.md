# 传章地图轮廓归档

取得日期：2026-10-26。只服务当前本地学习预览，地理数据来源与使用说明如实保留。

## 原始来源

数据工具为[阿里云 DataV.GeoAtlas 区域选择器](https://datav.aliyun.com/portal/school/atlas/area_selector)。工具页脚当前说明数据来源于高德开放平台，areas_v3 数据版本更新于 2021.5，仅供学习交流使用。

| 本地原始文件 | 官方下载地址 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| `440000.datav-areas-v3.json` | [广东省轮廓](https://geo.datav.aliyun.com/areas_v3/bound/440000.json) | 59165 | `1D6882879B704297AD8331468FCE9CE767C21F14AF13C3CF46C237B40B2A7B9D` |
| `100000.datav-areas-v3.json` | [中国轮廓](https://geo.datav.aliyun.com/areas_v3/bound/100000.json) | 162746 | `83AC502AEAC66A5527607EC844169418505D990F1A2DC33226743643541EED3C` |

两份文件原字节保存。中国数据含 277 个 Polygon，含大陆、台湾、海南、其他海岛和源文件南海断续线图形；广东数据含 65 个 Polygon。没有手绘添加行政轮廓或传播地点，也没有依据现有照片编造传播路线、覆盖规模或先后次序。

## 来源说明与限制

DataV 当前页面脚本 `https://g.alicdn.com/datav/datav-portal/0.46.1/atlas.js` 可查到页脚文案：

> 本页面数据来源于高德开放平台，该版本数据更新于2021.5，仅供学习交流使用。

该实际说明不等于开放数据许可证。本次未取得另外的开放许可，也未在这两份 JSON 或该页脚中取得审图号，因此衍生 SVG 不标记为经审定标准地图，不伪造审图号。坐标参考系未在原 JSON 明示；城市坐标为本项目近似定位，不作为测绘依据。

界面可用署名：`轮廓：阿里云 DataV.GeoAtlas / 高德开放平台（2021.5）`。附注：`仅供学习交流；经简化的案例位置示意，非审定标准地图。`

## 离线生成与检查

在项目根目录运行：

```powershell
node source/design/spread-map-geography/build-geography.mjs
node source/design/spread-map-geography/verify.mjs
```

生成目标为 `src/data/spread-map-geography.js`。运行时无需联网和新增依赖，统一 `viewBox="0 0 1000 600"`。

- 使用球面 Mercator：`x=longitude`，`northing=180/π×ln(tan(π/4+latitude×π/360))`，各层按全部原始轮廓等比例居中拟合，边距至少 72。
- `regionalMaps.guangdong` 与 `.china` 包含 SVG `paths`、原始经纬度 `bounds`、`sourceUrl`、`attribution` 和 `usageNote`。
- `projectRegionalPoint(level, [longitude, latitude])` 使用生成时相同的投影与缩放；不得将旧世界视图的坐标函数用于地区轮廓。
- `guangdongInChinaPaths` 把同一广东 GeoJSON 放到中国投影下，供中国层高亮广东；中国层无需增加省界。
- 道格拉斯–普克简化阈值为 1.2 视图像素，最终坐标四舍五入到整像素。所有源 Polygon 均保留，低于像素的岛轮廓可能在显示时收敛为点或短线；不能据此读出小岛面积或边界精度。
- 保持南海图形的原有地理位置，没有另做移位插图。因而全国陆地主体周围有较多留白，南部几何延伸到画布下部。

实际检查覆盖全部源 Polygon 数量、投影方向、视框范围、广州和佛山陆地内点、台湾/海南可见陆地以及模块体积。界面与交互回归由主任务统一验证。
