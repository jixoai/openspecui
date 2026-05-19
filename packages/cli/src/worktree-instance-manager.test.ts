import {
  HOSTED_SHELL_PROTOCOL_VERSION,
  OPENSPECUI_RUNTIME_CAPABILITIES,
  buildBackendHealthPayload,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestHealthServer, type TestHealthServer } from './worktree-handoff-test-platform'
import {
  assertWorktreeServerCompatible,
  createWorktreeServerLaunchPlan,
  resolveLocalCliWorkspace,
} from './worktree-instance-manager'
import {
  buildWorktreeServerStartOptions,
  normalizeSourceBootstrapEntryUrl,
} from './worktree-server-worker'

const tempDirs: string[] = []
const healthServers: TestHealthServer[] = []
const createWorker = (): never => {
  throw new Error('Test worker factory should not be called by launch-plan tests.')
}

afterEach(async () => {
  await Promise.all([
    ...healthServers.splice(0).map((server) => server.close()),
    ...tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  ])
})

async function createWorkspaceFixture(): Promise<{ repoRoot: string; runtimeDir: string }> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'openspecui-worktree-manager-'))
  tempDirs.push(repoRoot)

  await mkdir(join(repoRoot, 'packages', 'cli', 'src'), { recursive: true })
  await mkdir(join(repoRoot, 'packages', 'cli', 'dist'), { recursive: true })
  await writeFile(join(repoRoot, 'package.json'), '{}\n', 'utf8')
  await writeFile(join(repoRoot, 'packages', 'cli', 'package.json'), '{}\n', 'utf8')
  await writeFile(join(repoRoot, 'packages', 'cli', 'src', 'cli.ts'), '// test\n', 'utf8')
  await writeFile(join(repoRoot, 'packages', 'cli', 'dist', 'cli.mjs'), '// test\n', 'utf8')

  return {
    repoRoot,
    runtimeDir: join(repoRoot, 'packages', 'cli', 'src'),
  }
}

describe('worktree instance manager helpers', () => {
  it('resolves the monorepo workspace from the CLI runtime directory', async () => {
    const fixture = await createWorkspaceFixture()

    expect(resolveLocalCliWorkspace(fixture.runtimeDir)).toEqual({
      repoRoot: fixture.repoRoot,
      cliPackageDir: join(fixture.repoRoot, 'packages', 'cli'),
    })
  })

  it('uses the self-bootstrap worker factory when developing inside the monorepo', async () => {
    const fixture = await createWorkspaceFixture()

    const plan = createWorktreeServerLaunchPlan({
      runtimeDir: fixture.runtimeDir,
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      createWorker,
    })

    expect(plan.kind).toBe('worker')
    if (plan.kind !== 'worker') throw new Error('Expected worker launch plan')
    expect(plan.createWorker).toBe(createWorker)
    expect('entry' in plan).toBe(false)
    expect(plan.workerData).toEqual({
      projectDir: '/tmp/feature-worktree',
      port: 3123,
    })
  })

  it('adds the development export condition for source self-bootstrap workers', async () => {
    const fixture = await createWorkspaceFixture()
    await rm(join(fixture.repoRoot, 'packages', 'cli', 'dist'), { recursive: true, force: true })

    const plan = createWorktreeServerLaunchPlan({
      runtimeDir: fixture.runtimeDir,
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      createWorker,
    })

    expect(plan.kind).toBe('worker')
    if (plan.kind !== 'worker') throw new Error('Expected worker launch plan')
    expect(plan.createWorker).toBe(createWorker)
    expect(plan.execArgv).toContain('--conditions=development')
  })

  it('keeps built self-bootstrap workers on the default export condition', async () => {
    const fixture = await createWorkspaceFixture()

    const plan = createWorktreeServerLaunchPlan({
      runtimeDir: join(fixture.repoRoot, 'packages', 'cli', 'dist'),
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      createWorker,
    })

    expect(plan.kind).toBe('worker')
    if (plan.kind !== 'worker') throw new Error('Expected worker launch plan')
    expect(plan.createWorker).toBe(createWorker)
    expect(plan.execArgv).not.toContain('--conditions=development')
    expect(plan.workerData).toEqual({
      projectDir: '/tmp/feature-worktree',
      port: 3123,
    })
  })

  it('uses the self-bootstrap worker factory outside the monorepo when the root entry provides it', () => {
    const plan = createWorktreeServerLaunchPlan({
      runtimeDir: '/pkg/runtime',
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      createWorker,
    })

    expect(plan.kind).toBe('worker')
    if (plan.kind !== 'worker') throw new Error('Expected worker launch plan')
    expect(plan.createWorker).toBe(createWorker)
    expect(plan.execArgv).not.toContain('--conditions=development')
  })

  it('falls back to the packaged cli.mjs entry when no worker factory is available', () => {
    const plan = createWorktreeServerLaunchPlan({
      runtimeDir: '/pkg/runtime',
      projectDir: '/tmp/feature-worktree',
      port: 3123,
    })

    expect(plan.kind).toBe('process')
    if (plan.kind !== 'process') throw new Error('Expected process launch plan')
    expect(plan.command).toBe(process.execPath)
    expect(plan.args).toEqual([
      '/pkg/runtime/cli.mjs',
      'start',
      '/tmp/feature-worktree',
      '--port',
      '3123',
      '--no-open',
    ])
    expect(plan.cwd).toBe('/tmp/feature-worktree')
  })
})

