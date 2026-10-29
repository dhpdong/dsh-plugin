/**
 * Workspace-safe file mutations for the sidebar (the upload route today).
 *
 * Every write is confined to the real session workspace: the upload
 * directory is resolved absolute and its target is checked through existing
 * filesystem ancestors, the relative path is sanitized (absolute paths, '.',
 * '..' and empty segments are refused), and the final target must stay inside
 * the workspace after symlink resolution. Bytes stream from the request body
 * to a uniquely named temp sibling
 * and are renamed into place, so a failed, aborted, or oversized upload never
 * leaves a partial file at the target path.
 */
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { lstat, mkdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import trash from 'trash'
import type { SidebarHttpRequest } from './context-types.ts'
import { isWithin, requireAbsolute } from './fs-tree.ts'
import { ensureWorkspacePath, ensureWorkspaceWritePath, isOutsideWorkspaceAllowed } from './path-security.ts'
import { SidebarError } from './wire.ts'

/** Inputs of one upload: the session scope plus the request body stream. */
export interface WorkspaceUploadInput {
  /** The session workspace root; target and directory must stay inside it. */
  cwd: string
  /** Absolute upload directory chosen by the client (inside `cwd`). */
  dir: string
  /** Relative path below `dir` (absolute paths, '.', '..' and empty segments refused). */
  relativePath: string
  /** The request body stream (raw bytes). */
  chunks: AsyncIterable<string | Uint8Array>
  /** Byte cap; an oversized upload is refused without touching the target. */
  limit: number
}

export type WorkspaceCreateKind = 'file' | 'directory'

function assertCreateName(name: string): string {
  if (name === '' || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new SidebarError('bad-request', 'name must be a direct child of the target directory', 400)
  }
  return name
}

/**
 * Create one empty file or directory inside an existing workspace directory.
 * The containing directory is resolved through the workspace fence, the new
 * name must be one direct child (no absolute/traversal/nested segments), and
 * existing targets are refused instead of overwritten.
 */
export async function createWorkspaceEntry(
  cwd: string,
  dir: string,
  name: string,
  kind: WorkspaceCreateKind,
): Promise<{ path: string; kind: WorkspaceCreateKind }> {
  if (kind !== 'file' && kind !== 'directory') {
    throw new SidebarError('bad-request', 'invalid create kind', 400)
  }
  const base = await ensureWorkspacePath(cwd, requireAbsolute(dir))
  const baseInfo = await lstat(base).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot inspect "${base}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })
  if (!baseInfo.isDirectory()) {
    throw new SidebarError('fs-error', `"${base}" is not a directory`, 400)
  }
  const target = await ensureWorkspaceWritePath(cwd, join(base, assertCreateName(name)))
  if (await lstat(target).then(() => true).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw new SidebarError('fs-error', `cannot inspect "${target}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })) {
    throw new SidebarError('fs-error', `target already exists: "${target}"`, 400)
  }
  try {
    if (kind === 'directory') await mkdir(target, { recursive: false })
    else await writeFile(target, '', { flag: 'wx' })
  } catch (error) {
    throw new SidebarError('fs-error', `cannot create "${target}": ${error instanceof Error ? error.message : String(error)}`, 400)
  }
  return { path: target, kind }
}

/**
 * Move an existing workspace file/folder to the OS trash. The row's parent
 * directory must resolve inside the session workspace, but the final segment is
 * checked with lstat so a symlink row is trashed as a link instead of following
 * and trashing its target. The workspace root itself is refused so a
 * context-menu slip cannot trash the whole project. Globbing is disabled
 * because explorer rows are literal paths, not patterns.
 */
export async function trashWorkspacePath(cwd: string, target: string): Promise<{ path: string }> {
  const absolute = requireAbsolute(target)
  // Global file-browser mode: the target may live outside the session
  // workspace, so only the two structural guards survive (a filesystem root
  // and the session workspace root itself are never trashed).
  if (isOutsideWorkspaceAllowed()) {
    const realParent = await realpath(dirname(absolute)).catch((error: unknown) => {
      throw new SidebarError('fs-error', `cannot resolve target parent "${dirname(absolute)}": ${error instanceof Error ? error.message : String(error)}`, 400)
    })
    const safeTarget = join(realParent, basename(absolute))
    const parent = dirname(safeTarget)
    if (parent === safeTarget || safeTarget === requireAbsolute(cwd)) {
      throw new SidebarError('forbidden', 'refusing to trash a filesystem root', 403)
    }
    await lstat(safeTarget).catch((error: unknown) => {
      throw new SidebarError('fs-error', `cannot trash "${safeTarget}": ${error instanceof Error ? error.message : String(error)}`, 400)
    })
    try {
      await trash(safeTarget, { glob: false })
    } catch (error) {
      throw new SidebarError('fs-error', `cannot trash "${safeTarget}": ${error instanceof Error ? error.message : String(error)}`, 400)
    }
    return { path: safeTarget }
  }
  const root = requireAbsolute(cwd)
  if (isWithin(root, absolute) && isWithin(absolute, root)) {
    throw new SidebarError('forbidden', 'refusing to trash the workspace root', 403)
  }
  const realCwd = await realpath(cwd).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot resolve workspace "${cwd}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })
  const realParent = await realpath(dirname(absolute)).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot resolve target parent "${dirname(absolute)}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })
  if (!isWithin(realCwd, realParent)) {
    throw new SidebarError('forbidden', `path "${absolute}" is outside workspace`, 403)
  }
  const safeTarget = join(realParent, basename(absolute))
  const isWorkspaceRoot = isWithin(realCwd, safeTarget) && isWithin(safeTarget, realCwd)
  if (isWorkspaceRoot) {
    throw new SidebarError('forbidden', 'refusing to trash the workspace root', 403)
  }

  // `trash` silently ignores missing files; the API should report stale rows as
  // normal filesystem errors instead, so check existence before delegating.
  await lstat(safeTarget).catch((error: unknown) => {
    throw new SidebarError('fs-error', `cannot trash "${safeTarget}": ${error instanceof Error ? error.message : String(error)}`, 400)
  })
  try {
    await trash(safeTarget, { glob: false })
  } catch (error) {
    throw new SidebarError('fs-error', `cannot trash "${safeTarget}": ${error instanceof Error ? error.message : String(error)}`, 400)
  }
  return { path: safeTarget }
}

/**
 * Stream `chunks` into `dir/relativePath` atomically: a uniquely named temp
 * sibling receives the bytes, then is renamed over the target. The parent
 * directory is created on demand (recursive), so folder uploads work before
 * any level exists. The unique temp name keeps concurrent uploads to the same
 * target independent (each writes and renames its own file; the last rename
 * wins) and never blocks later uploads after a crashed process.
 *
 * @throws SidebarError with a wire code for containment, shape, and size
 * failures; the temp file is always removed on failure.
 */
export async function writeWorkspaceUpload(input: WorkspaceUploadInput): Promise<{ path: string; size: number }> {
  const { cwd, dir, relativePath, chunks, limit } = input
  const base = requireAbsolute(dir)
  await ensureWorkspacePath(cwd, base)
  if (relativePath === '' || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    throw new SidebarError('bad-request', 'relativePath must stay below the upload directory', 400)
  }
  const segments = relativePath.split(/[\\/]/)
  if (segments.some(part => part === '' || part === '.' || part === '..')) {
    throw new SidebarError('bad-request', 'relativePath must stay below the upload directory', 400)
  }
  const target = join(base, ...segments)
  const safeTarget = await ensureWorkspaceWritePath(cwd, target)
  const tmp = join(dirname(safeTarget), `.${basename(safeTarget)}.dsh-upload-${randomUUID()}.tmp`)
  await mkdir(dirname(safeTarget), { recursive: true })
  const stream = createWriteStream(tmp, { flags: 'wx' })
  // Resolves once the stream fully closes; created up front so a stream that
  // already closed (successful end, later failure) cannot leave the wait hanging.
  const closed = new Promise<void>((resolve) => { stream.once('close', () => resolve()) })
  let size = 0
  let streamError: unknown
  // A permanent 'error' listener keeps a failing disk from crashing the host:
  // every await below surfaces the failure through the promise chain instead.
  stream.on('error', (error) => { streamError = error })
  try {
    for await (const chunk of chunks) {
      const buffer = Buffer.from(chunk)
      size += buffer.length
      if (size > limit) throw new SidebarError('too-large', `upload exceeds the ${limit} byte limit`, 413)
      if (!stream.write(buffer)) await once(stream, 'drain')
      if (streamError !== undefined) throw streamError
    }
    await new Promise<void>((resolve, reject) => {
      stream.end((error?: Error | null) => (error === undefined || error === null ? resolve() : reject(error)))
    })
    if (streamError !== undefined) throw streamError
    await rename(tmp, safeTarget)
    const info = await stat(safeTarget)
    return { path: target, size: info.size }
  } catch (error) {
    // Wait for the stream to fully close before unlinking (Windows locks open
    // files), then remove our own uniquely named temp file.
    stream.destroy()
    await closed.catch(() => {})
    await rm(tmp, { force: true }).catch(() => {})
    throw error
  }
}
