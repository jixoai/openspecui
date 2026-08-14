/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove public Router owner boundaries and dedicated Planning-root stream settlement.
 * 2. Prove strict Archive identity, generation, validation, diagnostics, and Store selection publicly.
 * 3. Prove reactive configuration, Dashboard Summary v2, Git, notification, and runtime procedures retain scoped behavior.
 * 4. Prove stale Git binding intent conflicts before rebound repository side effects.
 * 5. Prove Root, Store, Planning CLI, and Environment Global Projection Work routes through their real Server owners.
 * 6. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-17): "Every public application mutation remains inside its Server-owned root and lifetime."
 * Original request (2026-07-17): "Rejected Validate and Update handles converge to one public terminal error."
 * Original request (2026-07-18): "Environment Global profile/drift must use one reactive CLI-owned projection."
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 * Derived requirement (2026-07-19): Project Binding mutation exposes launch-write and convergence evidence.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 * Owner correction (2026-07-31): Observation refresh is a query even when it maintains internal cache or stamp state.
 * Original request (2026-07-31): "手动刷新报错：Code Git snapshot failed: Invalid Dashboard projection Work event."
 * Review correction (2026-08-01): Archive Instructions and mutation must share one Root generation.
 * Original request (2026-08-01): configured machine fallback must not fabricate effective Root success.
 * Original request (2026-08-01): Active Root Raw YAML must reject stale revisions and refresh dependent owners.
 * Review correction (2026-08-02): generic CLI Init/Update transports must not bypass Agent ownership.
 * Review correction (2026-08-02): Init cancellation and success require process and projection settlement.
 */
