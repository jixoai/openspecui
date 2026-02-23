import { describe, expect, it, vi } from 'vitest'
import type { Context } from '../src/router.js'
import { appRouter } from '../src/router.js'

const dashboardGitSnapshotState = vi.hoisted(() => ({
  result: {
    defaultBranch: 'origin/main',
    worktrees: [
      {
        path: '/tmp/openspecui-router-test',
        relativePath: '.',
        branchName: 'main',
        isCurrent: true,
        ahead: 0,
        behind: 0,
        diff: { files: 0, insertions: 0, deletions: 0 },
        entries: [],
      },
    ],
  },
}))

vi.mock('./dashboard-git-snapshot.js', () => ({
  buildDashboardGitSnapshot: vi
    .fn()
    .mockImplementation(async () => dashboardGitSnapshotState.result),
}))

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

const createMockContext = (adapter = createMockAdapter()): Context => {
  const configManager = {
    readConfig: vi.fn().mockResolvedValue({
      cli: {},
      theme: 'system',
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
    execute: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    initStream: vi.fn(),
    archiveStream: vi.fn(),
    validateStream: vi.fn(),
    executeCommandStream: vi.fn(),
  }

  const kernel = {
    waitForWarmup: vi.fn().mockResolvedValue(undefined),
  }

  const searchService = {
    query: vi.fn().mockResolvedValue({ total: 0, hits: [] }),
    queryReactive: vi.fn().mockResolvedValue({ total: 0, hits: [] }),
  }

  return {
    adapter: adapter as unknown as Context['adapter'],
    configManager: configManager as unknown as Context['configManager'],
    cliExecutor: cliExecutor as unknown as Context['cliExecutor'],
    kernel: kernel as unknown as Context['kernel'],
    searchService: searchService as unknown as Context['searchService'],
    watcher: undefined,
    projectDir: '/tmp/openspecui-router-test',
  }
}

const createCaller = (adapter = createMockAdapter()) => {
  return appRouter.createCaller({
    ...createMockContext(adapter),
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
      const caller = createCaller()
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

    it('accepts manual git snapshot refresh trigger', async () => {
      const caller = createCaller()
      const result = await caller.dashboard.refreshGitSnapshot({ reason: 'test-manual' })

      expect(result.success).toBe(true)
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
})
