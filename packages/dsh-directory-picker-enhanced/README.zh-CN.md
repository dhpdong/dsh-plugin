# dsh-directory-picker-enhanced

[English](README.md) | 中文

增强版 DSH Web 工作区目录选择器 UI 插件。

这个插件替换 `dsh-mobile` 插入的官方 browse 目录选择器前端界面，并在“添加工作区”弹窗中增加两个导航能力：

- **上一级**按钮：从当前目录列表直接返回父目录。
- **Windows 盘符下拉**：使用现有 `listDirectory(root, signal)` API 自动检测 `A:\` 到 `Z:\` 中可访问的盘符，并允许直接跳转到其他盘符。

行为细节：

- 选择器界面跟随 DSH 当前语言（内置 zh / en 文案，实时切换）。
- 位于文件系统根目录（盘符根）时隐藏「上一级」按钮——没有更上级可列。
- 盘符下拉只列出探测成功的盘符，不可用的盘符不会出现在菜单里。

本插件**未发布到 npm**，按下方说明以本地路径方式安装。

## 为什么这是前端 UI surface 插件

DSH 已经有一个 host 侧 `directoryPicker` service。如果再注册一个同名 service，会触发 Cordis 重复 service 错误。因此本插件**不会**注册新的后端目录选择器服务。

本插件只替换客户端 UI surface：

1. 保留 `dsh-mobile` 提供的官方后端 browse picker：
   - `directory-picker-mobile-host`
   - `@deepseek-ai/dsh-host-directory-picker-browse`
2. 禁用 `dsh-mobile` 插入的官方 browse UI surface：
   - `directory-picker-mobile-surface`
   - `@deepseek-ai/dsh-client-ui-directory-picker-browse`
3. 插入增强版 UI surface：
   - `directory-picker-enhanced-surface`
   - `dsh-directory-picker-enhanced`

官方 DSH 安装目录中的文件保持原始状态，不需要热补丁。

## 目录结构

```text
dsh-directory-picker-enhanced/
├─ package.json
├─ cordis.patch.yml
├─ README.md
├─ README.zh-CN.md
└─ lib/
   ├─ index.js
   └─ client.js
```

## 安装到 DSH Web profile

本插件需要在 `dsh-mobile` 之后加载，因为它的 patch 会禁用 `dsh-mobile` 插入的官方 browse UI surface。

在 `C:\Users\dhpdo\.dsh\profiles\web\package.json` 中添加依赖示例：

```json
"dsh-directory-picker-enhanced": "file:K:/work/project/dsh/dsh-directory-picker-enhanced"
```

bundle 顺序示例：

```json
"bundles": [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dsh-mobile",
  "dsh-directory-picker-enhanced"
]
```

如果 profile 没有自动安装 `file:` 依赖，可以把本目录复制到：

```text
C:\Users\dhpdo\.dsh\profiles\web\node_modules\dsh-directory-picker-enhanced
```

## 验证

执行：

```bash
node --check "K:/work/project/dsh/dsh-directory-picker-enhanced/lib/client.js"
node --check "K:/work/project/dsh/dsh-directory-picker-enhanced/lib/index.js"
dsh --profile web --dump-config
```

`dump-config` 中应能看到：

```yaml
# == dsh-mobile, patched by dsh-directory-picker-enhanced
- id: directory-picker-mobile-surface
  name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'
  disabled: true

# == dsh-directory-picker-enhanced
- id: directory-picker-enhanced-surface
  name: dsh-directory-picker-enhanced
```

然后重启 DSH Web：

```bash
dsh web --no-open
```

打开 `http://127.0.0.1:3080/`，进入“添加工作区”弹窗，应能看到**盘符**下拉和**上一级**按钮。

## 回滚

从 Web profile 的 `dependencies` 和 `bundles` 中移除 `dsh-directory-picker-enhanced`，如果 profile 的 `node_modules` 中有复制安装的目录，也一并删除：

```text
C:\Users\dhpdo\.dsh\profiles\web\node_modules\dsh-directory-picker-enhanced
```

因为本插件不修改官方 DSH 文件，所以回滚时不需要恢复全局 DSH 安装目录中的文件。
