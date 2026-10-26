# Four Chapter Local Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. The user approved direct execution without further stage confirmations.

**Goal:** 在当前本地分支完成序／造／舞／传精简改版并提供真实电脑预览。

**Architecture:** 合法页面路由与顶栏章节分离，八态归舞但保留自身路由及原结构观察上下文。复用七页史册、形制组件、照片和三维场景；新传章使用原生 SVG 与现有照片。独立组件并行开发，集成后由一个独立审查者检查全任务 diff。

**Tech Stack:** React 19、Vite 7、Three.js 0.160、原生 SVG/dialog、Node test、Playwright Chrome；无新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-26-four-chapter-local-redesign.md`

## Global Constraints

- 用户已批准范围并授权后续不再逐阶段确认。
- 仅电脑端；保留原模型、视频、字体与许可；不新增未经核实内容。
- 分支 `codex/nfys-structure-review-2026-10-26`；本地提交，不合并 main、不 push、不创建 PR、不部署。
- 保留原 App 排版差异与 `.superpowers/`；按任务路径或 hunk 暂存。
- 工艺只呈现有来源的扎／扑／画／装；点睛固定顺序、内部机关图、鼓型对应、阿南游戏接入不在本版。

## Review Focus

- `#state` 与旧别名直达：页面和顶栏归属不能混淆；由任务1测试。
- 从结构进入八态后返回原部位：保留选择、阅读位置和焦点；由任务1和4浏览器测试。
- 地图照片切换和图片故障：图注、署名、许可必须随照片一致；由任务2测试。
- 短窗口及设置推开：关键阅读、章际入口和局部滚动可用；由任务5截图和几何检查。
- 顺序观赏、后台及离章：不能叠加声音、意外恢复或自动启动；由任务4测试。

### Task 1: 主章、子页与序章入口（集成者）

**Files:** `src/config/chapters.js`、`src/hooks/useChapterRoute.js`、`src/components/ChapterNav.jsx`、`ChapterIdentity.jsx`、`src/App.jsx`、`src/features/chapters/ChapterPage.jsx`、`src/features/home/HomePage.jsx`、`HomeArchiveNav.jsx`、`src/styles/home-journey.css`、`src/features/developer-settings/surfaceSettings.js`、`DeveloperSettingsPanel.jsx`。

**Interfaces:** 输出 `pageRoutes`、`chapterForRoute(route)`、`getChapter(route)`；`state`所属`action`。传章组件消费 `onNavigate(route)`；ActionPage新增同名导航回调；ExpressionPage新增`onReturnToAction()`，保留`observation/onReturnToModel`。

- [x] 添加并运行 `tests/assets/chapter-navigation.test.mjs`，先验证现有配置没有 spread 且 state 尚无父章归属。

```js
assert.deepEqual(chapters.map(c => c.route), ['entry', 'model', 'action', 'spread']);
assert.ok(pageRoutes.includes('state'));
assert.equal(chapterForRoute('state'), 'action');
assert.equal(getChapter('state').number, '03');
```

- [x] 实现最小路由与导航拆分，保留别名与真实 displayedRoute；显式分发 SpreadPage。
- [x] 首页保留七页书册及章际入口，用原生 dialog 提供资料与许可阅读并恢复触发按钮焦点。
- [x] 设置新增传章底板，保留八态控制，复用现有材质生成与存储回退。
- [x] 浏览器覆盖直达、历史、八态父章、资料开关与快速切章；确认 Node 测试由红转绿。

### Task 2: 传章地图与案例（独立执行者）

**Files:** 新增 `src/data/spread.js`、`src/features/spread/SpreadPage.jsx`、`SpreadMap.jsx`、`src/styles/spread.css`、`tests/assets/spread-data.test.mjs`；可新增独立 e2e。

**Interfaces:** 默认导出 `SpreadPage({ onNavigate, settings })`；使用`spreadOverlay`现有材质 CSS 变量（由任务1添加）。数据从`homeCultureStories`继承，不修改原数据。地点为岭南、香港、新加坡、旧金山、埃德蒙顿。

- [x] 先写数据行为测试：每个案例可解析为现有 story；照片与原许可字段相等；节点选择有稳定 id。

```js
for (const place of spreadPlaces) {
  assert.ok(place.stories.length);
  for (const story of place.stories) assert.ok(homeCultureStories.includes(story));
}
```

