/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove reactive Code/Planning binding epochs across A -> B -> Code -> A.
 * 2. Prove stale Planning intent conflicts before refresh, removal, or handoff side effects.
 * 3. Prove Launch-owned Code Git remains available when Planning resolution fails.
 * 4. Prove one scope projection observes Code identity exactly once before Planning comparison.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  CliExecutor,
  ConfigManager,
  parseCliCommandResult,
  RuntimeInvalidationIndex,
  type CliCommandResult,
  type GitRepositoryScopes,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import {
  GitRepositoryBindingConflictError,
  GitRepositoryBindingService,
} from './git-repository-binding-service.js'
import { defaultRunGit, type GitRunner } from './git-shared.js'
import { PlanningRootServiceManager } from './planning-root-service.js'
import { createReactiveSubscription } from './reactive-subscription.js'

const runCommand = promisify(execFile)
const fixtures: GitBindingFixture[] = []

interface GitBindingFixture {
  tempDir: string
  codeRoot: string
  rootA: string
  rootB: string
  runtimeInvalidation: RuntimeInvalidationIndex
  manager: PlanningRootServiceManager
  bindings: GitRepositoryBindingService
  selectRoot(root: string): void
  setAvailable(available: boolean): void
  setGitIdentityFailure(failed: boolean): void
  getGitIdentityCalls(): ReadonlyArray<{ cwd: string; args: readonly string[] }>
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise(value)
    },
    reject(reason) {
      if (!rejectPromise) throw new Error('Deferred rejecter was not initialized.')
      rejectPromise(reason)
    },
  }
}

function commandResult<T>(data: T, schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
    },
    schema
  )
}

function failedCommandResult<T>(schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: false,
      stdout: '{"status":[]}',
      stderr: 'Planning root is unavailable.',
      exitCode: 1,
    },
    schema
  )
}

function requirePlanning(
  scopes: GitRepositoryScopes
): NonNullable<GitRepositoryScopes['planning']> {
  if (!scopes.planning) throw new Error('Expected a distinct Planning repository binding.')
  return scopes.planning
}

async function initRepository(path: string): Promise<void> {
  await mkdir(join(path, 'openspec'), { recursive: true })
  await runCommand('git', ['init', '--quiet'], { cwd: path })
}

async function createFixture(): Promise<GitBindingFixture> {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-git-binding-'))
  const codeRoot = join(tempDir, 'code')
  const rootA = join(tempDir, 'root-a')
  const rootB = join(tempDir, 'root-b')
  await Promise.all([initRepository(codeRoot), initRepository(rootA), initRepository(rootB)])

  let selectedRoot = rootA
  let available = true
  let gitIdentityFailure = false
  const gitIdentityCalls: Array<{ cwd: string; args: readonly string[] }> = []
  const configManager = new ConfigManager(codeRoot)
  const cliExecutor = new CliExecutor(configManager, codeRoot)
  vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
    available
      ? commandResult(
          {
            root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
            store: null,
            references: [],
            status: [],
          },
          CliDoctorSchema
        )
      : failedCommandResult(CliDoctorSchema)
  )
  vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
    available
      ? commandResult(
          {
            root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
            members: [],
            status: [],
          },
          CliContextSchema
        )
      : failedCommandResult(CliContextSchema)
  )

  const runGit: GitRunner = async (cwd, args) => {
    gitIdentityCalls.push({ cwd, args: [...args] })
    if (gitIdentityFailure && cwd === selectedRoot && args[0] === 'rev-parse') {
      throw new Error('permission denied while resolving Planning Git identity')
    }
    return defaultRunGit(cwd, args)
  }

  const runtimeInvalidation = new RuntimeInvalidationIndex()
  const codeBinding = { bindingToken: 'code-binding' }
  const manager = new PlanningRootServiceManager({
    launchProjectDir: codeRoot,
    previewAssetsDir: join(tempDir, 'preview-assets'),
    configManager,
    cliExecutor,
    observationEnvironment: { acquireRoot: async () => async () => {} },
    projectInvalidation: { acquireRoot: () => () => {} },
    runtimeInvalidation,
    codeBinding,
  })
  const fixture: GitBindingFixture = {
    tempDir,
    codeRoot,
    rootA,
    rootB,
    runtimeInvalidation,
    manager,
    bindings: new GitRepositoryBindingService({
      launchProjectDir: codeRoot,
      planningRootServices: manager,
      codeBinding,
      runGit,
    }),
    selectRoot(root) {
      selectedRoot = root
    },
    setAvailable(nextAvailable) {
      available = nextAvailable
    },
    setGitIdentityFailure(failed) {
      gitIdentityFailure = failed
    },
    getGitIdentityCalls() {
      return gitIdentityCalls
    },
  }
  fixtures.push(fixture)
  return fixture
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    fixtures.splice(0).map(async (fixture) => {
      await fixture.manager.dispose()
      await rm(fixture.tempDir, { recursive: true, force: true })
    })
  )
})

