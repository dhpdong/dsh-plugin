/**
 * One-shot identity rename for the dsh-sidebar-lite fork:
 *   dsh-better-sidebar  -> dsh-sidebar-lite
 *   DSH-better-sidebar  -> dsh-sidebar-lite (repo refs in docs/badges)
 *   better-sidebar      -> sidebar-lite     (cordis entry id, css selectors)
 * The cordis service name `betterSidebar` is deliberately untouched.
 */
const { readdirSync, statSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')
const SKIP_DIRS = new Set(['node_modules', '.git', 'lib'])
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'rename-identity.cjs'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else if (SKIP_FILES.has(name)) continue
    else out.push(path)
  }
  return out
}

let changed = 0
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  let next = src
    .replaceAll('dsh-better-sidebar', 'dsh-sidebar-lite')
    .replaceAll('DSH-better-sidebar', 'dsh-sidebar-lite')
    .replaceAll('better-sidebar', 'sidebar-lite')
  // fix accidental double-hit: dsh-sidebar-lite-invariant stays correct already
  if (next !== src) {
    writeFileSync(file, next)
    changed++
    console.log('renamed:', file.slice(ROOT.length + 1))
  }
}
console.log(`\n${changed} file(s) updated`)
