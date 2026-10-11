# 广府醒狮数字展厅整体页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将整体/结构模型页改造成三栏式广府醒狮数字图鉴，加入真实可用的热点联动和 Three.js 镜头聚焦，同时保留合并网格的事实边界。

**Architecture:** React `ModelPage` 负责三栏信息、选中状态、路由入口和结构示意状态；`lionScene.js` 负责模型加载、相机聚焦/复原、OrbitControls 和资源清理；`lion-structure.json` 提供文化、结构、材料和镜头目标数据；`model.css` 负责暖米金中心、朱红两侧和桌面/小屏布局。

**Tech Stack:** React 19、Vite、Three.js 0.160、原生 CSS、Playwright、Node test runner。

**Spec:** `docs/superpowers/specs/2026-10-11-lion-overall-digital-exhibition-design.md`

## Global Constraints

- 保留原始 `source/public/assets/models/lion-overall.glb`，不声称合并网格拥有真实可分离部件。
- 保留顶部章节导航、搜索、菜单、整体/结构 Hash 路由、视频入口和模型失败回退。
- 新增数据必须标注为结构示意、资料整理或 AI 辅助创作，不编造官方统计或实测工艺数据。
- 桌面优先验收 1920×1080 和 2560×1440，小屏幕保留单列回退和无横向溢出。
- 组件退出时释放 Three.js 动画帧、监听器、控制器、纹理、几何和渲染器。

## Review Focus

- 合并网格模型点击“查看结构”时，用户能看到明确的示意边界，而不会误以为存在真实爆炸零件。
- 相机聚焦后连续拖拽、缩放和重置视角不会留下多个动画循环或丢失 OrbitControls。
- 模型加载失败、WebGL 上下文丢失和离开页面时，左右信息面板仍可见且资源被清理。
- 1920/2560 桌面三栏和 390px 单列布局不会让面板遮住关键模型或造成横向滚动。
- 切换整体、结构和其他章节后，顶部导航高亮、结构滑杆和选中信息不会串页。

### Task 1: Extend the factual hotspot data and add red tests

**Files:**
- Modify: `src/data/lion-structure.json`
- Modify: `tests/assets/asset-integrity.test.mjs`
- Modify: `tests/e2e/app.spec.js`

**Interfaces:**
- Produces each hotspot's `culture`, `structure`, `focusTarget`, and `focusDistance` fields for `ModelPage` and `lionScene.js`.

- [ ] **Step 1: Write failing assertions**

Add asset assertions that every hotspot includes non-empty cultural meaning, pattern, structure parts, craft text, a three-number focus target, and a positive focus distance. Add browser assertions for `#culturePanel`, `#structurePanel`, `#viewStructure`, `#resetView`, and a hotspot click changing `data-focus-state`.

- [ ] **Step 2: Run the tests to verify they fail**

Run `npm test` and `npx playwright test tests/e2e/app.spec.js --grep "数字图鉴"`.

Expected: the asset test reports missing new hotspot fields and the browser test reports missing panel/action selectors.

- [ ] **Step 3: Add the six hotspot data blocks**

Keep existing names, source tags and structure caveats. Add concise Chinese fields such as `culture.meaning`, `culture.pattern`, `culture.form`, `structure.parts`, `structure.material`, `structure.craft`, `structure.connection`, `focusTarget: [0, 0.2, 0.25]`, and `focusDistance: 2.7` with values adjusted per part.

- [ ] **Step 4: Run the asset test**

Run `npm test`.

Expected: all asset tests pass; the browser test remains red until the page implementation exists.

### Task 2: Add camera focus and reset APIs to the Three.js service

**Files:**
- Modify: `src/services/lionScene.js`
- Modify: `tests/e2e/app.spec.js`

**Interfaces:**
- `createLionScene()` returns `focusOn({ target: [number, number, number], distance: number })`, `resetView()`, `setAutoRotate(value)`, and `dispose()`.
- `focusOn` eases both `camera.position` and `controls.target` for about 700ms and pauses auto-rotation through `onAutoRotateChange(false)`.

- [ ] **Step 1: Add browser behavior assertions**

After model ready, click `#hotspots [data-id="eyes"]`, assert `#modelStage` has `data-focus-state="eyes"`, click `#resetView`, and assert `data-focus-state="overall"`. In structure view, assert `#viewStructure` changes to the structure route without losing the selected hotspot.

- [ ] **Step 2: Run the focused browser test to verify it fails**

Run `npx playwright test tests/e2e/app.spec.js --grep "数字图鉴"`.

Expected: missing `data-focus-state` and reset behavior.

- [ ] **Step 3: Implement a single tweened camera view**

Track one `viewTween` object inside the render loop. Interpolate camera position and OrbitControls target with an eased progress value, and cancel/replace an existing tween when another hotspot is selected. Store the centered initial camera/target for `resetView`; do not create a second requestAnimationFrame loop.

