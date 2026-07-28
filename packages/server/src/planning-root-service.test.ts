/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove filesystem services read and mutate only the CLI-selected planning root.
 * 2. Prove failed Root Context resolution creates no root-dependent actions.
 * 3. Prove root identity transitions await child settlement before retiring services, leases, and previews.
 * 4. Prove planning roots own reactive dependencies, current snapshots, and leave zero observation/invalidation residue.
 * 5. Prove Change/Archive lists and Dashboard metrics remain scoped to the selected planning root.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-17): "A stream cancellation request is not child-process settlement."
 * Original request (2026-07-17): "Prove the transition was already blocked on A before disposal began."
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import {
  CliExecutor,
  closeAllWatchers,
  ConfigManager,
  getActiveWatcherCount,
  getWatcherRuntimeStatus,
  OpsxKernel,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  RuntimeRootInvalidationRegistry,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type CliStreamHandle,
  type CliStreamSettlement,
  type ObservationRootOwner,
  type RootContextResolvedState,
  type RuntimeRootInvalidationOwner,
} from '@openspecui/core'
import { EventEmitter } from 'node:events'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardOverviewService } from './dashboard-overview-service.js'
import { FilePreviewService } from './file-preview-service.js'
import { ProjectHookRuntime } from './hook-runtime.js'
import {
  PlanningRootServiceManager,
  PlanningRootUnavailableError,
} from './planning-root-service.js'
import { createRootContextSubscription } from './root-context-service.js'
import { SchemaMutationService } from './schema-mutation-service.js'
import { SearchService } from './search-service.js'

const tempDirs: string[] = []

function createControlledStreamHandle(): {
  handle: CliStreamHandle
  cancel: ReturnType<typeof vi.fn>
  settle(exitCode?: number | null): void
} {
  const terminal = Promise.withResolvers<CliStreamSettlement>()
  const cancel = vi.fn(() => {
    terminal.resolve({ reason: 'cancelled', exitCode: null })
    return terminal.promise
  })
  return {
    handle: { settled: terminal.promise, cancel },
    cancel,
    settle: (exitCode = 0) => terminal.resolve({ reason: 'exited', exitCode }),
  }
}

