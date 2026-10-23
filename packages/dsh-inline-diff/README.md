# dsh-inline-diff

[English](README_EN.md) | 中文

DSH Web 插件：把 **Edit / Write 工具的文件改动**（原文与修改结果）直接显示在对话界面里，**默认展开**，风格类似 Claude Code——不再需要点开折叠行或跳到轨迹视图查看。

## 它解决什么

DSH 默认的文件编辑行（`Edit · 路径`）带 diff 卡片，但**默认折叠**，要看具体改了什么必须逐个点开或去轨迹视图。本插件接管 `edit` / `write` 两个工具行的渲染：改动 hunks 以红绿 diff 形式**常驻显示**在对话流中。

## 效果

```text
┌──────────────────────────────────────┐
│ ● Edit · tag_pipeline/tagger.py      │  ← 状态点（运行中蓝/完成绿），路径可点击打开
│ ┌────────────────────────────────────┐│
│ │ - old = normalize(e.get("tags"))   ││  ← 红色删除行
│ │ + old = normalize_element(e.get…   ││  ← 绿色新增行
│ │   …上下文行…                        ││
│ └────────────────────────────────────┘│
└──────────────────────────────────────┘
```

- 运行中（参数流式到达）：蓝点 + 已知 diff 先行显示
- 完成：绿点 + 最终 diff（`resultView` 为准）
- 失败 / 无 diff：黄点 + 首行错误文本
- 多文件改动一次展示全部 hunks；`write` 新建文件显示为整文件新增
- 其他工具行不受影响（未注册的 key 自动回退官方默认行）

## 实现方式

注册进 **keyed 槽位 `tool.call.toolview`**（按工具名分发）：

- `key: 'edit'` 与 `key: 'write'` → 本插件的 `InlineDiffRow`（接管官方的折叠式 `FileMutationRow`）
- diff 提取逻辑镜像 `dsh-client-ui-tool` 的 `diffCardModel`：运行中读 `block.callView.diffs`，结束后读 `block.resultView.diffs`（带形状校验）
- 渲染复用官方 `DiffBlock`（`@deepseek-ai/dsh-client-ui-primitives`），视觉与 DSH 原生 diff 卡片完全一致，只是不再折叠（`maxLines: Infinity`）

## 安装（本地路径）

在 `~/.dsh/profiles/web/package.json`：

```jsonc
{
  "dependencies": { "dsh-inline-diff": "file:<本目录绝对路径>" },
  "dsh": { "profile": { "bundles": [ /* … */, "dsh-inline-diff" ] } }
}
```

把本目录复制到 profile 的 `node_modules/dsh-inline-diff/`（或 `pnpm install`），重启 `dsh web --no-open` 并硬刷新浏览器（Ctrl+Shift+R）。

> 建议排在 `dsh-web-app` 之后加载（keyed 槽位后注册者接管）。卸载只需从 dependencies 与 bundles 移除本条目，官方折叠行随即恢复。

## 目录结构

```text
dsh-inline-diff/
├─ package.json        # 零依赖；声明 dsh.client 注入与 ./client 导出
├─ cordis.patch.yml    # 挂载行 id: inline-diff
├─ README.md / README_EN.md
└─ lib/
   ├─ index.js         # host 半：无路由，纯 UI 插件的挂载桩
   └─ client.js        # client 半：toolview 接管 + 常展开 DiffBlock
```
