/** Inputs of one upload: the session scope plus the request body stream. */
export interface WorkspaceUploadInput {
    /** The session workspace root; target and directory must stay inside it. */
    cwd: string;
    /** Absolute upload directory chosen by the client (inside `cwd`). */
    dir: string;
    /** Relative path below `dir` (absolute paths, '.', '..' and empty segments refused). */
    relativePath: string;
    /** The request body stream (raw bytes). */
    chunks: AsyncIterable<string | Uint8Array>;
    /** Byte cap; an oversized upload is refused without touching the target. */
    limit: number;
}
export type WorkspaceCreateKind = 'file' | 'directory';
/**
 * Create one empty file or directory inside an existing workspace directory.
 * The containing directory is resolved through the workspace fence, the new
 * name must be one direct child (no absolute/traversal/nested segments), and
 * existing targets are refused instead of overwritten.
 */
export declare function createWorkspaceEntry(cwd: string, dir: string, name: string, kind: WorkspaceCreateKind): Promise<{
    path: string;
    kind: WorkspaceCreateKind;
}>;
/**
 * Move an existing workspace file/folder to the OS trash. The row's parent
 * directory must resolve inside the session workspace, but the final segment is
 * checked with lstat so a symlink row is trashed as a link instead of following
 * and trashing its target. The workspace root itself is refused so a
 * context-menu slip cannot trash the whole project. Globbing is disabled
 * because explorer rows are literal paths, not patterns.
 */
export declare function trashWorkspacePath(cwd: string, target: string): Promise<{
    path: string;
}>;
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
export declare function writeWorkspaceUpload(input: WorkspaceUploadInput): Promise<{
    path: string;
    size: number;
}>;
