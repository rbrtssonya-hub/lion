# 动作视角设置保持现场调参

用户2026-10-22要求：动作页开发者参数设置的“视角”分类需要边调整参数边在主视口转动视角，退出必须点击“取消”。基线为E盘main@aa47942，原未跟踪model/保留。

## 实现

- `src/App.jsx`统一持有设置分类，仅在动作页且当前分类为视角时移除外部点击拦截，真实canvas直接接收拖动和滚轮。Escape不退出，导航设置按钮改为聚焦面板，顶部关闭按钮隐藏。
- `DeveloperSettingsPanel.jsx`提示现场调参与取消退出；底部“取消”仍采用原未保存确认：继续编辑或放弃并回滚。
- “保存设置”在此模式只保存并继续编辑。`useDeveloperSettings.js`在成功保存后将取消快照更新为最新保存值，刷新dirty状态；重复保存也刷新，失败保留原快照及草稿。其他分类/章节继续采用原保存关闭及外部点击/Escape策略。
- 设置分类上提保持原分类、滚动与分组生命周期；不更换或重建三维模型、播放器、视角服务，不修改运行资产和依赖。

## 验证

Windows PowerShell，Node24.16.0/npm12.0.1/Python3.14.2，生产Chromium通道，单worker、trace关闭。用户原5173服务器不动，生产回归自建4196。

- `npm test`：73/73，4870.9417ms，包含651条资产快照检查。
- `npm run build`：341模块，最终构建1.88s；既有538.05kB Three包大小提示保留。
- 最终生产命令：`$env:PLAYWRIGHT_PREVIEW_PORT = '4196'; npx playwright test --config tmp/action-view-preview.config.mjs tests/e2e/action-view-editing.spec.js tests/e2e/settings-transaction.spec.js tests/e2e/view-scene-settings.spec.js tests/e2e/settings-view-source.spec.js --grep-invert 手机`。临时配置只继承preview配置、将testDir设为项目测试目录、关闭trace并指定忽略目录输出。最终19/19通过（1.7分钟）：新专项5项、原事务5项、设置分组/来源3项、真实场景视角/环境/释放6项。
- 首轮只选前三个spec，共16项：第1项推开通过，第2项覆盖模式因夹具鼠标点击被侧栏正常盖住的导航设置按钮而120秒超时，随后主动中止。仅修正专项夹具为真实键盘激活该按钮，并让滚轮依当前半径选择仍有余量的方向；新增干净会话也实际转动/缩放的检查，然后补原settings-view-source一起运行上述19项。产品代码不为夹具改动。
- 新增5项覆盖1920×1080推开/覆盖、900×600覆盖回退，真实命中canvas/拖动相机位置与滚轮距离变化；检查无误关闭、连续保存、最新保存快照回滚、继续编辑、取消直接关闭、刷新保留、存储失败及分类/路由切换恢复原策略。
- 独立静态审查及`git diff --check`通过；仅声明本轮桌面Chromium局部回归，未运行全工程E2E或其他浏览器/设备专项。无运行资产更改，原651条清单保留。

工程记忆已同步；实际运行index --apply及check --require-ready：110页、0错误，4条既有历史源文件提示保留。Git按根AGENTS持续授权提交推送本任务路径，最终revision与push以所属提交和实际upstream核对。已确认生产4196由Playwright回收，原5173仍为用户原进程41556。