- [ ] **Step 4: Run the focused browser test**

Run `npx playwright test tests/e2e/app.spec.js --grep "数字图鉴"`.

Expected: the camera API test passes and no page error is reported.

### Task 3: Rebuild `ModelPage` as the three-column information view

**Files:**
- Modify: `src/features/model/ModelPage.jsx`
- Modify: `src/data/lion-structure.json` only if a data label needs correction

**Interfaces:**
- Consumes hotspot data from Task 1 and scene APIs from Task 2.
- Produces `#culturePanel`, `#sceneFrame`, `#structurePanel`, `#hotspots`, `#viewStructure`, `#resetView`, and `#restoreStructure`.

- [ ] **Step 1: Add the failing DOM contract test**

Assert the page exposes `#culturePanel`, `#structurePanel`, `.panel-detail-list`, `.structure-diagram`, `#viewStructure`, `#resetView`, and that selecting `eyes` updates both panel headings and `data-selected-id="eyes"`.

- [ ] **Step 2: Run the test to verify it fails**

Run `npx playwright test tests/e2e/app.spec.js --grep "数字图鉴"`.

Expected: the old two-column DOM lacks the new panel IDs and actions.

- [ ] **Step 3: Implement state and markup**

Keep existing loading/error handling. Add `selectedId`, `hoveredId`, `focusState`, and `structureDepth` coordination; call `sceneRef.current.focusOn(selected.focusTarget, selected.focusDistance)` on hotspot selection, `resetView()` on reset, and preserve selected data when navigating to structure. Render culture meaning/pattern/form on the left and parts/material/craft/connection with a compact structure diagram on the right.

- [ ] **Step 4: Run the focused browser test**

Run `npx playwright test tests/e2e/app.spec.js --grep "数字图鉴"`.

Expected: all new IDs, selection updates, route action and reset behavior pass.

### Task 4: Apply the warm paper/朱红 visual system and responsive layout

**Files:**
- Modify: `src/styles/model.css`
- Modify: `tests/e2e/app.spec.js`

**Interfaces:**
- Keeps class names consumed by `ChapterNav`, `EntryNavTools`, Three.js and existing fallback tests.

- [ ] **Step 1: Add visual/layout assertions**

Assert desktop `.model-layout` has three visible columns, `.model-stage` has the warm center gradient, and at 390px the document scroll width does not exceed the viewport.

- [ ] **Step 2: Run the test to verify it fails**

Run `npx playwright test tests/e2e/app.spec.js --grep "数字图鉴|模型页"`.

Expected: the old two-column computed grid and background values do not meet the new contract.

- [ ] **Step 3: Implement CSS**

Use a three-column grid with a bright central radial gradient, two red/umber side gradients, low-opacity repeating cloud/rotation motifs, paper-like panel backgrounds, gold guide lines, hotspot breathing, focus states, structure diagram bars, and a single-column media query below 900px. Keep `object-fit` fallback, loading panel, existing model controls, and navigation tool visibility.

- [ ] **Step 4: Run browser layout checks**

Run `npx playwright test tests/e2e/app.spec.js tests/e2e/home-navigation.spec.js` with Chrome at 1920×1080, 2560×1440, and 390×844 coverage in the tests.

Expected: desktop panels fit without overlap, mobile has no horizontal overflow, and all chapter/search/menu regressions pass.

### Task 5: Full verification, memory update, review, commit and push

**Files:**
- Create: `wiki_memory/日志/UI修改/2026-10-11-整体页数字展厅改版.md`
- Modify: `wiki_memory/当前状态/项目概览.md`
- Modify: `wiki_memory/当前状态/当前约束.md`
- Modify: `wiki_memory/当前状态/当前待办.md`
- Modify: `wiki_memory/日志/MOC_工作日志.md` via memory index

- [ ] **Step 1: Run full verification**

Run `npm test`, `npm run build`, `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e`, `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e:preview`, `npm run memory:index`, `npm run memory:check -- --require-ready`, and `git diff --check`.

- [ ] **Step 2: Inspect desktop screenshots**

Capture `/\#/model` and `/\#/structure` at 1920×1080 and 2560×1440, plus 390×844, and verify the model remains the visual focus, panels do not cover it, and the structure caveat remains visible.

- [ ] **Step 3: Run independent review**

Review the final diff for factual labeling, camera cleanup, route regressions, responsive overflow, and unchanged GLB bytes. Record Critical/Important fixes or deferred Minor findings in the UI log.

- [ ] **Step 4: Commit only task paths and push**

Run `git add` for the changed model page, scene service, data, styles, tests, design/plan docs, and memory pages; commit with `Redesign lion model digital exhibition`; push the current branch to configured `origin` and report the exact commit and remote status.
