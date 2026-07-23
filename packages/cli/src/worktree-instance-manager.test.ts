/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove worktree runtime selection and source bootstrap normalization.
 * 2. Prove worker-thread and process children inherit the exact parent Access Gate without argv leakage.
 * 3. Prove readiness authenticates with the inherited Gate while unguarded readiness remains unchanged.
 *
 * Original request (2026-07-24): "Propagate the exact parent Access Gate into worktree Servers."
 */
import {
  buildBackendHealthPayload,
  generateAccessGateCredential,
  HOSTED_SHELL_PROTOCOL_VERSION,
  OPENSPECUI_RUNTIME_CAPABILITIES,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestHealthServer, type TestHealthServer } from './worktree-handoff-test-platform'
import {
  assertWorktreeServerCompatible,
  createWorktreeInstanceManager,
  createWorktreeServerLaunchPlan,
  resolveLocalCliWorkspace,
  type WorktreeInstanceManager,
} from './worktree-instance-manager'
import {
  buildWorktreeServerStartOptions,
  consumeWorktreeProcessAccessGateCredential,
  normalizeSourceBootstrapEntryUrl,
  WORKTREE_ACCESS_GATE_CREDENTIAL_ENV,
} from './worktree-server-worker'

const tempDirs: string[] = []
const healthServers: TestHealthServer[] = []
const managers: WorktreeInstanceManager[] = []
const createWorker = (): never => {
  throw new Error('Test worker factory should not be called by launch-plan tests.')
}

afterEach(async () => {
  await Promise.all([
    ...healthServers.splice(0).map((server) => server.close()),
    ...managers.splice(0).map((manager) => manager.close()),
    ...tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  ])
  vi.unstubAllEnvs()
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

  it('carries the exact Access Gate through worker data without argv leakage', async () => {
    const fixture = await createWorkspaceFixture()
    const accessGateCredential = generateAccessGateCredential()
    const launchOptions = {
      runtimeDir: fixture.runtimeDir,
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      createWorker,
      accessGateCredential,
    }

    const plan = createWorktreeServerLaunchPlan(launchOptions)

    expect(plan.kind).toBe('worker')
    if (plan.kind !== 'worker') throw new Error('Expected worker launch plan')
    expect(plan.workerData).toEqual({
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      accessGateCredential,
    })
    expect(plan.execArgv.join(' ')).not.toContain(accessGateCredential.credential)
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

  it('carries the exact Access Gate through private process environment without argv leakage', () => {
    const accessGateCredential = generateAccessGateCredential()
    const launchOptions = {
      runtimeDir: '/pkg/runtime',
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      accessGateCredential,
    }

    const plan = createWorktreeServerLaunchPlan(launchOptions)

    expect(plan.kind).toBe('process')
    if (plan.kind !== 'process') throw new Error('Expected process launch plan')
    expect(plan.args.join(' ')).not.toContain(accessGateCredential.credential)
    expect(
      Object.entries(plan.env).some(
        ([key, value]) =>
          key.includes('WORKTREE_ACCESS_GATE') && value === accessGateCredential.credential
      )
    ).toBe(true)
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

  it('authenticates readiness with the exact inherited Access Gate', async () => {
    const accessGateCredential = generateAccessGateCredential()
    const healthServer = await createTestHealthServer(
      buildBackendHealthPayload({
        projectDir: '/tmp/feature-worktree',
        projectName: 'feature-worktree',
        watcherEnabled: true,
        openspecuiVersion: '3.7.0',
        embeddedUiUrl: 'http://localhost:3100',
      }),
      { authorizationHeader: accessGateCredential.authorizationHeader }
    )
    healthServers.push(healthServer)
    const compatibilityOptions = {
      serverUrl: healthServer.url,
      projectDir: '/tmp/feature-worktree',
      accessGateCredential,
    }

    await expect(assertWorktreeServerCompatible(compatibilityOptions)).resolves.toBeUndefined()
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
    const accessGateCredential = generateAccessGateCredential()
    const workerData = {
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      accessGateCredential,
    }
    expect(buildWorktreeServerStartOptions(workerData)).toEqual({
      projectDir: '/tmp/feature-worktree',
      port: 3123,
      open: false,
      accessGateCredential,
    })
  })

  it('consumes the process credential once and erases it before descendants inherit environment', () => {
    const accessGateCredential = generateAccessGateCredential()
    const env: NodeJS.ProcessEnv = {
      SAFE_PARENT_VALUE: 'retained',
      [WORKTREE_ACCESS_GATE_CREDENTIAL_ENV]: accessGateCredential.credential,
    }

    expect(consumeWorktreeProcessAccessGateCredential(env)).toEqual(accessGateCredential)
    expect(env).toEqual({ SAFE_PARENT_VALUE: 'retained' })
    expect(consumeWorktreeProcessAccessGateCredential(env)).toBeNull()
  })
})

describe('worktree child Access Gate integration', () => {
  async function expectGatedChild(
    manager: WorktreeInstanceManager,
    targetPath: string
  ): Promise<void> {
    managers.push(manager)
    const handoff = await manager.ensureWorktreeServer({ targetPath })

    const missing = await fetch(`${handoff.serverUrl}/api/health`)
    expect(missing.status).toBe(401)
    return Promise.resolve()
  }

  it('starts a process child through the private env contract and authenticated readiness', async () => {
    const currentProjectDir = await mkdtemp(join(tmpdir(), 'openspecui-process-current-'))
    const targetPath = await mkdtemp(join(tmpdir(), 'openspecui-process-target-'))
    const runtimeDir = await mkdtemp(join(tmpdir(), 'openspecui-process-runtime-'))
    tempDirs.push(currentProjectDir, targetPath, runtimeDir)
    const tsxApiUrl = import.meta.resolve('tsx/esm/api')
    const cliEntryUrl = new URL('./cli.ts', import.meta.url).href
    await writeFile(
      join(runtimeDir, 'cli.mjs'),
      `import { tsImport } from ${JSON.stringify(tsxApiUrl)}\n` +
        `await tsImport(${JSON.stringify(cliEntryUrl)}, { parentURL: ${JSON.stringify(cliEntryUrl)} })\n`,
      'utf8'
    )
    const accessGateCredential = generateAccessGateCredential()
    vi.stubEnv(
      'NODE_OPTIONS',
      `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--conditions=development`
    )
    const manager = createWorktreeInstanceManager({
      currentProjectDir,
      currentServerUrl: 'http://127.0.0.1:1',
      runtimeDir,
      accessGateCredential,
    })

    await expectGatedChild(manager, targetPath)
    const handoff = await manager.ensureWorktreeServer({ targetPath })
    const authenticated = await fetch(`${handoff.serverUrl}/api/health`, {
      headers: { Authorization: accessGateCredential.authorizationHeader },
    })
    expect(authenticated.status).toBe(200)
  }, 20_000)
})