function commandResult<T>(data: T): CliCommandResult<T> {
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    data,
    payload: data,
    diagnostics: [],
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('PlanningRootServiceManager', () => {
  it('reads and writes through the CLI-selected root, never the launch project', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const planningRootDir = join(tempDir, 'planning')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec', 'specs', 'launch-only'), { recursive: true }),
      mkdir(join(planningRootDir, 'openspec', 'specs', 'planning-only'), { recursive: true }),
      mkdir(join(planningRootDir, 'openspec', 'specs', 'planning-secondary'), {
        recursive: true,
      }),
    ])
    await Promise.all([
      writeFile(
        join(launchProjectDir, 'openspec', 'specs', 'launch-only', 'spec.md'),
        '# Launch only\n\n## Purpose\n\nLaunch.\n'
      ),
      writeFile(
        join(planningRootDir, 'openspec', 'specs', 'planning-only', 'spec.md'),
        '# Planning only\n\n## Purpose\n\nPlanning.\n'
      ),
      writeFile(
        join(planningRootDir, 'openspec', 'specs', 'planning-secondary', 'spec.md'),
        '# Planning secondary\n\n## Purpose\n\nPlanning.\n'
      ),
    ])
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec', 'changes', 'archive', 'launch-only-archive'), {
        recursive: true,
      }),
      mkdir(join(planningRootDir, 'openspec', 'changes', 'archive', 'planning-only-archive'), {
        recursive: true,
      }),
    ])
    await Promise.all([
      writeFile(
        join(
          launchProjectDir,
          'openspec',
          'changes',
          'archive',
          'launch-only-archive',
          'proposal.md'
        ),
        '# Launch-only archive\n'
      ),
      writeFile(
        join(
          planningRootDir,
          'openspec',
          'changes',
          'archive',
          'planning-only-archive',
          'proposal.md'
        ),
        '# Planning-only archive\n'
      ),
    ])

    const configManager = new ConfigManager(launchProjectDir)
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    const doctor: CliDoctor = {
      root: {
        path: planningRootDir,
        source: 'declared',
        healthy: true,
        status: [],
      },
      store: {
        id: 'planning',
        metadata: { present: true, valid: true },
        status: [],
      },
      references: [],
      status: [],
    }
    const context: CliContext = {
      root: { path: planningRootDir, source: 'declared', role: 'openspec_root' },
      members: [],
      status: [],
    }
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockResolvedValue(commandResult(doctor))
    vi.spyOn(cliExecutor.contracts, 'context').mockResolvedValue(commandResult(context))
    const releaseObservationRoot = vi.fn(async () => {})
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => releaseObservationRoot),
    }
    const releaseProjectInvalidation = vi.fn()
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => releaseProjectInvalidation),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const trackInvalidation = vi.spyOn(runtimeInvalidation, 'track')

    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })
    await manager.runOperation(async (services) => {
      expect(await services.adapter.listSpecs()).toEqual(['planning-only', 'planning-secondary'])
      expect(await services.documentService.readSpecRaw('planning-only', 'view', 'source')).toEqual(
        expect.objectContaining({ markdown: expect.stringContaining('Planning only') })
      )

      await services.adapter.writeSpec('created', '# Created\n\n## Purpose\n\nCreated.\n')
      await services.adapter.writeChange(
        'created-change',
        '# Change: Created\n',
        '- [ ] First task\n'
      )
      await expect(
        readFile(join(planningRootDir, 'openspec', 'specs', 'created', 'spec.md'), 'utf8')
      ).resolves.toContain('# Created')
      await expect(
        readFile(join(launchProjectDir, 'openspec', 'specs', 'created', 'spec.md'), 'utf8')
      ).rejects.toThrow()
      await expect(
        readFile(
          join(planningRootDir, 'openspec', 'changes', 'created-change', 'proposal.md'),
          'utf8'
        )
      ).resolves.toContain('# Change: Created')
      await expect(
        readFile(join(planningRootDir, 'openspec', 'changes', 'created-change', 'tasks.md'), 'utf8')
      ).resolves.toContain('- [ ] First task')
      await expect(
        readFile(
          join(launchProjectDir, 'openspec', 'changes', 'created-change', 'proposal.md'),
          'utf8'
        )
      ).rejects.toThrow()
      await expect(services.adapter.writeSpec('../escaped', '# Escaped\n')).rejects.toThrow(
        /Invalid specId/
      )
      await expect(
        services.adapter.writeChange('../escaped-change', '# Escaped change\n')
      ).rejects.toThrow(/Invalid changeId/)
      await expect(
        services.adapter.readEntityDetail('change', '../escaped-change')
      ).rejects.toThrow(/Invalid changeId/)
      await expect(
        readFile(join(planningRootDir, 'openspec', 'escaped', 'spec.md'), 'utf8')
      ).rejects.toThrow()
      await expect(
        readFile(join(planningRootDir, 'openspec', 'escaped-change', 'proposal.md'), 'utf8')
      ).rejects.toThrow()

      await mkdir(join(launchProjectDir, 'openspec', 'changes', 'launch-only-change'), {
        recursive: true,
      })
      await Promise.all([
        writeFile(
          join(launchProjectDir, 'openspec', 'changes', 'launch-only-change', 'proposal.md'),
          '# Change: Launch only\n'
        ),
        writeFile(
          join(launchProjectDir, 'openspec', 'changes', 'launch-only-change', 'tasks.md'),
          '- [ ] Launch task one\n- [ ] Launch task two\n'
        ),
      ])

      const activeChanges = await services.adapter.listChangesWithMeta()
      expect(activeChanges.map((change) => change.id)).toEqual(['created-change'])

      expect(await services.adapter.listArchivedChanges()).toEqual(['planning-only-archive'])

      const dashboard = await services.dashboardOverviewService.getCurrent()
      expect(dashboard.summary).toMatchObject({
        specifications: 3,
        activeChanges: 1,
        tasksTotal: 1,
        tasksCompleted: 0,
      })
      expect(dashboard.specifications.map((specification) => specification.id).sort()).toEqual([
        'created',
        'planning-only',
        'planning-secondary',
      ])
      expect(dashboard.activeChanges.map((change) => change.id)).toEqual(['created-change'])
    })

    await expect(manager.runOperation(({ adapter }) => adapter.listSpecs())).resolves.toContain(
      'created'
    )
    await expect(
      manager.runReactiveOperation(({ adapter }) => adapter.listSpecs())
    ).resolves.toContain('created')
    await expect(manager.runOperation(({ adapter }) => adapter)).rejects.toThrow(
      /operation capability is no longer active/i
    )
    const escaped = await manager.runOperation(({ adapter }) => ({ adapter }))
    expect(() => escaped.adapter.listSpecs()).toThrow(/operation capability is no longer active/i)
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(1)
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledWith(planningRootDir)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledTimes(1)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledWith(planningRootDir)
    expect(trackInvalidation).toHaveBeenCalledWith('project', 'stores', 'context')
    const disposePromise = manager.dispose()
    expect(manager.dispose()).toBe(disposePromise)
    await disposePromise
    expect(releaseObservationRoot).toHaveBeenCalledTimes(1)
    expect(releaseProjectInvalidation).toHaveBeenCalledTimes(1)
  })

  it('runs typed Schema init from the selected Planning root, never the launch project', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-schema-command-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const planningRootDir = join(tempDir, 'planning')
    const runnerPath = join(tempDir, 'schema-runner.mjs')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(planningRootDir, 'openspec', 'schemas'), { recursive: true }),
    ])
    await writeFile(
      runnerPath,
      [
        "import { mkdir, writeFile } from 'node:fs/promises'",
        "import { join } from 'node:path'",
        'const args = process.argv.slice(2)',
        'if (args.includes("--version")) { process.stdout.write("1.6.0"); process.exit(0) }',
        "if (args[0] !== 'schema' || args[1] !== 'init') process.exit(2)",
        'const schemaRoot = join(process.cwd(), "openspec", "schemas", args[2])',
        'await mkdir(schemaRoot, { recursive: true })',
        'await writeFile(join(schemaRoot, "schema.yaml"), `name: ${args[2]}\\n`, "utf8")',
        'await writeFile(join(schemaRoot, "cwd.txt"), process.cwd(), "utf8")',
        'process.stdout.write(JSON.stringify({ created: true }))',
      ].join('\n'),
      'utf8'
    )

    const configManager = new ConfigManager(launchProjectDir)
    await configManager.writeConfig({ cli: { command: `${process.execPath} ${runnerPath}` } })
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    const doctor: CliDoctor = {
      root: { path: planningRootDir, source: 'declared', healthy: true, status: [] },
      store: { id: 'planning', metadata: { present: true, valid: true }, status: [] },
      references: [],
      status: [],
    }
    const context: CliContext = {
      root: { path: planningRootDir, source: 'declared', role: 'openspec_root' },
      members: [],
      status: [],
    }
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockResolvedValue(commandResult(doctor))
    vi.spyOn(cliExecutor.contracts, 'context').mockResolvedValue(commandResult(context))
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment: { acquireRoot: vi.fn(async () => async () => {}) },
      projectInvalidation: { acquireRoot: vi.fn(() => () => {}) },
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    const result = await manager.mutateSchema({ action: 'init', name: 'owned-schema' })

    expect(result?.success, result?.stderr).toBe(true)
    expect(result).toMatchObject({ exitCode: 0 })
    await expect(
      readFile(join(planningRootDir, 'openspec', 'schemas', 'owned-schema', 'schema.yaml'), 'utf8')
    ).resolves.toBe('name: owned-schema\n')
    await expect(
      readFile(join(planningRootDir, 'openspec', 'schemas', 'owned-schema', 'cwd.txt'), 'utf8')
    ).resolves.toBe(realpathSync(planningRootDir))
    await expect(
      readFile(join(launchProjectDir, 'openspec', 'schemas', 'owned-schema', 'schema.yaml'), 'utf8')
    ).rejects.toThrow()

    await manager.dispose()
  })

  it('rejects failed root resolution before any workflow action can be created', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-failed-root-'))
    tempDirs.push(tempDir)
    const configManager = new ConfigManager(tempDir)
    const cliExecutor = new CliExecutor(configManager, tempDir)
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockResolvedValue({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'doctor failed',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    vi.spyOn(cliExecutor.contracts, 'context').mockResolvedValue({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'context failed',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    const workflowStatus = vi.spyOn(cliExecutor.contracts, 'workflowStatus')
    const artifactInstructions = vi.spyOn(cliExecutor.contracts, 'artifactInstructions')
    const applyInstructions = vi.spyOn(cliExecutor.contracts, 'applyInstructions')
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => async () => {}),
    }
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => () => {}),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()

    const manager = new PlanningRootServiceManager({
      launchProjectDir: tempDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    await expect(
      manager.runOperation(() => undefined)
    ).rejects.toMatchObject<PlanningRootUnavailableError>({
      name: 'PlanningRootUnavailableError',
      state: {
        state: 'error',
        error: { code: 'doctor-command-failed', message: 'doctor failed' },
      },
    })
    expect(workflowStatus).not.toHaveBeenCalled()
    expect(artifactInstructions).not.toHaveBeenCalled()
    expect(applyInstructions).not.toHaveBeenCalled()
    expect(observationEnvironment.acquireRoot).not.toHaveBeenCalled()
    expect(projectInvalidation.acquireRoot).not.toHaveBeenCalled()
    expect(manager.readPreviewRequest('missing', '/index.html')).toBeNull()

    await manager.dispose()
  })

  it('replaces services when Store identity changes on the same physical root', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-identity-'))
    tempDirs.push(tempDir)
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    const configManager = new ConfigManager(tempDir)
    const cliExecutor = new CliExecutor(configManager, tempDir)
    let storeId: string | null = null
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult<CliDoctor>({
        root: storeId
          ? {
              path: tempDir,
              source: 'store',
              store_id: storeId,
              healthy: true,
              status: [],
            }
          : { path: tempDir, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult<CliContext>({
        root: storeId
          ? { path: tempDir, source: 'store', store_id: storeId, role: 'openspec_root' }
          : { path: tempDir, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const releases: Array<ReturnType<typeof vi.fn>> = []
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => {
        const release = vi.fn(async () => {})
        releases.push(release)
        return release
      }),
    }
    const invalidationReleases: Array<ReturnType<typeof vi.fn>> = []
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => {
        const release = vi.fn()
        invalidationReleases.push(release)
        return release
      }),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir: tempDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    const nearest = await manager.runOperation(({ rootContext }) => rootContext)
    storeId = 'shared'
    runtimeInvalidation.invalidate(['stores', 'context'])
    const explicitStore = await manager.runOperation(({ rootContext }) => rootContext)

    expect(explicitStore).not.toBe(nearest)
    expect(explicitStore).toMatchObject({
      planningRoot: { path: tempDir, source: 'store' },
      storeId: 'shared',
    })
    expect(releases[0]).toHaveBeenCalledOnce()
    expect(invalidationReleases[0]).toHaveBeenCalledOnce()
    await manager.dispose()
  })

  it('replaces A with B and A again while retiring obsolete leases and previews', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-replacement-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const rootA = join(tempDir, 'root-a')
    const rootB = join(tempDir, 'root-b')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(rootA, 'openspec', 'changes', 'preview'), { recursive: true }),
      mkdir(join(rootB, 'openspec'), { recursive: true }),
    ])
    await writeFile(
      join(rootA, 'openspec', 'changes', 'preview', 'index.html'),
      '<h1>Root A</h1>',
      'utf8'
    )

    const configManager = new ConfigManager(launchProjectDir)
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    let selectedRoot = rootA
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    const doctorRoot = vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    const contextCommand = vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const observationReleases: Array<ReturnType<typeof vi.fn>> = []
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => {
        const release = vi.fn(async () => {})
        observationReleases.push(release)
        return release
      }),
    }
    const invalidationReleases: Array<ReturnType<typeof vi.fn>> = []
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => {
        const release = vi.fn()
        invalidationReleases.push(release)
        return release
      }),
    }
    const kernelDispose = vi.spyOn(OpsxKernel.prototype, 'dispose')
    const hooksDispose = vi.spyOn(ProjectHookRuntime.prototype, 'dispose')
    const searchDispose = vi.spyOn(SearchService.prototype, 'dispose')
    const dashboardDispose = vi.spyOn(DashboardOverviewService.prototype, 'dispose')
    const previewDispose = vi.spyOn(FilePreviewService.prototype, 'dispose')
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    const preview = await manager.runOperation(({ filePreviewService }) =>
      filePreviewService.prepareEntityFilePreview({
        stage: 'change',
        changeId: 'preview',
        path: 'index.html',
      })
    )
    expect(manager.readPreviewRequest(preview.hash, 'index.html')?.content.toString()).toContain(
      'Root A'
    )

    selectedRoot = rootB
    runtimeInvalidation.invalidate(['context'])
    await manager.runOperation(() => undefined)
    expect(observationReleases[0]).toHaveBeenCalledOnce()
    expect(invalidationReleases[0]).toHaveBeenCalledOnce()
    expect(kernelDispose).toHaveBeenCalledTimes(1)
    expect(hooksDispose).toHaveBeenCalledTimes(1)
    expect(searchDispose).toHaveBeenCalledTimes(1)
    expect(dashboardDispose).toHaveBeenCalledTimes(1)
    expect(previewDispose).toHaveBeenCalledTimes(1)
    expect(manager.readPreviewRequest(preview.hash, 'index.html')).toBeNull()

    selectedRoot = rootA
    runtimeInvalidation.invalidate(['context'])
    const secondPreview = await manager.runOperation(({ filePreviewService }) =>
      filePreviewService.prepareEntityFilePreview({
        stage: 'change',
        changeId: 'preview',
        path: 'index.html',
      })
    )
    expect(secondPreview.hash).not.toBe(preview.hash)
    expect(manager.readPreviewRequest(preview.hash, 'index.html')).toBeNull()
    expect(
      manager.readPreviewRequest(secondPreview.hash, 'index.html')?.content.toString()
    ).toContain('Root A')
    expect(observationReleases[1]).toHaveBeenCalledOnce()
    expect(invalidationReleases[1]).toHaveBeenCalledOnce()
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(3)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledTimes(3)

    doctorRoot.mockResolvedValueOnce({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'Planning root disappeared.',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    contextCommand.mockResolvedValueOnce({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'Planning root disappeared.',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    runtimeInvalidation.invalidate(['context'])
    await expect(manager.runOperation(() => undefined)).rejects.toBeInstanceOf(
      PlanningRootUnavailableError
    )
    expect(observationReleases[2]).toHaveBeenCalledOnce()
    expect(invalidationReleases[2]).toHaveBeenCalledOnce()
    expect(manager.readPreviewRequest(preview.hash, 'index.html')).toBeNull()

    await manager.dispose()
    await manager.dispose()
    expect(observationReleases).toHaveLength(3)
    expect(invalidationReleases).toHaveLength(3)
    for (const release of observationReleases) expect(release).toHaveBeenCalledOnce()
    for (const release of invalidationReleases) expect(release).toHaveBeenCalledOnce()
    expect(kernelDispose).toHaveBeenCalledTimes(3)
    expect(hooksDispose).toHaveBeenCalledTimes(3)
    expect(searchDispose).toHaveBeenCalledTimes(3)
    expect(dashboardDispose).toHaveBeenCalledTimes(3)
    expect(previewDispose).toHaveBeenCalledTimes(3)
  })

  it('holds replacement through stream terminal, cancellation, startup failure, and disposal', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-stream-leases-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const roots = ['a', 'b', 'c', 'd', 'e'].map((name) => join(tempDir, `root-${name}`))
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      ...roots.map((root) => mkdir(join(root, 'openspec'), { recursive: true })),
    ])

    const configManager = new ConfigManager(launchProjectDir)
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    let selectedRoot = roots[0]!
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const observationReleases: Array<ReturnType<typeof vi.fn>> = []
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => {
        const release = vi.fn(async () => {})
        observationReleases.push(release)
        return release
      }),
    }
    const invalidationReleases: Array<ReturnType<typeof vi.fn>> = []
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => {
        const release = vi.fn()
        invalidationReleases.push(release)
        return release
      }),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    const streamA = createControlledStreamHandle()
    const handleA = await manager.startOperationStream(({ rootContext }) => {
      expect(rootContext.planningRoot?.path).toBe(roots[0])
      return streamA.handle
    })
    selectedRoot = roots[1]!
    runtimeInvalidation.invalidate(['context'])
    const replacementB = manager.resolveRootContext()
    const bExposedBeforeTerminal = await Promise.race([
      replacementB.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ])
    expect(bExposedBeforeTerminal).toBe(false)
    streamA.settle()
    await expect(replacementB).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: roots[1] } },
    })
    await handleA.cancel()
    await handleA.cancel()
    expect(streamA.cancel).toHaveBeenCalledOnce()

    const streamB = createControlledStreamHandle()
    const handleB = await manager.startOperationStream(({ rootContext }) => {
      expect(rootContext.planningRoot?.path).toBe(roots[1])
      return streamB.handle
    })
    selectedRoot = roots[2]!
    runtimeInvalidation.invalidate(['context'])
    const replacementC = manager.resolveRootContext()
    const cExposedBeforeCancel = await Promise.race([
      replacementC.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ])
    expect(cExposedBeforeCancel).toBe(false)
    const cancellationB = handleB.cancel()
    expect(handleB.cancel()).toBe(cancellationB)
    await cancellationB
    expect(streamB.cancel).toHaveBeenCalledOnce()
    await expect(replacementC).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: roots[2] } },
    })

    const schemaStarted = Promise.withResolvers<void>()
    const resumeSchema = Promise.withResolvers<void>()
    const schemaMutation = vi
      .spyOn(SchemaMutationService.prototype, 'mutate')
      .mockImplementationOnce(async () => {
        schemaStarted.resolve()
        await resumeSchema.promise
        return null
      })
    const schemaWrite = manager.mutateSchema({
      action: 'write-yaml',
      schema: 'demo',
      content: 'name: demo\n',
    })
    await schemaStarted.promise
    selectedRoot = roots[3]!
    runtimeInvalidation.invalidate(['context'])
    const replacementD = manager.resolveRootContext()
    const dExposedBeforeSchema = await Promise.race([
      replacementD.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ])
    expect(dExposedBeforeSchema).toBe(false)
    resumeSchema.resolve()
    await Promise.all([schemaWrite, replacementD])
    schemaMutation.mockRestore()

    await expect(
      manager.startOperationStream(() => {
        throw new Error('stream startup failed')
      })
    ).rejects.toThrow('stream startup failed')
    selectedRoot = roots[4]!
    runtimeInvalidation.invalidate(['context'])
    await expect(manager.resolveRootContext()).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: roots[4] } },
    })

    const streamD = createControlledStreamHandle()
    await manager.startOperationStream(() => streamD.handle)
    const disposal = manager.dispose()
    await disposal
    await manager.dispose()
    expect(streamD.cancel).toHaveBeenCalledOnce()

    expect(observationReleases).toHaveLength(5)
    expect(invalidationReleases).toHaveLength(5)
    for (const release of observationReleases) expect(release).toHaveBeenCalledOnce()
    for (const release of invalidationReleases) expect(release).toHaveBeenCalledOnce()
  })

  it.skipIf(process.platform === 'win32')(
    'keeps A leased until a cancelled real child closes and can no longer write A',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-stream-settlement-'))
      tempDirs.push(tempDir)
      const launchProjectDir = join(tempDir, 'launch')
      const rootA = join(tempDir, 'root-a')
      const rootB = join(tempDir, 'root-b')
      const sentinelPath = join(rootA, 'post-cancel-sentinel.txt')
      const closingPath = join(rootA, 'child-closing.txt')
      await Promise.all([
        mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
        mkdir(join(rootA, 'openspec'), { recursive: true }),
        mkdir(join(rootB, 'openspec'), { recursive: true }),
      ])

      const configManager = new ConfigManager(launchProjectDir)
      await configManager.writeConfig({ cli: { command: process.execPath } })
      const cliExecutor = new CliExecutor(configManager, launchProjectDir)
      let selectedRoot = rootA
      vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
        available: true,
        version: '1.6.0',
      })
      vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
        commandResult({
          root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        })
      )
      vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
        commandResult({
          root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
          members: [],
          status: [],
        })
      )
      const runtimeInvalidation = new RuntimeInvalidationIndex()
      const manager = new PlanningRootServiceManager({
        launchProjectDir,
        previewAssetsDir: join(tempDir, 'preview-assets'),
        configManager,
        cliExecutor,
        observationEnvironment: { acquireRoot: async () => async () => {} },
        projectInvalidation: { acquireRoot: () => () => {} },
        runtimeInvalidation,
        storeObservation: { subscribe: () => () => {} },
        codeBinding: { bindingToken: 'code-binding' },
      })
      const childReady = Promise.withResolvers<void>()
      const childClosing = Promise.withResolvers<void>()
      const childScript = [
        "const { writeFileSync } = require('node:fs')",
        `const sentinel = ${JSON.stringify(sentinelPath)}`,
        `const closing = ${JSON.stringify(closingPath)}`,
        "process.on('SIGTERM', () => {",
        '  setTimeout(() => writeFileSync(sentinel, String(Date.now())), 80)',
        "  setTimeout(() => { writeFileSync(closing, 'closing'); process.stdout.write('closing\\n'); process.exit(0) }, 180)",
        '})',
        "process.stdout.write('ready\\n')",
        'setInterval(() => {}, 1_000)',
      ].join(';')

      const stream = await manager.startOperationStream(({ rootContext }) => {
        const planningRoot = rootContext.planningRoot?.path
        expect(planningRoot).toBe(rootA)
        const rootExecutor = new CliExecutor(configManager, planningRoot!)
        return rootExecutor.executeStream(['-e', childScript], (event) => {
          if (event.type === 'stdout' && event.data?.includes('ready')) childReady.resolve()
          if (event.type === 'stdout' && event.data?.includes('closing')) childClosing.resolve()
        })
      })
      await childReady.promise

      selectedRoot = rootB
      runtimeInvalidation.invalidate(['context'])
      const replacement = manager.resolveRootContext()
      void stream.cancel()
      const firstSettlement = await Promise.race([
        replacement.then(() => 'replacement' as const),
        childClosing.promise.then(() => 'child' as const),
      ])
      const replacementState = await replacement
      const replacementObservedAt = Date.now()
      await vi.waitFor(async () => expect(await readFile(sentinelPath, 'utf8')).toMatch(/^\d+$/), {
        timeout: 2_000,
      })
      const sentinelObservedAt = Number(await readFile(sentinelPath, 'utf8'))
      await manager.dispose()

      expect(firstSettlement).toBe('child')
      expect(replacementState).toMatchObject({
        state: 'ready',
        data: { planningRoot: { path: rootB } },
      })
      expect(replacementObservedAt).toBeGreaterThanOrEqual(sentinelObservedAt)
    }
  )

  it.skipIf(process.platform === 'win32')(
    'cancels retiring A outside a blocked replacement transition and never exposes B during disposal',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-disposal-transition-'))
      tempDirs.push(tempDir)
      const launchProjectDir = join(tempDir, 'launch')
      const rootA = join(tempDir, 'root-a')
      const rootB = join(tempDir, 'root-b')
      await Promise.all([
        mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
        mkdir(join(rootA, 'openspec'), { recursive: true }),
        mkdir(join(rootB, 'openspec'), { recursive: true }),
      ])

      const configManager = new ConfigManager(launchProjectDir)
      await configManager.writeConfig({ cli: { command: process.execPath } })
      const cliExecutor = new CliExecutor(configManager, launchProjectDir)
      let selectedRoot = rootA
      vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
        available: true,
        version: '1.6.0',
      })
      vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
        commandResult({
          root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        })
      )
      vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
        commandResult({
          root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
          members: [],
          status: [],
        })
      )
      const observationRelease = vi.fn(async () => {})
      const invalidationRelease = vi.fn()
      const observationEnvironment: ObservationRootOwner = {
        acquireRoot: vi.fn(async () => observationRelease),
      }
      const projectInvalidation: RuntimeRootInvalidationOwner = {
        acquireRoot: vi.fn(() => invalidationRelease),
      }
      const runtimeInvalidation = new RuntimeInvalidationIndex()
      const manager = new PlanningRootServiceManager({
        launchProjectDir,
        previewAssetsDir: join(tempDir, 'preview-assets'),
        configManager,
        cliExecutor,
        observationEnvironment,
        projectInvalidation,
        runtimeInvalidation,
        storeObservation: { subscribe: () => () => {} },
        codeBinding: { bindingToken: 'code-binding' },
      })
      const childReady = Promise.withResolvers<void>()
      const childClosing = Promise.withResolvers<void>()
      const childScript = [
        "process.on('SIGTERM', () => setTimeout(() => { process.stdout.write('closing\\n'); process.exit(0) }, 80))",
        "process.stdout.write('ready\\n')",
        'setInterval(() => {}, 1_000)',
      ].join(';')
      const stream = await manager.startOperationStream(({ rootContext }) => {
        expect(rootContext.planningRoot?.path).toBe(rootA)
        return new CliExecutor(configManager, rootA).executeStream(['-e', childScript], (event) => {
          if (event.type === 'stdout' && event.data?.includes('ready')) childReady.resolve()
          if (event.type === 'stdout' && event.data?.includes('closing')) childClosing.resolve()
        })
      })
      await childReady.promise

      selectedRoot = rootB
      runtimeInvalidation.invalidate(['context'])
      const replacement = manager.resolveRootContext()
      const bExposedBeforeDisposal = await Promise.race([
        replacement.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
      ])
      expect(bExposedBeforeDisposal).toBe(false)

      const disposal = manager.dispose()
      expect(manager.dispose()).toBe(disposal)
      try {
        const childClosedFromDisposal = await Promise.race([
          childClosing.promise.then(() => true),
          new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
        ])
        expect(childClosedFromDisposal).toBe(true)
        await expect(replacement).resolves.toMatchObject({ state: 'error' })
        await disposal
      } finally {
        void stream.cancel()
        await stream.settled.catch(() => {})
        await disposal.catch(() => {})
      }

      expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(1)
      expect(projectInvalidation.acquireRoot).toHaveBeenCalledTimes(1)
      expect(observationRelease).toHaveBeenCalledOnce()
      expect(invalidationRelease).toHaveBeenCalledOnce()
    }
  )

  it('keeps an already-retiring A blocked after forced rejection and late close', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-forced-termination-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const rootA = join(tempDir, 'root-a')
    const rootB = join(tempDir, 'root-b')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(rootA, 'openspec', 'changes', 'preview-change'), { recursive: true }),
      mkdir(join(rootB, 'openspec'), { recursive: true }),
    ])
    await writeFile(
      join(rootA, 'openspec', 'changes', 'preview-change', 'preview.html'),
      '<h1>Root A</h1>',
      'utf8'
    )

    const configManager = new ConfigManager(launchProjectDir)
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    let selectedRoot = rootA
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const releaseObservationRoot = vi.fn(async () => {})
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => releaseObservationRoot),
    }
    const releaseProjectInvalidation = vi.fn()
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => releaseProjectInvalidation),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })
    const retirementWaitEntered = Promise.withResolvers<void>()
    const managerProbe = manager as unknown as {
      waitForOperations(record: unknown): Promise<void>
    }
    const waitForOperations = managerProbe.waitForOperations.bind(manager)
    vi.spyOn(managerProbe, 'waitForOperations').mockImplementation(async (record) => {
      retirementWaitEntered.resolve()
      await waitForOperations(record)
    })
    const preview = await manager.runOperation(({ filePreviewService }) =>
      filePreviewService.prepareEntityFilePreview({
        stage: 'change',
        changeId: 'preview-change',
        path: 'preview.html',
      })
    )
    expect(manager.readPreviewRequest(preview.hash, 'preview.html')).not.toBeNull()

    const terminal = Promise.withResolvers<CliStreamSettlement>()
    void terminal.promise.catch(() => {})
    const child = new EventEmitter()
    const forcedFailure = new Error('forced termination did not confirm child close')
    let activeChild: EventEmitter | null = child
    const clearActiveChild = vi.fn(() => {
      activeChild = null
    })
    const closeChild = vi.fn(() => {
      if (activeChild !== child) return
      clearActiveChild()
      terminal.resolve({ reason: 'cancelled', exitCode: null })
    })
    child.on('close', closeChild)
    const requestTermination = vi.fn(() => {
      setTimeout(() => terminal.reject(forcedFailure), 0)
    })
    let cancelRequested = false
    const cancel = vi.fn(() => {
      if (!cancelRequested) {
        cancelRequested = true
        requestTermination()
      }
      return terminal.promise
    })
    const stream = await manager.startOperationStream(() => ({
      settled: terminal.promise,
      cancel,
    }))

    selectedRoot = rootB
    runtimeInvalidation.invalidate(['context'])
    const replacement = manager.resolveRootContext()
    void replacement.catch(() => {})
    await retirementWaitEntered.promise
    expect(manager.readPreviewRequest(preview.hash, 'preview.html')).toBeNull()
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(1)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledTimes(1)

    const disposal = manager.dispose()
    expect(manager.dispose()).toBe(disposal)
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())

    const firstFailure = await stream.settled.catch((error: unknown) => error)
    expect(firstFailure).toBe(forcedFailure)
    await expect(
      Promise.race([
        disposal,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('disposal did not reject in bounded time')), 200)
        ),
      ])
    ).rejects.toThrow('Planning-root stream termination failed')

    child.emit('close')
    child.emit('close')
    await Promise.resolve()
    await expect(stream.cancel()).rejects.toBe(firstFailure)
    expect(cancel).toHaveBeenCalledOnce()
    expect(requestTermination).toHaveBeenCalledOnce()
    expect(closeChild).toHaveBeenCalledTimes(2)
    expect(clearActiveChild).toHaveBeenCalledOnce()
    expect(activeChild).toBeNull()
    expect(manager.readPreviewRequest(preview.hash, 'preview.html')).toBeNull()
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(1)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledTimes(1)
    await expect(
      Promise.race([
        replacement.then(() => 'replacement-settled' as const),
        new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 25)),
      ])
    ).resolves.toBe('blocked')
    expect(releaseObservationRoot).not.toHaveBeenCalled()
    expect(releaseProjectInvalidation).not.toHaveBeenCalled()
  })

  it('actively cancels attached streams before repeated disposal retires their root', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-stream-disposal-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const planningRoot = join(tempDir, 'planning')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(planningRoot, 'openspec'), { recursive: true }),
    ])
    const configManager = new ConfigManager(launchProjectDir)
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockResolvedValue(
      commandResult({
        root: { path: planningRoot, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    vi.spyOn(cliExecutor.contracts, 'context').mockResolvedValue(
      commandResult({
        root: { path: planningRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment: { acquireRoot: async () => async () => {} },
      projectInvalidation: { acquireRoot: () => () => {} },
      runtimeInvalidation: new RuntimeInvalidationIndex(),
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })
    const stream = createControlledStreamHandle()
    await manager.startOperationStream(() => stream.handle)

    const firstDisposal = manager.dispose()
    expect(manager.dispose()).toBe(firstDisposal)
    const disposedWithoutExternalTerminal = await Promise.race([
      firstDisposal.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
    ])
    if (!disposedWithoutExternalTerminal) stream.settle()
    await firstDisposal

    expect(disposedWithoutExternalTerminal).toBe(true)
    expect(stream.cancel).toHaveBeenCalledOnce()
  })

  it('retires A before a Root Context subscription exposes B', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-subscription-'))
    tempDirs.push(tempDir)
    const launchProjectDir = join(tempDir, 'launch')
    const rootA = join(tempDir, 'root-a')
    const rootB = join(tempDir, 'root-b')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(rootA, 'openspec', 'changes', 'preview'), { recursive: true }),
      mkdir(join(rootB, 'openspec'), { recursive: true }),
    ])
    await writeFile(
      join(rootA, 'openspec', 'changes', 'preview', 'index.html'),
      '<h1>Root A</h1>',
      'utf8'
    )

    const configManager = new ConfigManager(launchProjectDir)
    const cliExecutor = new CliExecutor(configManager, launchProjectDir)
    let selectedRoot = rootA
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    const doctorRoot = vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    const contextCommand = vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult({
        root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const observationReleases: Array<ReturnType<typeof vi.fn>> = []
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => {
        const release = vi.fn(async () => {})
        observationReleases.push(release)
        return release
      }),
    }
    const invalidationReleases: Array<ReturnType<typeof vi.fn>> = []
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => {
        const release = vi.fn()
        invalidationReleases.push(release)
        return release
      }),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })
    const preview = await manager.runOperation(({ filePreviewService }) =>
      filePreviewService.prepareEntityFilePreview({
        stage: 'change',
        changeId: 'preview',
        path: 'index.html',
      })
    )

    const firstReady = Promise.withResolvers<void>()
    const readyB = Promise.withResolvers<void>()
    const disappeared =
      Promise.withResolvers<Extract<RootContextResolvedState, { state: 'error' }>>()
    const subscription = createRootContextSubscription(manager).subscribe({
      next: (state) => {
        if (state.state === 'error') {
          disappeared.resolve(state)
          return
        }
        if (state.state !== 'ready') return
        if (state.data.planningRoot?.path === rootA) firstReady.resolve()
        if (state.data.planningRoot?.path === rootB) readyB.resolve()
      },
      error: (error) => {
        readyB.reject(error)
        disappeared.reject(error)
      },
    })

    await firstReady.promise
    selectedRoot = rootB
    runtimeInvalidation.invalidate(['context'])
    await readyB.promise

    expect(observationReleases[0]).toHaveBeenCalledOnce()
    expect(invalidationReleases[0]).toHaveBeenCalledOnce()
    expect(manager.readPreviewRequest(preview.hash, 'index.html')).toBeNull()

    doctorRoot.mockResolvedValueOnce({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'Planning root disappeared.',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    contextCommand.mockResolvedValueOnce({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'Planning root disappeared.',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    runtimeInvalidation.invalidate(['context'])
    const errorState = await disappeared.promise
    expect(errorState.error.code).toBe('doctor-command-failed')
    expect(observationReleases[1]).toHaveBeenCalledOnce()
    expect(invalidationReleases[1]).toHaveBeenCalledOnce()

    subscription.unsubscribe()
    await manager.dispose()
  })

  it('releases physical and invalidation roots across replacement and disappearance', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-real-leases-'))
    tempDirs.push(tempDir)
    const rootA = join(tempDir, 'root-a')
    const rootB = join(tempDir, 'root-b')
    await Promise.all([
      mkdir(join(rootA, 'openspec'), { recursive: true }),
      mkdir(join(rootB, 'openspec'), { recursive: true }),
    ])
    const configManager = new ConfigManager(tempDir)
    const cliExecutor = new CliExecutor(configManager, tempDir)
    let selectedRoot = rootA
    let available = true
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      available
        ? commandResult({
            root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
            store: null,
            references: [],
            status: [],
          })
        : {
            success: false,
            stdout: '{"status":[]}',
            stderr: 'Planning root disappeared.',
            exitCode: 1,
            data: null,
            payload: { status: [] },
            diagnostics: [],
          }
    )
    vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
      available
        ? commandResult({
            root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
            members: [],
            status: [],
          })
        : {
            success: false,
            stdout: '{"status":[]}',
            stderr: 'Planning root disappeared.',
            exitCode: 1,
            data: null,
            payload: { status: [] },
            diagnostics: [],
          }
    )
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const observationEnvironment = new ReactiveObservationEnvironment()
    const projectInvalidation = new RuntimeRootInvalidationRegistry(runtimeInvalidation, [
      'project',
      'context',
    ])
    const manager = new PlanningRootServiceManager({
      launchProjectDir: tempDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    await manager.resolveRootContext()
    expect(observationEnvironment.getRoots()).toEqual([
      { rootPath: realpathSync(rootA), referenceCount: 1 },
    ])
    expect(projectInvalidation.getRoots()).toEqual([
      { rootPath: realpathSync(rootA), referenceCount: 1 },
    ])

    selectedRoot = rootB
    runtimeInvalidation.invalidate(['context'])
    await manager.resolveRootContext()
    expect(observationEnvironment.getRoots()).toEqual([
      { rootPath: realpathSync(rootB), referenceCount: 1 },
    ])
    expect(projectInvalidation.getRoots()).toEqual([
      { rootPath: realpathSync(rootB), referenceCount: 1 },
    ])

    available = false
    runtimeInvalidation.invalidate(['context'])
    const missing = await manager.resolveRootContext()
    expect(missing.state).toBe('error')
    expect(observationEnvironment.getRoots()).toEqual([])
    expect(projectInvalidation.getRoots()).toEqual([])
    expect(getActiveWatcherCount()).toBe(0)
    expect(getWatcherRuntimeStatus()).toBeNull()

    const firstDispose = manager.dispose()
    expect(manager.dispose()).toBe(firstDispose)
    await firstDispose
    projectInvalidation.dispose()
    await observationEnvironment.dispose()
    expect(getActiveWatcherCount()).toBe(0)
    expect(getWatcherRuntimeStatus()).toBeNull()
  })

  it('serializes concurrent root transitions in request order', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-services-concurrent-'))
    tempDirs.push(tempDir)
    const rootA = join(tempDir, 'root-a')
    const rootB = join(tempDir, 'root-b')
    await Promise.all([
      mkdir(join(rootA, 'openspec'), { recursive: true }),
      mkdir(join(rootB, 'openspec'), { recursive: true }),
    ])
    const configManager = new ConfigManager(tempDir)
    const cliExecutor = new CliExecutor(configManager, tempDir)
    vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    const firstDoctor = Promise.withResolvers<CliCommandResult<CliDoctor>>()
    const firstContext = Promise.withResolvers<CliCommandResult<CliContext>>()
    const doctorRoot = vi
      .spyOn(cliExecutor.contracts, 'doctorRoot')
      .mockImplementationOnce(() => firstDoctor.promise)
      .mockResolvedValueOnce(
        commandResult({
          root: { path: rootB, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        })
      )
    vi.spyOn(cliExecutor.contracts, 'context')
      .mockImplementationOnce(() => firstContext.promise)
      .mockResolvedValueOnce(
        commandResult({
          root: { path: rootB, source: 'nearest', role: 'openspec_root' },
          members: [],
          status: [],
        })
      )
    const observationEnvironment: ObservationRootOwner = {
      acquireRoot: vi.fn(async () => async () => {}),
    }
    const projectInvalidation: RuntimeRootInvalidationOwner = {
      acquireRoot: vi.fn(() => () => {}),
    }
    const runtimeInvalidation = new RuntimeInvalidationIndex()
    const manager = new PlanningRootServiceManager({
      launchProjectDir: tempDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation,
      storeObservation: { subscribe: () => () => {} },
      codeBinding: { bindingToken: 'code-binding' },
    })

    const resolvingA = manager.runOperation(({ rootContext }) => rootContext)
    await vi.waitFor(() => expect(doctorRoot).toHaveBeenCalledTimes(1))
    runtimeInvalidation.invalidate(['context'])
    const resolvingB = manager.resolveRootContextReactive()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const callsBeforeFirstSettled = doctorRoot.mock.calls.length
    firstDoctor.resolve(
      commandResult({
        root: { path: rootA, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    firstContext.resolve(
      commandResult({
        root: { path: rootA, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )

    const [rootContextA, stateB] = await Promise.all([resolvingA, resolvingB])
    expect(callsBeforeFirstSettled).toBe(1)
    expect(rootContextA.planningRoot?.path).toBe(rootA)
    expect(stateB).toMatchObject({ state: 'ready', data: { planningRoot: { path: rootB } } })
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(2)

    await manager.dispose()
  })
})
