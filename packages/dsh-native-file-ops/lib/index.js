/**
 * dsh-native-file-ops hosts half.
 *
 * A small, self-contained mutation API for the NATIVE right-Sidebar file tree
 * (`@deepseek-ai/dsh-client-ui-sidebar-files`). The native tree only lists and
 * opens files; DSH 0.2 exposes no create/rename/move/trash surface. This
 * plugin adds one, fenced like every other browser-facing route:
 *
 *   POST /native-file-ops/api/<op>
 *   { sessionId, cwd?, ... }
 *
 * Ops: create, rename, move, trash, download (POST returns the file bytes).
 * Paths on the wire are workspace-relative, exactly like the native tree's
 * `data-files-path`; the Host resolves them against the session's authoritative
 * cwd and refuses anything that escapes it.
 */
import { createReadStream } from 'node:fs'
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'

export const name = 'dsh-native-file-ops'

/** Required services: the web routes, the live session store, and the web bind facts. */
export const inject = ['webServer', 'sessions']

const ROUTE = '/sidebar/native-file-ops/api'
const MAX_BODY = 1 << 20

/** Read a small JSON request body. */
async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.from(chunk)
    total += buf.length
    if (total > MAX_BODY) throw Object.assign(new Error('body too large'), { status: 413 })
    chunks.push(buf)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    throw Object.assign(new Error('invalid JSON'), { status: 400 })
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) })
  res.end(text)
}

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

/** Canonical hostname:port authority string, or undefined. */
function parseAuthority(value) {
  try {
    const url = new URL(`http://${value}`)
    return url.hostname === '' ? undefined : url
  } catch {
    return undefined
  }
}

function isLoopback(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host === '::1' || host === '0.0.0.0' || /^127\./.test(host)
}

/** Whether one request authority is the bind host or an explicit trusted host. */
function isTrusted(req, ctx) {
  const hostHeader = req.headers.host
  if (typeof hostHeader !== 'string') return false
  const hostUrl = parseAuthority(hostHeader)
  if (hostUrl === undefined) return false
  if (isLoopback(hostUrl.hostname)) return true
  const trusted = [...(ctx.webStartup?.trustedHosts ?? [])]
  const bindHost = ctx.webServer?.host
  if (typeof bindHost === 'string' && bindHost !== '') trusted.push(bindHost)
  for (const entry of trusted) {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) continue
    if (entryUrl.hostname === hostUrl.hostname) return true
  }
  return false
}

/** The session's authoritative cwd, falling back to the client-provided one. */
function sessionCwd(ctx, sessionId, clientCwd) {
  const live = ctx.sessions.get(sessionId)
  const cwd = live?.header?.cwd ?? (typeof clientCwd === 'string' && clientCwd !== '' ? clientCwd : undefined)
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw fail(400, 'bad-request', 'session has no absolute cwd')
  return resolve(cwd)
}

/** Resolve one workspace-relative path under `cwd`, refusing escapes. */
function resolveInside(cwd, value) {
  if (typeof value !== 'string') throw fail(400, 'bad-path', 'path is required')
  if (!isAbsolute(value) && value.split(/[\\/]+/).includes('..')) throw fail(400, 'bad-path', 'path must not contain ".."')
  const abs = isAbsolute(value) ? resolve(value) : resolve(cwd, value)
  if (abs !== cwd && !abs.startsWith(cwd + sep)) throw fail(403, 'forbidden', 'path escapes the workspace')
  return abs
}

/** Refuse a name that would introduce separators or traversal. */
function safeName(value) {
  if (typeof value !== 'string' || value === '' || value === '.' || value === '..') throw fail(400, 'bad-name', 'invalid name')
  if (value.includes('/') || value.includes('\\') || value.includes('\0')) throw fail(400, 'bad-name', 'name must not contain separators')
  return value
}

