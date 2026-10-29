# 观形画框与部位海报

用户于2026-10-29通过设计稿后授权实施。设计参考：`source/design/structure-atlas/frame-2026-10-29/approved-ui.png`，由内置ImageGen以当前页面和用户额冠海报为参考生成，仅供视觉审核。实际边框为React/CSS/内联SVG，不把生成图的文字作为网页内容。

24张主图保留原RGB和尺寸，以本地BiRefNet-General-Lite计算alpha；六张941×1672用户海报按眉目brows、额冠crown、胡须beard（页面鬃须）、织锦body、云边trim、口齿mouth对应。海报文字不代表真实模型拆件或实测。整体入口小图以现有`poster/lion-full.png`做本地透明轮廓提取与缩图。

源码：`AtlasStudyFrame.jsx`为朱红/哑金细线及祥云角花，`layout.mjs`按真实容器计算画框、七个导航与完整海报区域。完整三维交接保持原相机与图片登记；框在研究态出现。当前实体PNG审查图在`source/reviews/structure-atlas/2026-10-29-frame/`。

验收仅电脑Chrome，覆盖1366×768、1920×1080、2560×1080与跨比例缩放、设置推开、交接取消、WebGL恢复。最终独立清单验证结果见工程任务日志。

最终main@5034916组合清单：核心/资产154/154、994模块构建、独立生产Chrome观形8/8；177页工程记忆0错误。当前源截图来自该组合，不以较早分支或混合工作区结果替代。
