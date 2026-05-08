import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createLocalHostedAppDevCommand,
  resolveLocalHostedAppWorkspace,
  shouldUseLocalHostedAppDevMode,
} from './local-hosted-app-dev'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function createWorkspaceFixture(
  includeApp = true
): Promise<{ cliDir: string; repoRoot: string }> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'openspecui-local-app-'))
  tempDirs.push(repoRoot)

  await mkdir(join(repoRoot, 'packages', 'cli', 'src'), { recursive: true })
  await mkdir(join(repoRoot, 'packages', 'web', 'dist'), { recursive: true })
  await writeFile(join(repoRoot, 'package.json'), '{}\n', 'utf8')

  if (includeApp) {
    await mkdir(join(repoRoot, 'packages', 'app'), { recursive: true })
    await writeFile(join(repoRoot, 'packages', 'app', 'package.json'), '{}\n', 'utf8')
  }

  return {
    repoRoot,
    cliDir: join(repoRoot, 'packages', 'cli', 'src'),
  }
}

describe('local hosted app dev helpers', () => {
  it('resolves workspace paths when the app workspace exists', async () => {
    const fixture = await createWorkspaceFixture(true)

    expect(resolveLocalHostedAppWorkspace(fixture.cliDir)).toEqual({
      repoRoot: fixture.repoRoot,
      appDir: join(fixture.repoRoot, 'packages', 'app'),
    })
  })

  it('returns null outside the workspace layout', async () => {
    const fixture = await createWorkspaceFixture(false)

    expect(resolveLocalHostedAppWorkspace(fixture.cliDir)).toBeNull()
  })

  it('uses local hosted app mode only for the bare --app flag', async () => {
    const fixture = await createWorkspaceFixture(true)
    const workspace = resolveLocalHostedAppWorkspace(fixture.cliDir)

    expect(workspace).not.toBeNull()
    expect(shouldUseLocalHostedAppDevMode({ appValue: '', workspace })).toBe(true)
    expect(shouldUseLocalHostedAppDevMode({ appValue: 'https://app.example.com', workspace })).toBe(
      false
    )
    expect(shouldUseLocalHostedAppDevMode({ appValue: '', workspace: null })).toBe(false)
  })

  it('builds pnpm commands for the local app dev server', async () => {
    const fixture = await createWorkspaceFixture(true)
    const workspace = resolveLocalHostedAppWorkspace(fixture.cliDir)

    expect(workspace).not.toBeNull()
    if (!workspace) {
      throw new Error('Expected workspace fixture to resolve')
    }

    const devCommand = createLocalHostedAppDevCommand({
      workspace,
      port: 13009,
    })
    expect(devCommand.args).toEqual([
      '--filter',
      '@openspecui/app',
      'exec',
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      '13009',
      '--strictPort',
    ])
    expect(devCommand.cwd).toBe(fixture.repoRoot)
  })
})
