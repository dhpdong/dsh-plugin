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
import { stat, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, isAbsolute, resolve } from 'node:path'

export const name = 'dsh-session-manager'

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
            const headers = await ctx.sessionPersistence.list()
            const sessions = []
            for (const meta of headers) {
              try {
                const loc = ctx.sessionPersistence.locate?.(meta)
                if (loc !== undefined) {
                  sessions.push({ id: meta.id, path: dirname(loc.path), title: meta.title, cwd: meta.cwd })
                }
              } catch { /* skip unresolvable */ }
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
          // Best-effort archive from workspace registry (optional service:
          // ctx.get returns undefined when absent, never throws).
          try {
            const registry = typeof ctx.get === 'function' ? ctx.get('workspaceRegistry') : undefined
            await registry?.archiveSession?.(sessionId)
          } catch { /* ignore */ }

          let headers
          try { headers = await ctx.sessionPersistence.list() }
          catch (e) { writeJson(res, 500, { ok: false, error: { code: 'internal', message: e.message } }); return }

          const meta = headers.find(h => h.id === sessionId)
          if (meta === undefined) {
            writeJson(res, 404, { ok: false, error: { code: 'not-found', message: `session "${sessionId}" not found` } })
            return
          }
          let sessionDir
          try {
            const loc = ctx.sessionPersistence.locate?.(meta)
            if (loc === undefined) throw new Error('session has no file on disk')
            sessionDir = dirname(loc.path)
          } catch (e) {
            writeJson(res, 400, { ok: false, error: { code: 'fs-error', message: e.message } })
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
