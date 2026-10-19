# 巨幕占位文字字体

`nanfeng-theater-labels.ttf` 由项目已核对的演示秋鸿楷源 TTF 制作，仅包含四个动作名称、缺片说明及 ASCII 字符。字体族名为 `Nanfeng Theater Labels`，版权和 SIL OFL 1.1 元数据保留；完整许可见 [OFL.txt](OFL.txt)。源文件及作者说明与[导航字体来源](../navigation-brush/README.md)相同。

字体供独立 Blender 工程打包使用，不进入网页运行目录，不替换现有导航字体。原字体缺少中点和乘号，因此屏幕尺寸标签采用 ASCII `/` 与 `x`。

可使用 Python 与 fontTools 从同一源 TTF 重建（输出已存在时拒绝覆盖）：

```text
python scripts/prepare_theater_font.py path/to/Slideqiuhong-Regular.ttf
```

脚本核对原 TTF 的 Git blob SHA、所需字形并保留授权字段。场景构建脚本从本目录读取字体，最终 `.blend` 内嵌该字体，无需系统安装。
