/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove the CLI-resolved Environment Global config path remains a create/change/remove dependency.
 * 2. Prove Environment Global refresh failure retains the prior snapshot as display-only.
 * 3. Prove Environment Global lifecycle Push carries no config or failure business payload.
 * 4. Prove dynamic CLI path replacement retires the old dependency across platform watcher event counts.
 * 5. Keep Environment and Root refresh alive only after dependency-driven config-file settlement.
 *
 * Original request (2026-07-26): "将这些变更信息收集起来作为触发器，更新底层幂等计算的缓存结果。"
 * Original request (2026-08-04): "?????????macOS???????????Windows????????????"
 */
import {
  clearCache,
  CliExecutor,
  closeAllWatchers,
  ConfigManager,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  type CliProjectionNotice,
  type CliResult,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createEnvironmentGlobalProjectionWorkOwner,
  EnvironmentGlobalProjectionService,
} from './environment-global-projection-service.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'

function successfulResult(stdout: string): CliResult {
  return { success: true, stdout, stderr: '', exitCode: 0 }
}

async function createFixture(options: {
  configPath: string
  initialContent?: string
  onConfigFileSettled?: () => void
}) {
  const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-environment-projection-'))
  if (options.initialContent !== undefined) {
    await mkdir(dirname(options.configPath), { recursive: true })
    await writeFile(options.configPath, options.initialContent, 'utf8')
  }
  const cliExecutor = new CliExecutor(new ConfigManager(projectDir), projectDir)
  let executionFailure: Error | null = null
  let resolvedConfigPath = options.configPath
  let configJson: Record<string, unknown> = { profile: 'core', delivery: 'both' }
  const execute = vi.spyOn(cliExecutor, 'execute').mockImplementation(async (args) => {
    if (executionFailure) throw executionFailure
    if (args.join(' ') === 'config path') return successfulResult(`${resolvedConfigPath}\n`)
    if (args.join(' ') === 'config list --json') {
      return successfulResult(JSON.stringify(configJson))
    }
    if (args.join(' ') === 'config list') return successfulResult('Profile is in sync.')
    throw new Error(`Unexpected CLI arguments: ${args.join(' ')}`)
  })
  const runtime = createServerProjectionWorkRuntime()
  const invalidation = new RuntimeInvalidationIndex()
  const observationEnvironment = new ReactiveObservationEnvironment()
  const service = new EnvironmentGlobalProjectionService({
    dataScope: {
      path: join(projectDir, 'data', 'openspec'),
      source: 'user-home-default',
      environmentVariable: null,
    },
    cliExecutor,
    observationEnvironment,
    workOwner: createEnvironmentGlobalProjectionWorkOwner(runtime),
    onConfigFileSettled: options.onConfigFileSettled,
  })
  return {
    execute,
    failWith(error: Error) {
      executionFailure = error
    },
    setConfigPath(path: string) {
      resolvedConfigPath = path
    },
    setConfigJson(config: Record<string, unknown>) {
      configJson = config
    },
    projectDir,
    invalidation,
    observationEnvironment,
    runtime,
    service,
  }
}

function containsBusinessData(notice: CliProjectionNotice): boolean {
  return Object.hasOwn(notice, 'data') || Object.hasOwn(notice, 'error')
}

