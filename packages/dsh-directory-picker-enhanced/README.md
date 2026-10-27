# dsh-directory-picker-enhanced

English | [中文](README.zh-CN.md)

Enhanced workspace directory picker UI for DSH Web (DSH **0.2.1-rc.2**).

The stock browse dialog lists folders but offers no explicit way back to the
parent and no Windows drive switch. This plugin replaces that browse surface
and adds:

- **Up** button: navigate to the parent directory of the current listing.
- **Windows drive selector**: probes `A:\` … `Z:\` with the existing
  `listDirectory(root, signal)` API and lists only the drives that answer.

It follows the active DSH language (built-in zh / en dictionaries), hides the
Up button at a filesystem root, and leaves the host-side directory picker
untouched.

## How it mounts on DSH 0.2

DSH 0.2 resolves the picker pair at boot: the `directory-picker-auto` row
mounts either the native or the browse host backend together with its matching
client surface. Replacing only the UI therefore means pinning that pair:

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

This ships as the package's `cordis.patch.yml`; installing the bundle applies
it automatically. The official browse client surface is never inserted, so the
single-occupant `conversation.hero.workspace.directoryFlow` and
`sidebar.workspaces.directoryFlow` holes have exactly one registrant.

## Install

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dependencies": {
    "dsh-directory-picker-enhanced": "file:<repo>/packages/dsh-directory-picker-enhanced"
  },
  "dsh": { "profile": { "bundles": [/* … */, "dsh-directory-picker-enhanced"] } }
}
```

Then `pnpm install` in the profile (or copy the package into
`node_modules/`), restart `dsh web`, and hard-refresh the browser.

## Verify

`dsh --profile web --dump-config` must show the disabled `directory-picker`
row, the `directory-picker-browse-host` row, and the
`directory-picker-enhanced-surface` row. Open **Add workspace** and check for
the **Up** button and the **Drive** selector on Windows.

## Rollback

Remove the package from the profile's `dependencies` and `bundles`; the stock
`directory-picker-auto` row returns on the next boot.
