# dsh-session-manager

[English](README_EN.md) | 中文

DSH Web 插件：**彻底删除不再需要的会话**。

在会话标题栏右侧（Session log 旁）添加一个 🗑️ 按钮，点开即列出全部持久化会话；对确认不再使用的会话一键永久删除——其磁盘记录被移入**系统回收站**，左侧工作区会话列表随之清爽。补齐 DSH「归档只是隐藏、删除工作区只是解除分组」之外缺失的第三种能力。

## 为什么需要它

DSH 对会话只有两种处置：

| 操作 | 实际效果 |
|---|---|
| 归档会话 | 从列表隐藏，记录仍保留在磁盘 |
| 删除工作区 | 仅解除分组，会话记录原样保留 |

过期、失效、确认不再访问的会话没有任何官方途径清除，重启后始终躺在工作区里。本插件补上这一环：把会话目录移入回收站，DSH 的持久化服务与工作区注册表会在下次启动时自动对账清理。

## 功能

- 🗑️ 会话标题栏 utilities 区新增按钮，点击弹出会话列表面板（标题 + 工作目录）
- 每行一个删除图标：确认后**移入系统回收站**（Windows 通过 PowerShell `Microsoft.VisualBasic.FileIO`，可从回收站还原）
- **当前会话**只读保护——显示「当前会话」标签、删除按钮禁用，防止删掉正在进行的对话
- 删除后面板即时刷新；DSH 下次重启时搜索索引与 workspace 成员关系自动清理
- **零 npm 依赖**：host 半纯 Node 内置模块，client 半纯 JS（经 DSH 模块加载器加载）

## 安装

本插件未发布到 npm，以本地路径安装。

1. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 添加：

   ```json
   "dsh-session-manager": "file:<本目录绝对路径>"
   ```

2. 在 `dsh.profile.bundles` 数组中添加 `"dsh-session-manager"`。

3. 把本目录复制到 `~/.dsh/profiles/web/node_modules/dsh-session-manager/`（或在该目录执行 `pnpm install`），然后重启 `dsh web --no-open` 并硬刷新浏览器（Ctrl+Shift+R）。

## 工作原理

```text
┌─ client（浏览器）────────────────┐      ┌─ host（Node）──────────────────┐
│ conversation.session.header.     │ POST  │ /sidebar/api/sessions          │
│ utilities slot 注册 🗑️ 按钮       │ ────▶ │  action=list   枚举持久化会话   │
│ 点击 → 面板列会话 → 点删除 → 确认  │      │  action=purge  定位会话目录     │
└──────────────────────────────────┘      │   → 移入回收站（PS FileIO）     │
                                          └────────────────────────────────┘
```

- **枚举**：host 通过 `ctx.sessionPersistence.list()` + `locate()` 拿到每个会话的磁盘目录
- **删除**：Windows 上调用 PowerShell 的 `Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(…, SendToRecycleBin)` 移入回收站；其他平台退化为递归删除
- **善后**：删除前对会话做 best-effort 工作区归档；文件消失后，DSH 的持久化扫描与 workspace 成员过滤在下次启动时自动收敛

### 安全

- 路径必须为绝对路径且真实存在；拒绝文件系统根目录
- API 仅接受 POST + JSON，与其他 `/sidebar/api` 路由同构
- 当前会话在 UI 层禁止删除

## 目录结构

```text
dsh-session-manager/
├─ package.json        # 零依赖；声明 dsh.client 注入与 ./client 导出
├─ dsh.plugin.json     # 插件清单
├─ cordis.patch.yml    # 挂载行 id: session-manager
├─ README.md / README_EN.md
└─ lib/
   ├─ index.js         # host 半：API 路由 + 回收站删除
   └─ client.js        # client 半：槽位按钮 + 会话列表面板
```

## 排错

| 现象 | 处理 |
|---|---|
| 标题栏没有 🗑️ 按钮 | `dump-config` 确认挂载行存在；浏览器硬刷新；确认 HTML 里含 `/plugins/dsh-session-manager/client.js` |
| 面板报 `session not found` | 会话列表已过期，点 ↻ 刷新后重试 |
| 删除报 `recycle-bin delete failed` | PowerShell 被策略限制时改用 `rm` 分支（非 win32 平台自动走该分支） |
