# dsh-plugins

DSH（DeepSeek Harness）Web 插件集——单仓多插件结构，**每个插件都是独立可安装的包**（参照 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) 的组织方式）。

| 插件 | 功能 | 依赖 |
|---|---|---|
| [dsh-sidebar-lite](packages/dsh-sidebar-lite) | VSCode 风格右侧工作台（文件 / 终端 / Git / 浏览器…）；本 fork 新增**移到回收站**、**新建文件/文件夹** | 见其 package.json（node-pty 等） |
| [dsh-session-manager](packages/dsh-session-manager) | 会话标题栏 🗑️ 按钮，**彻底删除**不再需要的会话（移入系统回收站） | 零依赖 |
| [dsh-directory-picker-enhanced](packages/dsh-directory-picker-enhanced) | 「添加工作区」目录选择器增强：**上一级**按钮 + **盘符下拉** | 零依赖 |

## 安装单个插件

### 从本地路径（开发）

在 `~/.dsh/profiles/web/package.json` 中：

```jsonc
{
  "dependencies": {
    "dsh-sidebar-lite": "file:<本仓库>/packages/dsh-sidebar-lite",
    "dsh-session-manager": "file:<本仓库>/packages/dsh-session-manager",
    "dsh-directory-picker-enhanced": "file:<本仓库>/packages/dsh-directory-picker-enhanced"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-sidebar-lite",
        "dsh-session-manager",
        "dsh-directory-picker-enhanced"
      ]
    }
  }
}
```

然后在 profile 目录 `pnpm install`（或直接把 `packages/<name>` 复制到 profile 的 `node_modules/` 下），重启 `dsh web --no-open` 并硬刷新浏览器。

> `dsh-directory-picker-enhanced` 必须排在 `dsh-mobile` 之后（其 patch 会禁用 dsh-mobile 插入的官方选择器 UI）。

### 从 GitHub（推送后）

`dsh plugin add` 底层转发 pnpm，支持 git 子路径——无需发布 npm 即可单独安装任一插件：

```sh
dsh plugin --profile web add github:dhpdong/dsh-plugins#path:packages/dsh-session-manager
dsh plugin --profile web add github:dhpdong/dsh-plugins#path:packages/dsh-directory-picker-enhanced
```

（sidebar-lite 需要 pnpm install + build 后方可使用，建议走本地 `file:` 或发布 npm。）

## 开发

```sh
# 零依赖插件：改完直接同步到 profile node_modules 即生效
# sidebar-lite：在其目录内构建
cd packages/dsh-sidebar-lite && pnpm install && pnpm build
```

- 每个 `packages/<name>` 自带 package.json / cordis.patch.yml / README，互不依赖、可独立卸载（从 profile 的 dependencies 与 bundles 中移除对应条目即可）。
- 构建产物（lib/）已随目录分发；sidebar-lite 构建后需把 `lib/` 与 `package.json`、`cordis.patch.yml` 同步到 profile 安装副本。

## 仓库结构

```text
dsh-plugins/
├─ README.md                  # 本文件
└─ packages/
   ├─ dsh-sidebar-lite/       # fork 自 DSH-better-sidebar（MIT），含完整源码与构建
   ├─ dsh-session-manager/    # host 路由 + client 槽位按钮，纯 JS 零构建
   └─ dsh-directory-picker-enhanced/  # UI surface 替换，纯 JS 零构建
```