describe('GitRepositoryBindingService', () => {
  it('reactively publishes A -> B -> Code -> A with stable Code and fresh Planning tokens', async () => {
    const fixture = await createFixture()
    const observed: GitRepositoryScopes[] = []
    const sawA = createDeferred<GitRepositoryScopes>()
    const sawB = createDeferred<GitRepositoryScopes>()
    const sawCodeOnly = createDeferred<GitRepositoryScopes>()
    const sawAAgain = createDeferred<GitRepositoryScopes>()
    let firstAToken: string | null = null

    const subscription = createReactiveSubscription(() =>
      fixture.bindings.resolveScopes({ reactive: true })
    ).subscribe({
      next(scopes) {
        observed.push(scopes)
        if (scopes.planning?.rootPath === fixture.rootA) {
          if (firstAToken === null) {
            firstAToken = scopes.planning.bindingToken
            sawA.resolve(scopes)
          } else if (scopes.planning.bindingToken !== firstAToken) {
            sawAAgain.resolve(scopes)
          }
          return
        }
        if (scopes.planning?.rootPath === fixture.rootB) {
          sawB.resolve(scopes)
          return
        }
        if (scopes.planning === null) sawCodeOnly.resolve(scopes)
      },
      error(error) {
        sawA.reject(error)
        sawB.reject(error)
        sawCodeOnly.reject(error)
        sawAAgain.reject(error)
      },
    })

    const scopesA = await sawA.promise
    fixture.selectRoot(fixture.rootB)
    fixture.runtimeInvalidation.invalidate(['context'])
    const scopesB = await sawB.promise
    fixture.selectRoot(fixture.codeRoot)
    fixture.runtimeInvalidation.invalidate(['context'])
    const scopesCodeOnly = await sawCodeOnly.promise
    fixture.selectRoot(fixture.rootA)
    fixture.runtimeInvalidation.invalidate(['context'])
    const scopesAAgain = await sawAAgain.promise

    expect(scopesA.code.bindingToken).toBe(scopesB.code.bindingToken)
    expect(scopesB.code.bindingToken).toBe(scopesCodeOnly.code.bindingToken)
    expect(scopesCodeOnly.code.bindingToken).toBe(scopesAAgain.code.bindingToken)
    expect(requirePlanning(scopesA).bindingToken).not.toBe(requirePlanning(scopesB).bindingToken)
    expect(requirePlanning(scopesAAgain).bindingToken).not.toBe(
      requirePlanning(scopesA).bindingToken
    )
    expect(observed.at(-1)?.planning?.rootPath).toBe(fixture.rootA)

    subscription.unsubscribe()
  })

  it('observes Code identity once before comparing the Planning candidate', async () => {
    const fixture = await createFixture()

    await fixture.bindings.resolveScopes()

    const codeCalls = fixture.getGitIdentityCalls().filter((call) => call.cwd === fixture.codeRoot)
    expect(codeCalls.map((call) => call.args.join(' '))).toEqual([
      'rev-parse --show-toplevel',
      'rev-parse --git-common-dir',
    ])
  })

  it('rejects stale Planning refresh, removal, and handoff before their owners run', async () => {
    const fixture = await createFixture()
    const scopesA = await fixture.bindings.resolveScopes()
    const bindingA = requirePlanning(scopesA)
    fixture.selectRoot(fixture.rootB)
    const scopesB = await fixture.bindings.resolveScopes()
    const bindingB = requirePlanning(scopesB)
    const refreshOwner = vi.fn(async () => 'refreshed')
    const removeOwner = vi.fn(async () => 'removed')
    const handoffOwner = vi.fn(async () => 'handed-off')

    for (const owner of [refreshOwner, removeOwner, handoffOwner]) {
      await expect(
        fixture.bindings.run(
          { scope: 'planning', expectedBindingToken: bindingA.bindingToken },
          owner
        )
      ).rejects.toBeInstanceOf(GitRepositoryBindingConflictError)
      expect(owner).not.toHaveBeenCalled()
    }

    await expect(
      fixture.bindings.run(
        { scope: 'planning', expectedBindingToken: bindingB.bindingToken },
        refreshOwner
      )
    ).resolves.toBe('refreshed')
    expect(refreshOwner).toHaveBeenCalledOnce()
  })

  it('keeps correctly bound Code operations available through Planning failure', async () => {
    const fixture = await createFixture()
    const initialScopes = await fixture.bindings.resolveScopes()
    const codeToken = initialScopes.code.bindingToken
    fixture.setAvailable(false)

    const failedPlanningScopes = await fixture.bindings.resolveScopes({ reactive: true })
    expect(failedPlanningScopes.planningState).toBe('failed')
    expect(failedPlanningScopes.planning).toBeNull()
    expect(failedPlanningScopes.code.bindingToken).toBe(codeToken)
    await expect(
      fixture.bindings.run(
        { scope: 'code', expectedBindingToken: codeToken },
        (repository) => repository.rootPath
      )
    ).resolves.toBe(fixture.codeRoot)
  })

  it('preserves ready-root Planning Git identity failures as explicit evidence', async () => {
    const fixture = await createFixture()
    const initialScopes = await fixture.bindings.resolveScopes()
    const codeToken = initialScopes.code.bindingToken
    fixture.setGitIdentityFailure(true)

    const failedScopes = await fixture.bindings.resolveScopes({ reactive: true })
    expect(failedScopes.planningState).toBe('failed')
    expect(failedScopes.planning).toBeNull()
    if (failedScopes.planningState !== 'failed') {
      throw new Error('Expected explicit Planning Git failure evidence.')
    }
    expect(failedScopes.planningError.message).toContain('permission denied')
    expect(failedScopes.code.bindingToken).toBe(codeToken)
    await expect(
      fixture.bindings.run(
        { scope: 'code', expectedBindingToken: codeToken },
        (repository) => repository.rootPath
      )
    ).resolves.toBe(fixture.codeRoot)
  })
})
