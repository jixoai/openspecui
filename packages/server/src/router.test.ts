import { describe, expect, it, vi } from 'vitest'
import type { Context } from '../src/router.js'
import { appRouter } from '../src/router.js'

// Mock adapter
const createMockAdapter = () => ({
  isInitialized: vi.fn().mockResolvedValue(true),
  listSpecs: vi.fn().mockResolvedValue(['auth', 'api']),
  listChanges: vi.fn().mockResolvedValue(['add-caching']),
  listArchivedChanges: vi.fn().mockResolvedValue(['old-change']),
  readSpec: vi.fn().mockResolvedValue({
    id: 'auth',
    name: 'Authentication',
    overview: 'Auth spec',
    requirements: [],
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
  getDashboardData: vi.fn().mockResolvedValue({
    specs: [],
    changes: [],
    archivedCount: 0,
    summary: {
      specCount: 0,
      requirementCount: 0,
      activeChangeCount: 0,
      archivedChangeCount: 0,
      totalTasks: 0,
      completedTasks: 0,
      progressPercent: 0,
    },
  }),
})

// Mock provider manager
const createMockProviderManager = () => ({
  list: vi.fn().mockReturnValue([]),
  checkAvailability: vi.fn().mockResolvedValue(new Map()),
  get: vi.fn().mockReturnValue(undefined),
  getDefaultApi: vi.fn().mockReturnValue(undefined),
  getDefaultAcp: vi.fn().mockReturnValue(undefined),
})

const createCaller = (
  adapter = createMockAdapter(),
  providerManager = createMockProviderManager()
) => {
  return appRouter.createCaller({
    adapter: adapter as unknown as Context['adapter'],
    providerManager: providerManager as unknown as Context['providerManager'],
  })
}

describe('appRouter', () => {
  describe('dashboard', () => {
    it('should get dashboard data', async () => {
      const caller = createCaller()
      const data = await caller.dashboard.getData()

      expect(data).toBeDefined()
      expect(data.summary).toBeDefined()
    })

    it('should check if initialized', async () => {
      const caller = createCaller()
      const result = await caller.dashboard.isInitialized()

      expect(result).toBe(true)
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

  describe('ai', () => {
    it('should list providers', async () => {
      const caller = createCaller()
      const providers = await caller.ai.listProviders()

      expect(Array.isArray(providers)).toBe(true)
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
