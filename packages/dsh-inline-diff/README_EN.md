# dsh-inline-diff

[中文](README.md) | English

A DSH web plugin: shows **Edit / Write tool file changes** (original vs. edited) directly in the conversation, **always expanded** — Claude Code style. No more clicking collapsed rows or hopping to the trajectory view.

## What it fixes

DSH's stock file-mutation rows (`Edit · path`) carry a diff card that is **collapsed by default**; seeing what actually changed means expanding each row or opening the trajectory. This plugin takes over the `edit` / `write` tool rows so the hunks stay visible inline, red/green, in the chat flow.

## Look

```text
┌──────────────────────────────────────┐
│ ● Edit · tag_pipeline/tagger.py      │  ← state dot (running blue / done green); clickable path
│ ┌────────────────────────────────────┐│
│ │ - old = normalize(e.get("tags"))   ││  ← removed (red)
│ │ + old = normalize_element(e.get…   ││  ← added (green)
│ │   …context lines…                  ││
│ └────────────────────────────────────┘│
└──────────────────────────────────────┘
```

- Running (args streaming in): blue dot, diff shown as soon as known
- Settled: green dot, final diff (`resultView` is authoritative)
- Errored / no diff: amber dot + first line of the error text
- Multi-file edits show every hunk; a `write` renders as a full-file addition
- All other tool rows untouched (unclaimed keys fall back to the stock rows)

## How it works

Registers into the **keyed `tool.call.toolview` slot** (dispatched by wire tool name):

- `key: 'edit'` and `key: 'write'` → this plugin's `InlineDiffRow` (replaces the stock collapsed `FileMutationRow`)
- Diff extraction mirrors `dsh-client-ui-tool`'s `diffCardModel`: running calls read `block.callView.diffs`, settled results read `block.resultView.diffs` (with shape validation)
- Rendering reuses the official `DiffBlock` (`@deepseek-ai/dsh-client-ui-primitives`) — identical chrome to DSH's native diff cards, just never collapsed (`maxLines: Infinity`)

## Install (local path)

In `~/.dsh/profiles/web/package.json`:

```jsonc
{
  "dependencies": { "dsh-inline-diff": "file:<absolute path to this folder>" },
  "dsh": { "profile": { "bundles": [ /* … */, "dsh-inline-diff" ] } }
}
```

Copy this folder to the profile's `node_modules/dsh-inline-diff/` (or run `pnpm install` there), restart `dsh web --no-open`, and hard-refresh the browser (Ctrl+Shift+R).

> Load it after `dsh-web-app` (in a keyed slot, the later registration takes over). Uninstall by removing the entry from dependencies and bundles — the stock collapsed rows come right back.

## Layout

```text
dsh-inline-diff/
├─ package.json        # zero deps; declares dsh.client inject + ./client export
├─ cordis.patch.yml    # mount row id: inline-diff
├─ README.md / README_EN.md
└─ lib/
   ├─ index.js         # host half: no routes, mount stub for a pure UI plugin
   └─ client.js        # client half: toolview takeover + always-open DiffBlock
```
