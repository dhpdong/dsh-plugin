# dsh-directory-picker-enhanced

[English](README.md) | 中文

DSH Web 工作区目录选择器增强（适配 DSH **0.2.1-rc.2**）。

官方 browse 弹窗没有显式的「上一级」入口，Windows 下也不能切换盘符。本插件
替换该前端界面并增加：

- **上一级**按钮：从当前目录跳到父目录。
- **Windows 盘符下拉**：用现有 `listDirectory(root, signal)` 探测
  `A:\` … `Z:\`，只列出可访问的盘符。

界面跟随 DSH 当前语言（内置 zh / en），在文件系统根目录隐藏「上一级」，
不改动宿主侧目录选择器。

## 在 DSH 0.2 上如何挂载

DSH 0.2 在启动时动态解析目录选择器：`directory-picker-auto` 会把
native 或 browse 的宿主后端与对应前端成对挂载。只替换 UI 就必须固定这对
组合：

```yaml
- id: directory-picker
  name: '@deepseek-ai/dsh-host-directory-picker-auto'
  disabled: true

- insert:
    - id: directory-picker-browse-host
      name: '@deepseek-ai/dsh-host-directory-picker-browse'
    - id: directory-picker-enhanced-surface
      name: 'dsh-directory-picker-enhanced'
```

以上内容就是本包的 `cordis.patch.yml`，安装 bundle 时自动生效。官方 browse
前端不会再被插入，因此两个单占位槽
（`conversation.hero.workspace.directoryFlow` /
`sidebar.workspaces.directoryFlow`）只有本插件一个注册者。

## 安装

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dependencies": {
    "dsh-directory-picker-enhanced": "file:<仓库>/packages/dsh-directory-picker-enhanced"
  },
  "dsh": { "profile": { "bundles": [/* … */, "dsh-directory-picker-enhanced"] } }
}
```

在 profile 目录执行 `pnpm install`（或把包复制进 `node_modules/`），重启
`dsh web` 并硬刷新浏览器。

## 验证

`dsh --profile web --dump-config` 应能看到被停用的 `directory-picker` 行、
`directory-picker-browse-host` 行和 `directory-picker-enhanced-surface` 行。
打开「添加工作区」，应出现「上一级」按钮（Windows 下还有「盘符」下拉）。

## 回滚

从 profile 的 `dependencies` 与 `bundles` 中移除本包，下次启动即恢复官方
`directory-picker-auto` 行。
