import {
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  OpenSpecAdapter,
  reactiveReadFile,
  RuntimeInvalidationIndex,
} from '@openspecui/core'
import { DEFAULT_BELL_SOUND_ID, DEFAULT_NOTIFICATION_SOUND_ID } from '@openspecui/core/sounds'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardOverviewService } from '../src/dashboard-overview-service.js'
import { loadDashboardOverview } from '../src/dashboard-overview.js'
import { resolveGitWorktreeSwitchTarget } from '../src/git-panel-data.js'
import { sameGitPath } from '../src/git-shared.js'
import type { Context } from '../src/router.js'
import { appRouter } from '../src/router.js'
import { FilePreviewService } from './file-preview-service.js'
import type { PlanningRootServices } from './planning-root-service.js'

function trackedTaskProgress(total: number, completed: number) {
  return createTrackedTaskProgress(
    Array.from({ length: total }, (_, index) => ({
      id: `task-${index + 1}`,
      text: `Task ${index + 1}`,
      completed: index < completed,
      location: { filePath: 'tasks.md', taskIndex: index + 1 },
    }))
  )
}

function documentChecklistSummary() {
  return createDocumentChecklistSummary([])
}

const dashboardGitSnapshotState = vi.hoisted(() => ({
  removeDetachedWorktree: vi.fn().mockResolvedValue(undefined),
  result: {
    defaultBranch: 'origin/main',
    worktrees: [
      {
        path: '/tmp/openspecui-router-test',
        relativePath: '.',
        branchName: 'main',
        detached: false,
        isCurrent: true,
        ahead: 0,
        behind: 0,
        diff: { files: 0, insertions: 0, deletions: 0 },
        entries: [],
      },
    ],
  },
}))

vi.mock('./dashboard-git-snapshot.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dashboard-git-snapshot.js')>()
  return {
    ...actual,
    buildDashboardGitSnapshot: vi
      .fn()
      .mockImplementation(async () => dashboardGitSnapshotState.result),
    removeDetachedDashboardGitWorktree: dashboardGitSnapshotState.removeDetachedWorktree,
  }
})

// Mock adapter
const createMockAdapter = () => ({
  isInitialized: vi.fn().mockResolvedValue(true),
  listSpecs: vi.fn().mockResolvedValue(['auth', 'api']),
  listSpecsWithMeta: vi.fn().mockResolvedValue([
    { id: 'auth', name: 'Authentication', createdAt: 1, updatedAt: 20 },
    { id: 'api', name: 'Public API', createdAt: 1, updatedAt: 10 },
  ]),
  listChanges: vi.fn().mockResolvedValue(['add-caching']),
  listChangesWithMeta: vi.fn().mockResolvedValue([
    {
      id: 'add-caching',
      name: 'Add Caching',
      trackedTaskProgress: trackedTaskProgress(0, 0),
      documentChecklistSummary: documentChecklistSummary(),
      createdAt: 1,
      updatedAt: 30,
    },
  ]),
  listArchivedChanges: vi.fn().mockResolvedValue(['old-change']),
  listArchivedChangesWithMeta: vi.fn().mockResolvedValue([
    {
      id: 'old-change',
      name: 'Old Change',
      trackedTaskProgress: trackedTaskProgress(1, 1),
      documentChecklistSummary: documentChecklistSummary(),
      createdAt: 1,
      updatedAt: 1,
    },
  ]),
  readArchivedChangeFiles: vi.fn().mockResolvedValue([
    { path: '.openspec.yaml', type: 'file', content: 'schema: custom-audit\n' },
    { path: 'reports/summary.md', type: 'file', content: '# Summary\n' },
  ]),
  readArchivedChange: vi.fn().mockResolvedValue({
    id: 'old-change',
    name: 'Old Change',
    why: 'why',
    whatChanges: 'what',
    deltas: [],
    trackedTaskProgress: trackedTaskProgress(1, 1),
    documentChecklistSummary: documentChecklistSummary(),
  }),
  readSpec: vi.fn().mockImplementation(async (id: string) => {
    if (id === 'api') {
      return {
        id: 'api',
        name: 'Public API',
        overview: 'API spec',
        requirements: [
          {
            id: 'r-1',
            title: 'one',
            bodyMarkdown: 'one',
            text: 'one',
            scenarios: [{ title: 's', bodyMarkdown: 's', rawText: 's\ns' }],
          },
        ],
      }
    }
    return {
      id: 'auth',
      name: 'Authentication',
      overview: 'Auth spec',
      requirements: [
        {
          id: 'r-1',
          title: 'one',
          bodyMarkdown: 'one',
          text: 'one',
          scenarios: [{ title: 's', bodyMarkdown: 's', rawText: 's\ns' }],
        },
        {
          id: 'r-2',
          title: 'two',
          bodyMarkdown: 'two',
          text: 'two',
          scenarios: [{ title: 's', bodyMarkdown: 's', rawText: 's\ns' }],
        },
      ],
    }
  }),
  readSpecRaw: vi.fn().mockResolvedValue('# Auth\n## Purpose\nAuth spec'),
  readChange: vi.fn().mockResolvedValue({
    id: 'add-caching',
    name: 'Add Caching',
    why: 'Performance improvement',
    whatChanges: 'Add Redis',
    deltas: [],
    trackedTaskProgress: trackedTaskProgress(0, 0),
    documentChecklistSummary: documentChecklistSummary(),
  }),
  readChangeRaw: vi.fn().mockResolvedValue({ proposal: '# Add Caching', tasks: '' }),
  readChangeTaskProjection: vi.fn().mockResolvedValue({
    trackedTaskProgress: createTrackedTaskProgress(
      [
        {
          id: 'task-1',
          text: 'Backend',
          completed: false,
          location: { filePath: 'work/backend/tasks.md', taskIndex: 1 },
        },
        {
          id: 'task-2',
          text: 'Backend follow-up',
          completed: false,
          location: { filePath: 'work/backend/tasks.md', taskIndex: 2 },
        },
      ],
      {
        kind: 'artifact',
        artifactId: 'work',
        outputPath: 'work/**/*.md',
        filePaths: ['work/backend/tasks.md'],
      }
    ),
    documentChecklistSummary: documentChecklistSummary(),
  }),
  writeSpec: vi.fn().mockResolvedValue(undefined),
  writeChange: vi.fn().mockResolvedValue(undefined),
  writeEntityFile: vi.fn().mockResolvedValue(undefined),
  validateSpec: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
  validateChange: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
  init: vi.fn().mockResolvedValue(undefined),
  getDashboardData: vi.fn().mockResolvedValue(undefined),
})

function createMockProjectRecoveryService(
  status: Context['projectRecoveryService']['getCurrent'] extends () => infer T ? T : never = {
    state: 'idle',
  }
): Context['projectRecoveryService'] {
  return {
    getCurrent: vi.fn(() => status),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  } as unknown as Context['projectRecoveryService']
}

const tempDirs: string[] = []
const execFileAsync = promisify(execFile)

async function createTempProjectDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024,
    encoding: 'utf8',
  })
  return stdout.trim()
}

async function initGitRepo(dir: string): Promise<void> {
  await runGit(dir, ['init'])
  await runGit(dir, ['config', 'user.name', 'OpenSpecUI Test'])
  await runGit(dir, ['config', 'user.email', 'test@openspecui.local'])
  await writeFile(join(dir, 'README.md'), 'init\n', 'utf8')
  await runGit(dir, ['add', 'README.md'])
  await runGit(dir, ['commit', '-m', 'init'])
}

async function writeGitFile(cwd: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = join(cwd, relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (!dir) continue
    await rm(dir, { recursive: true, force: true })
  }
})

