# 工艺四阶段配图：2026-10-28换景版

创作日期：2026-10-28，Asia/Shanghai。用户要求以“image 2”重新生成“造 → 工艺”的四张图，沿用现有温暖手绘画风，同时让四道工序呈现不同画面。本目录四张PNG为本轮当前创作源，实际尺寸均为 **1536 × 1024（3:2）**，均为完整连续画面，无拼贴分格、可见文字、logo或水印。

## 四张图的区别

| 阶段 | 当前创作源 | 镜头、场景与操作 | 完整生成记录 |
| --- | --- | --- | --- |
| 扎 | [zha.png](zha.png) | 从上方斜俯看竹篾骨架；双手在右侧扎结，石地与竹料架构成背景，重点为竹篾弧线与连接节点 | [zha-generation.json](zha-generation.json) |
| 扑 | [pu.png](pu.png) | 亲近的侧面低机位；双手拉展并抚平米白纱纸，半覆盖纸胚保留可见竹骨，前景有浆糊碗和纸张，背景为灰白墙与院落入口 | [pu-generation.json](pu-generation.json) |
| 画 | [hua.png](hua.png) | 朝左的眉眼彩绘近景；手持细笔触及红金黑彩纹，另一只手扶壳，前景有小颜料碟，背景为纹样纸与木架 | [hua-generation.json](hua-generation.json) |
| 装 | [zhuang.png](zhuang.png) | 院落入口中景；完整狮头略朝左，双手整理并固定奶白绒眉，矮木台、竹帘与灰砖院落形成较开阔空间 | [zhuang-generation.json](zhuang-generation.json) |

四图保持暖金日光、米白水彩纸纹、赭色木材和细腻写实水彩／水粉笔触；通过俯视、侧面、局部近景与较开阔中景区分工序。旧图仅作为画风、配色、材质或狮头形制参考，不作为保留构图的编辑目标。具体输入角色与最终完整prompt以各自JSON为准。

## 生成方式与原生输出

实际使用 **Codex内置 `image_gen` / `imagegen`**，每个资产独立调用，`transparent_background=false`，未走外部CLI/API。用户指定“image 2”的意图已记录；内置工具未暴露模型选择或身份参数，因此本项目不能声称已独立核验底层模型为`gpt-image-2`。

| 文件 | 内置工具原生输出路径 |
| --- | --- |
| zha.png | `C:/Users/ALLEN/.codex/generated_images/01a17ffd-6772-78a0-89c9-1f9b9f1d6e23/exec-e5743bb7-1954-4432-9426-f271adc335b8.png` |
| pu.png | `C:/Users/ALLEN/.codex/generated_images/01a17ffd-6772-78a0-89c9-1f9b9f1d6e23/exec-96de2568-5e01-45d1-8590-fd68a51c2052.png` |
| hua.png | `C:/Users/ALLEN/.codex/generated_images/01a18000-6ff9-76c0-994c-b13bf8fc425d/exec-ef12f2f5-543d-44b6-9296-418dfb99adfe.png` |
| zhuang.png | `C:/Users/ALLEN/.codex/generated_images/01a18005-59ef-72c3-b40e-442509442cb2/exec-8c675db1-dac1-4ad8-aa3b-d86919d2b810.png` |

原生输出保留，本目录保存其未经裁切或重绘的项目副本。上表个人工具目录用于本机溯源；项目接续使用本目录PNG及JSON，不要求运行环境具备该本机目录。

## 新旧路径与运行副本

- 2026-10-27历史原稿：上一级目录的四张同名PNG及 [历史说明](../README.md)，原字节保留。
- 2026-10-28当前创作源：本目录的四张PNG与四份`*-generation.json`。
- 网页稳定运行路径：`source/public/assets/craft/zha.png`、`pu.png`、`hua.png`、`zhuang.png`；本轮由主任务将新版复制至这些路径，接入状态和源／public／dist字节核对见 [更新说明](../../../references/craft-art-varied-scenes-2026-10-28.md)。
- README、生成记录与历史原稿属于设计资料，不放入public；轮播继续经现有`assetPaths.js`、`media.js`和四阶段数据消费稳定路径。

## 内容边界与检查

这组图是 **AI辅助绘制的概念工艺示意**，不是实拍、工坊调研记录、内部结构实证、经验证的制造操作图或特定流派的固定工艺标准。四工序概念名称与既有资料来源沿用，不以生成图新增史实结论。网页应继续就近标注“工艺示意 · AI辅助绘制”。

四图均已逐张目检，工序材料与动作可辨，机位、背景和操作姿势存在明显变化；文件尺寸已读取确认为1536 × 1024。新版创作源、`source/public/assets/craft/`运行副本及最新`dist/assets/craft/`四文件逐项SHA-256一致。2026-10-28资产清单共950项，`npm test`为138/138通过，`npm run build`由Vite转换383个模块并成功。Chrome生产工艺轮播专项9/9通过，覆盖四阶段图文同步、交互与暂停、小游戏/离页停止绘制、减少动态和WebGL回退，以及1920×1080、1440×900、1366×768桌面视口。详细命令、环境与截图见[更新说明](../../../references/craft-art-varied-scenes-2026-10-28.md)。
