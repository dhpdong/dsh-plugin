/** Filesystem path guards shared by sidebar APIs that access a session workspace. */
import { realpath } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { isWithin, requireAbsolute } from './fs-tree.ts'
import { SidebarError } from './wire.ts'

/**
 * When true the workspace fence is lifted: every fs route accepts absolute
 * paths outside the session workspace, so the file panel can browse an
 * arbitrary directory (the "global file browser" mode backed by
 * `dsh-native-file-ops`). Set once by the host half from
 * `config.allowOutsideWorkspace`; defaults to false, which keeps every route
 * workspace-confined exactly as before.
 */
let outsideWorkspaceAllowed = false

/** Turn the workspace fence on or off (host bootstrap reads the config). */
export function setOutsideWorkspaceAllowed(value: boolean): void {
  outsideWorkspaceAllowed = value
}

/** Whether absolute paths outside the session workspace are accepted. */
export function isOutsideWorkspaceAllowed(): boolean {
  return outsideWorkspaceAllowed
}

/** Resolve a path and convert filesystem resolution failures to an API error. */
async function resolveRealPath(path: string, label: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    throw new SidebarError('fs-error', `cannot resolve ${label} "${path}": ${error instanceof Error ? error.message : String(error)}`, 400)
  }
}

/** Reject a resolved path whose real filesystem target escapes the workspace. */
function assertWithinWorkspace(workspace: string, target: string): void {
  if (!isWithin(workspace, target)) {
    throw new SidebarError('forbidden', `path "${target}" is outside workspace`, 403)
  }
}

/**
 * Resolve an existing workspace path through symlinks and enforce containment.
 *
 * @param cwd - Session workspace directory.
 * @param target - Client-supplied absolute path.
 * @returns The canonical absolute path used for the filesystem operation.
 */
export async function ensureWorkspacePath(cwd: string, target: string): Promise<string> {
  const absolute = requireAbsolute(target)
  // Global file-browser mode: an absolute path is already the operand the
  // caller asked for, so only canonicalize it (no containment check).
  if (outsideWorkspaceAllowed) return resolveRealPath(absolute, 'target')
  const [realCwd, realTarget] = await Promise.all([
    resolveRealPath(cwd, 'workspace'),
    resolveRealPath(absolute, 'target'),
  ])
  assertWithinWorkspace(realCwd, realTarget)
  return realTarget
}

/**
 * Validate a write destination, including destinations that do not exist yet.
 * Existing targets are resolved to catch symlinks; missing targets are checked
 * against the nearest existing ancestor before the caller creates or renames.
 * The returned path is rebuilt from that canonical ancestor, so an existing
 * symlink is never left in the path passed to the write operation.
 *
 * @param cwd - Session workspace directory.
 * @param target - Client-supplied absolute destination path.
 * @returns A canonical path for an existing target or its nearest existing ancestor.
 */
export async function ensureWorkspaceWritePath(cwd: string, target: string): Promise<string> {
  const absolute = requireAbsolute(target)
  // Global file-browser mode: the destination may live anywhere; missing
  // segments are created by the caller, so the absolute path is returned.
  if (outsideWorkspaceAllowed) return absolute
  const realCwd = await resolveRealPath(cwd, 'workspace')
  let existingPath = absolute
  const missingSegments: string[] = []

  for (;;) {
    try {
      const realTarget = await realpath(existingPath)
      assertWithinWorkspace(realCwd, realTarget)
      return missingSegments.reduce((path, segment) => join(path, segment), realTarget)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof SidebarError) throw error
        throw new SidebarError('fs-error', `cannot resolve target "${existingPath}": ${error instanceof Error ? error.message : String(error)}`, 400)
      }
      const parent = dirname(existingPath)
      if (parent === existingPath) {
        throw new SidebarError('fs-error', `cannot resolve target "${absolute}"`, 400)
      }
      missingSegments.unshift(basename(existingPath))
      existingPath = parent
    }
  }
}
