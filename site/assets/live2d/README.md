# 《南风有狮》Live2D 资产说明

仓库已有 Cubism 导出的 `.moc3`、纹理和动作文件，但当前版本不能作为首页成品发布。浏览器实测发现，模型叠加后出现第二头醒狮及明显裁切接缝；`Background_Repair.png` 全透明，狮头与眼皮图层仍包含扁平封面的背景像素，闭眼时底下的静态眼睛也不会消失。因此 `model-manifest.json` 暂设为 `needs-layer-rebuild`，首页显示原封面并保留全部交互入口。现有模型和 PSD 均不删除，可作为重制参考。

已经生成的初版分层源文件：

```text
site/assets/live2d/source/nanfeng-lion-layered-rgb.psd
```

这是基于现有扁平封面的遮罩拆层初稿，不是真正可直接绑定的独立狮头、眼皮和修复背景。必须先重做图层：狮头从背景中干净抠出，补绘移动后暴露的背景，制作睁眼与闭眼的独立绘画内容，并在 Cubism Editor 中重新对齐、绑定和导出。

## 导出目录

将 Cubism Editor 的发布文件放到：

```text
site/assets/live2d/nanfeng-lion/
  nanfeng-lion.model3.json
  nanfeng-lion.moc3
  nanfeng-lion.physics3.json
  textures/
  motions/
    Idle.motion3.json
    Blink.motion3.json
    LookAt.motion3.json
    EntryConfirm.motion3.json
```

只有完成视觉验收后，才能把 `model-manifest.json` 的 `status` 改为 `ready`。网页读取该清单，并按本地依赖优先、CDN 依赖备用的顺序加载 Pixi、Cubism Core 和 Live2D 显示适配器。

## 分层命名

以 `source/layer-spec.json` 为拆层参考。建议在 Cubism Editor 中保留这些 Drawable 组：

- `Background`：天空、建筑、灯笼、后方醒狮、红绸和修复背景，保持静态。
- `Lion_Body`：中央醒狮身体和四肢，轻微跟随头部。
- `Lion_Head`：狮头主体，绑定 `ParamAngleX/Y/Z`。
- `Lion_Mane`、`Lion_Beard`：鬃毛和胡须，绑定 `ParamHairSway`。
- `Lion_Eyes`、`Lion_Pupils`、`Lion_Eyelids`：眼球、瞳孔、眼皮，绑定眨眼和鼠标跟随。
- `Lion_Mouth`：嘴部开合，绑定 `ParamMouthOpenY`。
- `Lion_Tassels`：耳饰、铜铃和流苏，绑定 `ParamTasselSway`。

## 编辑器与 SDK

Cubism Editor 需要从 Live2D 官方页面获取并按其许可使用：

- Editor：https://www.live2d.com/en/cubism/download/editor/
- Web SDK：https://www.live2d.com/en/sdk/download/web/

网页适配器文件 `runtime/nanfeng-live2d-runtime.js` 只负责把合法导出的模型接入页面；它不能从 PNG 自动生成 `.moc3`。

## 导出顺序

1. 在 Cubism Editor 中打开 `nanfeng-lion-layered.psd`。
2. 重做真实透明的狮头、眼睛和眼皮分层，并补绘 `Background_Repair`，不能继续使用当前全透明修复层或带背景的裁切块。
3. 建立 `ParamAngleX/Y/Z`、眼睛开合、瞳孔、嘴部、呼吸、鬃毛和流苏参数。
4. 制作并导出 `Idle`、`Blink`、`LookAt`、`EntryConfirm` 四个动作。
5. 将发布目录复制到 `site/assets/live2d/nanfeng-lion/`，再运行：

```text
node site/tests/validate-live2d-package.mjs
```

6. 再用浏览器截图检查封面只有一头醒狮、没有接缝，自动摆头与眨眼都可见且眼睛能重新睁开；通过后才把 `status` 从 `needs-layer-rebuild` 改为 `ready`。
