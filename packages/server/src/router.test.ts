import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve as resolvePath } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardOverviewService } from '../src/dashboard-overview-service.js'
import { loadDashboardOverview } from '../src/dashboard-overview.js'
import type { Context } from '../src/router.js'
import { appRouter } from '../src/router.js'

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
      progress: { total: 0, completed: 0 },
      createdAt: 1,
      updatedAt: 30,
    },
  ]),
  listArchivedChanges: vi.fn().mockResolvedValue(['old-change']),
  listArchivedChangesWithMeta: vi
    .fn()
    .mockResolvedValue([{ id: 'old-change', name: 'Old Change', createdAt: 1, updatedAt: 1 }]),
  readArchivedChange: vi.fn().mockResolvedValue({
    id: 'old-change',
    name: 'Old Change',
    why: 'why',
    whatChanges: 'what',
    deltas: [],
    tasks: [{ id: '1', text: 'done', completed: true }],
    progress: { total: 1, completed: 1 },
  }),
  readSpec: vi.fn().mockImplementation(async (id: string) => {
    if (id === 'api') {
      return {
        id: 'api',
        name: 'Public API',
        overview: 'API spec',
        requirements: [{ id: 'r-1', text: 'one', scenarios: [{ rawText: 's' }] }],
      }
    }
    return {
      id: 'auth',
      name: 'Authentication',
      overview: 'Auth spec',
      requirements: [
        { id: 'r-1', text: 'one', scenarios: [{ rawText: 's' }] },
        { id: 'r-2', text: 'two', scenarios: [{ rawText: 's' }] },
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
    tasks: [],
    progress: { total: 0, completed: 0 },
  }),
  readChangeRaw: vi.fn().mockResolvedValue({ proposal: '# Add Caching', tasks: '' }),
  writeSpec: vi.fn().mockResolvedValue(undefined),
  writeChange: vi.fn().mockResolvedValue(undefined),
  archiveChange: vi.fn().mockResolvedValue(true),
  validateSpec: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
  validateChange: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
  init: vi.fn().mockResolvedValue(undefined),
  getDashboardData: vi.fn().mockResolvedValue(undefined),
})

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
  } = {}
): Context => {
  const configManager = {
    readConfig: vi.fn().mockResolvedValue({
      cli: {},
      theme: 'system',
      codeEditor: {
        theme: 'github',
      },
      terminal: {
        fontSize: 13,
        fontFamily: '',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        rendererEngine: 'xterm',
      },
      dashboard: { trendPointLimit: 100 },
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
      progress: { total: 0, complete: 0, remaining: 0 },
    }),
  }

  const searchService = {
    query: vi.fn().mockResolvedValue({ total: 0, hits: [] }),
    queryReactive: vi.fn().mockResolvedValue({ total: 0, hits: [] }),
  }

  const projectDir = options.projectDir ?? '/tmp/openspecui-router-test'
  const dashboardOverviewService = new DashboardOverviewService((reason) =>
    loadDashboardOverview(
      {
        adapter: adapter as unknown as Context['adapter'],
        configManager: configManager as unknown as Context['configManager'],
        projectDir,
      },
      reason
    )
  )

  return {
    adapter: adapter as unknown as Context['adapter'],
    configManager: configManager as unknown as Context['configManager'],
    cliExecutor: cliExecutor as unknown as Context['cliExecutor'],
    kernel: kernel as unknown as Context['kernel'],
    searchService: searchService as unknown as Context['searchService'],
    dashboardOverviewService,
    watcher: undefined,
    projectDir,
  }
}

const createCaller = (
  adapter = createMockAdapter(),
  options: {
    projectDir?: string
  } = {}
) => {
  return appRouter.createCaller({
    ...createMockContext(adapter, options),
  })
}

describe('appRouter', () => {
  describe('system', () => {
    it('should return runtime status', async () => {
      const caller = createCaller()
      const status = await caller.system.status()

      expect(status.projectDir).toBe('/tmp/openspecui-router-test')
      expect(typeof status.watcherEnabled).toBe('boolean')
      expect(typeof status.watcherGeneration).toBe('number')
      expect(typeof status.watcherReinitializeCount).toBe('number')
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
      expect(context.kernel.waitForWarmup).not.toHaveBeenCalled()
      expect(context.kernel.ensureApplyInstructions).not.toHaveBeenCalled()
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
            text: 'requirement',
            scenarios: [{ rawText: 'scenario' }],
          })),
        }
      })
      adapter.listChangesWithMeta.mockResolvedValue(
        Array.from({ length: 12 }, (_, index) => ({
          id: `change-${index}`,
          name: `Change ${index}`,
          progress: { total: 1, completed: index % 2 },
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
          createdAt: 2_000_000_000_000,
          updatedAt: 2_000_000_000_000,
        },
        {
          id: '2026-02-21-opsx-config-center',
          name: 'Archive B',
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
      const result = await caller.dashboard.refreshGitSnapshot({ reason: 'test-manual' })
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
      const result = await caller.dashboard.refreshGitSnapshot({ reason: 'worktree' })
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

      const result = await caller.dashboard.refreshGitSnapshot({ reason: 'no-git' })

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

      await expect(caller.dashboard.removeDetachedWorktree({ path: projectDir })).rejects.toThrow(
        /Only detached worktrees can be removed/
      )
    })
  })

  describe('spec', () => {
    it('should list specs', async () => {
      const caller = createCaller()
      const specs = await caller.spec.list()

      expect(specs).toEqual(['auth', 'api'])
    })

    it('should get a spec', async () => {
      const caller = createCaller()
      const spec = await caller.spec.get({ id: 'auth' })

      expect(spec?.id).toBe('auth')
      expect(spec?.name).toBe('Authentication')
    })

    it('should get raw spec', async () => {
      const caller = createCaller()
      const raw = await caller.spec.getRaw({ id: 'auth' })

      expect(raw).toContain('# Auth')
    })

    it('should save a spec', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      const result = await caller.spec.save({ id: 'test', content: '# Test' })

      expect(result.success).toBe(true)
      expect(adapter.writeSpec).toHaveBeenCalledWith('test', '# Test')
    })

    it('should validate a spec', async () => {
      const caller = createCaller()
      const result = await caller.spec.validate({ id: 'auth' })

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

    it('should archive a change', async () => {
      const adapter = createMockAdapter()
      const caller = createCaller(adapter)

      const result = await caller.change.archive({ id: 'add-caching' })

      expect(result).toBe(true)
      expect(adapter.archiveChange).toHaveBeenCalledWith('add-caching')
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
      const path = await caller.cli.getGlobalConfigPath()
      const config = await caller.cli.getGlobalConfig()
      const setResult = await caller.cli.setGlobalConfig({
        config: { profile: 'core', delivery: 'both', workflows: ['propose'] },
      })

      expect(path.path).toBe('/tmp/mock-openspec-config.json')
      expect(config).toMatchObject({ profile: 'core', delivery: 'both' })
      expect(setResult.success).toBe(true)
    })

    it('passes force flag to init command', async () => {
      const context = createMockContext()
      const caller = appRouter.createCaller(context)

      await caller.cli.init({ force: true })

      const initMock = context.cliExecutor.init as unknown as ReturnType<typeof vi.fn>
      expect(initMock).toHaveBeenCalledWith({ force: true, profile: undefined, tools: undefined })
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
      expect(state.workflows).toEqual(['propose', 'explore', 'apply', 'archive'])
      expect(state.driftStatus).toBe('in-sync')
    })
  })
})
