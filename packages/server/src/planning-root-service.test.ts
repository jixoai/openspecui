/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Prove filesystem services read and mutate only the CLI-selected planning root.
 * 2. Prove failed Root Context resolution creates no root-dependent actions.
 * 3. Prove planning-root observation is acquired once per service record and released on teardown.
 * 4. Prove planning roots own project/context invalidation registrations and reactive dependencies.
 * 5. Prove Change/Archive lists and Dashboard metrics remain scoped to the selected planning root.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import {
  CliExecutor,
  ConfigManager,
  RuntimeInvalidationIndex,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type ObservationRootOwner,
  type RuntimeRootInvalidationOwner,
} from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PlanningRootServiceManager,
  PlanningRootUnavailableError,
} from './planning-root-service.js'

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
    const services = await manager.resolve()

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
    await expect(services.adapter.toggleTask('created-change', 1, true)).resolves.toBe(true)
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
    ).resolves.toContain('- [x] First task')
    await expect(
      readFile(
        join(launchProjectDir, 'openspec', 'changes', 'created-change', 'proposal.md'),
        'utf8'
      )
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
      specifications: 2,
      activeChanges: 1,
      tasksTotal: 1,
      tasksCompleted: 1,
    })
    expect(dashboard.specifications.map((specification) => specification.id).sort()).toEqual([
      'planning-only',
      'planning-secondary',
    ])
    expect(dashboard.activeChanges.map((change) => change.id)).toEqual(['created-change'])

    await expect(services.adapter.archiveChange('created-change')).resolves.toBe(true)
    await expect(
      readFile(
        join(planningRootDir, 'openspec', 'changes', 'archive', 'created-change', 'tasks.md'),
        'utf8'
      )
    ).resolves.toContain('- [x] First task')
    await expect(
      readFile(
        join(launchProjectDir, 'openspec', 'changes', 'archive', 'created-change', 'tasks.md'),
        'utf8'
      )
    ).rejects.toThrow()

    expect((await manager.resolve()).adapter).toBe(services.adapter)
    expect((await manager.resolveReactive()).adapter).toBe(services.adapter)
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledTimes(1)
    expect(observationEnvironment.acquireRoot).toHaveBeenCalledWith(planningRootDir)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledTimes(1)
    expect(projectInvalidation.acquireRoot).toHaveBeenCalledWith(planningRootDir)
    expect(trackInvalidation).toHaveBeenCalledWith('project', 'context')
    await manager.dispose()
    expect(releaseObservationRoot).toHaveBeenCalledTimes(1)
    expect(releaseProjectInvalidation).toHaveBeenCalledTimes(1)
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

    await expect(manager.resolve()).rejects.toMatchObject<PlanningRootUnavailableError>({
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
})
