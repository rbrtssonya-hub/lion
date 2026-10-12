# 导航毛笔字体

运行字体 `source/public/assets/fonts/nanfeng-navigation-brush.woff` 为演示秋鸿楷的字符子集，字体族名改为 `Nanfeng Navigation Brush`。仅用于品牌和导航，页面正文继续使用既有字体。

- 上游：[SlideFont 作者授权的开源仓库](https://github.com/maoken-fonts/slidefont)
- 原文件：`fonts/Slideqiuhong-Regular.ttf`；Git blob SHA：`ff0353c03b1dae981861d3d8b94effd31c9d8a8b`
- 作者：The SlideFont Project Authors；许可：SIL Open Font License 1.1。原版权声明及完整许可随部署放在 `source/public/assets/fonts/OFL.txt`，字体内部版权及许可元数据也保留。
- 用户附件是书法位图，没有提供字体文件。本字体用于接近其粗笔、收笔有锋的风格，不是经确认的原图字体。

从上游取得原 TTF 后，在工程根目录使用 Python 和 fontTools 重新生成：

```text
python source/fonts/navigation-brush/subset.py path/to/Slideqiuhong-Regular.ttf
```

脚本从导航配置、导航组件与品牌组件提取中文，并保留原字体提供的普通 ASCII。修改这些文字后需重新生成；原字体不包含中点 `·`，浏览器使用后备字体显示该标点。