/** Reject a destination that already exists. */
async function mustNotExist(path) {
  try {
    await lstat(path)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  throw fail(409, 'exists', `${basename(path)} already exists`)
}

/** Move to the OS recycle bin, falling back to recursive removal. */
async function trashPath(path) {
  try {
    const { default: trash } = await import('trash')
    await trash([path])
  } catch {
    await rm(path, { recursive: true, force: true })
  }
}

/** Resolve the real parent of a target, symlink-safe for the containment check. */
async function realParent(path) {
  try {
    return await realpath(dirname(path))
  } catch {
    return dirname(path)
  }
}

/** Run one mutation op. */
async function mutate(ctx, body) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (sessionId === '') throw fail(400, 'bad-request', 'sessionId is required')
  const cwd = sessionCwd(ctx, sessionId, body.cwd)
  const op = body.op

  if (op === 'create') {
    const dir = resolveInside(cwd, typeof body.dir === 'string' ? body.dir : '')
    const target = join(dir, safeName(body.name))
    await mustNotExist(target)
    if (body.kind === 'folder') await mkdir(target, { recursive: false })
    else await writeFile(target, '', { flag: 'wx' })
    return { path: target.startsWith(cwd + sep) ? target.slice(cwd.length + 1).split(sep).join('/') : '' }
  }

  if (op === 'rename') {
    const source = resolveInside(cwd, body.path)
    const target = join(dirname(source), safeName(body.newName))
    if (target === source) return { path: body.path }
    await mustNotExist(target)
    await rename(source, target)
    return { path: target.startsWith(cwd + sep) ? target.slice(cwd.length + 1).split(sep).join('/') : '' }
  }

  if (op === 'move') {
    const source = resolveInside(cwd, body.from)
    const dir = resolveInside(cwd, typeof body.toDir === 'string' ? body.toDir : '')
    const target = join(dir, basename(source))
    if (target === source) return { path: body.from }
    if (target.startsWith(source + sep)) throw fail(400, 'bad-path', 'cannot move a folder into itself')
    await mustNotExist(target)
    const cwdReal = await realpath(cwd).catch(() => cwd)
    const targetParentReal = await realParent(target)
    if (targetParentReal !== cwdReal && !targetParentReal.startsWith(cwdReal + sep)) {
      throw fail(403, 'forbidden', 'destination escapes the workspace')
    }
    await rename(source, target)
    return { path: target.startsWith(cwd + sep) ? target.slice(cwd.length + 1).split(sep).join('/') : '' }
  }

  if (op === 'trash') {
    const target = resolveInside(cwd, body.path)
    if (target === cwd) throw fail(403, 'forbidden', 'refusing to delete the workspace root')
    await trashPath(target)
    return { ok: true }
  }

  throw fail(400, 'bad-op', `unknown op "${String(op)}"`)
}

/** Stream one workspace file back to the browser as a download. */
async function download(ctx, req, res, body) {
  const cwd = sessionCwd(ctx, body.sessionId, body.cwd)
  const target = resolveInside(cwd, body.path)
  const info = await stat(target)
  if (!info.isFile()) throw fail(400, 'not-a-file', 'not a regular file')
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': info.size,
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(basename(target))}`,
  })
  await pipeline(createReadStream(target), res)
}

/** Mount the fenced mutation route. */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } })
        return
      }
      if (!isTrusted(req, ctx)) {
        sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      let body
      try {
        body = await readJson(req)
      } catch (error) {
        sendJson(res, error.status ?? 400, { ok: false, error: { code: 'bad-request', message: error.message } })
        return
      }
      try {
        if (body.op === 'download') {
          await download(ctx, req, res, body)
          return
        }
        const value = await mutate(ctx, body)
        sendJson(res, 200, { ok: true, value })
      } catch (error) {
        const status = typeof error.status === 'number' ? error.status : 500
        ctx.logger?.warn(`[native-file-ops] ${String(body.op)} failed: ${error.message}`)
        sendJson(res, status, { ok: false, error: { code: error.code ?? 'internal', message: error.message } })
      }
    },
  }), 'native-file-ops: fenced file mutation route')
}
