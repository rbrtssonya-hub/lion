# 《南风有狮》Live2D 资产说明

当前 React 首页使用循环视频与图片标题，未加载 Live2D 模型、Pixi 或 Cubism。本目录保留 Cubism 导出的 `.moc3`、纹理、动作和本地运行库，供后续重制与接入；`nanfeng-lion/model-manifest.json` 的状态仍为 `needs-layer-rebuild`。

迁移前的资产说明记录了第二头醒狮、裁切接缝和闭眼后静态眼睛仍可见的问题：初版狮头与眼皮包含扁平封面的背景像素，初版 `Background_Repair.png` 为透明层。这些是历史重制线索，本轮架构迁移没有重新完成 Cubism 视觉验收，也不代表后续 v2/v3 分层已解决全部问题。模型、PSD 和 Cubism 工程均保留。

已经生成的初版分层源文件：

```text
source/live2d/source/nanfeng-lion-layered-rgb.psd
source/live2d/source/nanfeng-lion-layered.psd
source/live2d/source-v2/
source/live2d/source-v3/
source/live2d/cubism/nanfeng-lion.cmo3
```

这是基于现有扁平封面的遮罩拆层初稿，不是真正可直接绑定的独立狮头、眼皮和修复背景。必须先重做图层：狮头从背景中干净抠出，补绘移动后暴露的背景，制作睁眼与闭眼的独立绘画内容，并在 Cubism Editor 中重新对齐、绑定和导出。

## 导出目录

将 Cubism Editor 的发布文件放到：

```text
source/public/assets/live2d/nanfeng-lion/
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

只有完成视觉验收后，才能把 `model-manifest.json` 的 `status` 改为 `ready`。该清单仍保留历史本地库与 CDN 字段，但当前 React 网页不会读取或加载它们。后续接入需要独立实现 React 生命周期、失败回退和资源释放，不能仅修改清单状态。根原始导出另存于 `source/live2d/root-export/`，与此运行包分开。

## 分层命名

以项目根目录下 `source/live2d/source/layer-spec.json` 为拆层参考。建议在 Cubism Editor 中保留这些 Drawable 组：

- `Background`：天空、建筑、灯笼、后方醒狮、红绸和修复背景，保持静态。
- `Lion_Body`：中央醒狮身体和四肢，轻微跟随头部。
- `Lion_Head`：狮头主体，绑定 `ParamAngleX/Y/Z`。
- `Lion_Mane`、`Lion_Beard`：鬃毛和胡须，绑定 `ParamHairSway`。
- `Lion_Eyes`、`Lion_Pupils`、`Lion_Eyelids`：眼球、瞳孔、眼皮，绑定眨眼和鼠标跟随。
- `Lion_Mouth`：嘴部开合，绑定 `ParamMouthOpenY`。
- `Lion_Tassels`：耳饰、铜铃和流苏，绑定 `ParamTasselSway`。

## 编辑器与 SDK

Cubism Editor 需要从 Live2D 官方页面获取并按其许可使用：

- [Cubism Editor](https://www.live2d.com/en/cubism/download/editor/)
- [Web SDK](https://www.live2d.com/en/sdk/download/web/)

保留的适配器 `runtime/nanfeng-live2d-runtime.js` 用于加载合法导出的模型，目前未接入 React 页面；它不能从 PNG 自动生成 `.moc3`。本地库许可说明见 `runtime/THIRD-PARTY-NOTICES.md`。

## 导出顺序

1. 在 Cubism Editor 中打开 `source/live2d/source/nanfeng-lion-layered.psd`，或已有 `source/live2d/cubism/nanfeng-lion.cmo3`，核对真实分层与绑定。
2. 重做真实透明的狮头、眼睛和眼皮分层，并补绘 `Background_Repair`，不能继续使用当前全透明修复层或带背景的裁切块。
3. 建立 `ParamAngleX/Y/Z`、眼睛开合、瞳孔、嘴部、呼吸、鬃毛和流苏参数。
4. 制作并导出 `Idle`、`Blink`、`LookAt`、`EntryConfirm` 四个动作。
5. 将发布目录复制到 `source/public/assets/live2d/nanfeng-lion/`，更新模型引用，再从项目根运行：

```text
node --test tests/assets/live2d-package.test.mjs
```

6. 包检查通过后，先实现接入及回退，再用浏览器检查只有一头醒狮、没有接缝，自动摆头与眨眼可见且眼睛能重新睁开；检查窄屏、重进页面和退出清理。视觉验收通过后才把 `status` 从 `needs-layer-rebuild` 改为 `ready`。包检查只验证文件引用与动作结构，不验证模型美术质量。
