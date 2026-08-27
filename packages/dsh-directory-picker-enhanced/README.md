# dsh-directory-picker-enhanced

English | [中文](README.zh-CN.md)

Enhanced DSH Web workspace directory picker UI.

This plugin replaces the stock browse directory-picker surface inserted by `dsh-mobile` and adds two navigation helpers to the "Add workspace" dialog:

- **Up** button: navigate to the parent directory from the current listing.
- **Windows drive selector**: automatically probes accessible roots from `A:\` through `Z:\` with the existing `listDirectory(root, signal)` API, then lets the user jump directly to another drive.

Behavior details:

- The picker follows the active DSH language (built-in zh / en dictionaries, switches live).
- The Up button is hidden at a filesystem root (a drive root has no parent to list).
- The drive dropdown lists only the roots that answered the probe — unavailable drive letters stay out of the menu.

This plugin is **not published to npm**; install it from a local path as shown below.

## Why this is a UI surface plugin

DSH already has a host-side `directoryPicker` service. Registering another service with the same name causes a Cordis duplicate-service error, so this plugin does **not** register a new host directory picker.

Instead, it replaces only the client-side UI surface:

1. Keep the official host browse picker from `dsh-mobile`:
   - `directory-picker-mobile-host`
   - `@deepseek-ai/dsh-host-directory-picker-browse`
2. Disable the official browse UI surface inserted by `dsh-mobile`:
   - `directory-picker-mobile-surface`
   - `@deepseek-ai/dsh-client-ui-directory-picker-browse`
3. Insert this enhanced UI surface:
   - `directory-picker-enhanced-surface`
   - `dsh-directory-picker-enhanced`

The official DSH installation files remain unmodified.

## Package layout

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

## Installation in a DSH Web profile

This plugin is intended to be loaded after `dsh-mobile`, because its patch disables the browse UI surface that `dsh-mobile` inserts.

Example profile dependency in `C:\Users\dhpdo\.dsh\profiles\web\package.json`:

```json
"dsh-directory-picker-enhanced": "file:K:/work/project/dsh/dsh-directory-picker-enhanced"
```

Example bundle order:

```json
"bundles": [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dsh-mobile",
  "dsh-directory-picker-enhanced"
]
```

If the profile does not automatically install `file:` dependencies, copy this folder to:

```text
C:\Users\dhpdo\.dsh\profiles\web\node_modules\dsh-directory-picker-enhanced
```

## Verification

From any shell:

```bash
node --check "K:/work/project/dsh/dsh-directory-picker-enhanced/lib/client.js"
node --check "K:/work/project/dsh/dsh-directory-picker-enhanced/lib/index.js"
dsh --profile web --dump-config
```

The dumped config should include:

```yaml
# == dsh-mobile, patched by dsh-directory-picker-enhanced
- id: directory-picker-mobile-surface
  name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'
  disabled: true

# == dsh-directory-picker-enhanced
- id: directory-picker-enhanced-surface
  name: dsh-directory-picker-enhanced
```

Then restart DSH Web:

```bash
dsh web --no-open
```

Open `http://127.0.0.1:3080/`, then use **Add workspace**. The directory dialog should show the **Drive** selector and **Up** button.

## Rollback

Remove `dsh-directory-picker-enhanced` from the Web profile `dependencies` and `bundles`, then remove the installed copy from the profile `node_modules` directory if present.

Because this plugin does not patch official DSH files, rollback does not require restoring files under the global DSH installation.
