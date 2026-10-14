# 导航栏用户图案

2026-10-14按用户提供的“导航栏图案(1)”PNG替换共用导航。图案由用户提供，接入与文件对应由Agent完成。

| 导航项 | 用户文件 | 运行资源 | 显示取景viewBox |
| --- | --- | --- | --- |
| 首页 | 导航栏图案.png | assets/navigation/home.png | 193 242 868 773 |
| 结构 | 2.png | assets/navigation/structure.png | 156 135 942 987 |
| 动作 | 3.png | assets/navigation/action.png | 210 140 888 963 |
| 神态 | 4.png | assets/navigation/expression.png | 109 311 1038 611 |
| 设置 | 5.png | assets/navigation/settings.png | 270 272 715 715 |

五个文件保留1254×1254 RGBA原字节、金白配色与透明度。运行副本和用户原文件、验收构建的dist副本逐一比较相同，大小与SHA256在asset-manifest.json登记。

NavigationIcon通过SVG image引用PNG，以viewBox对透明留白取景，图案按比例居中。取景以alpha>16的主体边界外扩10像素，保留光晕；眼形保持横向比例。路径由assetPaths/media适配部署基址，取景集中在chapters.js的navigationIcons。

共用导航继续保留首页完整文字、章节五图向右收拢、悬停浮起、当前红色下划线、键盘与设置入口；图案显示原金白颜色，无颜色滤镜。此要求替代此前“旧SVG图标始终朱红”的图案约定。

电脑验收截图位于source/reviews/navigation/2026-10-14-user-icons/，包括1920/1366首页和1920章节收拢模式。验证范围与其他未提交任务的边界见本轮工程记忆日志。
