/**
 * dsh-session-manager host half: registers /sidebar/api/sessions with two
 * actions — 'list' enumerates every persisted session via sessionPersistence,
 * and 'purge' permanently removes one by moving its on-disk directory to the
 * OS recycle bin. After deletion, the session-persistence service and
 * workspace registry reconcile automatically on next boot.
 *
 * Recycle-bin deletion is native (zero npm dependencies): Windows uses
 * PowerShell's Microsoft.VisualBasic FileIO SendToRecycleBin; other
 * platforms fall back to a plain recursive remove.
 */
import { readdir, stat, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { isAbsolute, join, resolve } from 'node:path'
import { homedir } from 'node:os'

export const name = 'dsh-session-manager'

/** The DSH home: `$DSH_HOME` or `~/.dsh` (same precedence as dsh-home-paths). */
function dshHome() {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured.trim() !== '' ? configured.trim() : join(homedir(), '.dsh')
}

/** Services required before mounting: the webserver routes and the
 *  session-persistence enumeration. workspaceRegistry is optional (accessed
 *  through ctx.get, which returns undefined without an inject declaration). */
export const inject = ['webServer', 'sessionPersistence']

export function apply(ctx) {
  async function readJsonBody(req) {
    const chunks = []
    let total = 0
    for await (const chunk of req) {
      const buf = Buffer.from(chunk)
      total += buf.length
      if (total > 1 << 20) throw Object.assign(new Error('body too large'), { status: 400 })
      chunks.push(buf)
    }
    const text = Buffer.concat(chunks).toString('utf8')
    if (text.trim() === '') return {}
    try { return JSON.parse(text) }
    catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }) }
  }

  function writeJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  function ensureAbsolute(raw) {
    if (!isAbsolute(raw)) throw Object.assign(new Error(`"${raw}" is not absolute`), { status: 400 })
    return resolve(raw)
  }

  /**
   * Resolve one session's artifact directory under the persistence root.
   * DSH 0.2 removed the backend's public `locate()` (and detached
   * `inspect()`), so the plugin finds the session by its directory name. The
   * current backend groups sessions as `<root>/<project-key>/<session-id>/`;
   * session ids are filesystem-safe (`session-<uuid>`), so a one-level scan
   * of the project directories is enough and avoids re-implementing the
   * backend's project-key encoding. The configured root is read from the
   * backend instance (present on the JSONL implementation) and falls back
   * to `$DSH_HOME/sessions`.
   */
  async function sessionDirOf(sessionId) {
    const root = typeof ctx.sessionPersistence.root === 'string' && ctx.sessionPersistence.root !== ''
      ? ctx.sessionPersistence.root
      : join(dshHome(), 'sessions')
    const candidates = [join(root, sessionId)]
    let projects = []
    try { projects = await readdir(root, { withFileTypes: true }) } catch { projects = [] }
    for (const entry of projects) {
      if (!entry.isDirectory() || entry.name === sessionId) continue
      candidates.push(join(root, entry.name, sessionId))
    }
    for (const candidate of candidates) {
      try {
        if ((await stat(candidate)).isDirectory()) return candidate
      } catch { /* try the next project directory */ }
    }
    throw Object.assign(new Error(`session "${sessionId}" has no artifact directory under ${root}`), { status: 404 })
  }

  /** Run one PowerShell command; resolves with combined stderr on failure. */
  function runPowerShell(script) {
    return new Promise((resolveRun, rejectRun) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['ignore', 'ignore', 'pipe'] })
      let errText = ''
      child.stderr.on('data', d => { errText += d.toString() })
      child.on('error', rejectRun)
      child.on('close', code => {
        if (code === 0) resolveRun()
        else rejectRun(new Error(errText.trim() || `powershell exited ${code}`))
      })
    })
  }

  /**
   * Move `target` to the OS recycle bin (Windows) or remove it recursively
   * (other platforms). Validates the path is absolute, exists, and is not
   * the filesystem root.
   */
  async function deleteSessionDir(target) {
    const absolute = ensureAbsolute(target)
    await stat(absolute).catch((err) => {
      throw Object.assign(new Error(`cannot stat "${absolute}": ${err.message}`), { status: 400 })
    })
    if (absolute === resolve('/')) {
      throw Object.assign(new Error('refusing to delete root'), { status: 403 })
    }
    if (process.platform === 'win32') {
      // Microsoft.VisualBasic's FileIO deletes to the recycle bin.
      const ps = [
        'Add-Type -AssemblyName Microsoft.VisualBasic',
        `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${absolute.replace(/'/g, "''")}', 'OnlyErrorDialogs', 'SendToRecycleBin')`,
      ].join('; ')
      await runPowerShell(ps).catch((err) => {
        throw Object.assign(new Error(`recycle-bin delete failed: ${err.message}`), { status: 400 })
      })
    } else {
      await rm(absolute, { recursive: true, force: true }).catch((err) => {
        throw Object.assign(new Error(`cannot remove "${absolute}": ${err.message}`), { status: 400 })
      })
    }
  }

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/sidebar/api/sessions',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } })
          return
        }
        let body
        try { body = await readJsonBody(req) }
        catch (e) { writeJson(res, e.status ?? 400, { ok: false, error: { code: 'bad-request', message: e.message } }); return }

        // ── list ──────────────────────────────────────────────────────
        if (body.action === 'list') {
          try {
            // 0.2 `list()` returns snapshots: { header, revision, ... }. The
            // header carries identity/cwd/lineage; the display title folds
            // from the event log (and is read here only for live sessions,
            // where the title service already holds it).
            const snapshots = await ctx.sessionPersistence.list()
            const titleService = typeof ctx.get === 'function' ? ctx.get('sessionTitle') : undefined
            const liveStore = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
            const sessions = []
            for (const snapshot of snapshots) {
              const header = snapshot.header
              if (header === undefined) continue
              const live = liveStore?.get?.(header.id)
              let title
              if (live !== undefined) {
                try { title = titleService?.get?.(live)?.title } catch { /* no title yet */ }
              }
              sessions.push({ id: header.id, title: title ?? header.id, cwd: header.cwd })
            }
            writeJson(res, 200, { ok: true, value: sessions })
          } catch (e) {
            writeJson(res, 500, { ok: false, error: { code: 'internal', message: e.message } })
          }
          return
        }

        // ── purge ─────────────────────────────────────────────────────
        if (body.action === 'purge') {
          const sessionId = body.sessionId
          if (typeof sessionId !== 'string' || sessionId === '') {
            writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'sessionId required' } })
            return
          }
          // A live session still owns its write lease; removing the directory
          // under it would corrupt the running agent's next flush.
          const liveStore = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
          if (liveStore?.get?.(sessionId) !== undefined) {
            writeJson(res, 409, { ok: false, error: { code: 'running', message: `session "${sessionId}" is still running` } })
            return
          }
          // Best-effort archive from workspace registry (optional service:
          // ctx.get returns undefined when absent, never throws).
          try {
            // 0.2 replaced workspaceRegistry.archiveSession() with the
            // workspaceController Remote owner; archive hides the row from
            // workspace surfaces before the artifact directory goes away.
            const controller = typeof ctx.get === 'function' ? ctx.get('workspaceController') : undefined
            await controller?.archiveSession?.({ sessionId })
          } catch { /* best effort */ }

          let snapshots
          try { snapshots = await ctx.sessionPersistence.list() }
          catch (e) { writeJson(res, 500, { ok: false, error: { code: 'internal', message: e.message } }); return }

          const snapshot = snapshots.find(s => s.header?.id === sessionId)
          if (snapshot === undefined) {
            writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `session "${sessionId}" not found` } })
            return
          }
          let sessionDir
          try {
            sessionDir = await sessionDirOf(sessionId)
          } catch (e) {
            writeJson(res, e.status ?? 400, { ok: false, error: { code: 'fs-error', message: e.message } })
            return
          }
          try {
            await deleteSessionDir(sessionDir)
            writeJson(res, 200, { ok: true, value: { sessionId } })
          } catch (e) {
            writeJson(res, e.status ?? 500, { ok: false, error: { code: 'fs-error', message: e.message } })
          }
          return
        }

        writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: `unknown action "${body.action}"` } })
      },
    }),
  )
}
