# 小醒：四章讲解与本地问答资料

核实日期：2026-10-26。范围：当前工作树中网页实际使用的中文内容、交互入口及已有来源声明。此页记录小醒的资料整理依据；没有将新增外部搜索、模型生成文字或示例回答当成已核实的醒狮知识。

## 内容入口与复用边界

运行资料为 `src/features/assistant/knowledge.js`，浏览器本地兜底与服务端检索共用同一份条目。路由采用当前网页的 `entry / model / action / state`，对应“入境 / 观形 / 起舞 / 传神”。每章有一段固定讲解和三条推荐问题；普通问答条目带稳定 ID、问题变体、关键词、答案和来源。

| 范围 | 当前依据 | 可支持的讲解 |
| --- | --- | --- |
| 四章参观路线 | `src/config/chapters.js`、`src/features/home/HomePage.jsx`、实际三章页面 | 首页影像与四展板，结构、动作、神态的用途与参观入口 |
| 醒狮文化与协作 | `src/data/home-culture.js`、`src/features/home/HomeCulture.jsx` | 文化照片中的头尾协作、锣鼓、狮头外观和连续表演观察；不凭单图推断难度或得分 |
| 佛山狮、鹤山狮、佛鹤狮 | `src/data/home-heritage.js`、`src/features/home/HomeHeritage.jsx` | 传统流派与融合形制的区分、形制与表演观察；不以颜色或一个特征作通用鉴定 |
| 狮头工艺 | `src/data/lion-structure.json`、`src/data/home-culture.js`、已有工艺来源 | 扎、扑、画、装和材料概述；具体实物与工坊做法仍有差异 |
| 六处可见结构 | `src/data/lion-structure.json`、`src/features/model/ModelPage.jsx`、`src/features/model/StructureReadingPanel.jsx` | 部件名称、旋转缩放、点选聚焦与复原；内部骨架、活动连接为资料说明，未展示内部拆装 |
| 四段动作视频 | `src/features/action/actionClips.js`、`src/features/action/ActionPage.jsx` | 探青采青、抖毛、狮子吐球、踩梅花桩的当前演示与实际控制；不用 `chapterContent.action` 的旧“待提供”文案 |
| 八态与对照 | `src/data/lion-expressions.js`、`src/features/chapters/ExpressionPage.jsx`、`src/features/chapters/ExpressionComparison.jsx` | 喜怒哀乐动静惊疑、三组对照和切换操作；AI 辅助视觉、定性观察提示、待真实样本校核 |
| 来源与创作说明 | `src/features/home/HomeCultureSources.jsx`、`source/references/lion-expressions.md` | 文化照片署名与许可、书册和类型图示意、神态视觉证据边界 |

外部链接全部复用网页已有的资料 URL：南海博物馆、鹤山市人民政府、中国非物质文化遗产网、新加坡武术龙狮总会。本轮核实了它们在工程内容中的对应关系，没有重新声称已经访问或验证远程页面当前可用性。

## 来源与导航

来源对象为 `{ id, label, chapter, section?, url? }`，章节和条目来自程序内的固定资料，不接受用户提问注入新的来源地址。内部 section 已通过源码检查确认存在；外部 URL 固定为无凭证 HTTPS。

首页展板受 `useHomeExhibit` 控制，文化、形制与参考资料可能位于隐藏面板。来源按钮应至少可靠导航到首页；要进入指定展板，需先切换对应展板再滚动，不能只对隐藏 section 调用 `scrollIntoView`。其他章节可先导航章路由，再等待目标出现。

## 本地检索与未覆盖问题

本地检索仅对程序内问题变体和关键词匹配，加入中文相邻字对相似度帮助理解常见换问法。章节偏好仅用于已经匹配的条目排序，不能使无关提问自动获得答案。通用的“模型、评分、资料、AI 生成”等词不会在缺少醒狮/网站上下文时单独触发讲解。

“讲解本页”直接返回当前章节固定讲解；明确要求讲解某一章时使用指定章。未命中的问题返回 `reason: 'not-in-knowledge'`，明确说明暂未收录并提供当前章入口。空白或非字符串问题返回 `reason: 'empty-question'`。本地资料不提供开放百科、天气、股票、确切起源年份或未经指定年份与来源的赛事规则。

联网大模型应把检索到的条目视为资料边界，保留 AI 辅助、定性观察与真实样本未校核等限定。来源不足时沿用未知提示，不根据用户的提示词编造历史、动作指标、情绪识别结果或评分。

## 实际检查

`node --test tests/assets/xiaoxing-knowledge.test.mjs`：12 项通过，覆盖四章推荐问题、跨章检索与换问法、无关与超长/异常输入、类型边界、当前四视频、模型未展示内部拆装、八态 AI 与评分边界、章节讲解意图、真实 section 和来源 URL。额外审查补齐狮口角度、膝关节、喂养及特定眼色原因等资料未覆盖问题，不能因出现已知狮种名而给出无关概述。首次执行因模块尚未创建而失败，随后在实际模块上通过；该检查不代表联网模型质量、浏览器导航或桌宠动效已验收。