describe('worktree handoff compatibility BDD platform', () => {
  it('accepts a sibling server with compatible runtime capabilities', async () => {
    const healthServer = await createTestHealthServer(
      buildBackendHealthPayload({
        projectDir: '/tmp/feature-worktree',
        projectName: 'feature-worktree',
        watcherEnabled: true,
        openspecuiVersion: '3.7.0',
        embeddedUiUrl: 'http://localhost:3100',
      })
    )
    healthServers.push(healthServer)

    await expect(
      assertWorktreeServerCompatible({
        serverUrl: healthServer.url,
        projectDir: '/tmp/feature-worktree',
      })
    ).resolves.toBeUndefined()
  })

  it('rejects a projectDir-only healthy sibling server before navigation', async () => {
    const healthServer = await createTestHealthServer({
      status: 'ok',
      projectDir: '/tmp/feature-worktree',
      projectName: 'feature-worktree',
      watcherEnabled: true,
    })
    healthServers.push(healthServer)

    await expect(
      assertWorktreeServerCompatible({
        serverUrl: healthServer.url,
        projectDir: '/tmp/feature-worktree',
      })
    ).rejects.toThrow(/incompatible/i)
  })

  it('rejects stale runtimes that omit required runtime capabilities', async () => {
    const healthServer = await createTestHealthServer({
      status: 'ok',
      projectDir: '/tmp/feature-worktree',
      projectName: 'feature-worktree',
      watcherEnabled: true,
      openspecuiVersion: '3.5.0',
      hostedShellProtocolVersion: HOSTED_SHELL_PROTOCOL_VERSION,
      embeddedUiUrl: 'http://localhost:3100',
      runtimeCapabilities: OPENSPECUI_RUNTIME_CAPABILITIES.filter(
        (capability) => capability !== 'notifications.subscribe'
      ),
    })
    healthServers.push(healthServer)

    await expect(
      assertWorktreeServerCompatible({
        serverUrl: healthServer.url,
        projectDir: '/tmp/feature-worktree',
      })
    ).rejects.toThrow(/notifications\.subscribe/)
  })
})

describe('worktree server worker module loading', () => {
  it('strips parent tsx loader query state from nested source self-bootstrap entries', () => {
    expect(
      normalizeSourceBootstrapEntryUrl(
        'file:///repo/packages/cli/src/index.ts?tsx-namespace=parent-runtime#worker'
      )
    ).toBe('file:///repo/packages/cli/src/index.ts')
  })

  it('normalizes worker data to the same startServer options as CLI start', () => {
    expect(
      buildWorktreeServerStartOptions({
        projectDir: '/tmp/feature-worktree',
        port: 3123,
      })
    ).toEqual({
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      open: false,
    })
  })
})
