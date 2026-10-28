# 验证记录

验证日期：2026-10-26。桌面浏览器：Playwright Chromium。源文件未写入。

- `npm run build`：通过。Three.js 独立脚本约 710 kB（gzip 约 182 kB），存在正常的 >500 kB chunk 提示；未因此削减模型细节。
- `npm test`：8/8 通过，覆盖凸包、投影、径向分箱、分轴宽度、面积权重、世界变换、实例和采样去重。
- `npm run test:browser`：通过，见 `browser-results.json`。实际加载最终 Draco GLB，87 个材质 primitive、6 个研究部位。验证真实三维表面点击、拖动旋转、空间标注、六种参数改变图形、显示模式、图版放大、返回全貌、资料弹窗以及 1536×960 / 1280×800 桌面窗口。
- 所有原生对象位置与加载时一致，没有研究模式触发网格平移、分离或爆炸。
- `node tests/production.mjs`：通过，见 `production-results.json`。生产静态构建的 Three.js 脚本、Draco WASM、GLB、图片与真实织锦纹样成功加载；无 HTTP 失败和控制台错误；开发诊断入口未暴露。
- 当前环境生产测试读数：180 FPS、161 draw calls、16 textures。渲染计数为 2,270,738 triangles，**包含阴影 pass**；模型本体为 1,624,972 triangles。该帧率仅代表本次测试机器和头显刷新策略，不能承诺其他设备相同。
- Blender 源文件 SHA-256 再次复核：`CC5F72C3E1A5C330DD64DAF6842720A91A8E21B6909A01B6F6200A8834545F53`，与初审一致。

代表截图：`desktop-overview.png`、`desktop-brows.png`、`desktop-body.png`、`desktop-mouth.png`、`production-study.png`。带 `-parameter` 的截图是参数调整后的面板滚动状态；初始截图展示生成图版与测量图形。

最终交付侧重桌面，不将先前的窄屏探索作为移动端优化承诺。毛发、共面面片、程序材质和实物尺寸的限制见根目录审计与设计文档。