describe('EnvironmentGlobalProjectionService', () => {
  it('keeps config-file observation alive and refreshes Environment plus Root without a file consumer', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-global-config-bridge-'))
    const configPath = join(baseDir, 'config.json')
    const initialContent = '{"profile":"core"}\n'
    const onConfigFileSettled = vi.fn()
    const fixture = await createFixture({ configPath, initialContent, onConfigFileSettled })
    const subscription = fixture.service.subscribe(() => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read()).toMatchObject({
          state: 'ready',
          data: { defaultStore: { state: 'absent', id: null } },
        })
      })

      fixture.setConfigJson({ profile: 'core', defaultStore: 'team-plans' })
      await writeFile(configPath, '{"profile":"core","defaultStore":"team-plans"}\n', 'utf8')

      await vi.waitFor(() => {
        expect(fixture.service.read()).toMatchObject({
          state: 'ready',
          invalidationCause: 'dependency',
          data: { defaultStore: { state: 'configured', id: 'team-plans' } },
        })
      })
      expect(onConfigFileSettled).toHaveBeenCalledOnce()
    } finally {
      subscription.unsubscribe()
      await fixture.service.dispose()
      fixture.runtime.clear()
      fixture.execute.mockRestore()
      await fixture.observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(fixture.projectDir, { recursive: true, force: true })
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  it('recomputes when the CLI-resolved config file is created, changed, and removed', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-global-config-'))
    const configPath = join(baseDir, 'config.json')
    const onConfigFileSettled = vi.fn()
    const fixture = await createFixture({ configPath, onConfigFileSettled })
    const notices: CliProjectionNotice[] = []
    const subscription = fixture.service.subscribe((notice) => notices.push(notice))
    const fileSubscription = fixture.service.subscribeFile(() => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read()).toMatchObject({
          state: 'ready',
          invalidationCause: 'initial',
          data: { configPath },
          workGeneration: 1,
          snapshotGeneration: 1,
        })
      })

      const created = '{"profile":"core"}\n'
      await writeFile(configPath, created, 'utf8')
      await vi.waitFor(() => {
        expect(fixture.service.readFile()).toMatchObject({
          state: 'ready',
          invalidationCause: 'dependency',
          data: { file: { path: configPath, exists: true, content: created } },
          workGeneration: 2,
          snapshotGeneration: 2,
        })
      })

      const changed = '{"profile":"custom"}\n'
      await writeFile(configPath, changed, 'utf8')
      await vi.waitFor(() => {
        expect(fixture.service.readFile()).toMatchObject({
          state: 'ready',
          invalidationCause: 'dependency',
          data: { file: { path: configPath, exists: true, content: changed } },
          workGeneration: 3,
          snapshotGeneration: 3,
        })
      })

      await rm(configPath)
      await vi.waitFor(() => {
        expect(fixture.service.readFile()).toMatchObject({
          state: 'ready',
          invalidationCause: 'dependency',
          data: { file: { path: configPath, exists: false, content: null } },
          workGeneration: 4,
          snapshotGeneration: 4,
        })
      })
      expect(fixture.execute).toHaveBeenCalledTimes(12)
      expect(onConfigFileSettled).toHaveBeenCalledTimes(3)
      expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
    } finally {
      subscription.unsubscribe()
      fileSubscription.unsubscribe()
      await fixture.service.dispose()
      fixture.runtime.clear()
      fixture.execute.mockRestore()
      await fixture.observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(fixture.projectDir, { recursive: true, force: true })
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  it('replaces the observed dependency when a refreshed CLI path changes', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-global-config-rebind-'))
    const firstPath = join(baseDir, 'first.json')
    const secondPath = join(baseDir, 'second.json')
    const firstContent = '{"profile":"core"}\n'
    const secondContent = '{"profile":"custom"}\n'
    await writeFile(firstPath, firstContent, 'utf8')
    await writeFile(secondPath, secondContent, 'utf8')
    const fixture = await createFixture({ configPath: firstPath })
    const subscription = fixture.service.subscribe(() => {})
    const fileSubscription = fixture.service.subscribeFile(() => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.readFile()).toMatchObject({
          state: 'ready',
          data: { file: { path: firstPath, content: firstContent } },
          workGeneration: 1,
        })
      })

      fixture.setConfigPath(secondPath)
      fixture.service.refresh()
      await vi.waitFor(() => {
        expect(fixture.service.readFile()).toMatchObject({
          state: 'ready',
          data: { file: { path: secondPath, content: secondContent } },
          workGeneration: 2,
        })
      })
      const reboundGeneration = fixture.service.readFile().workGeneration
      const callsAfterReplacement = fixture.execute.mock.calls.length

      await writeFile(firstPath, '{"profile":"retired"}\n', 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 250))
      expect(fixture.execute).toHaveBeenCalledTimes(callsAfterReplacement)

      const replacementContent = '{"profile":"core"}\n'
      await writeFile(secondPath, replacementContent, 'utf8')
      await vi.waitFor(() => {
        const projection = fixture.service.readFile()
        expect(projection).toMatchObject({
          state: 'ready',
          data: { file: { path: secondPath, content: replacementContent } },
        })
        expect(projection.workGeneration).toBeGreaterThan(reboundGeneration)
      })
    } finally {
      subscription.unsubscribe()
      fileSubscription.unsubscribe()
      await fixture.service.dispose()
      fixture.runtime.clear()
      fixture.execute.mockRestore()
      await fixture.observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(fixture.projectDir, { recursive: true, force: true })
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  it('retains ready A as display-only when an explicit refresh fails', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-global-config-'))
    const configPath = join(baseDir, 'config.json')
    const initialContent = '{"profile":"core"}\n'
    const fixture = await createFixture({ configPath, initialContent })
    const notices: CliProjectionNotice[] = []
    const subscription = fixture.service.subscribe((notice) => notices.push(notice))
    const fileSubscription = fixture.service.subscribeFile(() => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.read()).toMatchObject({
          state: 'ready',
          invalidationCause: 'initial',
          data: { configPath },
          freshness: 'current',
          workGeneration: 1,
          snapshotGeneration: 1,
        })
      })

      fixture.failWith(new Error('config refresh failed'))
      expect(fixture.service.refresh()).toMatchObject({
        state: 'revalidating',
        invalidationCause: 'explicit-refresh',
        data: { configPath },
        freshness: 'stale-display-only',
        workGeneration: 2,
        snapshotGeneration: 1,
      })
      await vi.waitFor(() => {
        expect(fixture.service.read()).toMatchObject({
          state: 'refresh-error',
          invalidationCause: 'explicit-refresh',
          data: { configPath },
          freshness: 'stale-display-only',
          workGeneration: 2,
          snapshotGeneration: 1,
          error: { name: 'Error', message: 'config refresh failed', cliEvidence: null },
        })
      })
      expect(notices.every((notice) => !containsBusinessData(notice))).toBe(true)
    } finally {
      subscription.unsubscribe()
      fileSubscription.unsubscribe()
      await fixture.service.dispose()
      fixture.runtime.clear()
      fixture.execute.mockRestore()
      await fixture.observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(fixture.projectDir, { recursive: true, force: true })
      await rm(baseDir, { recursive: true, force: true })
    }
  })

  it('does not rerun global config CLI Work for unrelated data-home schema or project Context invalidation', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-global-config-'))
    const configPath = join(baseDir, 'config.json')
    const fixture = await createFixture({ configPath, initialContent: '{"profile":"core"}\n' })
    const subscription = fixture.service.subscribe(() => {})

    try {
      await vi.waitFor(() => expect(fixture.service.read()).toMatchObject({ state: 'ready' }))
      expect(fixture.execute).toHaveBeenCalledTimes(3)

      fixture.invalidation.invalidate(['schemas', 'context'])
      await Promise.resolve()
      await Promise.resolve()

      expect(fixture.execute).toHaveBeenCalledTimes(3)
      expect(fixture.service.read()).toMatchObject({
        state: 'ready',
        workGeneration: 1,
        snapshotGeneration: 1,
      })
    } finally {
      subscription.unsubscribe()
      await fixture.service.dispose()
      fixture.runtime.clear()
      fixture.execute.mockRestore()
      await fixture.observationEnvironment.dispose()
      clearCache()
      await closeAllWatchers()
      await rm(fixture.projectDir, { recursive: true, force: true })
      await rm(baseDir, { recursive: true, force: true })
    }
  })
})
