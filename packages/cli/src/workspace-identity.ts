/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Resolve one physical project directory into a stable daemon Workspace identity.
 *
 * Original request (2026-07-30): "Workspace needs to remember directories and start OpenSpecUI directly from a directory."
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { win32 } from 'node:path'

export interface WorkspaceIdentity {
  readonly id: string
  readonly projectDir: string
}

function workspaceIdentityKey(projectDir: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? win32.normalize(projectDir).toLowerCase() : projectDir
}

/** Resolve aliases before deriving the durable Workspace id and registration path. */
export async function resolveWorkspaceIdentity(
  projectDir: string,
  platform: NodeJS.Platform = process.platform
): Promise<WorkspaceIdentity> {
  const canonicalProjectDir = await realpath(projectDir)
  const key = workspaceIdentityKey(canonicalProjectDir, platform)
  return {
    id: `workspace-${createHash('sha256').update(key).digest('hex').slice(0, 20)}`,
    projectDir: canonicalProjectDir,
  }
}