import {
  acquireWatcherRoot,
  CliExecutor,
  ConfigManager,
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  OpenSpecAdapter,
  reactiveReadFile,
  RuntimeInvalidationIndex,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type CliProjectionNotice,
  type CliStreamEvent,
  type CliStreamHandle,
  type CliStreamSettlement,
  type ObservationRootOwner,
  type PlanningCliProjectionData,
  type RuntimeRootInvalidationOwner,
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
import type {
  DashboardProjectionServiceContract,
  DashboardProjectionSubscription,
} from '../src/dashboard-projection-service.js'
import { resolveGitWorktreeSwitchTarget } from '../src/git-panel-data.js'
import { GitRepositoryBindingService } from '../src/git-repository-binding-service.js'
import { sameGitPath } from '../src/git-shared.js'
import type { Context } from '../src/router.js'
import { appRouter } from '../src/router.js'
import type {
  ChangeProjectionData,
  ChangeProjectionEvent,
  ChangesProjectionServiceContract,
} from './changes-projection-service.js'
import {
  createEnvironmentGlobalProjectionWorkOwner,
  EnvironmentGlobalProjectionService,
} from './environment-global-projection-service.js'
import { FilePreviewService } from './file-preview-service.js'
import {
  createPlanningCliProjectionWorkOwner,
  PlanningCliProjectionService,
} from './planning-cli-projection-service.js'
import { PlanningRootServiceManager, type PlanningRootServices } from './planning-root-service.js'
import {
  createServerProjectionWorkRuntime,
  type ProjectionWorkIdentity,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'
import {
  createRootContextProjectionWorkOwner,
  RootContextProjectionService,
} from './root-context-projection-service.js'
import type { SchemaMutationAction } from './schema-mutation-service.js'
import {
  createStoreContentProjectionWorkOwner,
  StoreContentProjectionService,
} from './store-content-projection-service.js'
import {
  createStoreProjectionWorkOwner,
  StoreProjectionService,
} from './store-projection-service.js'

function settledStreamHandle(exitCode: number | null): CliStreamHandle {
  const settlement: CliStreamSettlement = { reason: 'exited', exitCode }
  return {
    settled: Promise.resolve(settlement),
    cancel: () => Promise.resolve(settlement),
  }
}

function controlledStreamHandle(): {
  handle: CliStreamHandle
  settle(exitCode: number | null): void
} {
  const terminal = Promise.withResolvers<CliStreamSettlement>()
  return {
    handle: {
      settled: terminal.promise,
      cancel: () => {
        terminal.resolve({ reason: 'cancelled', exitCode: null })
        return terminal.promise
      },
    },
    settle: (exitCode) => terminal.resolve({ reason: 'exited', exitCode }),
  }
}

function subscribeDashboardProjectionFixture<T>(
  projectionKind: string,
  load: () => Promise<T>,
  listener: DashboardProjectionSubscription<T>
): ProjectionWorkSubscription {
  const identity: ProjectionWorkIdentity = {
    projectionKind,
    planningRoot: {
      identity: '/tmp/openspecui-router-test',
      source: 'nearest',
      storeSelector: null,
    },
    owner: { generation: 'planning-binding', gitBindingToken: null },
    selector: projectionKind,
    inputFingerprint: 'router-fixture:v1',
    protocolVersion: 1,
  }
  let active = true
  void load().then(
    (data) => {
      if (!active) return
      const snapshot = { data, freshness: 'current' as const, identity, workGeneration: 1 }
      listener({ type: 'snapshot', snapshot })
      listener({ type: 'complete', snapshot })
    },
    (cause: unknown) => {
      if (!active) return
      listener({
        type: 'failed',
        error: cause instanceof Error ? cause : new Error(String(cause)),
        retainedSnapshot: null,
        workGeneration: 1,
      })
    }
  )
  return {
    unsubscribe() {
      active = false
    },
  }
}

function subscribeChangesProjectionFixture(
  load: () => Promise<ChangeProjectionData>,
  listener: (event: ChangeProjectionEvent) => void
): ProjectionWorkSubscription {
  const identity: ProjectionWorkIdentity = {
    projectionKind: 'changes-rows',
    planningRoot: {
      identity: '/tmp/openspecui-router-test',
      source: 'nearest',
      storeSelector: null,
    },
    owner: { generation: 'planning-binding', gitBindingToken: null },
    selector: 'changes:list-with-meta',
    inputFingerprint: 'router-fixture:v1',
    protocolVersion: 1,
  }
  let active = true
  void load().then(
    (data) => {
      if (!active) return
      const snapshot = { data, freshness: 'current' as const, identity, workGeneration: 1 }
      listener({ type: 'snapshot', snapshot })
      listener({ type: 'complete', snapshot })
    },
    (cause: unknown) => {
      if (!active) return
      listener({
        type: 'failed',
        error: cause instanceof Error ? cause : new Error(String(cause)),
        retainedSnapshot: null,
        workGeneration: 1,
      })
    }
  )
  return {
    unsubscribe: () => {
      active = false
    },
  }
}

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
  readLaunchProjectInitialization: vi.fn().mockResolvedValue({
    initialized: false,
    launchProjectPath: '/tmp/openspecui-router-test',
    openspecPath: '/tmp/openspecui-router-test/openspec',
  }),
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
    windowsHide: true,
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
  const projectDir = options.projectDir ?? '/tmp/openspecui-router-test'
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
      listSpecs: vi.fn().mockResolvedValue({
        success: true,
        stdout: JSON.stringify({
          specs: [
            { id: 'auth', requirementCount: 2 },
            { id: 'api', requirementCount: 1 },
          ],
          root: { path: projectDir, source: 'nearest' },
          status: [],
        }),
        stderr: '',
        exitCode: 0,
        data: {
          specs: [
            { id: 'auth', requirementCount: 2 },
            { id: 'api', requirementCount: 1 },
          ],
          root: { path: projectDir, source: 'nearest' },
          status: [],
        },
        payload: {
          specs: [
            { id: 'auth', requirementCount: 2 },
            { id: 'api', requirementCount: 1 },
          ],
          root: { path: projectDir, source: 'nearest' },
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
    executeStream: vi.fn(),
    initStream: vi.fn(),
    initProjectStream: vi.fn(),
    archiveStream: vi.fn(),
    validateStream: vi.fn(),
    executeCommandStream: vi.fn(),
  }

  const kernel = {
    waitForWarmup: vi.fn().mockResolvedValue(undefined),
    readStatusProjection: vi.fn(),
    readChangeListProjection: vi.fn().mockResolvedValue({
      value: ['add-caching'],
      evidence: {
        success: true,
        stdout: '{"changes":[{"name":"add-caching"}]}',
        stderr: '',
        exitCode: 0,
        payload: { changes: [{ name: 'add-caching' }] },
        diagnostics: [],
      },
    }),
    readStatusListProjection: vi.fn().mockResolvedValue({
      value: [],
      evidence: {
        success: true,
        stdout: '{"changes":[]}',
        stderr: '',
        exitCode: 0,
        payload: { changes: [] },
        diagnostics: [],
      },
    }),
    readInstructionsProjection: vi.fn(),
    readApplyInstructionsProjection: vi.fn().mockResolvedValue({
      changeName: 'add-caching',
      changeDir: '/tmp/openspecui-router-test/openspec/changes/add-caching',
      schemaName: 'spec-driven',
      contextFiles: {},
      tasks: [],
      state: 'all_done',
      instruction: 'No pending tasks.',
      applyInstructionProgress: {
        source: 'openspec-instructions-apply',
        total: 0,
        complete: 0,
        remaining: 0,
        state: 'all_done',
        divergence: null,
      },
      evidence: {
        command: 'instructions apply',
        success: true,
        stdout: '{"changeName":"add-caching"}',
        stderr: '',
        exitCode: 0,
        payload: { changeName: 'add-caching' },
        diagnostics: [],
        selector: {},
        root: { path: '/tmp/openspecui-router-test', source: 'nearest' },
      },
    }),
    readConfigBundleProjection: vi.fn().mockResolvedValue({
      schemas: [],
      schemaDetails: {},
      schemaResolutions: {},
    }),
    readTemplatesProjection: vi.fn().mockResolvedValue({}),
    readTemplateContentsProjection: vi.fn().mockResolvedValue({}),
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
    tryGetSchemaDetail: vi.fn().mockReturnValue({
      name: 'custom-audit',
      artifacts: [{ id: 'summary', outputPath: 'reports/summary.md', requires: [] }],
      applyRequires: [],
    }),
    tryGetSchemaYaml: vi.fn().mockReturnValue(`
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

  const filePreviewService = new FilePreviewService(projectDir, join(projectDir, '.preview-assets'))
  const dashboardOverviewService = new DashboardOverviewService((reason) =>
    loadDashboardOverview(
      {
        adapter: adapter as unknown as PlanningRootServices['adapter'],
        configManager: configManager as unknown as Context['configManager'],
        projectDir,
        codeBindingToken: 'code-binding',
      },
      reason
    )
  )
  const getDashboardSummary: DashboardProjectionServiceContract['getSummary'] = async () => {
    const overview = await dashboardOverviewService.getCurrent()
    return {
      state: 'ready',
      identity: 'dashboard-summary-v2:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      workGeneration: 1,
      invalidationCause: 'initial',
      freshness: 'current',
      snapshotGeneration: 1,
      data: {
        summary: overview.summary,
        specifications: overview.specifications,
        activeChanges: overview.activeChanges,
        trackedTaskPhaseCounts: overview.trackedTaskPhaseCounts,
        recentArchives: overview.recentArchives,
      },
      error: null,
    }
  }
  const getDashboardTrends: DashboardProjectionServiceContract['getTrends'] = async () => {
    const overview = await dashboardOverviewService.getCurrent()
    return {
      trends: overview.trends,
      triColorTrends: overview.triColorTrends,
      trendKinds: overview.trendKinds,
      cardAvailability: overview.cardAvailability,
      trendMeta: overview.trendMeta,
    }
  }
  const getDashboardGit: DashboardProjectionServiceContract['getGit'] = async () =>
    (await dashboardOverviewService.getCurrent()).git
  const dashboardProjectionService: DashboardProjectionServiceContract = {
    getSummary: getDashboardSummary,
    getTrends: getDashboardTrends,
    getGit: getDashboardGit,
    subscribeSummaryInvalidation: (listener) => {
      let active = true
      void getDashboardSummary().then((summary) => {
        if (!active) return
        listener({
          identity: summary.identity,
          workGeneration: summary.workGeneration,
          snapshotGeneration: summary.snapshotGeneration,
          state: summary.state,
          cause: 'initial',
        })
      })
      return { unsubscribe: () => (active = false) }
    },
    subscribeTrends: (listener) =>
      subscribeDashboardProjectionFixture('dashboard-trends', getDashboardTrends, listener),
    subscribeGit: (listener) =>
      subscribeDashboardProjectionFixture('dashboard-git', getDashboardGit, listener),
    invalidateGit: vi.fn(),
    dispose: vi.fn(),
  }
  const getChangesProjection: ChangesProjectionServiceContract['getCurrent'] = async () => ({
    rows: await adapter.listChangesWithMeta(),
    errors: [],
  })
  const changesProjectionService: ChangesProjectionServiceContract = {
    getCurrent: getChangesProjection,
    subscribe: (listener) => subscribeChangesProjectionFixture(getChangesProjection, listener),
    dispose: vi.fn(),
  }
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
  const runtimeInvalidation = new RuntimeInvalidationIndex()
  const projectionWorkRuntime = createServerProjectionWorkRuntime()
  const storeObservation = {
    reconcile: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
  const planningCliProjectionService = new PlanningCliProjectionService({
    rootContext,
    gitBindingToken: 'planning-binding',
    kernel,
    documentService,
    contracts: (cliExecutor as unknown as Context['cliExecutor']).contracts,
    invalidation: runtimeInvalidation,
    storeObservation,
    workOwner: createPlanningCliProjectionWorkOwner(projectionWorkRuntime),
  })
  const planningRootServices = {
    gitBindingToken: 'planning-binding',
    rootContext,
    adapter: adapter as unknown as PlanningRootServices['adapter'],
    documentService: documentService as unknown as PlanningRootServices['documentService'],
    kernel: kernel as unknown as PlanningRootServices['kernel'],
    filePreviewService,
    searchService: searchService as unknown as PlanningRootServices['searchService'],
    dashboardOverviewService,
    dashboardProjectionService,
    changesProjectionService,
    planningCliProjectionService,
    workflowInvocationService:
      workflowInvocationService as unknown as PlanningRootServices['workflowInvocationService'],
  } satisfies PlanningRootServices
  const rootContextState = {
    state: 'ready' as const,
    data: rootContext,
    attempt: null,
    error: null,
    observedAt: rootContext.observedAt,
  }
  const planningRootResolver: Context['planningRootServices'] = {
    resolveRootContext: vi.fn().mockResolvedValue(rootContextState),
    resolveRootContextReactive: vi.fn().mockResolvedValue(rootContextState),
    runOperation: vi.fn(async (operation) => operation(planningRootServices)),
    runReactiveOperation: vi.fn(async (operation) => operation(planningRootServices)),
    startOperationStream: vi.fn(async (operation) => operation(planningRootServices)),
    mutateSchema: vi.fn().mockResolvedValue(null),
    readPreviewRequest: vi.fn().mockReturnValue(null),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
  const storeProjectionService = new StoreProjectionService({
    dataScopePath: rootContext.dataScope.path,
    cliExecutor: cliExecutor as unknown as Context['cliExecutor'],
    invalidation: runtimeInvalidation,
    storeObservation,
    workOwner: createStoreProjectionWorkOwner(projectionWorkRuntime),
  })
  const storeContentProjectionService = new StoreContentProjectionService({
    dataScopePath: rootContext.dataScope.path,
    cliExecutor: cliExecutor as unknown as Context['cliExecutor'],
    invalidation: runtimeInvalidation,
    storeObservation,
    workOwner: createStoreContentProjectionWorkOwner(projectionWorkRuntime),
  })
  const rootContextProjectionService = new RootContextProjectionService({
    launchProjectDir: projectDir,
    dataScopePath: rootContext.dataScope.path,
    planningRootServices: planningRootResolver,
    workOwner: createRootContextProjectionWorkOwner(projectionWorkRuntime),
  })
  const environmentGlobalProjectionService = new EnvironmentGlobalProjectionService({
    dataScope: rootContext.dataScope,
    cliExecutor: cliExecutor as unknown as Context['cliExecutor'],
    observationEnvironment: { acquireRoot: async () => async () => {} },
    workOwner: createEnvironmentGlobalProjectionWorkOwner(projectionWorkRuntime),
  })
  const agentDeliveryProjection = {
    registry: [],
    policy: { profile: 'core', delivery: 'skills', workflows: [] },
    states: [],
  } as const
  const agentDeliveryProjectionService = {
    getCurrent: vi.fn().mockResolvedValue(agentDeliveryProjection),
    refresh: vi.fn().mockResolvedValue(agentDeliveryProjection),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  } as unknown as Context['agentDeliveryProjectionService']
  const gitRepositoryBindings = new GitRepositoryBindingService({
    launchProjectDir: projectDir,
    planningRootServices: planningRootResolver,
    codeBinding: { bindingToken: 'code-binding' },
  })

  return {
    launchProjectAdapter: adapter as unknown as Context['launchProjectAdapter'],
    planningRootServices: planningRootResolver,
    gitRepositoryBindings,
    runtimeInvalidation,
    storeObservation,
    storeProjectionService,
    storeContentProjectionService,
    rootContextProjectionService,
    environmentGlobalProjectionService,
    agentDeliveryProjectionService,
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
  return context.planningRootServices.runOperation((services) => services)
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

    it('keeps root B unexposed until an admitted root A Router mutation settles', async () => {
      const tempDir = await createTempProjectDir('openspecui-router-root-operation-')
      const launchProjectDir = join(tempDir, 'launch')
      const rootA = join(tempDir, 'root-a')
      const rootB = join(tempDir, 'root-b')
      await Promise.all([
        mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
        mkdir(join(rootA, 'openspec', 'specs'), { recursive: true }),
        mkdir(join(rootB, 'openspec', 'specs'), { recursive: true }),
      ])

      const configManager = new ConfigManager(launchProjectDir)
      const cliExecutor = new CliExecutor(configManager, launchProjectDir)
      let selectedRoot = rootA
      vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
        available: true,
        version: '1.6.0',
      })
      vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
        commandResult<CliDoctor>({
          root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        })
      )
      vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
        commandResult<CliContext>({
          root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
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
        launchProjectDir,
        previewAssetsDir: join(tempDir, 'preview-assets'),
        configManager,
        cliExecutor,
        observationEnvironment,
        projectInvalidation,
        runtimeInvalidation: new RuntimeInvalidationIndex(),
        storeObservation: { subscribe: () => () => {} },
        codeBinding: { bindingToken: 'code-binding' },
      })
      const context = createMockContext(createMockAdapter(), { projectDir: launchProjectDir })
      context.planningRootServices = manager
      context.cliExecutor = cliExecutor
      context.rootContextProjectionService = new RootContextProjectionService({
        launchProjectDir,
        dataScopePath: join(tempDir, 'openspec-data'),
        planningRootServices: manager,
        workOwner: createRootContextProjectionWorkOwner(createServerProjectionWorkRuntime()),
      })
      const caller = appRouter.createCaller(context)

      const originalWriteSpec = OpenSpecAdapter.prototype.writeSpec
      const firstWriteStarted = Promise.withResolvers<void>()
      const resumeFirstWrite = Promise.withResolvers<void>()
      let writeCount = 0
      const writeSpec = vi
        .spyOn(OpenSpecAdapter.prototype, 'writeSpec')
        .mockImplementation(async function (
          this: OpenSpecAdapter,
          ...args: Parameters<OpenSpecAdapter['writeSpec']>
        ) {
          writeCount += 1
          if (writeCount === 1) {
            firstWriteStarted.resolve()
            await resumeFirstWrite.promise
          }
          return originalWriteSpec.apply(this, args)
        })

      try {
        const firstSave = caller.spec.save({
          identity: { kind: 'owned', specId: 'first-on-a' },
          content: '# First on A\n',
        })
        await firstWriteStarted.promise

        selectedRoot = rootB
        const replacement = caller.rootContext.get()
        const replacementSettledBeforeA = await Promise.race([
          replacement.then(() => true),
          new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
        ])
        const laterSave = caller.spec.save({
          identity: { kind: 'owned', specId: 'later-on-b' },
          content: '# Later on B\n',
        })

        resumeFirstWrite.resolve()
        await Promise.all([firstSave, replacement, laterSave])

        expect(replacementSettledBeforeA).toBe(false)
        await expect(
          readFile(join(rootA, 'openspec', 'specs', 'first-on-a', 'spec.md'), 'utf8')
        ).resolves.toContain('First on A')
        await expect(
          readFile(join(rootB, 'openspec', 'specs', 'later-on-b', 'spec.md'), 'utf8')
        ).resolves.toContain('Later on B')
        expect(await pathExists(join(rootA, 'openspec', 'specs', 'later-on-b', 'spec.md'))).toBe(
          false
        )

        const archiveStarted = Promise.withResolvers<void>()
        const archiveEvent = Promise.withResolvers<(event: CliStreamEvent) => void>()
        const archiveTerminal = controlledStreamHandle()
        const validateStream = vi
          .spyOn(cliExecutor, 'validateStream')
          .mockImplementationOnce((_options, onEvent) => {
            onEvent({ type: 'exit', exitCode: 0 })
            return settledStreamHandle(0)
          })
        const archiveStream = vi
          .spyOn(cliExecutor, 'archiveStream')
          .mockImplementationOnce((_changeId, _options, onEvent) => {
            archiveStarted.resolve()
            archiveEvent.resolve(onEvent)
            return archiveTerminal.handle
          })
        const archiveRootState = await caller.rootContext.get()
        if (archiveRootState.state !== 'ready' || !archiveRootState.data.generation) {
          throw new Error('Archive root generation was not ready.')
        }
        const strictArchive = await caller.cli.archiveStrictStream({
          changeId: 'archive-me',
          expectedRootGeneration: archiveRootState.data.generation,
        })
        const archiveCompleted = Promise.withResolvers<void>()
        strictArchive.subscribe({
          complete: archiveCompleted.resolve,
          error: archiveCompleted.reject,
        })
        await archiveStarted.promise
        selectedRoot = rootA
        const replacementAfterArchive = caller.rootContext.get()
        const aExposedBeforeArchive = await Promise.race([
          replacementAfterArchive.then(() => true),
          new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
        ])
        expect(aExposedBeforeArchive).toBe(false)
        ;(await archiveEvent.promise)({ type: 'exit', exitCode: 0 })
        archiveTerminal.settle(0)
        await Promise.all([archiveCompleted.promise, replacementAfterArchive])
        expect(validateStream).toHaveBeenCalledWith(
          { id: 'archive-me', type: 'change', strict: true },
          expect.any(Function)
        )
        expect(archiveStream).toHaveBeenCalledWith(
          'archive-me',
          { skipSpecs: undefined, noValidate: true },
          expect.any(Function)
        )
      } finally {
        resumeFirstWrite.resolve()
        writeSpec.mockRestore()
        await manager.dispose()
      }
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

    it('exposes the demand-driven Store-content procedures keyed by composite identity (6.10)', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)
      // The procedures are registered and accept the composite identity (envUri + Store id + kind). The demand-driven
      // ready path + exact CLI argv + composite-identity isolation are proven by store-content-projection-service.test;
      // this test proves the router wiring (procedures callable, subscription returns an observable).
      expect(() =>
        caller.storesContent.readSpecsProjection({
          envUri: 'env://1',
          storeId: 'team',
          kind: 'specs',
        })
      ).not.toThrow()
      expect(() =>
        caller.storesContent.readChangesProjection({
          envUri: 'env://1',
          storeId: 'team',
          kind: 'changes',
        })
      ).not.toThrow()
      // The service backing the procedure returns a valid loading Pull state (demand-driven: no subscriber yet).
      expect(
        context.storeContentProjectionService.readContent({
          envUri: 'env://1',
          storeId: 'team',
          kind: 'specs',
        }).state
      ).toBe('loading')
      // The subscription procedure accepts the same composite identity and returns an observable.
      const observable = await caller.storesContent.subscribeProjection({
        envUri: 'env://1',
        storeId: 'team',
        kind: 'specs',
      })
      expect(typeof observable.subscribe).toBe('function')
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
      const beforeMutation = context.runtimeInvalidation.track('project', 'context', 'schemas')
      const refreshRootContext = vi.spyOn(context.rootContextProjectionService, 'refresh')
      const retireConfigWork = vi.spyOn(
        planning.planningCliProjectionService,
        'invalidateConfigDependentWork'
      )
      const mutation = await caller.planningConfig.writeActiveRoot({
        mode: 'raw',
        ownerPath: active.owner.path,
        filePath: active.file.path,
        revision: active.revision,
        content: 'schema: active\n',
      })
      const afterMutation = context.runtimeInvalidation.track('project', 'context', 'schemas')

      expect(binding.kind).toBe('project-binding-update')
      expect(binding.launchWrite.owner.path).toBe(launchProject)
      expect(binding.launchWrite.binding.store).toEqual({ state: 'declared', id: 'shared' })
      expect(active.owner).toMatchObject({
        path: planningRoot,
        source: 'store',
        storeId: 'shared',
        externalToLaunchProject: true,
      })
      expect(mutation).toMatchObject({
        state: 'applied',
        config: { file: { content: 'schema: active\n' } },
      })
      expect(afterMutation).toEqual(
        beforeMutation.map(({ facet, generation }) => ({ facet, generation: generation + 1 }))
      )
      expect(refreshRootContext).toHaveBeenCalledTimes(1)
      expect(retireConfigWork).toHaveBeenCalledTimes(1)
      expect(context.planningRootServices.resolveRootContext).not.toHaveBeenCalled()
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
      expect(planning.kernel.readApplyInstructionsProjection).not.toHaveBeenCalled()
    })

    it('exposes independently wired Dashboard regional projections', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      const [summary, trends, git] = await Promise.all([
        caller.dashboard.getSummary(),
        caller.dashboard.getTrends(),
        caller.dashboard.getGit(),
      ])

      expect(summary.data.summary.specifications).toBe(2)
      expect(trends.trendKinds.requirements).toBe('monotonic')
      expect(git.defaultBranch).toBe('origin/main')
    })

    it('accepts scheduler queue and resource-admission stages on Dashboard subscriptions', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      planning.dashboardProjectionService.subscribeGit = (listener) => {
        listener({ type: 'stage', phase: 'queue-enter', workGeneration: 1 })
        listener({ type: 'stage', phase: 'resource-admitted', workGeneration: 1 })
        return { unsubscribe() {} }
      }
      const caller = appRouter.createCaller(context)
      const observable = await caller.dashboard.subscribeGit()
      const events: unknown[] = []
      const errors: Error[] = []
      const subscription = observable.subscribe({
        next: (event) => events.push(event),
        error: (error) => errors.push(error instanceof Error ? error : new Error(String(error))),
      })

      await vi.waitFor(() => expect(events).toHaveLength(2))
      expect(errors).toEqual([])
      expect(events).toEqual([
        { type: 'stage', phase: 'queue-enter', workGeneration: 1 },
        { type: 'stage', phase: 'resource-admitted', workGeneration: 1 },
      ])
      subscription.unsubscribe()
    })

    it('replays the legacy Dashboard subscription without forcing a refresh', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      await planning.dashboardOverviewService.getCurrent()
      const refresh = vi.spyOn(planning.dashboardOverviewService, 'refresh')
      const caller = appRouter.createCaller(context)
      const observable = await caller.dashboard.subscribe()
      const values: unknown[] = []
      const subscription = observable.subscribe({ next: (value) => values.push(value) })

      await vi.waitFor(() => expect(values).toHaveLength(1))
      expect(refresh).not.toHaveBeenCalled()
      subscription.unsubscribe()
    })

    it('invalidates only the Dashboard Git region after a Code refresh', async () => {
      const projectDir = await createTempProjectDir('openspecui-dashboard-regional-refresh-')
      await initGitRepo(projectDir)
      const context = createMockContext(createMockAdapter(), { projectDir })
      const planning = await resolveMockPlanningRoot(context)
      const invalidateGit = planning.dashboardProjectionService.invalidateGit
      const refresh = vi.spyOn(planning.dashboardOverviewService, 'refresh')
      const caller = appRouter.createCaller(context)
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken

      await expect(
        caller.dashboard.refreshGitSnapshot({
          scope: 'code',
          expectedBindingToken,
          reason: 'regional-test',
        })
      ).resolves.toEqual({ success: true })
      await vi.waitFor(() => expect(invalidateGit).toHaveBeenCalledOnce())
      expect(refresh).not.toHaveBeenCalled()
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
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      const result = await caller.dashboard.refreshGitSnapshot({
        scope: 'code',
        expectedBindingToken,
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
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      const result = await caller.dashboard.refreshGitSnapshot({
        scope: 'code',
        expectedBindingToken,
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
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken

      const result = await caller.dashboard.refreshGitSnapshot({
        scope: 'code',
        expectedBindingToken,
        reason: 'no-git',
      })

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
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      const result = await caller.dashboard.removeDetachedWorktree({
        scope: 'code',
        expectedBindingToken,
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
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken

      await expect(
        caller.dashboard.removeDetachedWorktree({
          scope: 'code',
          expectedBindingToken,
          path: projectDir,
        })
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
      await expect(
        caller.git.overview({
          scope: 'planning',
          expectedBindingToken: planning.gitBindingToken,
        })
      ).rejects.toThrow(/Planning repository scope is unavailable or identical/)
    })

    it('keeps status, history, detail, and readonly refresh inside the selected repository', async () => {
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
      const planningBindingToken = scopes.planning?.bindingToken
      if (!planningBindingToken) throw new Error('Expected Planning repository binding token.')
      const codeBindingToken = scopes.code.bindingToken
      const [codeEntries, planningEntries, codeFiles, planningFiles] = await Promise.all([
        caller.git.listEntries({ scope: 'code', expectedBindingToken: codeBindingToken }),
        caller.git.listEntries({ scope: 'planning', expectedBindingToken: planningBindingToken }),
        caller.git.getEntryFiles({
          scope: 'code',
          expectedBindingToken: codeBindingToken,
          selector: { type: 'uncommitted' },
        }),
        caller.git.getEntryFiles({
          scope: 'planning',
          expectedBindingToken: planningBindingToken,
          selector: { type: 'uncommitted' },
        }),
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

      await caller.git.refresh({
        scope: 'planning',
        expectedBindingToken: planningBindingToken,
        reason: 'planning-scope-test',
      })
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

    it('rejects a stale Planning refresh before the rebound repository stamp is touched', async () => {
      const codeRepository = await createTempProjectDir('openspecui-router-git-stale-code-')
      const rootA = await createTempProjectDir('openspecui-router-git-stale-a-')
      const rootB = await createTempProjectDir('openspecui-router-git-stale-b-')
      await Promise.all([initGitRepo(codeRepository), initGitRepo(rootA), initGitRepo(rootB)])

      const context = createMockContext(createMockAdapter(), { projectDir: codeRepository })
      const planning = await resolveMockPlanningRoot(context)
      planning.rootContext = {
        ...planning.rootContext,
        launchProject: { path: codeRepository },
        planningRoot: {
          path: rootA,
          source: 'store',
          store_id: 'root-a',
          healthy: true,
          status: [],
        },
        storeId: 'root-a',
      }
      const caller = appRouter.createCaller(context)
      const rootABinding = (await caller.git.scopes()).planning
      if (!rootABinding) throw new Error('Expected Root A Planning repository binding.')

      planning.rootContext = {
        ...planning.rootContext,
        planningRoot: {
          path: rootB,
          source: 'store',
          store_id: 'root-b',
          healthy: true,
          status: [],
        },
        storeId: 'root-b',
      }
      planning.gitBindingToken = 'planning-binding-b'
      const rootBGitDir = await runGit(rootB, ['rev-parse', '--git-dir'])
      const rootBStamp = resolvePath(rootB, rootBGitDir, 'openspecui-dashboard-git-refresh.stamp')

      await expect(
        caller.git.refresh({
          scope: 'planning',
          expectedBindingToken: rootABinding.bindingToken,
          reason: 'stale-root-a-refresh',
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(pathExists(rootBStamp)).resolves.toBe(false)

      await expect(
        caller.git.refresh({
          scope: 'planning',
          expectedBindingToken: planning.gitBindingToken,
          reason: 'current-root-b-refresh',
        })
      ).resolves.toEqual({ success: true })
      await expect(pathExists(rootBStamp)).resolves.toBe(true)
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
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      const overview = await caller.git.overview({ scope: 'code', expectedBindingToken })
      const entries = await caller.git.listEntries({ scope: 'code', expectedBindingToken })

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
        expectedBindingToken,
        selector: { type: 'uncommitted' },
      })
      expect(uncommittedMeta).toMatchObject({
        type: 'uncommitted',
        diff: { files: 1, insertions: 0, deletions: 0 },
      })

      const uncommittedFiles = await caller.git.getEntryFiles({
        scope: 'code',
        expectedBindingToken,
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
        expectedBindingToken,
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
        expectedBindingToken,
        selector: { type: 'commit', hash: commitEntry.hash },
      })
      expect(commitMeta).toMatchObject({
        type: 'commit',
        hash: commitEntry.hash,
      })

      const commitFiles = await caller.git.getEntryFiles({
        scope: 'code',
        expectedBindingToken,
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
        expectedBindingToken,
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

      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      const overview = await caller.git.overview({ scope: 'code', expectedBindingToken })
      const targetPath = overview.otherWorktrees[0]?.path
      if (!targetPath) {
        throw new Error('Expected overview to include the sibling worktree')
      }

      const handoff = await caller.git.switchWorktree({
        scope: 'code',
        expectedBindingToken,
        path: targetPath,
      })

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
          name: 'auth',
          summary: null,
          requirementCount: 2,
          updatedAt: 0,
        },
        {
          identity: { kind: 'owned', specId: 'api' },
          source: 'owned',
          readOnly: false,
          name: 'api',
          summary: null,
          requirementCount: 1,
          updatedAt: 0,
        },
      ])
      expect(catalog.ownedProjection).toMatchObject({
        provenance: 'live',
        root: { path: '/tmp/openspecui-router-test', source: 'nearest' },
        evidence: {
          success: true,
          payload: {
            specs: [
              { id: 'auth', requirementCount: 2 },
              { id: 'api', requirementCount: 1 },
            ],
          },
        },
      })
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

    it('preserves every recursive Spec identity segment through public mutation', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      await expect(
        caller.spec.save({
          identity: { kind: 'owned', specId: 'platform/auth' },
          content: '# Platform Auth',
        })
      ).resolves.toEqual({ success: true })
      expect(adapter.writeSpec).toHaveBeenCalledExactlyOnceWith('platform/auth', '# Platform Auth')
    })

    it.each(['../escaped', 'platform//auth', '/platform/auth', '%2e%2e%2fescaped'])(
      'rejects non-canonical Spec id %j before Adapter mutation',
      async (specId) => {
        const adapter = createMockAdapter()
        const caller = createCaller(adapter)

        await expect(
          caller.spec.save({
            identity: { kind: 'owned', specId },
            content: '# Escaped',
          })
        ).rejects.toThrow(/Invalid specId/)
        expect(adapter.writeSpec).not.toHaveBeenCalled()
      }
    )

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

    it('forwards a completed Change row batch before the final inventory snapshot', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const firstRow = {
        id: 'add-caching',
        name: 'Add caching',
        trackedTaskProgress: trackedTaskProgress(1, 0),
        documentChecklistSummary: documentChecklistSummary(),
        createdAt: 1,
        updatedAt: 1,
      }
      const batchIdentity = {
        projectionKind: 'changes-rows',
        planningRoot: {
          identity: '/tmp/openspecui-router-test',
          source: 'nearest',
          storeSelector: null,
        },
        owner: { generation: 'planning-binding', gitBindingToken: null },
        selector: 'changes:list-with-meta',
        inputFingerprint: 'router-fixture:v1',
        protocolVersion: 1,
      }
      planning.changesProjectionService.subscribe = (listener) => {
        listener({
          type: 'batch',
          batch: {
            rows: [firstRow],
            errors: [],
            progress: { completed: 1, total: 2 },
          },
          progress: { completed: 1, total: 2 },
          identity: batchIdentity,
          workGeneration: 1,
        })
        return { unsubscribe: vi.fn() }
      }
      const observable = await appRouter.createCaller(context).change.subscribeBatches()
      const received: unknown[] = []
      const subscription = observable.subscribe({
        next: (event) => received.push(event),
      })

      await vi.waitFor(() =>
        expect(received).toContainEqual(
          expect.objectContaining({
            type: 'batch',
            batch: expect.objectContaining({ rows: [firstRow] }),
            progress: { completed: 1, total: 2 },
            identity: batchIdentity,
          })
        )
      )
      expect(
        received.some((event) => typeof event === 'object' && event !== null && 'snapshot' in event)
      ).toBe(false)
      subscription.unsubscribe()
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
    it('pushes Launch Project initialization replacement through the public subscription', async () => {
      const projectDir = await createTempProjectDir('openspecui-init-subscribe-')
      await acquireWatcherRoot(projectDir)
      const context = createMockContext(new OpenSpecAdapter(projectDir), { projectDir })
      const stream = await appRouter.createCaller(context).init.subscribe()
      const events: Awaited<ReturnType<OpenSpecAdapter['readLaunchProjectInitialization']>>[] = []
      const subscription = stream.subscribe({ next: (event) => events.push(event) })

      await vi.waitFor(() => expect(events.at(-1)?.initialized).toBe(false))
      await mkdir(join(projectDir, 'openspec'), { recursive: true })
      await vi.waitFor(() => expect(events.at(-1)?.initialized).toBe(true))

      subscription.unsubscribe()
    })

    it('reads Launch Project initialization without starting a mutation', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      const result = await caller.init.get()

      expect(result).toEqual({
        initialized: false,
        launchProjectPath: '/tmp/openspecui-router-test',
        openspecPath: '/tmp/openspecui-router-test/openspec',
      })
      expect(adapter.init).not.toHaveBeenCalled()
    })

    it('streams only the fixed Launch Project tools-none command and cancels on detach', async () => {
      const context = createMockContext()
      const terminal = Promise.withResolvers<CliStreamSettlement>()
      const cancel = vi.fn(() => terminal.promise)
      const initProjectStream = vi.mocked(context.cliExecutor.initProjectStream)
      initProjectStream.mockReturnValue({ settled: terminal.promise, cancel })
      const stream = await appRouter
        .createCaller(context)
        .init.initStream({ requestId: 'init-detach' })
      const subscription = stream.subscribe({ error() {} })

      await vi.waitFor(() =>
        expect(initProjectStream).toHaveBeenCalledWith(context.projectDir, expect.any(Function))
      )
      subscription.unsubscribe()
      terminal.resolve({ reason: 'cancelled', exitCode: null })
      await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
    })

    it('keeps explicit cancellation pending until the CLI process settles', async () => {
      const context = createMockContext()
      const terminal = Promise.withResolvers<CliStreamSettlement>()
      let mutationEvent: ((event: CliStreamEvent) => void) | null = null
      const cancel = vi.fn(() => terminal.promise)
      vi.mocked(context.cliExecutor.initProjectStream).mockImplementation((_path, onEvent) => {
        mutationEvent = onEvent
        return { settled: terminal.promise, cancel }
      })
      const caller = appRouter.createCaller(context)
      const stream = await caller.init.initStream({ requestId: 'init-cancel' })
      const events: CliStreamEvent[] = []
      const complete = vi.fn()
      stream.subscribe({ next: (event) => events.push(event), complete, error() {} })
      await vi.waitFor(() => expect(mutationEvent).not.toBeNull())

      let cancellationSettled = false
      const cancellation = caller.init.cancel({ requestId: 'init-cancel' }).then((value) => {
        cancellationSettled = true
        return value
      })
      await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
      expect(cancellationSettled).toBe(false)

      mutationEvent?.({ type: 'exit', exitCode: null })
      terminal.resolve({ reason: 'cancelled', exitCode: null })

      await expect(cancellation).resolves.toEqual({ reason: 'cancelled', exitCode: null })
      await expect(caller.init.cancel({ requestId: 'init-cancel' })).resolves.toEqual({
        reason: 'cancelled',
        exitCode: null,
      })
      expect(events).toEqual([{ type: 'exit', exitCode: null }])
      expect(complete).toHaveBeenCalledOnce()
    })

    it('replays an HTTP cancellation across repeated late Init subscriptions', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await expect(caller.init.cancel({ requestId: 'init-early-cancel' })).resolves.toEqual({
        reason: 'cancelled',
        exitCode: null,
      })

      for (const replay of [1, 2]) {
        const stream = await caller.init.initStream({ requestId: 'init-early-cancel' })
        const events: CliStreamEvent[] = []
        const complete = vi.fn()
        stream.subscribe({ next: (event) => events.push(event), complete, error() {} })
        await vi.waitFor(() => expect(events).toEqual([{ type: 'exit', exitCode: null }]))
        expect(complete, `replay ${replay}`).toHaveBeenCalledOnce()
      }
      expect(context.cliExecutor.initProjectStream).not.toHaveBeenCalled()
    })

    it('withholds successful exit until every Init replacement owner settles', async () => {
      const context = createMockContext()
      vi.mocked(context.launchProjectAdapter.readLaunchProjectInitialization).mockResolvedValue({
        initialized: true,
        launchProjectPath: context.projectDir,
        openspecPath: join(context.projectDir, 'openspec'),
      })
      const rootReplacement = await context.rootContextProjectionService.getCurrent()
      const rootSettlement = Promise.withResolvers<typeof rootReplacement>()
      const rootRefresh = vi.spyOn(context.rootContextProjectionService, 'refresh')
      vi.spyOn(context.rootContextProjectionService, 'getCurrent').mockReturnValue(
        rootSettlement.promise
      )
      const replacement = await context.agentDeliveryProjectionService.getCurrent()
      const refreshSettlement = Promise.withResolvers<typeof replacement>()
      const refresh = vi
        .spyOn(context.agentDeliveryProjectionService, 'refresh')
        .mockReturnValue(refreshSettlement.promise)
      const planning = await resolveMockPlanningRoot(context)
      const settledConfigBundle = {
        kind: 'opsx-config-bundle',
        value: { schemas: [], schemaDetails: {}, schemaResolutions: {} },
        evidence: {
          schemas: {
            success: true,
            stdout: '{}',
            stderr: '',
            exitCode: 0,
            payload: {},
            diagnostics: [],
          },
          schemaResolutions: {},
        },
      } satisfies Extract<PlanningCliProjectionData, { kind: 'opsx-config-bundle' }>
      const configBundle = vi
        .spyOn(planning.planningCliProjectionService, 'getCurrent')
        .mockResolvedValue(settledConfigBundle)
      vi.mocked(context.cliExecutor.initProjectStream).mockImplementation((_path, onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return {
          settled: Promise.resolve({ reason: 'exited', exitCode: 0 }),
          cancel: () => Promise.resolve({ reason: 'cancelled', exitCode: null }),
        }
      })
      const stream = await appRouter
        .createCaller(context)
        .init.initStream({ requestId: 'init-success' })
      const events: CliStreamEvent[] = []
      const complete = vi.fn()
      stream.subscribe({ next: (event) => events.push(event), complete })

      await vi.waitFor(() => expect(rootRefresh).toHaveBeenCalledOnce())
      expect(events).toEqual([])
      expect(complete).not.toHaveBeenCalled()

      rootSettlement.resolve(rootReplacement)
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce())
      expect(events).toEqual([])

      refreshSettlement.resolve(replacement)
      await vi.waitFor(() => expect(events).toEqual([{ type: 'exit', exitCode: 0 }]))
      expect(context.planningRootServices.resolveRootContext).toHaveBeenCalled()
      expect(configBundle).toHaveBeenCalledWith({ kind: 'opsx-config-bundle' })
      expect(complete).toHaveBeenCalledOnce()
    })
  })

  describe('cli', () => {
    it('projects a rejected Planning-root Validate handle as one terminal tRPC error', async () => {
      const context = createMockContext()
      const terminal = Promise.withResolvers<CliStreamSettlement>()
      void terminal.promise.catch(() => {})
      const cancel = vi.fn(() => terminal.promise)
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      validateStream.mockReturnValue({ settled: terminal.promise, cancel })
      const stream = await appRouter.createCaller(context).cli.validateStream({
        id: 'add-search',
        type: 'change',
        strict: true,
      })
      const events: CliStreamEvent[] = []
      const errors: unknown[] = []
      const completes = vi.fn()
      const subscription = stream.subscribe({
        next: (event) => events.push(event),
        complete: completes,
        error: (error) => errors.push(error),
      })
      await vi.waitFor(() => expect(validateStream).toHaveBeenCalledOnce())
      const failure = new Error('forced termination did not confirm Validate child close')

      terminal.reject(failure)

      await vi.waitFor(() => expect(errors).toEqual([failure]), { timeout: 200 })
      expect(events.filter((event) => event.type === 'exit')).toEqual([])
      expect(completes).not.toHaveBeenCalled()
      subscription.unsubscribe()
      await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
    })

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
      validateStream.mockImplementation((_options, onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return settledStreamHandle(0)
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

    it('rejects a stale prepared workflow generation before Validate starts', async () => {
      const context = createMockContext()
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      const caller = appRouter.createCaller(context)
      const validateObservable = await caller.cli.validateStream({
        id: 'add-search',
        type: 'change',
        strict: true,
        expectedRootGeneration: 'planning-binding-a',
      })

      await expect(
        new Promise<void>((resolve, reject) => {
          validateObservable.subscribe({ complete: resolve, error: reject })
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      expect(validateStream).not.toHaveBeenCalled()
    })

    it('exposes archive only through the strict Server-owned stream', () => {
      expect(appRouter._def.procedures).not.toHaveProperty('cli.archive')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.archiveStream')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.execute')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.runCommandStream')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.executeOpenSpec')
      expect(appRouter._def.procedures).not.toHaveProperty('cli.executeOpenSpecStream')
      expect(appRouter._def.procedures).toHaveProperty('cli.archiveStrictStream')
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
      validateStream.mockImplementation((_options, onEvent) => {
        onEvent({ type: 'command', data: 'openspec validate add-search --strict' })
        onEvent({ type: 'exit', exitCode: 0 })
        return settledStreamHandle(0)
      })
      archiveStream.mockImplementation((_changeId, _options, onEvent) => {
        onEvent({ type: 'command', data: 'openspec archive -y add-search --no-validate' })
        onEvent({ type: 'exit', exitCode: 0 })
        return settledStreamHandle(0)
      })
      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        expectedRootGeneration: 'planning-binding',
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

    it('projects a rejected strict Archive handle as one terminal tRPC error', async () => {
      const context = createMockContext()
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      const archiveStream = context.cliExecutor.archiveStream as unknown as ReturnType<typeof vi.fn>
      const terminal = Promise.withResolvers<CliStreamSettlement>()
      void terminal.promise.catch(() => {})
      validateStream.mockImplementation((_options, onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return settledStreamHandle(0)
      })
      archiveStream.mockReturnValue({
        settled: terminal.promise,
        cancel: () => terminal.promise,
      })
      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        expectedRootGeneration: 'planning-binding',
      })
      const errors: unknown[] = []
      const completes = vi.fn()
      const subscription = stream.subscribe({
        complete: completes,
        error: (error) => errors.push(error),
      })

      await vi.waitFor(() => expect(archiveStream).toHaveBeenCalledOnce())
      const failure = new Error('forced termination did not confirm child close')
      terminal.reject(failure)

      await vi.waitFor(() => expect(errors).toEqual([failure]), { timeout: 200 })
      expect(completes).not.toHaveBeenCalled()
      subscription.unsubscribe()
    })

    it.each(
      [
        'archive/../legit',
        'archive\\..\\legit',
        '/absolute-change',
        '../legit',
        '.',
        ' leading-space',
        'trailing-space ',
        'nul\0change',
      ].flatMap((changeId) => [
        { changeId, noValidate: false },
        { changeId, noValidate: true },
      ])
    )(
      'rejects non-canonical Archive id $changeId before Root or CLI work (noValidate=$noValidate)',
      async ({ changeId, noValidate }) => {
        const context = createMockContext()
        const startPlanningRootStream = context.planningRootServices
          .startOperationStream as unknown as ReturnType<typeof vi.fn>
        const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
          typeof vi.fn
        >
        const archiveStream = context.cliExecutor.archiveStream as unknown as ReturnType<
          typeof vi.fn
        >
        validateStream.mockImplementation((_options, onEvent) => {
          onEvent({ type: 'exit', exitCode: 1 })
          return settledStreamHandle(1)
        })
        archiveStream.mockImplementation((_changeId, _options, onEvent) => {
          onEvent({ type: 'exit', exitCode: 0 })
          return settledStreamHandle(0)
        })

        const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
          changeId,
          expectedRootGeneration: 'planning-binding',
          noValidate,
        })
        await expect(
          new Promise<void>((resolve, reject) => {
            stream.subscribe({ complete: resolve, error: reject })
          })
        ).rejects.toThrow(/Invalid changeId/)
        expect(startPlanningRootStream).not.toHaveBeenCalled()
        expect(validateStream).not.toHaveBeenCalled()
        expect(archiveStream).not.toHaveBeenCalled()
      }
    )

    it('does not archive after strict preflight failure', async () => {
      const context = createMockContext()
      const validateStream = context.cliExecutor.validateStream as unknown as ReturnType<
        typeof vi.fn
      >
      const archiveStream = context.cliExecutor.archiveStream as unknown as ReturnType<typeof vi.fn>
      validateStream.mockImplementation((_options, onEvent) => {
        onEvent({ type: 'stderr', data: 'strict validation failed' })
        onEvent({ type: 'exit', exitCode: 1 })
        return settledStreamHandle(1)
      })
      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        expectedRootGeneration: 'planning-binding',
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
      archiveStream.mockImplementation((_changeId, _options, onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return settledStreamHandle(0)
      })

      const stream = await appRouter.createCaller(context).cli.archiveStrictStream({
        changeId: 'add-search',
        expectedRootGeneration: 'planning-binding',
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

    it('reads and writes global config without fabricating data-home invalidation', async () => {
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
          stdout: '',
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
      expect(context.planningRootServices.resolveRootContext).not.toHaveBeenCalled()
      expect(setResult.success).toBe(true)
      const invalidation = context.runtimeInvalidation as RuntimeInvalidationIndex
      expect(invalidation.current('stores')).toBe(0)
      expect(invalidation.current('worksets')).toBe(0)
      expect(invalidation.current('schemas')).toBe(0)
      expect(invalidation.current('context')).toBe(0)
    })

    it('pushes Environment Global lifecycle notices and Pulls typed CLI data', async () => {
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
          stdout: '',
          stderr: '',
          exitCode: 0,
        })

      const caller = appRouter.createCaller(context)
      const observable = await caller.planningConfig.subscribeEnvironmentGlobalProjection()
      const readyNotice = Promise.withResolvers<CliProjectionNotice>()
      const subscription = observable.subscribe({
        next: (notice) => {
          expect(notice).not.toHaveProperty('data')
          if (notice.state === 'ready') readyNotice.resolve(notice)
        },
        error: readyNotice.reject,
      })

      await expect(readyNotice.promise).resolves.toMatchObject({
        identity: expect.any(String),
        workGeneration: 1,
        state: 'ready',
      })
      await expect(caller.planningConfig.readEnvironmentGlobalProjection()).resolves.toMatchObject({
        state: 'ready',
        freshness: 'current',
        data: {
          configPath: '/tmp/mock-openspec-config.json',
          config: { profile: 'core', delivery: 'both', workflows: ['propose'] },
          owner: { kind: 'runtime-environment' },
        },
      })
      expect(context.planningRootServices.resolveRootContextReactive).not.toHaveBeenCalled()
      subscription.unsubscribe()
    })

    it('refreshes Environment and Root projections without fabricating effective fallback success', async () => {
      const context = createMockContext()
      const execute = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>
      const caller = appRouter.createCaller(context)

      const result = await caller.planningConfig.writeEnvironmentDefaultStore({
        value: 'team-plans',
      })

      expect(execute).toHaveBeenCalledWith([
        'config',
        'set',
        'defaultStore',
        'team-plans',
        '--string',
      ])
      expect(result).toMatchObject({
        kind: 'environment-default-store-update',
        configured: { state: 'configured', id: 'team-plans' },
        environment: { state: 'loading', data: null },
        file: { state: 'loading', data: null },
        rootContext: { state: 'loading', data: null },
      })
    })

    it('uses the distinct explicit-clear mutation for machine defaultStore', async () => {
      const context = createMockContext()
      const execute = context.cliExecutor.execute as unknown as ReturnType<typeof vi.fn>

      const result = await appRouter
        .createCaller(context)
        .planningConfig.writeEnvironmentDefaultStore({ value: null })

      expect(execute).toHaveBeenCalledWith(['config', 'unset', 'defaultStore'])
      expect(result.configured).toEqual({ state: 'absent', id: null })
    })
  })

  describe('opsx', () => {
    it('adapts every Schema and Template mutation through the Planning-root owner', async () => {
      const context = createMockContext()
      const mutateSchema = vi.fn(async (action: SchemaMutationAction) =>
        action.action === 'init' || action.action === 'fork'
          ? { success: true, stdout: '{}', stderr: '', exitCode: 0 }
          : null
      )
      context.planningRootServices.mutateSchema = mutateSchema
      const caller = appRouter.createCaller(context)

      await expect(
        caller.opsx.writeSchemaFile({ schema: 'demo', path: '../outside.md', content: 'outside' })
      ).rejects.toThrow(/invalid|relative/i)
      expect(mutateSchema).not.toHaveBeenCalled()
      expect((context.runtimeInvalidation as RuntimeInvalidationIndex).current('schemas')).toBe(0)

      await caller.opsx.writeSchemaYaml({ name: 'demo', content: 'name: demo\n' })
      await caller.opsx.writeSchemaFile({ schema: 'demo', path: 'notes.md', content: '# Notes\n' })
      await caller.opsx.createSchemaFile({ schema: 'demo', path: 'new.md', content: '' })
      await caller.opsx.createSchemaDirectory({ schema: 'demo', path: 'templates/nested' })
      await caller.opsx.deleteSchemaEntry({ schema: 'demo', path: 'new.md' })
      await caller.opsx.writeTemplateContent({
        schema: 'demo',
        artifactId: 'proposal',
        content: '# Proposal\n',
      })
      await caller.opsx.deleteSchema({ name: 'demo' })
      await caller.opsx.initSchema({ name: 'new-schema' })
      await caller.opsx.forkSchema({ source: 'spec-driven', name: 'derived-schema' })

      expect(mutateSchema).toHaveBeenNthCalledWith(1, {
        action: 'write-yaml',
        schema: 'demo',
        content: 'name: demo\n',
      })
      expect(mutateSchema).toHaveBeenNthCalledWith(2, {
        action: 'write-file',
        schema: 'demo',
        path: 'notes.md',
        content: '# Notes\n',
      })
      expect(mutateSchema).toHaveBeenNthCalledWith(3, {
        action: 'create-file',
        schema: 'demo',
        path: 'new.md',
        content: '',
      })
      expect(mutateSchema).toHaveBeenNthCalledWith(4, {
        action: 'create-directory',
        schema: 'demo',
        path: 'templates/nested',
      })
      expect(mutateSchema).toHaveBeenNthCalledWith(5, {
        action: 'delete-entry',
        schema: 'demo',
        path: 'new.md',
      })
      expect(mutateSchema).toHaveBeenNthCalledWith(6, {
        action: 'write-template',
        schema: 'demo',
        artifactId: 'proposal',
        content: '# Proposal\n',
      })
      expect(mutateSchema).toHaveBeenNthCalledWith(7, { action: 'delete-schema', schema: 'demo' })
      expect(mutateSchema).toHaveBeenNthCalledWith(8, { action: 'init', name: 'new-schema' })
      expect(mutateSchema).toHaveBeenNthCalledWith(9, {
        action: 'fork',
        source: 'spec-driven',
        name: 'derived-schema',
      })
      expect((context.runtimeInvalidation as RuntimeInvalidationIndex).current('schemas')).toBe(9)
    })

    it('delivers Status List while unrelated full Kernel warmup remains pending', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const pendingWarmup = planning.kernel.waitForWarmup as unknown as ReturnType<typeof vi.fn>
      pendingWarmup.mockImplementation(() => new Promise<void>(() => {}))
      const status: ChangeStatus = {
        changeName: 'add-caching',
        schemaName: 'spec-driven',
        isPlanningComplete: false,
        applyRequires: [],
        artifacts: [],
        provenance: {
          kind: 'cli',
          planningHome: {
            kind: 'repo',
            root: '/tmp/openspecui-router-test',
            changesDir: '/tmp/openspecui-router-test/openspec/changes',
            defaultSchema: 'spec-driven',
          },
          changeRoot: '/tmp/openspecui-router-test/openspec/changes/add-caching',
          artifactPaths: {},
          nextSteps: [],
          actionContext: {
            mode: 'repo-local',
            sourceOfTruth: 'repo',
            planningArtifacts: [],
            linkedContext: [],
            allowedEditRoots: ['/tmp/openspecui-router-test'],
            requiresAffectedAreaSelection: false,
            constraints: [],
          },
          root: { path: '/tmp/openspecui-router-test', source: 'nearest' },
          evidence: {
            command: 'status',
            success: true,
            stdout: '{"changeName":"add-caching"}',
            stderr: '',
            exitCode: 0,
            payload: { changeName: 'add-caching' },
            diagnostics: [],
            selector: {},
          },
        },
      }
      planning.kernel.readStatusListProjection.mockResolvedValue({
        value: [status],
        evidence: {
          success: true,
          stdout: '{"changes":[{"name":"add-caching"}]}',
          stderr: '',
          exitCode: 0,
          payload: { changes: [{ name: 'add-caching' }] },
          diagnostics: [],
        },
      })
      const caller = appRouter.createCaller(context)
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Status List remained behind full warmup.')), 250)
      })

      const result = await Promise.race([caller.opsx.statusList(), timeout])

      expect(result).toEqual([status])
      expect(planning.kernel.readStatusListProjection).toHaveBeenCalledTimes(1)
      expect(pendingWarmup).not.toHaveBeenCalled()
      expect(result[0]?.provenance).toMatchObject({
        kind: 'cli',
        evidence: {
          command: 'status',
          selector: {},
          stdout: '{"changeName":"add-caching"}',
        },
      })
    })

    it('keeps Apply Instructions as an independent lazy leaf', async () => {
      const context = createMockContext()
      const planning = await resolveMockPlanningRoot(context)
      const pendingWarmup = planning.kernel.waitForWarmup as unknown as ReturnType<typeof vi.fn>
      pendingWarmup.mockImplementation(() => new Promise<void>(() => {}))
      const caller = appRouter.createCaller(context)
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Apply remained behind full warmup.')), 250)
      })

      const result = await Promise.race([
        caller.opsx.applyInstructions({ change: 'add-caching' }),
        timeout,
      ])

      expect(result.applyInstructionProgress).toMatchObject({
        source: 'openspec-instructions-apply',
      })
      expect(result.evidence).toMatchObject({
        command: 'instructions apply',
        selector: {},
        root: { source: 'nearest' },
      })
      expect(planning.kernel.readApplyInstructionsProjection).toHaveBeenCalledWith(
        'add-caching',
        undefined
      )
      expect(pendingWarmup).not.toHaveBeenCalled()
    })

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
        context.planningRootServices.runOperation as unknown as ReturnType<typeof vi.fn>
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
