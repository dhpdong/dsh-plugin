# dsh-native-file-ops

DSH Web 插件：给 **原生右侧栏的文件树** 补齐文件操作，不再需要另开一套插件侧边栏。

原生 `@deepseek-ai/dsh-client-ui-sidebar-files` 只提供列目录和打开文件；本插件在它上面增加：

- 右键菜单：新建文件、新建文件夹、重命名、下载、移动到回收站、复制相对/绝对路径
- 行内拖拽：把文件/文件夹拖到目标文件夹（或树根）即移动
- 文档预览头部的「编辑」按钮：**在原预览区域内**直接编辑文本源码（不弹窗、不离开当前页），`Ctrl+S` 保存，保存后自动刷新预览（二进制或超大文件会拒绝，避免截断覆盖）
- 新建/重命名对话框，跟随 DSH 当前中英文

不替换原生文件树，不加第二个侧边栏，只监听原生行上的 `data-files-path` 事件。

**依赖 `dsh-sidebar-lite` 已安装并挂载**：新建/重命名/移动/回收站走它的
`/sidebar/api/fs.*`，下载走 `/sidebar/file?...&download=1`。这两条路由是
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