const createMockContext = (
  adapter = createMockAdapter(),
  options: {
    projectDir?: string
    gitWorktreeHandoff?: Context['gitWorktreeHandoff']
    projectRecoveryService?: Context['projectRecoveryService']
  } = {}
): Context => {
  const configManager = {
    readConfig: vi.fn().mockResolvedValue({
      cli: {},
      theme: 'system',
      codeEditor: {
        theme: 'github',
      },
      opsx: {
        agentInvocationMode: 'compose',
      },
      terminal: {
        fontSize: 13,
        fontFamily: '',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        useTheme: 'app',
        lightTheme: 'default-light',
        darkTheme: 'default-dark',
        rendererEngine: 'xterm',
        bellSound: DEFAULT_BELL_SOUND_ID,
      },
      dashboard: { trendPointLimit: 100 },
      git: { diffEagerLineBudget: 1000 },
      notifications: { sound: DEFAULT_NOTIFICATION_SOUND_ID, systemNotificationsEnabled: false },
      translation: {
        enabled: false,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
      },
    }),
    setCliCommand: vi.fn().mockResolvedValue(undefined),
    writeConfig: vi.fn().mockResolvedValue(undefined),
    getCliCommandString: vi.fn().mockResolvedValue('openspec'),
  }

  const cliExecutor = {
    checkAvailability: vi.fn().mockResolvedValue({ available: true }),
    init: vi.fn().mockResolvedValue({ success: true }),
    archive: vi.fn().mockResolvedValue({ success: true }),
    validate: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
    contracts: {
      archive: vi.fn().mockResolvedValue({ success: true }),
      validate: vi.fn().mockResolvedValue({ success: true }),
      doctorRoot: vi.fn().mockResolvedValue({
        success: true,
        stdout: JSON.stringify({
          root: {
            path: '/tmp/openspecui-router-test',
            source: 'nearest',
            healthy: true,
            status: [],
          },
          store: null,
          references: [],
          status: [],
        }),
        stderr: '',
        exitCode: 0,
        data: {
          root: {
            path: '/tmp/openspecui-router-test',
            source: 'nearest',
            healthy: true,
            status: [],
          },
          store: null,
          references: [],
          status: [],
        },
        payload: {
          root: {
            path: '/tmp/openspecui-router-test',
            source: 'nearest',
            healthy: true,
            status: [],
          },
          store: null,
          references: [],
          status: [],
        },
        diagnostics: [],
      }),
      context: vi.fn().mockResolvedValue({
        success: true,
        stdout: JSON.stringify({
          root: {
            path: '/tmp/openspecui-router-test',
            source: 'nearest',
            role: 'openspec_root',
          },
          members: [],
          status: [],
        }),
        stderr: '',
        exitCode: 0,
        data: {
          root: {
            path: '/tmp/openspecui-router-test',
            source: 'nearest',
            role: 'openspec_root',
          },
          members: [],
          status: [],
        },
        payload: {
          root: {
            path: '/tmp/openspecui-router-test',
            source: 'nearest',
            role: 'openspec_root',
          },
          members: [],
          status: [],
        },
        diagnostics: [],
      }),
      showSpec: vi.fn(),
      listStores: vi.fn().mockResolvedValue({
        success: true,
        stdout: '{"stores":[],"status":[]}',
        stderr: '',
        exitCode: 0,
        data: { stores: [], status: [] },
        payload: { stores: [], status: [] },
        diagnostics: [],
      }),
      doctorStores: vi.fn().mockResolvedValue({
        success: true,
        stdout: '{"stores":[],"status":[]}',
        stderr: '',
        exitCode: 0,
        data: { stores: [], status: [] },
        payload: { stores: [], status: [] },
        diagnostics: [],
      }),
    },
    execute: vi.fn().mockResolvedValue({ success: true, stdout: '{}', stderr: '', exitCode: 0 }),
    initStream: vi.fn(),
    archiveStream: vi.fn(),
    validateStream: vi.fn(),
    executeCommandStream: vi.fn(),
  }

  const kernel = {
    waitForWarmup: vi.fn().mockResolvedValue(undefined),
    ensureStatusList: vi.fn().mockResolvedValue(undefined),
    getStatusList: vi.fn().mockReturnValue([]),
    ensureApplyInstructions: vi.fn().mockResolvedValue(undefined),
    getApplyInstructions: vi.fn().mockReturnValue({
      applyInstructionProgress: {
        source: 'openspec-instructions-apply',
        total: 0,
        complete: 0,
        remaining: 0,
        state: 'all_done',
        divergence: null,
      },
    }),
    ensureArtifactOutput: vi.fn().mockResolvedValue(undefined),
    getArtifactOutput: vi.fn().mockReturnValue('# Source artifact'),
    ensureGlobArtifactFiles: vi.fn().mockResolvedValue(undefined),
    getGlobArtifactFiles: vi
      .fn()
      .mockReturnValue([
        { path: 'specs/auth/spec.md', type: 'file', content: '# Source delta spec' },
      ]),
    ensureSchemaDetail: vi.fn().mockResolvedValue(undefined),
    ensureSchemaYaml: vi.fn().mockResolvedValue(undefined),
    getSchemaDetail: vi.fn().mockReturnValue({
      name: 'custom-audit',
      artifacts: [{ id: 'summary', outputPath: 'reports/summary.md', requires: [] }],
      applyRequires: [],
    }),
    getSchemaYaml: vi.fn().mockReturnValue(`
name: custom-audit
artifacts:
  - id: summary
    generates: reports/summary.md
  - id: broken
    futureOutput:
      path: reports/broken.md
`),
  }

  const searchService = {
    query: vi.fn().mockResolvedValue({ total: 0, hits: [] }),
    queryReactive: vi.fn().mockResolvedValue({ total: 0, hits: [] }),
  }
  const documentService = {
    readSpec: vi.fn((id: string) => adapter.readSpec(id)),
    readSpecRaw: vi.fn(async (id: string) => {
      const markdown = await adapter.readSpecRaw(id)
      return markdown === null ? null : { markdown }
    }),
    readChange: vi.fn((id: string) => adapter.readChange(id)),
    readArchivedChange: vi.fn((id: string) => adapter.readArchivedChange(id)),
    readEntityDetail: vi.fn().mockResolvedValue({
      stage: 'archive',
      id: 'old-change',
      exists: true,
      schemaName: 'custom-audit',
      files: [{ path: 'reports/summary.md', type: 'file', content: '# Summary\n' }],
      artifacts: [],
      ungroupedFiles: [{ path: 'reports/summary.md', type: 'file', content: '# Summary\n' }],
      diagnostics: [],
    }),
    readChangeArtifactOutput: vi.fn().mockResolvedValue('# Processed artifact'),
    readChangeGlobArtifactFiles: vi
      .fn()
      .mockResolvedValue([
        { path: 'specs/auth/spec.md', type: 'file', content: '# Processed delta spec' },
      ]),
  }
  const workflowInvocationService = {
    runWorkflow: vi.fn(),
  }
  const notificationService = {
    list: vi.fn().mockReturnValue([]),
    subscribe: vi.fn(() => () => undefined),
    publish: vi.fn(),
    markRead: vi.fn(),
    markManyRead: vi.fn(),
    clearGroup: vi.fn(),
    clearTerminalSession: vi.fn(),
    clearAll: vi.fn(),
  }
  const customSoundService = {
    listAvailable: vi.fn().mockResolvedValue([]),
    rename: vi.fn(),
    remove: vi.fn(),
  }

  const projectDir = options.projectDir ?? '/tmp/openspecui-router-test'
  const filePreviewService = new FilePreviewService(projectDir, join(projectDir, '.preview-assets'))
  const dashboardOverviewService = new DashboardOverviewService((reason) =>
    loadDashboardOverview(
      {
        adapter: adapter as unknown as PlanningRootServices['adapter'],
        configManager: configManager as unknown as Context['configManager'],
        projectDir,
      },
      reason
    )
  )
  const rootContext = {
    launchProject: { path: projectDir },
    planningRoot: {
      path: projectDir,
      source: 'nearest' as const,
      healthy: true,
      status: [],
    },
    storeId: null,
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: join(projectDir, '.openspec-data'),
      source: 'user-home-default' as const,
      environmentVariable: null,
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
  const planningRootServices = {
    rootContext,
    adapter: adapter as unknown as PlanningRootServices['adapter'],
    documentService: documentService as unknown as PlanningRootServices['documentService'],
    kernel: kernel as unknown as PlanningRootServices['kernel'],
    filePreviewService,
    searchService: searchService as unknown as PlanningRootServices['searchService'],
    dashboardOverviewService,
    workflowInvocationService:
      workflowInvocationService as unknown as PlanningRootServices['workflowInvocationService'],
  } satisfies PlanningRootServices
  const runtimeInvalidation = new RuntimeInvalidationIndex()
  const storeObservation = {
    reconcile: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  }

  return {
    launchProjectAdapter: adapter as unknown as Context['launchProjectAdapter'],
    planningRootServices: {
      resolve: vi.fn().mockResolvedValue(planningRootServices),
      resolveReactive: vi.fn().mockResolvedValue(planningRootServices),
      readPreviewRequest: vi.fn().mockReturnValue(null),
      dispose: vi.fn().mockResolvedValue(undefined),
    },
    runtimeInvalidation,
    storeObservation,
    configManager: configManager as unknown as Context['configManager'],
    cliExecutor: cliExecutor as unknown as Context['cliExecutor'],
    projectRecoveryService: options.projectRecoveryService ?? createMockProjectRecoveryService(),
    notificationService: notificationService as unknown as Context['notificationService'],
    customSoundService: customSoundService as unknown as Context['customSoundService'],
    globalSettingsManager: {
      readSettings: vi.fn().mockResolvedValue({ translationCache: { entryLimit: 10000 } }),
      writeSettings: vi.fn().mockResolvedValue(undefined),
    } as unknown as Context['globalSettingsManager'],
    translationCacheService: {
      getStats: vi.fn().mockResolvedValue({ enabled: false, entryLimit: 10000, entries: 0 }),
      read: vi.fn().mockResolvedValue(null),
      write: vi.fn().mockResolvedValue({ accepted: false }),
      clean: vi.fn().mockResolvedValue({ before: 0, after: 0, deleted: 0 }),
      clear: vi.fn().mockResolvedValue({ deleted: 0 }),
      close: vi.fn(),
    } as unknown as Context['translationCacheService'],
    gitWorktreeHandoff: options.gitWorktreeHandoff,
    watcher: undefined,
    projectDir,
  }
}

function resolveMockPlanningRoot(context: Context): Promise<PlanningRootServices> {
  return context.planningRootServices.resolve()
}

const createCaller = (
  adapter = createMockAdapter(),
  options: {
    projectDir?: string
    gitWorktreeHandoff?: Context['gitWorktreeHandoff']
    projectRecoveryService?: Context['projectRecoveryService']
  } = {}
) => {
  return appRouter.createCaller({
    ...createMockContext(adapter, options),
  })
}

describe('appRouter', () => {
  describe('root context', () => {
    it('exposes the shared CLI-owned Root Context projection', async () => {
      const caller = createCaller()
      const state = await caller.rootContext.get()

      expect(state.state).toBe('ready')
      if (state.state !== 'ready') return
      expect(state.data.launchProject.path).toBe('/tmp/openspecui-router-test')
      expect(state.data.planningRoot).toMatchObject({
        path: '/tmp/openspecui-router-test',
        source: 'nearest',
      })
    })
  })

  describe('runtime invalidation', () => {
    it('pushes identity-only tokens and lets the client pull the Store projection', async () => {
      const context = createMockContext()
      const observable = await appRouter.createCaller(context).runtimeInvalidation.subscribe({
        facets: ['stores'],
      })
      const first = Promise.withResolvers<void>()
      const second = Promise.withResolvers<void>()
      let emissionCount = 0
      let firstTokens: unknown
      let secondTokens: unknown
      const subscription = observable.subscribe({
        next: (tokens) => {
          emissionCount += 1
          if (emissionCount === 1) {
            firstTokens = tokens
            first.resolve()
          }
          if (emissionCount === 2) {
            secondTokens = tokens
            second.resolve()
          }
        },
        error: second.reject,
      })

      await first.promise
      ;(context.runtimeInvalidation as RuntimeInvalidationIndex).invalidate(['stores'])
      await second.promise

      expect(firstTokens).toEqual([{ facet: 'stores', generation: 0 }])
      expect(secondTokens).toEqual([{ facet: 'stores', generation: 1 }])
      expect(context.cliExecutor.contracts.listStores).not.toHaveBeenCalled()
      await appRouter.createCaller(context).stores.list()
      expect(context.cliExecutor.contracts.listStores).toHaveBeenCalledTimes(1)
      expect(context.storeObservation.reconcile).toHaveBeenCalledTimes(1)
      subscription.unsubscribe()
    })

    it('retains the observed Store-root set when the CLI list attempt fails', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.stores.list()
      vi.mocked(context.cliExecutor.contracts.listStores).mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'registry unavailable',
        exitCode: 1,
        data: null,
        payload: null,
        diagnostics: [],
      })
      const failed = await caller.stores.list()

      expect(failed.available).toBe(false)
      expect(context.storeObservation.reconcile).toHaveBeenCalledTimes(1)
    })

    it('projects lenient Store data from typed payload and preserves complete evidence', async () => {
      const context = createMockContext()
      const evidence = {
        success: true,
        stdout: 'typed executor already parsed this document',
        stderr: 'upstream warning',
        exitCode: 0,
        data: null,
        payload: {
          stores: [{ id: 'team', root: '/stores/team', future: true }],
        },
        diagnostics: [],
        contractError: 'status: Required',
      }
      vi.mocked(context.cliExecutor.contracts.listStores).mockResolvedValueOnce(evidence)

      const result = await appRouter.createCaller(context).stores.list()

      expect(result).toMatchObject({
        available: true,
        stores: [{ id: 'team', root: '/stores/team', future: true }],
        evidence,
      })
      expect(context.storeObservation.reconcile).toHaveBeenCalledWith([
        { id: 'team', root: '/stores/team', future: true },
      ])
    })

    it('projects partial doctor facts from typed payload without reparsing stdout', async () => {
      const context = createMockContext()
      const evidence = {
        success: true,
        stdout: 'typed executor already parsed this document',
        stderr: '',
        exitCode: 0,
        data: null,
        payload: {
          stores: [
            {
              id: 'empty',
              root: '/stores/empty',
              openspec_root: { present: true, healthy: true },
            },
          ],
        },
        diagnostics: [],
        contractError: 'metadata: Required',
      }
      vi.mocked(context.cliExecutor.contracts.doctorStores).mockResolvedValueOnce(evidence)

      await expect(
        appRouter.createCaller(context).stores.doctor({ id: '' })
      ).resolves.toMatchObject({
        available: true,
        stores: [{ id: 'empty', openspec_root: { present: true, healthy: true } }],
        evidence,
      })
      expect(context.cliExecutor.contracts.doctorStores).toHaveBeenCalledWith('')
    })

    it('does not attach a Store polling timer to each invalidation subscriber', async () => {
      vi.useFakeTimers()
      try {
        const context = createMockContext()
        const observable = await appRouter.createCaller(context).runtimeInvalidation.subscribe({
          facets: ['stores'],
        })
        const listener = vi.fn()
        const subscription = observable.subscribe({ next: listener })

        expect(listener).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(15_000)
        expect(listener).toHaveBeenCalledTimes(1)
        subscription.unsubscribe()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('planning config ownership', () => {
    it('keeps launch Project Binding and external Active Root writes physically separate', async () => {
      const tempDir = await createTempProjectDir('openspecui-router-planning-config-')
      const launchProject = join(tempDir, 'launch')
      const planningRoot = join(tempDir, 'planning')
      await Promise.all([
        mkdir(join(launchProject, 'openspec'), { recursive: true }),
        mkdir(join(planningRoot, 'openspec'), { recursive: true }),
      ])
      await Promise.all([
        writeFile(join(launchProject, 'openspec', 'config.yaml'), 'schema: launch\n', 'utf8'),
        writeFile(join(planningRoot, 'openspec', 'config.yaml'), 'schema: old\n', 'utf8'),
      ])
      const context = createMockContext(createMockAdapter(), { projectDir: launchProject })
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        launchProject: { path: launchProject },
        planningRoot: {
          path: planningRoot,
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
      }
      const caller = appRouter.createCaller(context)

      const binding = await caller.planningConfig.updateProjectBinding({
        store: 'shared',
        references: [{ id: 'platform' }],
      })
      const active = await caller.planningConfig.activeRoot()
      await caller.planningConfig.writeActiveRoot({ content: 'schema: active\n' })

      expect(binding.kind).toBe('project-binding')
      expect(binding.owner.path).toBe(launchProject)
      expect(binding.binding.store).toEqual({ state: 'declared', id: 'shared' })
      expect(active.owner).toMatchObject({
        path: planningRoot,
        source: 'store',
        storeId: 'shared',
        externalToLaunchProject: true,
      })
      await expect(
        readFile(join(launchProject, 'openspec', 'config.yaml'), 'utf8')
      ).resolves.toMatch(/schema: launch[\s\S]*store: shared/)
      await expect(readFile(join(planningRoot, 'openspec', 'config.yaml'), 'utf8')).resolves.toBe(
        'schema: active\n'
      )
    })
  })

  describe('system', () => {
    it('should return runtime status', async () => {
      const caller = createCaller()
      const status = await caller.system.status()

      expect(status.projectDir).toBe('/tmp/openspecui-router-test')
      expect(typeof status.watcherEnabled).toBe('boolean')
      expect(typeof status.watcherRootCount).toBe('number')
      expect(typeof status.watcherSubscriptionCount).toBe('number')
      expect(Array.isArray(status.watcherRoots)).toBe(true)
      expect(status.projectRecovery).toEqual({ state: 'idle' })
    })
  })

  describe('entity file preview platform', () => {
    it('writes entity and artifact files only inside the selected planning root', async () => {
      const tempDir = await createTempProjectDir('openspecui-router-separated-write-')
      const launchProject = join(tempDir, 'launch')
      const planningRoot = join(tempDir, 'planning')
      await Promise.all([
        mkdir(join(launchProject, 'openspec', 'changes', 'mutation-demo', 'work', 'backend'), {
          recursive: true,
        }),
        mkdir(join(planningRoot, 'openspec', 'changes', 'mutation-demo', 'work', 'backend'), {
          recursive: true,
        }),
        mkdir(join(planningRoot, 'openspec', 'changes', 'archive', 'archived-demo'), {
          recursive: true,
        }),
        mkdir(join(planningRoot, 'openspec', 'schemas', 'vision-driven'), { recursive: true }),
      ])
      const trackedTasks = '- [ ] Backend\n- [ ] Backend follow-up\n'
      await Promise.all([
        writeFile(
          join(
            launchProject,
            'openspec',
            'changes',
            'mutation-demo',
            'work',
            'backend',
            'tasks.md'
          ),
          trackedTasks,
          'utf8'
        ),
        writeFile(
          join(planningRoot, 'openspec', 'changes', 'mutation-demo', 'work', 'backend', 'tasks.md'),
          trackedTasks,
          'utf8'
        ),
        writeFile(
          join(planningRoot, 'openspec', 'changes', 'mutation-demo', '.openspec.yaml'),
          'schema: vision-driven\n',
          'utf8'
        ),
        writeFile(
          join(planningRoot, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
          `name: vision-driven
artifacts:
  - id: work
    generates: work/**/*.md
apply:
  tracks: work/**/*.md
`,
          'utf8'
        ),
      ])
      const context = createMockContext(createMockAdapter(), { projectDir: launchProject })
      const planning = await resolveMockPlanningRoot(context)
      planning.adapter = new OpenSpecAdapter(planningRoot)
      planning.rootContext = {
        ...planning.rootContext,
        launchProject: { path: launchProject },
        planningRoot: {
          path: planningRoot,
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
      }
      const caller = appRouter.createCaller(context)
      const changeNotePath = join(
        planningRoot,
        'openspec',
        'changes',
        'mutation-demo',
        'notes',
        'change.md'
      )
      const artifactPath = join(
        planningRoot,
        'openspec',
        'changes',
        'mutation-demo',
        'artifacts',
        'output.md'
      )
      const archiveNotePath = join(
        planningRoot,
        'openspec',
        'changes',
        'archive',
        'archived-demo',
        'notes',
        'archive.md'
      )
      expect(await reactiveReadFile(changeNotePath)).toBeNull()
      expect(await reactiveReadFile(artifactPath)).toBeNull()
      expect(await reactiveReadFile(archiveNotePath)).toBeNull()

      await caller.change.writeFile({
        id: 'mutation-demo',
        path: 'notes/change.md',
        content: '# Change note\n',
      })
      await caller.opsx.writeArtifactOutput({
        changeId: 'mutation-demo',
        outputPath: 'artifacts/output.md',
        content: '# Artifact\n',
      })
      await caller.archive.writeFile({
        id: 'archived-demo',
        path: 'notes/archive.md',
        content: '# Archive note\n',
      })
      await caller.change.toggleTask({
        changeId: 'mutation-demo',
        location: { filePath: 'work/backend/tasks.md', taskIndex: 2 },
        completed: true,
      })

      expect(await reactiveReadFile(changeNotePath)).toBe('# Change note\n')
      expect(await reactiveReadFile(artifactPath)).toBe('# Artifact\n')
      expect(await reactiveReadFile(archiveNotePath)).toBe('# Archive note\n')

      await expect(
        readFile(
          join(planningRoot, 'openspec', 'changes', 'mutation-demo', 'notes', 'change.md'),
          'utf8'
        )
      ).resolves.toBe('# Change note\n')
      await expect(
        readFile(
          join(planningRoot, 'openspec', 'changes', 'mutation-demo', 'artifacts', 'output.md'),
          'utf8'
        )
      ).resolves.toBe('# Artifact\n')
      await expect(
        readFile(
          join(
            planningRoot,
            'openspec',
            'changes',
            'archive',
            'archived-demo',
            'notes',
            'archive.md'
          ),
          'utf8'
        )
      ).resolves.toBe('# Archive note\n')
      await expect(
        readFile(
          join(planningRoot, 'openspec', 'changes', 'mutation-demo', 'work', 'backend', 'tasks.md'),
          'utf8'
        )
      ).resolves.toBe('- [ ] Backend\n- [x] Backend follow-up\n')

      await expect(
        readFile(
          join(launchProject, 'openspec', 'changes', 'mutation-demo', 'notes', 'change.md'),
          'utf8'
        )
      ).rejects.toThrow()
      await expect(
        readFile(
          join(
            launchProject,
            'openspec',
            'changes',
            'mutation-demo',
            'work',
            'backend',
            'tasks.md'
          ),
          'utf8'
        )
      ).resolves.toBe(trackedTasks)
      await expect(
        readFile(
          join(launchProject, 'openspec', 'changes', 'mutation-demo', 'artifacts', 'output.md'),
          'utf8'
        )
      ).rejects.toThrow()
      await expect(
        readFile(
          join(
            launchProject,
            'openspec',
            'changes',
            'archive',
            'archived-demo',
            'notes',
            'archive.md'
          ),
          'utf8'
        )
      ).rejects.toThrow()

      await expect(
        caller.opsx.writeArtifactOutput({
          changeId: 'mutation-demo',
          outputPath: '../escaped.md',
          content: 'nope',
        })
      ).rejects.toThrow(/escaped entity root|path/i)
      await expect(
        caller.change.toggleTask({
          changeId: 'mutation-demo',
          location: { filePath: '../escaped.md', taskIndex: 1 },
          completed: true,
        })
      ).rejects.toThrow(/escaped entity root|path/i)
      await expect(
        caller.change.toggleTask({
          changeId: '../escaped-change',
          location: { filePath: 'tasks.md', taskIndex: 1 },
          completed: true,
        })
      ).rejects.toThrow(/invalid changeId|escaped entity root|path/i)
      await expect(
        caller.change.toggleTask({
          changeId: 'nested/../mutation-demo',
          location: { filePath: 'work/backend/tasks.md', taskIndex: 1 },
          completed: true,
        })
      ).rejects.toThrow(/invalid changeId/i)
      await expect(
        caller.change.toggleTask({
          changeId: 'mutation-demo',
          location: { filePath: 'notes/not-tracked.md', taskIndex: 1 },
          completed: true,
        })
      ).rejects.toThrow(/not part of the current tracked artifact projection/i)
    })

    it('writes change entity files through a guarded relative path', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-change-file-')
      await mkdir(join(projectDir, 'openspec', 'changes', 'preview-demo'), { recursive: true })
      const caller = createCaller(
        new OpenSpecAdapter(projectDir) as unknown as ReturnType<typeof createMockAdapter>,
        { projectDir }
      )

      await caller.change.writeFile({
        id: 'preview-demo',
        path: 'notes/demo.md',
        content: '# Demo\n',
      })

      await expect(
        readFile(
          join(projectDir, 'openspec', 'changes', 'preview-demo', 'notes', 'demo.md'),
          'utf8'
        )
      ).resolves.toBe('# Demo\n')
    })

    it('rejects entity file writes that try to escape the change root', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-change-escape-')
      await mkdir(join(projectDir, 'openspec', 'changes', 'preview-demo'), { recursive: true })
      const caller = createCaller(
        new OpenSpecAdapter(projectDir) as unknown as ReturnType<typeof createMockAdapter>,
        { projectDir }
      )

      await expect(
        caller.change.writeFile({
          id: 'preview-demo',
          path: '../escape.md',
          content: 'nope',
        })
      ).rejects.toThrow(/escaped entity root|path/i)
    })

    it('prepares preview URLs for supported change files', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-change-preview-')
      const changeDir = join(projectDir, 'openspec', 'changes', 'preview-demo')
      await mkdir(join(changeDir, 'site'), { recursive: true })
      await writeFile(join(changeDir, 'site', 'index.html'), '<!doctype html><h1>demo</h1>', 'utf8')

      const caller = createCaller(createMockAdapter(), { projectDir })
      const preview = await caller.change.prepareFilePreview({
        id: 'preview-demo',
        path: 'site/index.html',
      })

      expect(preview.previewKind).toBe('html')
      expect(preview.mime).toBe('text/html')
      expect(preview.resourcePathname).toBeNull()
      expect(preview.entryPathname).toContain('/index.html')
      expect(preview.urlPath).toContain('/index.html')
    })

    it('subscribes archive folder files from source content', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const documentService = planning.documentService as unknown as {
        readArchivedChangeFiles: ReturnType<typeof vi.fn>
      }
      documentService.readArchivedChangeFiles = vi
        .fn()
        .mockResolvedValue([
          { path: 'reports/summary.md', type: 'file', content: '# Source summary\n' },
        ])

      const subscription = appRouter.createCaller(context).archive.subscribeFiles
      const observable = await subscription({ id: 'old-change' })

      const onData = vi.fn()
      const onError = vi.fn()
      const onComplete = vi.fn()

      const teardown = observable.subscribe({
        next: onData,
        error: onError,
        complete: onComplete,
      })

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(documentService.readArchivedChangeFiles).toHaveBeenCalledWith(
        'old-change',
        'view',
        'source'
      )
      expect(onData).toHaveBeenCalledWith([
        { path: 'reports/summary.md', type: 'file', content: '# Source summary\n' },
      ])
      expect(onError).not.toHaveBeenCalled()
      teardown.unsubscribe()
    })
  })

  describe('config', () => {
    it('accepts opsx config updates', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.config.update({ opsx: { agentInvocationMode: 'command' } })

      const writeConfig = context.configManager.writeConfig as unknown as ReturnType<typeof vi.fn>
      expect(writeConfig).toHaveBeenCalledWith({ opsx: { agentInvocationMode: 'command' } })
    })

    it('accepts document translation config updates', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.config.update({ translation: { displayMode: 'bilingual' } })

      const writeConfig = context.configManager.writeConfig as unknown as ReturnType<typeof vi.fn>
      expect(writeConfig).toHaveBeenCalledWith({ translation: { displayMode: 'bilingual' } })
    })

    it('accepts global translation config updates as patches', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.globalSettings.update({ translation: { enabled: true } })

      const writeSettings = context.globalSettingsManager.writeSettings as unknown as ReturnType<
        typeof vi.fn
      >
      expect(writeSettings).toHaveBeenCalledWith({ translation: { enabled: true } })
    })

    it('accepts user-level translation cache settings updates', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.globalSettings.update({ translationCache: { entryLimit: 12300 } })

      const writeSettings = context.globalSettingsManager.writeSettings as unknown as ReturnType<
        typeof vi.fn
      >
      expect(writeSettings).toHaveBeenCalledWith({ translationCache: { entryLimit: 12300 } })
    })
  })

  describe('sounds', () => {
    it('lists available custom sounds through the sound service', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await expect(caller.sounds.listCustom()).resolves.toEqual([])

      const listAvailable = context.customSoundService.listAvailable as unknown as ReturnType<
        typeof vi.fn
      >
      expect(listAvailable).toHaveBeenCalledTimes(1)
    })
  })

  describe('dashboard', () => {
    it('returns objective overview with trend metadata', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)
      const overview = await caller.dashboard.get()

      expect(overview.summary.specifications).toBe(2)
      expect(overview.summary.requirements).toBe(3)
      expect(overview.summary.archivedTasksCompleted).toBe(1)
      expect(overview.summary.taskCompletionPercent).toBeNull()
      expect(overview.trends.requirements.length).toBeGreaterThan(0)
      expect(overview.trends.activeChanges).toEqual([])
      expect(overview.trends.inProgressChanges).toEqual([])
      expect(overview.trends.taskCompletionPercent).toEqual([])
      expect(overview.cardAvailability.requirements).toEqual({ state: 'ok' })
      expect(overview.cardAvailability.activeChanges).toEqual({
        state: 'invalid',
        reason: 'objective-history-unavailable',
      })
      expect(overview.cardAvailability.inProgressChanges).toEqual({
        state: 'invalid',
        reason: 'objective-history-unavailable',
      })
      expect(overview.cardAvailability.taskCompletionPercent).toEqual({
        state: 'invalid',
        reason: 'semantic-uncomputable',
      })
      expect(overview.trendMeta.pointLimit).toBe(100)
      expect(overview.trendMeta.lastUpdatedAt).toBeGreaterThan(0)
      expect(overview.trendKinds.requirements).toBe('monotonic')
      expect(overview.trendKinds.activeChanges).toBe('bidirectional')
      expect(overview.triColorTrends.specifications).toEqual([])
      expect(overview.git.defaultBranch).toBe('origin/main')
      expect(overview.git.worktrees[0]?.branchName).toBe('main')
      const planning = await resolveMockPlanningRoot(context)
      expect(planning.kernel.waitForWarmup).not.toHaveBeenCalled()
      expect(planning.kernel.ensureApplyInstructions).not.toHaveBeenCalled()
    })

    it('marks objective trend cards unavailable when timestamps are missing', async () => {
      const adapter = createMockAdapter()
      adapter.listSpecsWithMeta.mockResolvedValue([
        { id: 'auth', name: 'Authentication', createdAt: 0, updatedAt: 0 },
        { id: 'api', name: 'Public API', createdAt: 0, updatedAt: 0 },
      ])

      const caller = createCaller(adapter)
      const overview = await caller.dashboard.get()

      expect(overview.summary.requirements).toBe(3)
      expect(overview.cardAvailability.specifications).toEqual({
        state: 'invalid',
        reason: 'objective-history-unavailable',
      })
      expect(overview.cardAvailability.requirements).toEqual({
        state: 'invalid',
        reason: 'objective-history-unavailable',
      })
    })

    it('limits dashboard lists to the 10 most recent items while keeping summary totals intact', async () => {
      const adapter = createMockAdapter()
      adapter.listSpecsWithMeta.mockResolvedValue(
        Array.from({ length: 12 }, (_, index) => ({
          id: `spec-${index}`,
          name: `Spec ${index}`,
          createdAt: 1,
          updatedAt: index + 1,
        }))
      )
      adapter.readSpec.mockImplementation(async (id: string) => {
        const index = Number(id.split('-')[1] ?? '0')
        return {
          id,
          name: `Spec ${index}`,
          overview: 'Spec overview',
          requirements: Array.from({ length: 12 - index }, (_, requirementIndex) => ({
            id: `${id}-req-${requirementIndex}`,
            title: 'requirement',
            bodyMarkdown: 'requirement',
            text: 'requirement',
            scenarios: [
              { title: 'scenario', bodyMarkdown: 'scenario', rawText: 'scenario\nscenario' },
            ],
          })),
        }
      })
      adapter.listChangesWithMeta.mockResolvedValue(
        Array.from({ length: 12 }, (_, index) => ({
          id: `change-${index}`,
          name: `Change ${index}`,
          trackedTaskProgress: trackedTaskProgress(1, index % 2),
          documentChecklistSummary: documentChecklistSummary(),
          createdAt: 1,
          updatedAt: index + 1,
        }))
      )

      const caller = createCaller(adapter)
      const overview = await caller.dashboard.get()

      expect(overview.summary.specifications).toBe(12)
      expect(overview.summary.activeChanges).toBe(12)
      expect(overview.specifications).toHaveLength(10)
      expect(overview.activeChanges).toHaveLength(10)
      expect(overview.specifications.map((spec) => spec.id)).toEqual([
        'spec-11',
        'spec-10',
        'spec-9',
        'spec-8',
        'spec-7',
        'spec-6',
        'spec-5',
        'spec-4',
        'spec-3',
        'spec-2',
      ])
      expect(overview.activeChanges.map((change) => change.id)).toEqual([
        'change-11',
        'change-10',
        'change-9',
        'change-8',
        'change-7',
        'change-6',
        'change-5',
        'change-4',
        'change-3',
        'change-2',
      ])
    })

    it('uses dated archive id as completed trend timestamp source', async () => {
      const adapter = createMockAdapter()
      adapter.listArchivedChangesWithMeta.mockResolvedValue([
        {
          id: '2026-01-23-add-static-export',
          name: 'Archive A',
          trackedTaskProgress: trackedTaskProgress(1, 1),
          documentChecklistSummary: documentChecklistSummary(),
          createdAt: 2_000_000_000_000,
          updatedAt: 2_000_000_000_000,
        },
        {
          id: '2026-02-21-opsx-config-center',
          name: 'Archive B',
          trackedTaskProgress: trackedTaskProgress(1, 1),
          documentChecklistSummary: documentChecklistSummary(),
          createdAt: 2_000_000_000_000,
          updatedAt: 2_000_000_000_000,
        },
      ])

      const caller = createCaller(adapter)
      const overview = await caller.dashboard.get()
      const nonZeroIndexes = overview.trends.completedChanges
        .map((point, index) => ({ point, index }))
        .filter(({ point }) => point.value > 0)
        .map(({ index }) => index)

      expect(nonZeroIndexes).toHaveLength(2)
      expect(nonZeroIndexes[1]! - nonZeroIndexes[0]!).toBeGreaterThan(8)
    })

    it('returns git task status snapshot', async () => {
      const caller = createCaller()
      const status = await caller.dashboard.gitTaskStatus()

      expect(typeof status.running).toBe('boolean')
      expect(typeof status.inFlight).toBe('number')
      expect(status.inFlight).toBeGreaterThanOrEqual(0)
      expect(status.lastReason === null || typeof status.lastReason === 'string').toBe(true)
    })

    it('writes refresh stamp under .git when repository has git directory', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-test-')
      await initGitRepo(projectDir)
      const dotGitDir = await runGit(projectDir, ['rev-parse', '--git-dir'])
      const caller = createCaller(createMockAdapter(), { projectDir })
      const result = await caller.dashboard.refreshGitSnapshot({
        scope: 'code',
        reason: 'test-manual',
      })
      const stampPath = resolvePath(projectDir, dotGitDir, 'openspecui-dashboard-git-refresh.stamp')

      expect(result.success).toBe(true)
      expect(await pathExists(stampPath)).toBe(true)
      const content = await readFile(stampPath, 'utf8')
      expect(content).toContain('test-manual')
    })

    it('writes refresh stamp under resolved gitdir for worktree repositories', async () => {
      const baseRepoDir = await createTempProjectDir('openspecui-router-base-')
      await initGitRepo(baseRepoDir)
      const projectDir = await createTempProjectDir('openspecui-router-worktree-')
      await runGit(baseRepoDir, ['worktree', 'add', projectDir, '-b', 'feature-refresh-stamp'])

      const caller = createCaller(createMockAdapter(), { projectDir })
      const result = await caller.dashboard.refreshGitSnapshot({
        scope: 'code',
        reason: 'worktree',
      })
      const gitDir = await runGit(projectDir, ['rev-parse', '--git-dir'])
      const stampPath = resolvePath(projectDir, gitDir, 'openspecui-dashboard-git-refresh.stamp')

      expect(result.success).toBe(true)
      expect(await pathExists(stampPath)).toBe(true)
      const content = await readFile(stampPath, 'utf8')
      expect(content).toContain('worktree')
    })

    it('does not create legacy stamp file when git metadata is unavailable', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-nogit-')
      const caller = createCaller(createMockAdapter(), { projectDir })

      const result = await caller.dashboard.refreshGitSnapshot({ scope: 'code', reason: 'no-git' })

      expect(result.success).toBe(true)
      expect(
        await pathExists(join(projectDir, 'openspec', '.openspecui-dashboard-git-refresh.stamp'))
      ).toBe(false)
    })

    it('removes detached worktrees from the dashboard action', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-remove-')
      dashboardGitSnapshotState.removeDetachedWorktree.mockReset()
      dashboardGitSnapshotState.removeDetachedWorktree.mockResolvedValue(undefined)

      const caller = createCaller(createMockAdapter(), { projectDir })
      const result = await caller.dashboard.removeDetachedWorktree({
        scope: 'code',
        path: '/tmp/detached-worktree',
      })

      expect(result.success).toBe(true)
      expect(dashboardGitSnapshotState.removeDetachedWorktree).toHaveBeenCalledWith({
        projectDir,
        targetPath: '/tmp/detached-worktree',
      })
    })

    it('surfaces detached worktree removal failures', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-remove-guard-')
      dashboardGitSnapshotState.removeDetachedWorktree.mockReset()
      dashboardGitSnapshotState.removeDetachedWorktree.mockRejectedValue(
        new Error('Only detached worktrees can be removed from Dashboard.')
      )

      const caller = createCaller(createMockAdapter(), { projectDir })

      await expect(
        caller.dashboard.removeDetachedWorktree({ scope: 'code', path: projectDir })
      ).rejects.toThrow(/Only detached worktrees can be removed/)
    })
  })

  describe('git', () => {
    it('collapses nested launch and planning roots inside the same Git worktree', async () => {
      const repositoryDir = await createTempProjectDir('openspecui-router-git-same-repo-')
      await initGitRepo(repositoryDir)
      const launchProject = join(repositoryDir, 'apps', 'web')
      const planningRoot = join(repositoryDir, 'planning')
      await Promise.all([
        mkdir(launchProject, { recursive: true }),
        mkdir(planningRoot, { recursive: true }),
      ])

      const context = createMockContext(createMockAdapter(), { projectDir: launchProject })
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        launchProject: { path: launchProject },
        planningRoot: {
          path: planningRoot,
          source: 'nearest',
          healthy: true,
          status: [],
        },
      }
      const caller = appRouter.createCaller(context)

      const scopes = await caller.git.scopes()

      expect(scopes.code).toMatchObject({
        scope: 'code',
        rootPath: resolvePath(launchProject),
      })
      expect(await sameGitPath(scopes.code.repository?.topLevel ?? '', repositoryDir)).toBe(true)
      expect(scopes.planning).toBeNull()
      await expect(caller.git.overview({ scope: 'planning' })).rejects.toThrow(
        /Planning repository scope is unavailable or identical/
      )
    })

    it('keeps status, history, detail, and refresh mutations inside the selected repository', async () => {
      const codeRepository = await createTempProjectDir('openspecui-router-git-code-repo-')
      const planningRepository = await createTempProjectDir('openspecui-router-git-planning-repo-')
      await Promise.all([initGitRepo(codeRepository), initGitRepo(planningRepository)])
      await Promise.all([
        writeGitFile(codeRepository, 'src/code-only.ts', 'export const code = true\n'),
        writeGitFile(
          planningRepository,
          'openspec/specs/planning-only/spec.md',
          '# Planning only\n'
        ),
      ])

      const context = createMockContext(createMockAdapter(), { projectDir: codeRepository })
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        launchProject: { path: codeRepository },
        planningRoot: {
          path: planningRepository,
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
      }
      const caller = appRouter.createCaller(context)

      const scopes = await caller.git.scopes()
      const [codeEntries, planningEntries, codeFiles, planningFiles] = await Promise.all([
        caller.git.listEntries({ scope: 'code' }),
        caller.git.listEntries({ scope: 'planning' }),
        caller.git.getEntryFiles({ scope: 'code', selector: { type: 'uncommitted' } }),
        caller.git.getEntryFiles({ scope: 'planning', selector: { type: 'uncommitted' } }),
      ])

      expect(scopes.planning).toMatchObject({
        scope: 'planning',
        rootPath: resolvePath(planningRepository),
      })
      expect(
        await sameGitPath(scopes.planning?.repository?.topLevel ?? '', planningRepository)
      ).toBe(true)
      expect(codeEntries.items[0]).toMatchObject({ type: 'uncommitted' })
      expect(planningEntries.items[0]).toMatchObject({ type: 'uncommitted' })
      expect(codeFiles.files.map((file) => file.path)).toEqual(['src/code-only.ts'])
      expect(planningFiles.files.map((file) => file.path)).toEqual([
        'openspec/specs/planning-only/spec.md',
      ])

      await caller.git.refresh({ scope: 'planning', reason: 'planning-scope-test' })
      const codeGitDir = await runGit(codeRepository, ['rev-parse', '--git-dir'])
      const planningGitDir = await runGit(planningRepository, ['rev-parse', '--git-dir'])
      await expect(
        pathExists(
          resolvePath(planningRepository, planningGitDir, 'openspecui-dashboard-git-refresh.stamp')
        )
      ).resolves.toBe(true)
      await expect(
        pathExists(
          resolvePath(codeRepository, codeGitDir, 'openspecui-dashboard-git-refresh.stamp')
        )
      ).resolves.toBe(false)
    })

    it('returns overview, paged entries, and detail for the current worktree', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-git-')
      const remoteDir = await createTempProjectDir('openspecui-router-git-remote-')
      await initGitRepo(projectDir)
      await runGit(remoteDir, ['init', '--bare'])
      await runGit(projectDir, ['branch', '-M', 'main'])
      await runGit(projectDir, ['remote', 'add', 'origin', remoteDir])
      await runGit(projectDir, ['push', '-u', 'origin', 'main'])
      await runGit(projectDir, ['remote', 'set-head', 'origin', 'main'])
      await runGit(projectDir, ['checkout', '-b', 'feature-git-panel'])

      await writeGitFile(
        projectDir,
        'openspec/changes/add-git-panel-worktree-handoff/loop/intake.md',
        'feature entry\n'
      )
      await runGit(projectDir, [
        'add',
        'openspec/changes/add-git-panel-worktree-handoff/loop/intake.md',
      ])
      await runGit(projectDir, ['commit', '-m', 'feat: add git panel intake'])

      await writeGitFile(projectDir, 'src/git-panel.ts', 'export const value = 1\n')

      const otherWorktreeDir = await createTempProjectDir('openspecui-router-git-worktree-')
      await runGit(projectDir, [
        'worktree',
        'add',
        otherWorktreeDir,
        '-b',
        'feature-other-worktree',
      ])

      const caller = createCaller(createMockAdapter(), { projectDir })
      const overview = await caller.git.overview({ scope: 'code' })
      const entries = await caller.git.listEntries({ scope: 'code' })

      expect(overview.defaultBranch).toBe('origin/main')
      expect(overview.currentWorktree?.branchName).toBe('feature-git-panel')
      expect(overview.otherWorktrees).toHaveLength(1)
      expect(await sameGitPath(overview.otherWorktrees[0]?.path ?? '', otherWorktreeDir)).toBe(true)

      expect(entries.items[0]).toMatchObject({
        type: 'uncommitted',
        relatedChanges: [],
        diff: { files: 1, insertions: 0, deletions: 0 },
      })
      expect(entries.items[1]).toMatchObject({
        type: 'commit',
        title: 'feat: add git panel intake',
        relatedChanges: ['add-git-panel-worktree-handoff'],
      })

      const uncommittedMeta = await caller.git.getEntryMeta({
        scope: 'code',
        selector: { type: 'uncommitted' },
      })
      expect(uncommittedMeta).toMatchObject({
        type: 'uncommitted',
        diff: { files: 1, insertions: 0, deletions: 0 },
      })

      const uncommittedFiles = await caller.git.getEntryFiles({
        scope: 'code',
        selector: { type: 'uncommitted' },
      })
      expect(uncommittedFiles.files[0]).toMatchObject({
        path: 'src/git-panel.ts',
        changeType: 'added',
      })
      expect(uncommittedFiles.files[0]?.fileId).toEqual(expect.any(String))
      expect(uncommittedFiles.eagerFiles[0]).toMatchObject({
        path: 'src/git-panel.ts',
        state: 'available',
        source: 'untracked',
      })

      const uncommittedPatch = await caller.git.getEntryPatch({
        scope: 'code',
        selector: { type: 'uncommitted' },
        fileId: uncommittedFiles.files[0]!.fileId,
      })
      expect(uncommittedPatch.file).toMatchObject({
        path: 'src/git-panel.ts',
        state: 'available',
        source: 'untracked',
      })

      const commitEntry = entries.items.find((entry) => entry.type === 'commit')
      if (!commitEntry || commitEntry.type !== 'commit') {
        throw new Error('Expected a commit entry in git history')
      }

      const commitMeta = await caller.git.getEntryMeta({
        scope: 'code',
        selector: { type: 'commit', hash: commitEntry.hash },
      })
      expect(commitMeta).toMatchObject({
        type: 'commit',
        hash: commitEntry.hash,
      })

      const commitFiles = await caller.git.getEntryFiles({
        scope: 'code',
        selector: { type: 'commit', hash: commitEntry.hash },
      })
      expect(commitFiles.files[0]?.path).toBe(
        'openspec/changes/add-git-panel-worktree-handoff/loop/intake.md'
      )
      expect(commitFiles.eagerFiles[0]?.path).toBe(
        'openspec/changes/add-git-panel-worktree-handoff/loop/intake.md'
      )

      const commitPatch = await caller.git.getEntryPatch({
        scope: 'code',
        selector: { type: 'commit', hash: commitEntry.hash },
        fileId: commitFiles.files[0]!.fileId,
      })
      expect(commitPatch.file?.path).toBe(
        'openspec/changes/add-git-panel-worktree-handoff/loop/intake.md'
      )
    }, 20_000)

    it('hands off to a sibling worktree server through the configured service', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-git-switch-')
      await initGitRepo(projectDir)
      await runGit(projectDir, ['branch', '-M', 'main'])

      const otherWorktreeDir = await createTempProjectDir('openspecui-router-git-switch-target-')
      await runGit(projectDir, ['worktree', 'add', otherWorktreeDir, '-b', 'feature-switch-target'])

      const ensureWorktreeServer = vi.fn().mockResolvedValue({
        projectDir: resolvePath(otherWorktreeDir),
        serverUrl: 'http://127.0.0.1:3300',
      })

      const caller = createCaller(createMockAdapter(), {
        projectDir,
        gitWorktreeHandoff: {
          ensureWorktreeServer,
        },
      })

      const overview = await caller.git.overview({ scope: 'code' })
      const targetPath = overview.otherWorktrees[0]?.path
      if (!targetPath) {
        throw new Error('Expected overview to include the sibling worktree')
      }

      const handoff = await caller.git.switchWorktree({ scope: 'code', path: targetPath })

      expect(ensureWorktreeServer).toHaveBeenCalledWith({
        targetPath,
      })
      expect(handoff).toEqual({
        projectDir: resolvePath(otherWorktreeDir),
        serverUrl: 'http://127.0.0.1:3300',
      })
    }, 20_000)

    it('resolves switch targets without building full worktree overview stats', async () => {
      const projectDir = await createTempProjectDir('openspecui-router-git-switch-light-')
      const targetDir = await createTempProjectDir('openspecui-router-git-switch-light-target-')
      const gitCalls: string[][] = []

      const target = await resolveGitWorktreeSwitchTarget({
        projectDir,
        targetPath: targetDir,
        runGit: async (_cwd, args) => {
          gitCalls.push(args)
          if (args.join(' ') === 'worktree list --porcelain') {
            return {
              ok: true,
              stdout: [
                `worktree ${projectDir}`,
                'HEAD 0000000000000000000000000000000000000000',
                'branch refs/heads/main',
                '',
                `worktree ${targetDir}`,
                'HEAD 1111111111111111111111111111111111111111',
                'branch refs/heads/feature-switch-target',
                '',
              ].join('\n'),
            }
          }
          return { ok: false, stdout: '' }
        },
      })

      expect(target).toEqual({
        path: resolvePath(targetDir),
        pathAvailable: true,
      })
      expect(gitCalls).toEqual([['worktree', 'list', '--porcelain']])
    })
  })

  describe('spec', () => {
    it('should return the source-aware catalog', async () => {
      const caller = createCaller()
      const catalog = await caller.spec.catalog()

      expect(catalog.entries).toEqual([
        {
          identity: { kind: 'owned', specId: 'auth' },
          source: 'owned',
          readOnly: false,
          name: 'Authentication',
          summary: null,
          updatedAt: 20,
        },
        {
          identity: { kind: 'owned', specId: 'api' },
          source: 'owned',
          readOnly: false,
          name: 'Public API',
          summary: null,
          updatedAt: 10,
        },
      ])
    })

    it('should get an owned Spec document', async () => {
      const caller = createCaller()
      const document = await caller.spec.document({ kind: 'owned', specId: 'auth' })

      expect(document).toMatchObject({
        identity: { kind: 'owned', specId: 'auth' },
        source: 'owned',
        readOnly: false,
        state: 'ready',
        spec: { id: 'auth', name: 'Authentication' },
        rawMarkdown: '# Auth\n## Purpose\nAuth spec',
      })
    })

    it('gets processed raw spec markdown through the document service', async () => {
      const adapter = createMockAdapter()
      const context = createMockContext(adapter)
      const planning = await resolveMockPlanningRoot(context)
      const readSpecRaw = planning.documentService.readSpecRaw as unknown as ReturnType<
        typeof vi.fn
      >
      readSpecRaw.mockResolvedValueOnce({ markdown: '# Processed Auth' })
      const caller = appRouter.createCaller(context)

      const document = await caller.spec.document({ kind: 'owned', specId: 'auth' })

      expect(document.rawMarkdown).toBe('# Processed Auth')
      expect(readSpecRaw).toHaveBeenCalledWith('auth', 'view', 'processed')
    })

    it('should save a spec', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      const result = await caller.spec.save({
        identity: { kind: 'owned', specId: 'test' },
        content: '# Test',
      })

      expect(result.success).toBe(true)
      expect(adapter.writeSpec).toHaveBeenCalledWith('test', '# Test')
    })

    it('rejects a non-canonical spec id before Adapter mutation', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      await expect(
        caller.spec.save({
          identity: { kind: 'owned', specId: '../escaped' },
          content: '# Escaped',
        })
      ).rejects.toThrow(/Invalid specId/)
      expect(adapter.writeSpec).not.toHaveBeenCalled()
    })

    it('should validate a spec', async () => {
      const caller = createCaller()
      const result = await caller.spec.validate({ kind: 'owned', specId: 'auth' })

      expect(result.valid).toBe(true)
    })
  })

  describe('change', () => {
    it('should list changes', async () => {
      const caller = createCaller()
      const changes = await caller.change.list()

      expect(changes).toEqual(['add-caching'])
    })

    it('should list archived changes', async () => {
      const caller = createCaller()
      const archived = await caller.change.listArchived()

      expect(archived).toEqual(['old-change'])
    })

    it('should get a change', async () => {
      const caller = createCaller()
      const change = await caller.change.get({ id: 'add-caching' })

      expect(change?.id).toBe('add-caching')
    })

    it('rejects a non-canonical change id before Adapter mutation', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      await expect(caller.change.save({ id: '../escaped', proposal: '# Escaped' })).rejects.toThrow(
        /Invalid changeId/
      )
      expect(adapter.writeChange).not.toHaveBeenCalled()
    })
  })

  describe('archive', () => {
    it('lists archives from the selected planning-root adapter only', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const planningAdapter = createMockAdapter()
      planningAdapter.listArchivedChanges.mockResolvedValue(['planning-only-archive'])
      context.launchProjectAdapter.listArchivedChanges.mockResolvedValue(['launch-only-archive'])
      planning.adapter = planningAdapter as unknown as PlanningRootServices['adapter']
      const caller = appRouter.createCaller(context)

      await expect(caller.archive.list()).resolves.toEqual(['planning-only-archive'])
      expect(planningAdapter.listArchivedChanges).toHaveBeenCalledTimes(1)
      expect(context.launchProjectAdapter.listArchivedChanges).not.toHaveBeenCalled()
    })

    it('reads archive detail with schema diagnostics from the shared entity read options', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const readEntityDetail = planning.documentService.readEntityDetail as unknown as ReturnType<
        typeof vi.fn
      >
      const caller = appRouter.createCaller(context)

      await caller.archive.get({ id: 'old-change' })

      expect(readEntityDetail).toHaveBeenCalledWith(
        'archive',
        'old-change',
        'view',
        'processed',
        expect.objectContaining({
          schemas: expect.objectContaining({
            'custom-audit': expect.objectContaining({ name: 'custom-audit' }),
          }),
          schemaDiagnostics: expect.objectContaining({
            'custom-audit': expect.arrayContaining([
              expect.objectContaining({
                message: expect.stringContaining('missing a usable id or output path'),
              }),
            ]),
          }),
        })
      )
    })

    it('exposes raw archive data as schema-neutral entity source detail', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const readEntityDetail = planning.documentService.readEntityDetail as unknown as ReturnType<
        typeof vi.fn
      >
      const caller = appRouter.createCaller(context)

      await caller.archive.getRaw({ id: 'old-change' })

      expect(readEntityDetail).toHaveBeenCalledWith(
        'archive',
        'old-change',
        'view',
        'source',
        expect.any(Object)
      )
    })
  })

  describe('init', () => {
    it('should initialize project', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      const result = await caller.init.init()

      expect(result.success).toBe(true)
      expect(adapter.init).toHaveBeenCalled()
    })
  })

  describe('cli', () => {
    it('derives buffered validate Store selection from Root Context', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        planningRoot: {
          path: '/stores/shared',
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
      }
      const caller = appRouter.createCaller(context)

      await caller.cli.validate({
        kind: 'item',
        id: 'add-search',
        type: 'change',
        strict: true,
      })

      const validate = context.cliExecutor.contracts.validate as unknown as ReturnType<typeof vi.fn>
      expect(validate).toHaveBeenCalledWith({
        target: { kind: 'item', id: 'add-search', type: 'change' },
        strict: true,
        store: 'shared',
      })
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex
      expect(invalidation.current('project')).toBe(0)
      expect(invalidation.current('context')).toBe(0)
    })

    it('derives streaming validate Store selection from Root Context', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        planningRoot: {
          path: '/stores/shared',
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
      }
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      validateStream.mockImplementation(async (_options, onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return () => undefined
      })
      const caller = appRouter.createCaller(context)

      const validateObservable = await caller.cli.validateStream({
        id: 'add-search',
        type: 'change',
        strict: true,
      })
      await new Promise<void>((resolve, reject) => {
        validateObservable.subscribe({ error: reject, complete: resolve })
      })

      expect(validateStream).toHaveBeenCalledWith(
        { id: 'add-search', type: 'change', strict: true, store: 'shared' },
        expect.any(Function)
      )
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex
      expect(invalidation.current('project')).toBe(0)
      expect(invalidation.current('context')).toBe(0)
    })

    it('exposes archive only through the strict Server-owned stream', () => {
      expect(appRouter._def.procedures).not.toHaveProperty('cli.archive')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.archiveStream')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.execute')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.runCommandStream')
      expect(appRouter._def.procedures).toHaveProperty('cli.executeOpenSpec')
      expect(appRouter._def.procedures).toHaveProperty('cli.executeOpenSpecStream')
      expect(appRouter._def.procedures).toHaveProperty('cli.archiveStrictStream')
    })

    it.each([
      [
        'canonical command',
        ['archive', 'add-search', '--yes', '--no-validate', '--store', 'other'],
      ],
      [
        'global option prefix',
        ['--store=other', 'archive', 'add-search', '--yes', '--no-validate'],
      ],
      ['argument separator', ['--', 'archive', 'add-search', '--yes', '--no-validate']],
    ])('rejects Archive through generic buffered execution using %s', async (_name, args) => {
      const context = createMockContext()
      const execute = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>

      await expect(appRouter.createCaller(context).cli.executeOpenSpec({ args })).rejects.toThrow(
        /archiveStrictStream/
      )
      expect(execute).not.toHaveBeenCalled()
    })

    it.each([
      [
        'canonical command',
        ['archive', 'add-search', '--yes', '--no-validate', '--store', 'other'],
      ],
      [
        'global option prefix',
        ['--store=other', 'archive', 'add-search', '--yes', '--no-validate'],
      ],
      ['argument separator', ['--', 'archive', 'add-search', '--yes', '--no-validate']],
    ])('rejects Archive through generic streamed execution using %s', async (_name, args) => {
      const context = createMockContext()
      const executeCommandStream = context.cliExecutor
        .executeCommandStream as unknown as ReturnType<typeof vi.fn>
      const stream = await appRouter.createCaller(context).cli.executeOpenSpecStream({ args })

      await expect(
        new Promise<void>((resolve, reject) => {
          stream.subscribe({ complete: resolve, error: reject })
        })
      ).rejects.toThrow(/archiveStrictStream/)
      expect(executeCommandStream).not.toHaveBeenCalled()
    })

    it('keeps strict archive preflight and mutation on one Server-owned root selection', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        planningRoot: {
          path: '/stores/shared',
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
      }
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      const archiveStream = context.cliExecutor.archiveStream as unknown as ReturnType<typeof vi.fn>
      validateStream.mockImplementation(async (_options, onEvent) => {
        onEvent({ type: 'command', data: 'openspec validate add-search --strict' })
        onEvent({ type: 'exit', exitCode: 0 })
        return () => undefined
      })
      archiveStream.mockImplementation(async (_changeId, _options, onEvent) => {
        onEvent({ type: 'command', data: 'openspec archive -y add-search --no-validate' })
        onEvent({ type: 'exit', exitCode: 0 })
        return () => undefined
      })
      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        skipSpecs: true,
        noValidate: false,
      })
      const events: Array<{ type: string; exitCode?: number | null }> = []
      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          next: (event) => events.push(event),
          error: reject,
          complete: resolve,
        })
      })

      expect(validateStream).toHaveBeenCalledWith(
        { id: 'add-search', type: 'change', strict: true, store: 'shared' },
        expect.any(Function)
      )
      expect(archiveStream).toHaveBeenCalledWith(
        'add-search',
        { skipSpecs: true, noValidate: true, store: 'shared' },
        expect.any(Function)
      )
      expect(events.filter((event) => event.type === 'exit')).toEqual([
        { type: 'exit', exitCode: 0 },
      ])
    })

    it('does not archive after strict preflight failure', async () => {
      const context = createMockContext()
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      const archiveStream = context.cliExecutor.archiveStream as unknown as ReturnType<typeof vi.fn>
      validateStream.mockImplementation(async (_options, onEvent) => {
        onEvent({ type: 'stderr', data: 'strict validation failed' })
        onEvent({ type: 'exit', exitCode: 1 })
        return () => undefined
      })
      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        noValidate: false,
      })
      const events: Array<{ type: string; exitCode?: number | null }> = []
      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          next: (event) => events.push(event),
          error: reject,
          complete: resolve,
        })
      })

      expect(archiveStream).not.toHaveBeenCalled()
      expect(events.at(-1)).toEqual({ type: 'exit', exitCode: 1 })
    })

    it('honors an explicit operator validation skip only through the strict Archive stream', async () => {
      const context = createMockContext()
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      const archiveStream = context.cliExecutor.archiveStream as unknown as ReturnType<typeof vi.fn>
      archiveStream.mockImplementation(async (_changeId, _options, onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return () => undefined
      })

      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        noValidate: true,
      })
      await new Promise<void>((resolve, reject) => {
        stream.subscribe({ complete: resolve, error: reject })
      })

      expect(validateStream).not.toHaveBeenCalled()
      expect(archiveStream).toHaveBeenCalledWith(
        'add-search',
        { skipSpecs: undefined, noValidate: true },
        expect.any(Function)
      )
    })

    it('reads and writes global config via path resolution', async () => {
      const context = createMockContext()
      const executeMock = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>

      executeMock
        .mockResolvedValueOnce({
          success: true,
          stdout: '/tmp/mock-openspec-config.json\n',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: '{"profile":"core","delivery":"both","workflows":["propose"]}',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: '/tmp/mock-openspec-config.json\n',
          stderr: '',
          exitCode: 0,
        })

      const caller = appRouter.createCaller(context)
      const environment = await caller.planningConfig.environmentGlobal()
      const setResult = await caller.planningConfig.writeEnvironmentGlobal({
        config: { profile: 'core', delivery: 'both', workflows: ['propose'] },
      })

      expect(environment.file.path).toBe('/tmp/mock-openspec-config.json')
      expect(environment.config).toMatchObject({ profile: 'core', delivery: 'both' })
      expect(environment.owner.kind).toBe('runtime-environment')
      expect(setResult.success).toBe(true)
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex
      expect(invalidation.current('stores')).toBe(1)
      expect(invalidation.current('worksets')).toBe(1)
      expect(invalidation.current('schemas')).toBe(1)
      expect(invalidation.current('context')).toBe(1)
    })

    it('subscribes to Environment Global Config through the resolved CLI file', async () => {
      const context = createMockContext()
      const executeMock = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>
      executeMock
        .mockResolvedValueOnce({
          success: true,
          stdout: '/tmp/mock-openspec-config.json\n',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: '{"profile":"core","delivery":"both","workflows":["propose"]}',
          stderr: '',
          exitCode: 0,
        })

      const observable = await appRouter
        .createCaller(context)
        .planningConfig.subscribeEnvironmentGlobal()
      const firstResult = Promise.withResolvers<unknown>()
      const subscription = observable.subscribe({
        next: firstResult.resolve,
        error: firstResult.reject,
      })

      await expect(firstResult.promise).resolves.toMatchObject({
        file: { path: '/tmp/mock-openspec-config.json' },
        config: { profile: 'core', delivery: 'both', workflows: ['propose'] },
        owner: { kind: 'runtime-environment' },
      })
      subscription.unsubscribe()
    })

    it('passes force flag to init command', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.cli.init({ force: true })

      const initMock = context.cliExecutor.init as unknown as ReturnType<typeof vi.fn>
      expect(initMock).toHaveBeenCalledWith({ force: true, profile: undefined, tools: undefined })
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex
      expect(invalidation.current('project')).toBe(1)
      expect(invalidation.current('context')).toBe(1)
    })

    it('invalidates mapped raw CLI mutations but not read-only commands', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex

      await caller.cli.executeOpenSpec({ args: ['schemas', '--json'] })
      expect(invalidation.current('project')).toBe(0)
      expect(invalidation.current('schemas')).toBe(0)

      await caller.cli.executeOpenSpec({ args: ['schema', 'init', 'custom'] })
      expect(invalidation.current('project')).toBe(1)
      expect(invalidation.current('context')).toBe(1)
      expect(invalidation.current('schemas')).toBe(1)
    })

    it('invalidates a streamed OpenSpec mutation before completing the client stream', async () => {
      const context = createMockContext()
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex
      const executeCommandStream = context.cliExecutor
        .executeCommandStream as unknown as ReturnType<typeof vi.fn>
      executeCommandStream.mockImplementation((_command, onEvent) => {
        onEvent({ type: 'exit', exitCode: null })
        return vi.fn()
      })
      const caller = appRouter.createCaller(context)
      const stream = await caller.cli.executeOpenSpecStream({ args: ['update'] })

      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          error: reject,
          complete: () => {
            expect(invalidation.current('project')).toBe(1)
            expect(invalidation.current('context')).toBe(1)
            resolve()
          },
        })
      })
    })

    it('parses profile state and detects drift warning', async () => {
      const context = createMockContext()
      const executeMock = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>
      executeMock
        .mockResolvedValueOnce({
          success: true,
          stdout: '{"profile":"custom","delivery":"skills","workflows":["propose","apply"]}',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout:
            'Warning: Global config is not applied to this project. Run `openspec update` to sync.\n',
          stderr: '',
          exitCode: 0,
        })

      const caller = appRouter.createCaller(context)
      const state = await caller.cli.getProfileState()

      expect(state.available).toBe(true)
      expect(state.profile).toBe('custom')
      expect(state.delivery).toBe('skills')
      expect(state.workflows).toEqual(['propose', 'apply'])
      expect(state.driftStatus).toBe('drift')
      expect(state.warningText).toContain('Run `openspec update`')
    })

    it('falls back to core workflows when omitted from JSON config', async () => {
      const context = createMockContext()
      const executeMock = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>
      executeMock
        .mockResolvedValueOnce({
          success: true,
          stdout: '{"profile":"core","delivery":"both"}',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: 'profile: core\ndelivery: both\n',
          stderr: '',
          exitCode: 0,
        })

      const caller = appRouter.createCaller(context)
      const state = await caller.cli.getProfileState()

      expect(state.available).toBe(true)
      expect(state.profile).toBe('core')
      expect(state.delivery).toBe('both')
      expect(state.workflows).toEqual(['propose', 'explore', 'apply', 'update', 'sync', 'archive'])
      expect(state.driftStatus).toBe('in-sync')
    })
  })

  describe('opsx', () => {
    it('delegates workflow invocation preparation to the workflow service', async () => {
      const context = createMockContext()
      const runWorkflow = vi.fn().mockResolvedValue({
        kind: 'agent-command',
        text: '/opsx:propose add auth',
      })
      const planning = await resolveMockPlanningRoot(context)
      planning.workflowInvocationService.runWorkflow = runWorkflow
      const caller = appRouter.createCaller(context)

      const result = await caller.opsx.runWorkflow({
        requestedMode: 'command',
        input: { action: 'propose', text: 'add auth' },
      })

      expect(result).toEqual({ kind: 'agent-command', text: '/opsx:propose add auth' })
      expect(runWorkflow).toHaveBeenCalledWith({ action: 'propose', text: 'add auth' }, 'command')
    })

    it('rejects before creating a workflow action when Root Context resolution fails', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const runWorkflow = planning.workflowInvocationService.runWorkflow as unknown as ReturnType<
        typeof vi.fn
      >
      const rootFailure = new Error('OpenSpec Doctor rejected the selected Store.')
      ;(
        context.planningRootServices.resolve as unknown as ReturnType<typeof vi.fn>
      ).mockRejectedValue(rootFailure)
      const caller = appRouter.createCaller(context)

      await expect(
        caller.opsx.runWorkflow({
          requestedMode: 'command',
          input: { action: 'apply', changeId: 'add-search' },
        })
      ).rejects.toThrow(rootFailure.message)
      expect(runWorkflow).not.toHaveBeenCalled()
    })

    it('reads artifact preview output through the processed document service path', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      const result = await caller.opsx.readArtifactOutput({
        changeId: 'add-caching',
        outputPath: 'tasks.md',
      })

      expect(result).toBe('# Processed artifact')
      const planning = await resolveMockPlanningRoot(context)
      expect(planning.kernel.ensureArtifactOutput).toHaveBeenCalledWith('add-caching', 'tasks.md')
      expect(planning.documentService.readChangeArtifactOutput).toHaveBeenCalledWith(
        'add-caching',
        'tasks.md',
        'view',
        'processed'
      )
      expect(planning.kernel.getArtifactOutput).not.toHaveBeenCalled()
    })

    it('reads glob artifact preview files through the processed document service path', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      const result = await caller.opsx.readGlobArtifactFiles({
        changeId: 'add-caching',
        outputPath: 'specs/**/*.md',
      })

      expect(result).toEqual([
        { path: 'specs/auth/spec.md', type: 'file', content: '# Processed delta spec' },
      ])
      const planning = await resolveMockPlanningRoot(context)
      expect(planning.kernel.ensureGlobArtifactFiles).toHaveBeenCalledWith(
        'add-caching',
        'specs/**/*.md'
      )
      expect(planning.documentService.readChangeGlobArtifactFiles).toHaveBeenCalledWith(
        'add-caching',
        'specs/**/*.md',
        'view',
        'processed'
      )
      expect(planning.kernel.getGlobArtifactFiles).not.toHaveBeenCalled()
    })

    it('rejects artifact path traversal for queries and subscriptions before projection access', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await expect(
        caller.opsx.readArtifactOutput({
          changeId: 'add-caching',
          outputPath: '../../outside.md',
        })
      ).rejects.toThrow(/Invalid outputPath/)
      await expect(
        caller.opsx.subscribeArtifactOutput({
          changeId: 'add-caching',
          outputPath: '../../outside.md',
        })
      ).rejects.toThrow(/Invalid outputPath/)
      await expect(
        caller.opsx.readGlobArtifactFiles({
          changeId: 'add-caching',
          outputPath: '../outside/**/*.md',
        })
      ).rejects.toThrow(/Invalid outputPath/)
      await expect(
        caller.opsx.subscribeGlobArtifactFiles({
          changeId: 'add-caching',
          outputPath: '../outside/**/*.md',
        })
      ).rejects.toThrow(/Invalid outputPath/)

      const planning = await resolveMockPlanningRoot(context)
      expect(planning.kernel.ensureArtifactOutput).not.toHaveBeenCalled()
      expect(planning.kernel.ensureGlobArtifactFiles).not.toHaveBeenCalled()
      expect(planning.documentService.readChangeArtifactOutput).not.toHaveBeenCalled()
      expect(planning.documentService.readChangeGlobArtifactFiles).not.toHaveBeenCalled()
    })
  })
})
