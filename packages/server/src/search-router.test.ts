/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Prove the public Search subscription remains registered.
 * 2. Prove Search queries delegate through the Manager-owned Planning-root service.
 * 3. Prove query and subscription normalize source scope at the public boundary.
 *
 * Original request (2026-07-16): "你先负责后端（内核）的开发，我让ClaudeCode先帮你吧前端相关的代码先初步做一下。"
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  parseCliCommandResult,
  type CliCommandResult,
} from '@openspecui/core'
import type { SearchHit } from '@openspecui/search'
import { NodeWorkerSearchProvider } from '@openspecui/search/node'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { SearchService } from './search-service.js'
import { createServer } from './server.js'

type ServerFixture = ReturnType<typeof createServer>

const fixtures: Array<{ projectDir: string; server: ServerFixture }> = []

function commandResult<T>(data: T, schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
    },
    schema
  )
}

async function createSearchCaller() {
  const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-search-router-'))
  await mkdir(join(projectDir, 'openspec'), { recursive: true })
  const server = createServer({ projectDir, enableWatcher: false })
  fixtures.push({ projectDir, server })

  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockResolvedValue(
    commandResult(
      {
        root: { path: projectDir, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
  )
  vi.spyOn(server.cliExecutor.contracts, 'context').mockResolvedValue(
    commandResult(
      {
        root: { path: projectDir, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return appRouter.createCaller(server.createContext())
}

async function disposeFixture({ projectDir, server }: (typeof fixtures)[number]) {
  await server.storeObservationFallback.dispose()
  await server.planningRootServices.dispose()
  await server.storeObservation.dispose()
  await server.dataHomeObserver.dispose()
  server.storeInvalidation.dispose()
  server.projectInvalidation.dispose()
  await server.observationEnvironment.dispose()
  server.projectRecoveryService.dispose()
  server.translationCacheService.close()
  await rm(projectDir, { recursive: true, force: true })
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(disposeFixture))
  vi.restoreAllMocks()
})

const activeRootHit = {
  documentId: 'spec:owned:auth',
  kind: 'spec',
  scope: 'active-root',
  title: 'Auth',
  href: '/specs/owned/auth',
  path: 'owned:openspec/specs/auth/spec.md',
  score: 99,
  snippet: 'Auth snippet',
  updatedAt: 1,
} satisfies SearchHit

describe('search router', () => {
  it('registers search.subscribe procedure', async () => {
    const caller = await createSearchCaller()
    expect(caller.search.subscribe).toBeTypeOf('function')
  })

  it('delegates search query to search service', async () => {
    const search = vi.spyOn(SearchService.prototype, 'query').mockResolvedValue([activeRootHit])
    const caller = await createSearchCaller()

    const result = await caller.search.query({ query: 'auth', limit: 5 })

    expect(search).toHaveBeenCalledWith({
      query: 'auth',
      scope: 'active-root',
      limit: 5,
    })
    expect(result[0]?.documentId).toBe('spec:owned:auth')
  })

  it.each([
    ['missing', undefined],
    ['wrong', 'referenced-specs' as const],
  ])('rejects a query result with %s scope provenance', async (_kind, scope) => {
    vi.spyOn(NodeWorkerSearchProvider.prototype, 'init').mockResolvedValue(undefined)
    vi.spyOn(NodeWorkerSearchProvider.prototype, 'search').mockResolvedValue([
      { ...activeRootHit, scope },
    ])
    const caller = await createSearchCaller()

    await expect(caller.search.query({ query: 'auth' })).rejects.toThrow(/scope/i)
  })

  it('delegates explicit Reference scope through the Search subscription', async () => {
    const queryReactive = vi.spyOn(SearchService.prototype, 'queryReactive').mockResolvedValue([])
    const caller = await createSearchCaller()

    const subscription = (
      await caller.search.subscribe({
        query: 'auth',
        scope: 'referenced-specs',
        limit: 3,
      })
    ).subscribe({
      next: vi.fn(),
      error: vi.fn(),
      complete: vi.fn(),
    })

    await vi.waitFor(() => {
      expect(queryReactive).toHaveBeenCalledWith({
        query: 'auth',
        scope: 'referenced-specs',
        limit: 3,
      })
    })
    subscription.unsubscribe()
  })
})
