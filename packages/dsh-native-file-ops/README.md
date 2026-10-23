# dsh-native-file-ops

DSH Web 插件：给 **原生右侧栏的文件树** 补齐文件操作，不再需要另开一套插件侧边栏。

原生 `@deepseek-ai/dsh-client-ui-sidebar-files` 只提供列目录和打开文件；本插件在它上面增加：

- 右键菜单：新建文件、新建文件夹、重命名、下载、移动到回收站、复制相对/绝对路径
- 行内拖拽：把文件/文件夹拖到目标文件夹（或树根）即移动
- 新建/重命名对话框，跟随 DSH 当前中英文

不替换原生文件树，不加第二个侧边栏，只监听原生行上的 `data-files-path` 事件。

依赖 `dsh-sidebar-lite` 已安装：新建/重命名/移动/回收站走它的
`/sidebar/api/fs.*`，下载走 `/sidebar/file?...&download=1`。这两条路由是
DSH Web 在局域网地址下仍能通过浏览器鉴权的 carrier；本插件不再依赖自己的
POST 路由。

## 安装

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dependencies": {
    "dsh-native-file-ops": "file:<repo>/packages/dsh-native-file-ops"
  },
  "dsh": { "profile": { "bundles": [/* … */, "dsh-native-file-ops"] } }
}
```

```bash
cd ~/.dsh/profiles/web && pnpm install
# 重启 dsh web，硬刷新浏览器
```

宿主端注册一条围栏路由 `/native-file-ops/api`（与侧边栏使用同一套 Host/Origin 信任规则），
只接受工作区内的绝对/相对路径，拒绝 `..` 越界。

## 与 dsh-sidebar-lite 的关系

两者可共存：本插件只增强原生的文件树；dsh-sidebar-lite 的编辑器/终端/Git 等仍可在它自己的面板里使用。
如果只想保留原生侧边栏，把 `dsh-sidebar-lite` 从 profile 的 `bundles` 里移除即可。

## 验证

在原生右侧栏打开“Workspace files”，右键文件/文件夹应出现上述菜单；拖一行到另一个文件夹应完成移动。
