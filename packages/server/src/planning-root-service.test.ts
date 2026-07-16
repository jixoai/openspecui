/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Prove filesystem services read and mutate only the CLI-selected planning root.
 * 2. Prove failed Root Context resolution creates no root-dependent actions.
 * 3. Prove root identity transitions retire services, leases, and preview capabilities before exposure.
 * 4. Prove planning roots own reactive dependencies and leave zero observation/invalidation residue.
 * 5. Prove Change/Archive lists and Dashboard metrics remain scoped to the selected planning root.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
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
  type ObservationRootOwner,
  type RootContextResolvedState,
  type RuntimeRootInvalidationOwner,
} from '@openspecui/core'
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
    expect(trackInvalidation).toHaveBeenCalledWith('project', 'context')
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
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment: { acquireRoot: vi.fn(async () => async () => {}) },
      projectInvalidation: { acquireRoot: vi.fn(() => () => {}) },
      runtimeInvalidation: new RuntimeInvalidationIndex(),
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
    const manager = new PlanningRootServiceManager({
      launchProjectDir: tempDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation: new RuntimeInvalidationIndex(),
    })

    const nearest = await manager.runOperation(({ rootContext }) => rootContext)
    storeId = 'shared'
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
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation: new RuntimeInvalidationIndex(),
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
    const manager = new PlanningRootServiceManager({
      launchProjectDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation: new RuntimeInvalidationIndex(),
    })

    const terminal = Promise.withResolvers<void>()
    const cancelAProcess = vi.fn()
    const cancelA = await manager.startOperationStream(({ rootContext }, settle) => {
      expect(rootContext.planningRoot?.path).toBe(roots[0])
      void terminal.promise.then(settle)
      return cancelAProcess
    })
    selectedRoot = roots[1]!
    const replacementB = manager.resolveRootContext()
    const bExposedBeforeTerminal = await Promise.race([
      replacementB.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ])
    expect(bExposedBeforeTerminal).toBe(false)
    terminal.resolve()
    await expect(replacementB).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: roots[1] } },
    })
    cancelA()
    cancelA()
    expect(cancelAProcess).toHaveBeenCalledOnce()

    const cancelBProcess = vi.fn()
    const cancelB = await manager.startOperationStream(({ rootContext }) => {
      expect(rootContext.planningRoot?.path).toBe(roots[1])
      return cancelBProcess
    })
    selectedRoot = roots[2]!
    const replacementC = manager.resolveRootContext()
    const cExposedBeforeCancel = await Promise.race([
      replacementC.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ])
    expect(cExposedBeforeCancel).toBe(false)
    cancelB()
    cancelB()
    expect(cancelBProcess).toHaveBeenCalledOnce()
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
    await expect(manager.resolveRootContext()).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: roots[4] } },
    })

    const terminalD = Promise.withResolvers<void>()
    await manager.startOperationStream((_services, settle) => {
      void terminalD.promise.then(settle)
      return vi.fn()
    })
    const disposal = manager.dispose()
    const disposedBeforeTerminal = await Promise.race([
      disposal.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ])
    expect(disposedBeforeTerminal).toBe(false)
    terminalD.resolve()
    await disposal
    await manager.dispose()

    expect(observationReleases).toHaveLength(5)
    expect(invalidationReleases).toHaveLength(5)
    for (const release of observationReleases) expect(release).toHaveBeenCalledOnce()
    for (const release of invalidationReleases) expect(release).toHaveBeenCalledOnce()
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
    })

    await manager.resolveRootContext()
    expect(observationEnvironment.getRoots()).toEqual([
      { rootPath: realpathSync(rootA), referenceCount: 1 },
    ])
    expect(projectInvalidation.getRoots()).toEqual([
      { rootPath: realpathSync(rootA), referenceCount: 1 },
    ])

    selectedRoot = rootB
    await manager.resolveRootContext()
    expect(observationEnvironment.getRoots()).toEqual([
      { rootPath: realpathSync(rootB), referenceCount: 1 },
    ])
    expect(projectInvalidation.getRoots()).toEqual([
      { rootPath: realpathSync(rootB), referenceCount: 1 },
    ])

    available = false
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
    const manager = new PlanningRootServiceManager({
      launchProjectDir: tempDir,
      previewAssetsDir: join(tempDir, 'preview-assets'),
      configManager,
      cliExecutor,
      observationEnvironment,
      projectInvalidation,
      runtimeInvalidation: new RuntimeInvalidationIndex(),
    })

    const resolvingA = manager.runOperation(({ rootContext }) => rootContext)
    await vi.waitFor(() => expect(doctorRoot).toHaveBeenCalledTimes(1))
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
