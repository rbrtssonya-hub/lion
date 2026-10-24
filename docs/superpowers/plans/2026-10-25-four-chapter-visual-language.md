# 四章视觉语言统一实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Treat each chapter screenshot as a review point before continuing.

**Goal:** 把首页、结构、动作、神态串成一场连续的醒狮观展体验，同时保留四章各自的电影感、宣纸图鉴、剧场和水墨特色。

**Architecture:** 以共用的章节标识组件和少量 CSS 视觉变量统一标题层级、章号及朱红/金色强调；各章节保留自己的背景、材质与舞台构图。路由切换使用一套节奏稳定的轻量转场，再由章节本身的内容体现入境、观形、起舞、传神。

**Tech Stack:** React、现有 CSS、现有路由与导航动效。

**Spec:** `wiki_memory/日志/工程讨论/2026-10-25-四章视觉语言统一方案.md`

## Global Constraints

- 验收目标仅为电脑端。
- 保留首页、结构、动作、神态已有的主要视觉主题与交互。
- 红色用于当前章节和当前重点，金色用于少量分隔与装饰；避免全页叠加红金底色。
- 不新增依赖，不将各章改造成相同背景或相同卡片布局。
- 延续现有减少动态偏好处理；不增加遮挡主要内容的转场层。
- 实施前重新检查 `src/App.jsx`，其存在未提交的用户修改；仅改本计划明确涉及的 hunk。

## Review Focus

- 共享章节样式能否增强整体感，同时不冲淡四章自身的舞台气质。
- 标题、章号与红金强调在亮背景和暗背景上是否都清晰可读。
- 转场是否遮住视频、三维模型、神态主体或现有导航操作。
- 电脑窗口变矮或变窄时，章节标识是否挤压主视觉和原有控件。
- 减少动态偏好开启时，页面切换是否保留清楚、连贯的层级。

---

### Task 1: 建立共享章节标识与视觉变量

**Files:**
- Create: `src/components/ChapterIdentity.jsx`
- Create: `src/styles/chapter-identity.css`
- Modify: `src/config/chapters.js`
- Modify: `src/main.jsx`

**Interfaces:**
- `ChapterIdentity` 接收 `chapter`、`eyebrow`、`title`、`description` 和可选的 `className`；章节顺序与简短阶段名从 `chapters.js` 读取。
- 共用样式提供标题角色、章节编号、朱红强调和细金色装饰，不负责设置页面背景。

- [ ] 定义四个阶段名及编号：01 入境、02 观形、03 起舞、04 传神。
- [ ] 实现可复用章节标识，统一眉题、主标题、说明和章号层级。
- [ ] 定义最少量 CSS 变量，并确认它们不会覆盖各章背景及内容面板颜色。
- [ ] 在后续章节接入前，用占位页面截图检查组件在浅色与深色背景上的对比。

组件形态参考：

```jsx
<ChapterIdentity
  chapter="model"
  eyebrow="醒狮展览 / 观形"
  title="解构一头醒狮"
  description="从整体轮廓，走近每一处匠心。"
/>
```

### Task 2: 接入首页与结构页

**Files:**
- Modify: `src/features/home/HomePage.jsx`
- Modify: `src/styles/home.css`
- Modify: `src/styles/home-archive.css`
- Modify: `src/features/model/ModelPage.jsx`
- Modify: `src/features/model/StructureReadingPanel.jsx`
- Modify: `src/styles/model.css`

- [ ] 首页作为“入境”章节接入 01 识别，保持电影主视觉、标题动画与进入按钮清楚可见。
- [ ] 结构页作为“观形”章节接入 02 识别，保留宣纸色、三维醒狮、部件题签和阅读面板。
- [ ] 调整标识尺寸与构图，让结构页文字不遮挡模型，页面主视觉仍以醒狮为中心。
- [ ] 在 1920×1080 与 1440×900 桌面窗口检查首页首屏及结构页模型、面板布局。

### Task 3: 接入动作页与神态页

**Files:**
- Modify: `src/features/action/ActionPage.jsx`
- Modify: `src/features/action/action-theater.css`
- Modify: `src/features/chapters/ExpressionPage.jsx`
- Modify: `src/styles/expression-motion.css`

- [ ] 动作页作为“起舞”章节接入 03 识别，保留暗场剧场和金色灯光，让当前巨幕和表演仍是视觉焦点。
- [ ] 神态页作为“传神”章节接入 04 识别，保留水墨留白、八态狮头与当前状态反馈。
- [ ] 用各章自己的局部强调样式呈现共用识别，避免新增覆盖主视觉的大色块。
- [ ] 检查 1920×1080 与 1440×900 桌面窗口中标题和章号不挤压现有播放器、神态图和导航。

### Task 4: 统一章节切换节奏

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/features/navigation/useNavigationMotion.js`
- Modify: `src/styles/navigation.css`
- Modify: `src/styles/chapters.css`

- [ ] 复用现有导航和路由状态，统一章节离场、朱红细线提示、主标题出现的顺序与缓动。
- [ ] 为结构、动作、神态保留轻量的材质回应：墨迹显形、剧场灯光、淡墨停驻；使用同一时间节奏。
- [ ] 逐一从导航切换四章，确认转场完成后当前章号、活动导航、视频和三维内容状态一致。
- [ ] 开启系统减少动态偏好后重复切换，确保过渡变为简短淡入并立即呈现内容。
- [ ] 执行 `npm run build`，然后查看四页桌面截图及章节往返切换，按截图结果调整视觉细节。

## Execution Handoff

此计划记录用户选定的视觉方向，网页实现尚未开始。用户要求留待下一次共同执行；开始时先重查工作树并复核本计划，再依当时会话选择执行方式。完成每个章节后以桌面截图检查视觉层级，再继续接入下一章。
