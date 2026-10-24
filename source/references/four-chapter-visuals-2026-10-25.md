# 四章视觉统一与八态整图动作验收

本轮在 F 盘任务分支 `codex/four-chapter-visuals-2026-10-25` 基于 `32d435be` 完成。Windows、Node v24.20.0、Chrome 156.0.8078.47；范围为电脑网页，现用视频、模型、图片、依赖和原 App 底部排版均保留。

## 可见结果

四章采用同一章号与标题体系：01 入境、02 观形、03 起舞、04 传神。首页保留原电影书法主视觉，标识位于标题与探索按钮之间；结构为宣纸图鉴，动作为暗场剧院，神态为水墨图鉴。朱红强调当前主题，金色只用于细线和暗场细节。

`useChapterTransition` 保留旧页 140ms 轻收，再提交新展示章节并进行 540ms 显现。背景同步跟随展示章节；顶部细线不接收输入。各章使用暗角、宣纸页眉、水墨圆环或舞台光层呼应材质。剧场首次 ready 时另触发标题与光层，确保加载提示退出后仍能看见入场效果。首页/模型继续复用预热 DOM，返回模型后恢复原阅读位置及焦点。

八态动作使用原生 WAAPI，对完整插画播放一次。换图时等现有 520ms 进场的剩余时间结束再演示，当前态点击即时重播。原点击放大与详细解读维持独立层级，切态、对照、卸载和运行时启用减少动态均取消动作。

| 状态 | 主要姿态 | 动作时长 |
| --- | --- | --- |
| 喜 | 轻轻上扬 | 640ms |
| 怒 | 短促前倾、略放大 | 430ms |
| 哀 | 缓慢下沉 | 900ms |
| 乐 | 蓄势后轻弹一次 | 620ms |
| 动 | 横向摆动、转首 | 660ms |
| 静 | 一次微弱呼吸 | 880ms |
| 惊 | 轻微后缩抬起 | 500ms |
| 疑 | 偏首探看后回正 | 780ms |

## 实际验证

- `npm test`：最终核心与资产检查 78/78。
- `npm run build`：350 模块构建通过；Three 538.05kB 的已有体积提示保留。
- 开发组合：9 个相关 spec 首跑 62/65；补充复核见下方，未将首跑记为全量通过。
- 最终开发：`chapter-identity.spec.js` 与 `navigation-transitions.spec.js` 共 14/14，覆盖两种主验收尺寸、实际离场/细线/标题/材质、剧场 ready、冷等待、完整导航轨迹、快速切换和减少动态。
- 标题 FLIP 修订取样后专项 3/3；保留位移及连续性阈值，测真实原生动画和合成几何。
- 生产组合：7 个相关 spec 的电脑案例 48/48，覆盖首页、结构、动作、神态、对照与返回、设置、播放器和八态动作。
- 最终生产补验：新章标识与八态动作 8/8，包含剧场加载后入场、后台模型等待及实际运动矩阵。
- 操作提示改为短语整体换行后，生产动作宽/矮窗口布局补验2/2；原字号与防碰撞阈值保留。
- 1920×1080、1440×900 四章共 8 张生产截图已查看；捕获中无 pageerror、无横向溢出，首页章标与重播工具分离。截图、浏览器版本与几何记录见 [capture.json](../reviews/four-chapter-visuals/2026-10-25/capture.json)。
- 142 份 `source/public/assets` 与 `dist/assets` 逐项 SHA 一致；新增审查 PNG 逐项登记于资产清单，原有清单条目保留。

本轮主验收截图位于 `source/reviews/four-chapter-visuals/2026-10-25/`。手机、其他浏览器、真实显卡性能基准和离线 EXE 重打包不在本轮验证范围。

关键复核命令（Windows PowerShell）：

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm test
npm run build
npx playwright test tests/e2e/chapter-identity.spec.js tests/e2e/navigation-transitions.spec.js --output=tmp/chapter-final-motion
npx playwright test --config playwright.preview.config.js tests/e2e/chapter-identity.spec.js tests/e2e/expression-reactions.spec.js tests/e2e/expression-motion.spec.js tests/e2e/expression-click-feedback.spec.js tests/e2e/content-comparison.spec.js tests/e2e/app.spec.js tests/e2e/action-panel-readability.spec.js --grep-invert '手机' --output=tmp/four-chapter-production
npx playwright test --config playwright.preview.config.js tests/e2e/chapter-identity.spec.js tests/e2e/expression-reactions.spec.js --output=tmp/four-chapter-production-final
npx playwright test --config playwright.preview.config.js tests/e2e/action-panel-readability.spec.js --grep '动作标题与|矮电脑与' --output=tmp/action-identity-final
python wiki_memory/工具/memory.py check --project . --memory-dir wiki_memory --require-ready
```

## 首跑问题与处理

独立审查发现首页新标识与原重播卡相交。先加入矩形避让失败回归，再将标识移到主标题与探索按钮之间，两种主验收尺寸恢复通过。动作提示保留原可读字号，按操作短语整体换行，避免“缩放”等词语被断开。

新增转场测试原以固定 850ms 末帧断言终态，懒加载晚提交时实际动画仍在运行；已改为既采样真实中间态，也等待实际 idle 后检查终态。旧标题 FLIP 的固定 110ms 采样可能错过中段，现以原生 WAAPI clock 定位，再查看合成后的真实几何，保持并收紧起点/反向连续性断言。导航轨迹专测原未等待独立模型的几何/BVH/shader 准备，现明确等待 `#modelStatus` 就绪，原运行帧数、中段帧数和缓动阈值全部保留；独立冷等待用例仍验证首页/神态不被模型下载阻挡。

最终截图重拍曾遇一次 Windows 临时文件打开错误；确认文件可写并重新捕获后，8张截图与资产清单完整生成，最终78项核心与资产检查通过。

## 交付边界

本轮只暂存任务路径及 App 的任务 hunk；用户原有 App 底部三行排版继续留在工作区，`.superpowers/` 原有内容保持。实际提交、推送和 upstream SHA 以本轮日志所属提交及最终 Git 核对为准。
