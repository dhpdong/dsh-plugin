# dsh-plugin

DSH（DeepSeek Harness）Web 插件集——单仓多插件结构，**每个插件都是独立可安装的包**（参照 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) 的组织方式）。

> **当前适配 DSH 0.2.1-rc.2**（2026-10）。0.2 移除了 `webRuntime`、
> `ctx.settings.register`、`invariants`、客户端 `workspaces.openPath` 等
> 0.1 接口；本仓库的插件已按 0.2.1 的服务/槽位/模块表重写，旧版 0.1.x
> 宿主请使用本适配提交之前的版本。

| 插件 | 功能 | 依赖 |
|---|---|---|
| [dsh-sidebar-lite](packages/dsh-sidebar-lite) | 本 fork 已停用自带右侧工作台；保留宿主 `/sidebar/api/*`（文件操作/下载/清单）与底部终端面板，原生右侧栏打开时终端停靠到其下方 | 见其 package.json（node-pty 等） |
| [dsh-session-manager](packages/dsh-session-manager) | 会话标题栏 🗑️ 按钮，**彻底删除**不再需要的会话（移入系统回收站） | 零依赖 |
| [dsh-directory-picker-enhanced](packages/dsh-directory-picker-enhanced) | 「添加工作区」目录选择器增强：**上一级**按钮 + **盘符下拉** | 零依赖 |
| [dsh-inline-diff](packages/dsh-inline-diff) | Edit / Write 工具 diff 在对话中**常驻展开**（Claude Code 风格） | 零依赖 |
| [dsh-native-file-ops](packages/dsh-native-file-ops) | **原生右侧栏文件树增强（当前主要文件入口）**：右键新建/重命名/下载/回收站/复制路径 + 拖拽移动；依赖 `dsh-sidebar-lite` 的 `/sidebar/api/*` carrier | `trash` |

## 安装单个插件

### 从本地路径（开发）

在 `~/.dsh/profiles/web/package.json` 中：

```jsonc
{
  "dependencies": {
    "dsh-sidebar-lite": "file:<本仓库>/packages/dsh-sidebar-lite",
    "dsh-session-manager": "file:<本仓库>/packages/dsh-session-manager",
    "dsh-directory-picker-enhanced": "file:<本仓库>/packages/dsh-directory-picker-enhanced",
    "dsh-inline-diff": "file:<本仓库>/packages/dsh-inline-diff",
    "dsh-native-file-ops": "file:<本仓库>/packages/dsh-native-file-ops"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-sidebar-lite",
        "dsh-session-manager",
        "dsh-directory-picker-enhanced",
        "dsh-inline-diff",
        "dsh-native-file-ops"
      ]
    }
  }
}
```

然后在 profile 目录 `pnpm install`（或直接把 `packages/<name>` 复制到 profile 的 `node_modules/` 下），重启 `dsh web --no-open` 并硬刷新浏览器。

> 0.2 的目录选择器由 `directory-picker-auto` 在启动时动态挂载；`dsh-directory-picker-enhanced` 的 patch 会停用该自动选择行，改挂官方 browse 后端 + 本插件前端（见其 README）。

### 从 GitHub（推送后）

`dsh plugin add` 底层转发 pnpm，支持 git 子路径——无需发布 npm 即可单独安装任一插件：

```sh
dsh plugin --profile web add github:dhpdong/dsh-plugin#path:packages/dsh-session-manager
dsh plugin --profile web add github:dhpdong/dsh-plugin#path:packages/dsh-directory-picker-enhanced
```

（sidebar-lite 的 `lib/` 已随仓库分发，可直接走本地 `file:`；修改源码后需在其目录 `pnpm install && pnpm build` 再同步 `lib/`。）

## 开发

```sh
# 零依赖插件：改完直接同步到 profile node_modules 即生效
# sidebar-lite：在其目录内构建
cd packages/dsh-sidebar-lite && pnpm install && pnpm build
```

- 每个 `packages/<name>` 自带 package.json / cordis.patch.yml / README，互不依赖、可独立卸载（从 profile 的 dependencies 与 bundles 中移除对应条目即可）。
- 构建产物（lib/）已随目录分发；sidebar-lite 构建后需把 `lib/` 与 `package.json`、`cordis.patch.yml` 同步到 profile 安装副本。
- 当前 profile 形态：DSH 原生右侧栏（Files / 终端）+ `dsh-native-file-ops` 文件操作；`dsh-sidebar-lite` 只提供宿主 API carrier、底部终端和兼容层，不再显示自己的右侧面板。

## 仓库结构

```text
dsh-plugin/
├─ README.md                  # 本文件
└─ packages/
   ├─ dsh-sidebar-lite/       # fork 自 DSH-better-sidebar（MIT），宿主 carrier + 底部终端
   ├─ dsh-session-manager/    # host 路由 + client 槽位按钮，纯 JS 零构建
   ├─ dsh-directory-picker-enhanced/  # UI surface 替换，纯 JS 零构建
   ├─ dsh-inline-diff/        # 对话内联 diff，纯 JS 零构建
   └─ dsh-native-file-ops/    # 原生文件树增强，纯 JS 零构建
```
