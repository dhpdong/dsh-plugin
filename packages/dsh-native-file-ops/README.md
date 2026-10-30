# dsh-native-file-ops

DSH Web 插件：给 **原生右侧栏的文件树** 补齐文件操作，不再需要另开一套插件侧边栏。

原生 `@deepseek-ai/dsh-client-ui-sidebar-files` 只提供列目录和打开文件；本插件在它上面增加：

- 右键菜单：新建文件、新建文件夹、重命名、下载、移动到回收站、复制相对/绝对路径
- 行内拖拽：把文件/文件夹拖到目标文件夹（或树根）即移动
- **打开文本文件就直接进入编辑**：内容区挂载 CodeMirror（语法高亮、行号、撤销历史），**单行不自动换行**，超长行通过编辑器底部的横向滚动条左右查看；没有编辑按钮、双击或弹窗；Markdown/HTML 顶部提供 **Preview/Edit** 切换，可看渲染后的排版。停止输入约 0.7 秒自动保存，`Ctrl+S` 立即保存，切换文件/标签前也会落盘。二进制或读取被截断的超大文件保持只读预览
- 编辑器复用 `dsh-sidebar-lite` 的懒加载 CodeMirror chunk（`/sidebar/bundle/editor.js`），本插件不重复打包一份编辑器
- 新建/重命名对话框，跟随 DSH 当前中英文

## 全局文件浏览器（与工作区解绑）

原生文件页签只列**当前会话工作区**，切换工作区就换一棵树。本插件接管 `files` 这一
页签类型，改成一个**全局根目录**的浏览器：

- 所有工作区共用**同一个根目录**（存在浏览器 `localStorage` 的 `dsh.files.root`），
  换会话/换工作区看到的都是同一棵树；
- 顶部有 `↑ 上级`、`刷新`、`打开文件夹`：点「打开文件夹」可在应用内逐级浏览并选定
  **任意绝对目录**（不限工作区）；选「跟随工作区」则清除根目录、回落到当前会话工作区；
- 行内右键菜单、拖拽移动、新建、重命名、回收站、下载、复制路径、内联 CodeMirror
  编辑器全部沿用，路径统一按绝对路径发给宿主；
- **从桌面拖入即上传**：把文件（或整个文件夹）从系统文件管理器拖到某一行上，就复制进
  那个文件夹；拖到空白处复制进当前根目录。文件夹会递归还原内部结构，多选一次拖入也行，
  上传过程中顶部显示 `正在上传 n/m：路径`，完成后自动刷新树。行与行之间的拖拽仍然是
  **移动**（不复制）；
- **文件图标按大类区分**（不是每个扩展名一个图标）：代码、文档、图片、音视频、
  压缩包、可执行/二进制、配置、模型权重、数据库各自一个字形 + 一种低饱和颜色，
  其余落到通用文件图标；扩展名缺失的常见文件（Dockerfile / Makefile / LICENSE /
  README / .gitignore / .env …）按名字归类；
- 底部终端跟文件浏览区走：新开的终端以当前根目录作为 cwd，并且**所有工作区共用同一个
  shell**——切工作区只是重新挂上同一个 pty，滚动内容与 `cd` 之后的目录都原样保留，不会新开
  shell 也不会显示重连。共享 shell 的起始目录是「选定根目录 → 首次连接时的会话工作区 →
  记住的 `dsh.files.termCwd`」，因此各工作区始终看到同一个终端；点「跟随工作区」会清掉这条
  记忆，下次连接重新取当前会话目录。

选定的根目录写在本机浏览器里，因此同一台机器上的所有会话共享；清空站点数据会回到
「跟随工作区」。**展开状态、滚动位置也一并共享**（`dsh.files.expanded` /
`dsh.files.scroll`）：在 A 工作区展开的目录，切到 B 工作区仍然展开；目录列表在页面内
有一份 30 秒的共享缓存，切换工作区时直接出树而不是重新转圈。

**依赖 `dsh-sidebar-lite` 已安装并挂载**：新建/重命名/移动/回收站/列目录走它的
`/sidebar/api/fs.*`，下载走 `/sidebar/file?...&download=1`。要让文件浏览器能打开
**工作区之外**的目录，还需在 profile 里打开宿主侧的围栏开关：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: sidebar-lite
  config:
    allowOutsideWorkspace: true
```

打开后 `/sidebar/api/fs.*` 接受任意绝对路径（默认 `false`，保持工作区围栏）。这两条路由是
DSH Web 在局域网地址下仍能通过浏览器鉴权的 carrier；本插件不再依赖自己的
POST 路由。

## 安装

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dependencies": {
    "dsh-sidebar-lite": "file:<repo>/packages/dsh-sidebar-lite",
    "dsh-native-file-ops": "file:<repo>/packages/dsh-native-file-ops"
  },
  "dsh": { "profile": { "bundles": [/* … */, "dsh-sidebar-lite", "dsh-native-file-ops"] } }
}
```

```bash
cd ~/.dsh/profiles/web && pnpm install
# 重启 dsh web，硬刷新浏览器
```

宿主端还保留一条历史围栏路由 `/native-file-ops/api`（与侧边栏共用 Host/Origin 信任规则），
当前客户端不再使用；文件操作统一走 `/sidebar/api/*` carrier，因此 `dsh-sidebar-lite` 是必需依赖。

## 与 dsh-sidebar-lite 的关系

**必须同时安装 `dsh-sidebar-lite`**：本插件只增强原生文件树，所有文件操作都经它的
`/sidebar/api/*` carrier 落到宿主。`dsh-sidebar-lite` 在本 fork 中不再显示自己的右侧
面板，只提供宿主 API、底部终端和兼容层；它的 `fs.trash` / `fs.create` / 下载路由正是
本插件的后端。

## 验证

在原生右侧栏打开“Workspace files”，右键文件/文件夹应出现上述菜单；拖一行到另一个文件夹应完成移动。
