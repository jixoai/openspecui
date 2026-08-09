/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove Windows case, separator, trailing-slash, and junction aliases share one Workspace identity.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveWorkspaceIdentity } from './workspace-identity.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true, maxRetries: 5 }))
  )
})

describe.runIf(process.platform === 'win32')('Windows Workspace identity', () => {
  it('deduplicates textual and junction aliases of one physical directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-workspace-identity-'))
    tempDirs.push(root)
    const physical = join(root, 'Physical Project')
    const junction = join(root, 'Project Alias')
    await mkdir(physical)
    await symlink(physical, junction, 'junction')

    const identities = await Promise.all([
      resolveWorkspaceIdentity(physical),
      resolveWorkspaceIdentity(`${physical}\\`),
      resolveWorkspaceIdentity(physical.replace(/\\/g, '/').toUpperCase()),
      resolveWorkspaceIdentity(junction),
    ])

    expect(new Set(identities.map((identity) => identity.id))).toHaveLength(1)
    expect(new Set(identities.map((identity) => identity.projectDir.toLowerCase()))).toHaveLength(1)
    expect(identities[0]?.projectDir.toLowerCase()).toBe(physical.toLowerCase())
  })
})
