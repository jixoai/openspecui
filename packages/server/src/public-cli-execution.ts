/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own the command policy shared by generic buffered and streamed OpenSpec RPCs.
 * 2. Keep strict Archive mutation reachable only through archiveStrictStream.
 * 3. Reject alternate argv placement without reconstructing OpenSpec command semantics.
 *
 * Original request (2026-07-16): "archiveStrictStream 必须是唯一 Archive mutation。"
 */

const PROTECTED_ARCHIVE_COMMAND = 'archive'

/** Reject protected OpenSpec mutations that have a dedicated Server-owned public contract. */
export function assertGenericOpenSpecCommandAllowed(args: readonly string[]): void {
  if (!args.includes(PROTECTED_ARCHIVE_COMMAND)) return
  throw new Error(
    'Archive is not available through generic CLI execution; use cli.archiveStrictStream.'
  )
}
