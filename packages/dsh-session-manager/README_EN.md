# dsh-session-manager

[中文](README.md) | English

A DSH web plugin: **permanently delete sessions you no longer need**.

Adds a 🗑️ button to the right of the session header (next to Session log). Click it to list every persisted session; delete the ones you are done with — their on-disk records move to the **OS recycle bin** and the workspace session list stays clean. It fills the gap DSH leaves open: archiving only hides, deleting a workspace only ungroups.

## DSH 0.2.1 compatibility

DSH 0.2 replaced the persistence surface with snapshots and per-session
handles: `sessionPersistence.list()` now returns `{ header, revision }`, and
`locate()` / `inspect()` are gone. This plugin therefore reads identity and
cwd from the snapshot header, titles live sessions through `sessionTitle`,
locates the artifact directory under
`<$DSH_HOME>/sessions/<project>/<session-id>/`, archives the row through
`workspaceController.archiveSession()` before deletion, and refuses to delete
a session that is still running (its write lease must stay intact).

## Why

DSH offers exactly two dispositions for a session:

| Action | Effect |
|---|---|
| Archive session | Hidden from the list; records stay on disk |
| Delete workspace | Ungroups only; session records untouched |

Expired, invalid, never-again sessions have no official removal path and keep reappearing in the workspace after every restart. This plugin closes that gap: the session directory moves to the recycle bin, and DSH's persistence service and workspace registry reconcile automatically on next boot.

## Features

- 🗑️ A button in the session header utilities area; clicking opens a session-list panel (title + working directory)
- One delete icon per row: after confirmation the session moves to the **OS recycle bin** (Windows via PowerShell `Microsoft.VisualBasic.FileIO`; restorable from the bin)
- The **current session** is protected — shows a "Current" tag with the delete button disabled, so a live conversation can never be trashed
- The panel refreshes immediately after deletion; DSH's search index and workspace membership clean up automatically on next restart
- **Zero npm dependencies**: the host half uses only Node builtins, the client half is plain JS loaded through DSH's module loader

## Install

Not published to npm — install from a local path.

1. Add to `~/.dsh/profiles/web/package.json` `dependencies`:

   ```json
   "dsh-session-manager": "file:<absolute path to this folder>"
   ```

2. Add `"dsh-session-manager"` to the `dsh.profile.bundles` array.

3. Copy this folder to `~/.dsh/profiles/web/node_modules/dsh-session-manager/` (or run `pnpm install` there), then restart `dsh web --no-open` and hard-refresh the browser (Ctrl+Shift+R).

## How it works

```text
┌─ client (browser) ───────────────┐      ┌─ host (Node) ──────────────────┐
│ conversation.session.header.     │ POST  │ /sidebar/api/sessions          │
│ utilities slot registers 🗑️ btn  │ ────▶ │  action=list   enumerate       │
│ click → panel → delete → confirm │      │  action=purge  locate dir      │
└──────────────────────────────────┘      │   → recycle bin (PS FileIO)    │
                                          └────────────────────────────────┘
```

- **Enumerate**: the host reads each session's on-disk directory via `ctx.sessionPersistence.list()` + `locate()`
- **Delete**: on Windows, PowerShell's `Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(…, SendToRecycleBin)` moves the directory to the recycle bin; other platforms fall back to a recursive remove
- **Aftermath**: the session is best-effort archived from the workspace registry first; once the file is gone, DSH's persistence scan and workspace membership filtering converge automatically on next boot

### Safety

- Paths must be absolute and exist; the filesystem root is refused
- The API accepts POST + JSON only, mirroring every other `/sidebar/api` route
- The current session cannot be deleted from the UI

## Layout

```text
dsh-session-manager/
├─ package.json        # zero deps; declares dsh.client inject + ./client export
├─ dsh.plugin.json     # plugin manifest
├─ cordis.patch.yml    # mount row id: session-manager
├─ README.md / README_EN.md
└─ lib/
   ├─ index.js         # host half: API routes + recycle-bin deletion
   └─ client.js        # client half: slot button + session-list panel
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| No 🗑️ button in the header | Check the mount row in `dump-config`; hard-refresh; confirm the HTML includes `/plugins/dsh-session-manager/client.js` |
| Panel reports `session not found` | Stale list — click ↻ and retry |
| Delete reports `recycle-bin delete failed` | PowerShell blocked by policy — the non-win32 `rm` branch applies automatically on other platforms |
