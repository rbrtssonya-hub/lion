# 传章地图十二城位置校核

核对日期：2026-10-28。地图画布为 1000×650，城市数据坐标按 `[经度, 纬度]` 保存。经纬度是城市代表点的近似值；醒狮案例发生地需要以具体案例资料为准。

地图背景是 Blender 透视渲染，不是带地理参考的 GIS 底图。地图圆点使用画布像素锚点，城市经纬度保留在 `src/data/spread.js`。本轮依据用户重新标出的红框校准广州与北京的画布锚点；这不会覆盖城市坐标数据，也不应被解释成测绘级位置。

| 层级 | 城市 | 代表坐标 `[经度, 纬度]` | 圆点锚点 `[x, y]` |
| --- | --- | --- | --- |
| 广东 | 佛山 | `[113.12, 23.02]` | `[468, 323]` |
| 广东 | 广州 | `[113.26, 23.13]` | `[505, 293]` |
| 广东 | 鹤山 | `[112.96, 22.77]` | `[455, 344]` |
| 广东 | 遂溪 | `[110.25, 21.38]` | `[222, 458]` |
| 中国 | 北京 | `[116.33, 39.93]` | `[628, 198]` |
| 中国 | 田阳 | `[106.91, 23.74]` | `[532, 368]` |
| 中国 | 泉州 | `[118.67, 24.87]` | `[662, 357]` |
| 中国 | 香港 | `[114.17, 22.30]` | `[612, 382]` |
| 世界 | 新加坡 | `[103.82, 1.35]` | `[755, 314]` |
| 世界 | 吉隆坡 | `[101.69, 3.14]` | `[749, 310]` |
| 世界 | 旧金山 | `[-122.42, 37.77]` | `[200, 225]` |
| 世界 | 伦敦 | `[-0.13, 51.51]` | `[500, 191]` |

地理关系复核：广东层佛山与广州相邻，鹤山位于佛山西南，遂溪位于更西南的雷州半岛区域；中国层北京在北方、田阳在西南、泉州在东南沿海、香港在华南沿海；世界层新加坡和吉隆坡相邻，旧金山位于北美西岸，伦敦位于欧洲西部。十二点分别留在用户指定的广东、中国、世界层级。

坐标参照包括：[北京市政府概况](https://www.beijing.gov.cn/renwen/bjgk/202004/t20200422_1876719.html)、[联合国地名专家组佛山坐标](https://ungegn.un.org/dashboard/cities/details?id=2016)、[鹤山市政府地理范围](https://www.jiangmen.gov.cn/newzjqx/jmgk/content/post_3461020.html)、[湛江市政府遂溪资料](https://www.zhanjiang.gov.cn/attachment/0/53/53766/1432509.pdf)、[泉州市政府地理范围](https://www.quanzhou.gov.cn/zfb/xxgk/zfxxgkzl/zfxxgkml/srmzfxxgkml/ghjh/201301/t20130115_169652.htm)、[香港地政总署地理资料](https://www.landsd.gov.hk/tc/resources/mapping-information/hk-geographic-data.html)、[新加坡统计局地理范围](https://www.singstat.gov.sg/find-data/explore-data-themes/society/environment/our-data-explained)、[马来西亚国家地名录](https://mygeoname.mygeoportal.gov.my/exportpdffasa3.jsp?kodnegeri=14)、[联合国地名专家组旧金山](https://ungegn.un.org/dashboard/cities/details?id=361)及[伦敦](https://ungegn.un.org/dashboard/cities/details?id=141)。田阳点位参考田阳区政务服务中心地图位置（[高德地图](https://www.amap.com/place/B0JRKAU051)）。广东、中国地图轮廓的数据来源与限制见 `source/design/spread-map-geography/README.md`。

验证记录（Windows，2026-10-28）：

- `node --test tests/assets/spread-data.test.mjs`：5/5 通过，含十二个城市坐标顺序与数值校验。
- 独立 Vite 端口 28475，Edge 通道运行 `tests/e2e/spread-map-render.spec.js` 与 `tests/e2e/spread-map-stamps.spec.js`：6/6 通过，覆盖十二个画布锚点及分层邮票。
- `node source/design/spread-map-geography/verify.mjs`：通过，检查广东 65、中国 277 个原始多边形及位置投影。
- `npm run build`：383 个模块构建成功；保留已有大于 500 kB 的 chunk 提示。
