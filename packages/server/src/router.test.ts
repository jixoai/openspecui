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
  getDashboardData: vi.fn().mockResolvedValue(undefined),
})

const createMockContext = (adapter = createMockAdapter()): Context => {
  const configManager = {
    readConfig: vi.fn().mockResolvedValue({}),
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
