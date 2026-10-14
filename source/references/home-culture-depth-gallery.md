# 首页文化纵深照片图鉴

2026-10-14按用户指定本地源码 `D:/Gitclone/伪交互/codrops-depth-gallery` 适配首页原照片轮播，实施者为Agent。

- 参考项目：Atmospheric Depth Gallery，作者 Houmahani Kane / Codrops。原仓库信息来自本地 `package.json`：https://github.com/houmahani/codrops-depth-gallery 。本次依据本地源码，未联网核对远端版本。
- 实质参考：`src/Experience/Gallery.js` 的等距Z平面、原图比例、平滑视差/材质透明度，`Scroll.js` 的相机纵深推进，`Trail.js` 的浅色指针轨迹。原版背景shader负责blob和grain，照片本身没有深度图或三维重建。
- 完整MIT版权和许可归档在 [codrops-depth-gallery-LICENSE.txt](codrops-depth-gallery-LICENSE.txt)，相同原字节的[部署许可](../public/assets/licenses/codrops-depth-gallery-LICENSE.txt)经 `cultureDepthLicense` 登记后随Vite进入dist。本项目服务保留来源注释；未拷贝参考工程的花卉摄影。
- 适配入口：`src/features/home/CultureDepthGallery.jsx`、`src/services/cultureDepthGallery.js`；图片URL继续由 `src/config/media.js` 提供。保留原四组实景照片、文化资料、作者与CC许可，来源见 [home-culture-sources.md](home-culture-sources.md)。照片保持原始宽高比，缩放展示，不生成深度内容。
- 首页保留米纸/朱红/暖金，左侧透明WebGL照片沿纵深递进，右侧文化解读和下方署名、进度同步。原6秒自动播放、前后/主题点/暂停与聚焦暂停保留；仅在画廊可见且页面在前台时播放。方向键/Home/End限本文化区内操作，滚轮自然滚动页面。
- 图形服务延迟加载，限制DPR；只在可见/前台活动时绘制。组件卸载清理监听、观察器、RAF、材质、几何、纹理与WebGL上下文，处理异步纹理加载的卸载竞态。
- 减少动态效果使用静态图片并停止自动播放；WebGL创建/纹理加载/上下文故障保留当前图片、完整文化文字、署名和手动切换。不引入原工程的全局滚轮拦截、调试面板、body样式或新版Three依赖。
- 验收以电脑端为目标，实际命令、结果和截图在本轮工程记忆日志中记录。网站正式托管和真实设备GPU性能不在本次验证范围。
