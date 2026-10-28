# 五次提交的兼容导入与原 SHA 恢复

外部试验原本具有独立的五次提交，末次为 `869abd37bd991d3169d544f34bf964adab0e693b`。初始提交跟踪了一份 136,175,747 字节的 Blender 原件；它与本工程现有 `localOnly` 模型原件完全相同，超过 GitHub 普通 Git 文件限制。

本次保留五次历史的拓扑、作者、提交者、原时间和提交内容，只在各历史树中将该重复原件替换成 `.blend.source.txt` 来源指针。每次兼容提交附加 `Original-Commit` trailer，记录原 SHA；其他原 blob 保留原字节。兼容末次提交为 `460ec43bc3b1f4d30dd8208f2f237fc3ec78dde9`，由当前工程集成提交作为第二父提交纳入历史，不引入第二套运行入口。

## 提交映射

| 原提交 | 兼容提交 | 内容 |
| --- | --- | --- |
| `5128962` | `a0b21ab` | 初始化外部试验及标准工程记忆 |
| `2a781ac` | `49f7ea0` | 完成全屏交接后再缩图 |
| `7a492fe` | `575dc63` | 图片交接期间保留整窗模型 |
| `56e01b6` | `7810363` | 四比例清晰主图 |
| `869abd3` | `460ec43` | 六张信息图版及文化浮窗 |

完整 SHA 和唯一路径变化见 [compatible-commit-map.json](compatible-commit-map.json)。历史整树可通过 `git show <兼容SHA>:<原路径>` 读取；本工程的运行组件与资源已按现工程结构集成。

## 精确恢复原五个 SHA

[archive-original-history.json](archive-original-history.json) 保存原五份 commit 和 118 份 tree 对象的原始字节（base64），并登记全部原 blob SHA。466 份共享原 blob 在兼容历史中保持可达，因此不另造一份数百 MB 的 Git bundle。唯一未进入兼容历史的大 blob，可由现有同字节 Blender 原件重建。

在工程根执行只读检查：

```powershell
python source/archives/xuanji5/git-history/restore_original_history.py --repo . --verify
```

如在新克隆中缺少本地原件，可显式指定其路径：

```powershell
python source/archives/xuanji5/git-history/restore_original_history.py --repo . --verify --source-model 'C:\Users\Administrator\Desktop\炫技5\source\科比blend.blend'
```

原件应为 136,175,747 字节，SHA256 为 `cc5f72c3e1a5c330dd64daf6842720a91a8e21b6909a01b6f6200a8834545f53`。本工程默认恢复来源为 `source/models/lion-kobi-2026-10-26.blend`。脚本在写入前核对大小、SHA256 及 Git blob SHA1。

恢复仅写对象库，默认不更改 HEAD、index、工作树或任何 ref：

```powershell
python source/archives/xuanji5/git-history/restore_original_history.py --repo . --restore
```

需要单独保留可浏览的原历史引用时，明确指定新的归档 ref：

```powershell
python source/archives/xuanji5/git-history/restore_original_history.py --repo . --restore --ref refs/archive/xuanji5-original
git log --oneline refs/archive/xuanji5-original
```

脚本拒绝覆盖不同的已有引用或当前分支；精确恢复的原历史包含超大 blob，保留为本地归档即可，GitHub 集成使用兼容历史。原 SHA 的恢复检查在完全独立的临时仓库中执行，先只传输兼容历史并确认原 commit 和大 blob 缺失，再补回原件并核对五个 SHA，结果见 `roundtrip-validation.json`。