- [x] 运行红测试后实现数据、纸面 SVG 分布图、地点键盘按钮、当前照片卡及局部照片切换。
- [x] 显示“所收录案例分布示意”，不画方向航路；同屏署名许可、图片故障和空白内容回退可用。
- [x] 新照片不复制、不改字节；三个电脑尺寸保持地图和卡片同屏或局部可滚动。

### Task 3: 造章局部阅读（独立执行者）

**Files:** `src/features/model/ModelPage.jsx`；新增`CraftSection.jsx`、`src/styles/model-journey.css`及独立 e2e。

**Interfaces:** 保留 ModelPage 现有 props 与所有 DOM 选择器；复用`HomeLionTypes`。活动页签为`form/types/craft`；隐藏观形时通过原`setActive`等生命周期接口暂停场景，返回观形不丢所选部位。

- [x] 先写并运行浏览器红测试，断言“观形／形制／工艺”局部切换以及工艺的照片／来源可见。

```js
await page.getByRole('tab', { name: '形制', exact: true }).click();
await expect(page.getByText('融合形制', { exact: true }).first()).toBeVisible();
await page.getByRole('tab', { name: '工艺', exact: true }).click();
await expect(page.getByRole('heading', { name: '扎、扑、画、装' })).toBeVisible();
```

- [x] 保留原模型子树、标签、loading与聚焦行为，添加清楚且可键盘操作的局部页签。
- [x] 形制复用原有三类与对照；工艺仅为有来源的四工序和广州完成品实景，明确不显示内部机关。
- [x] 短桌面下图文可读；切回观形仍可从眉眼／嘴进入八态。

### Task 4: 舞章顺序观赏与八态（独立执行者）

**Files:** `src/features/action/ActionPage.jsx`、`useTheaterPlayback.js`及必要小型状态辅助；`src/features/chapters/ExpressionPage.jsx`；局部样式和独立测试。场景 API 仅在必要时添加真实空间机位，不改模型。

**Interfaces:** `ActionPage({ ..., onNavigate })`可进入`state/spread`；`ExpressionPage({ ..., onReturnToAction })`提供返回戏台；既有`onReturnToModel`优先保留上下文入口。默认单段loop，顺序模式才关闭loop并监听ended。

- [x] 先写运行红测试，覆盖主动开始、顺序推进、停止、末幕结束；不能靠任意timeout当成片段结束。

```js
await expect(page.getByRole('button', { name: '看狮头 · 八态' })).toBeVisible();
await page.getByRole('button', { name: '顺序观赏', exact: true }).click();
await expect(page.getByRole('button', { name: '停止顺序观赏' })).toBeVisible();
```

- [x] 使用实际video ended事件推进四片；单幕回看和停止恢复原循环；末幕给前往传章入口。
- [x] 八态入口首屏可见，八态有返回戏台及保留的原部位返回。减少动态与静音沿用现有策略。
- [x] 不增加鼓型、内部演员视角、完整连续采青表述；命名与源素材相符。

### Task 5: 集成、视觉验收与本地提交（集成者）

**Files:** `tests/e2e/four-chapter-journey.spec.js`、相关旧测试迁移、`source/reviews/four-chapter-journey/2026-10-26/`、`source/references/four-chapter-journey-2026-10-26.md`、资产清单与相关`wiki_memory`。

- [x] 运行 `npm test` 与 `npm run build`；运行新行为和受影响旧行为的 Chrome 开发／生产回归。
- [x] 1366×768、1440×900、1920×1080截图并逐张查看，检查所有页面、资料、形制／工艺、地图、八态和设置推开。
- [x] 独立审查全部任务 diff；修复实际缺陷并运行相应回归。
- [x] 核对原媒体 SHA 未变，追加审查记录，不全量重写旧清单；刷新并检查工程记忆。
- [x] 精确暂存任务改动，App暂存后从index排除原排版差异；本地 commit，核对branch/status，不 push。

## Execution evidence

Completed locally on 2026-10-26. Detailed commands, failures, fixes, screenshots and limits: `source/references/four-chapter-journey-2026-10-26.md`. User selected keeping this branch local; no merge or push. Formal review fixes include source-dialog material selectors and pending media-end consumption; no remaining confirmed product blocker in the exercised scope.
