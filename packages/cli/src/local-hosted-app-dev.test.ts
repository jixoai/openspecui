import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createHostedAppWebBuildCommand,
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
      webDistDir: join(fixture.repoRoot, 'packages', 'web', 'dist'),
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

  it('builds pnpm commands for the local app server and web dist', async () => {
    const fixture = await createWorkspaceFixture(true)
    const workspace = resolveLocalHostedAppWorkspace(fixture.cliDir)

    expect(workspace).not.toBeNull()
    if (!workspace) {
      throw new Error('Expected workspace fixture to resolve')
    }

    const webBuild = createHostedAppWebBuildCommand(workspace)
    expect(webBuild.args).toEqual(['--filter', '@openspecui/web', 'build'])
    expect(webBuild.cwd).toBe(fixture.repoRoot)

    const devCommand = createLocalHostedAppDevCommand({
      workspace,
      port: 13009,
      resolvedVersion: '2.0.2',
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
    expect(devCommand.env.OPENSPECUI_APP_DEV_MODE).toBe('1')
    expect(devCommand.env.OPENSPECUI_APP_DEV_WEB_DIST).toBe(
      join(fixture.repoRoot, 'packages', 'web', 'dist')
    )
    expect(devCommand.env.OPENSPECUI_APP_DEV_VERSION).toBe('2.0.2')
  })
})
