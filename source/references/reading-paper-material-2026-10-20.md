# 无框题签与暖灰宣纸材质

## 实施位置与范围

用户批准并要求执行同名计划。唯一工程F:/数媒竞赛/信息可视化codex，从main@668c96d新建codex/reading-paper-material-2026-10-20；仅普通提交推送此支线，不合并main、不强推、不创建PR。C盘worktree、E盘工程和既有EXE不修改。

六个产品文件：surfaceSettings.js、useDeveloperSettings.js、DeveloperSettingsPanel.jsx、surface-settings.css、home-archive.css、chapters.css。没有新增运行图、依赖、设置分页或交互；顶部导航、加载、结构红底、动作、媒体和翻书引擎不变。现有尺寸、居中、留白、字体及来源许可保持。

## 材质实现

- bookTitle/cultureTitle：#F7F5F0、透明35%、模糊0、圆角0；宿主透明无阴影，独立::before纸白托底通过双渐变intersect形成四边32px渐隐。文字没有透明、模糊或mask，伪元素不接收点击。
- bookDetails/cultureBody/expressionOverlay：同色、透明10%、模糊0、圆角10；#B7AA97低透明边线、极轻接触阴影。神态简介、解读和三组对照共用材质。
- cultureSources/cultureSourceCard：同色、透明5%、模糊0、圆角10。
- 正文#3C352D、强调#9D2D23；出处改为可读的暖灰墨色。现有纹理限边角，最高2.5%，随各自纸张透明度减弱。
- 透明100时背景、纸纹、外边线、接触阴影和模糊消失，文字不淡出。标题颜色/模糊/圆角仍对纸层生效。

## 保存与迁移

保持nanfeng-lion:developer-settings:v1及全部可见参数。内部readingPaperVersion=1标记单次迁移，固定旧材质值逐字段比较，只更新仍等于旧默认的字段；自定义值、尺寸、字号、导航和播放偏好不变。版本标记写回后，用户重新选择旧值仍保存。非法旧共享透明度不传播到正文；有效旧共享偏好继续保留。存储不可用时回退新默认并可即时调节。

公共模板初始草稿取cultureBody宣纸参数，编辑不自动应用；原home/chapters/sources/all四范围与4/4/2/10处批量应用保持，尺寸及非材质偏好不变。恢复默认使用新材质。

## 实际验证

- 先RED再实现：新增核心5项、浏览器材质最初5项；独立审查指出非法旧共享值后补RED复现和修复，浏览器材质共6项。审查无Critical/Important，两项Minor均处理。
- 最终资产/核心56/56、生产构建321模块成功（3.52秒）；仅既有Three.js534.77kB警告。
- 开发相关首批83/89，修正旧材质合同与异步读取后6/6；扩大复跑89/90，最后一项是滑杆End后React提交前读取。改为等待数值及四层实际alpha，整个home-reading文件开发7/7、生产7/7通过。选定90个案例的最后有效结果均通过，**不宣称单批90/90或全工程E2E全绿**。
- 生产相关材质/公共设置/对照/展开/电脑布局37/37（3.8分钟），完整阅读文件另7/7（1.2分钟）。验证单狮、对照、八态、结构往返、许可折叠、保存/恢复/禁用存储、透明端点及公共应用。
- 独立生产33条实际布局/缩放检查，12张截图：1920×1080、2560×1440、1366×768、1024×768、1255×900且设置推开约900px；真实Chrome125%与150%在隔离profile验证DPR、元素边界和溢出。缩放截图通过CDP合成器直接截图，避免Playwright viewport:null缩放裁切，不修改网页或缩放图片。
- 原454条资产清单逐字段保持，新增12张本任务QA至466条；89份public/dist逐字节相同。历史截图、动作/模型服务、媒体映射、原图/视频、依赖和EXE不变。
- 原始命令和完整范围见[验证记录](reading-paper-material-2026-10-20-validation.json)。临时trace/日志/config在ignored tmp/reading-paper，不上传。常规复现：npm test、npm run build、PLAYWRIGHT_CHANNEL=chrome下运行本次9份spec（文件名见验证记录及Git diff）；生产使用既有playwright.preview.config.js。

## GitHub远程审查

交付前fetch发现远端main从668c96d新增54110c4（仅4份E盘同步wiki文档）。保全本任务diff后，在材质支线执行git merge --ff-only origin/main，保留全部远端记录且0冲突；产品树不变，main未修改或推送。之后只显式暂存本任务代码、测试、QA和记忆。最终commit/push与远端HEAD一致性以所属提交及交付回复核对，不上传.superpowers/tmp/dist、不创建PR。

## 截图入口

- [首页无框题签](../reviews/reading-paper/2026-10-20/home-1920x1080.png)
- [单狮正文](../reviews/reading-paper/2026-10-20/type-expanded-1920.png)
- [神态简介](../reviews/reading-paper/2026-10-20/state-overview-1920.png)
- [神态解读](../reviews/reading-paper/2026-10-20/state-details-1920.png)
- [Chrome150%神态](../reviews/reading-paper/2026-10-20/chrome-150-state.png)

仅电脑Chrome相关范围；不代表手机、其他浏览器、实体硬件、公开部署或EXE重新验收。

## 推送后再次审查：远端又有独立模型提交

材质实现1695339已普通推送，实际ls-remote确认支线HEAD与本地一致。该次最终核对同时发现main又从54110c4前进至62bcd8e（完整醒狮与毛发替换，70份文件，涉及模型/动作服务、媒体配置及大量新二进制）。这不是前面已接收的4份wiki文档更新，且在本轮冻结范围外，**未将它自动并入已验收材质支线**。

重新fetch并只读执行git merge-tree --write-tree HEAD origin/main：产品没有直接文本冲突，四份当前状态记忆（已知问题、当前待办、当前约束、项目概览）有内容冲突；不能因产品自动合并就宣称整个组合树通过。未进入实际merge状态、未覆盖任一方文件，也未改动main。当前材质测试和截图仅证明668c96d产品基线加本任务，不证明62bcd8e的新模型/毛发兼容与性能。后续若集成两项工作，需要保留双方记忆并重新运行组合树的资产、模型/动作及材质验证。此次交付保留独立支线和明确风险，不创建PR、不强推。
