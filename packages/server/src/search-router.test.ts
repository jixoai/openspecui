/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove the public Search subscription remains registered.
 * 2. Prove Search queries delegate through the Manager-owned Planning-root service.
 * 3. Prove query and subscription normalize source scope at the public boundary.
 * 4. Prove two public clients retain independent physical Search dependencies.
 * 5. Settle shared watcher owners before removing Windows Search fixtures.
 *
 * Original request (2026-07-16): "你先负责后端（内核）的开发，我让ClaudeCode先帮你吧前端相关的代码先初步做一下。"
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 * Derived requirement (2026-07-19): Shared provider work cannot retire a waiting Search client.
 * Original request (2026-08-06): "Windows compatibility and adaptation, including the core and peripheral scripts."
 */
import {
  clearCache,
  CliContextSchema,
  CliDoctorSchema,
  CliSpecListSchema,
  OpenSpecAdapter,
  parseCliCommandResult,
  type CliCommandResult,
} from '@openspecui/core'
import type { SearchHit } from '@openspecui/search'
import { NodeWorkerSearchProvider } from '@openspecui/search/node'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { SearchService } from './search-service.js'
import {
  disposeServerTestFixture,
  removeServerTestDirectories,
  SERVER_FIXTURE_TEST_TIMEOUT_MS,
} from './server-test-cleanup.js'
import { createServer } from './server.js'

type ServerFixture = ReturnType<typeof createServer>

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

const fixtures: Array<{ projectDir: string; server: ServerFixture }> = []

function createDeferred<T>(): Deferred<T> {
  let complete: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    complete = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!complete) throw new Error('Deferred resolver was not initialized.')
      complete(value)
    },
  }
}

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
  vi.spyOn(server.cliExecutor.contracts, 'listSpecs').mockResolvedValue(
    commandResult(
      {
        specs: [],
        root: { path: projectDir, source: 'nearest' },
        status: [],
      },
      CliSpecListSchema
    )
  )

  return {
    caller: appRouter.createCaller(server.createContext()),
    projectDir,
    server,
  }
}

async function disposeFixture({ projectDir, server }: (typeof fixtures)[number]) {
  await disposeServerTestFixture(server)
  await removeServerTestDirectories([projectDir])
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(disposeFixture))
  clearCache()
  vi.restoreAllMocks()
}, SERVER_FIXTURE_TEST_TIMEOUT_MS)

function createSpecMarkdown(marker: string): string {
  return `# Auth Specification

## Purpose

${marker}

## Requirements

### Requirement: Authenticate

The system SHALL authenticate a user.

#### Scenario: Authentication succeeds

- **WHEN** valid credentials are supplied
- **THEN** the system SHALL authenticate the user
`
}

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

describe('search router', { timeout: SERVER_FIXTURE_TEST_TIMEOUT_MS }, () => {
  it('registers search.subscribe procedure', async () => {
    const { caller } = await createSearchCaller()
    expect(caller.search.subscribe).toBeTypeOf('function')
  })

  it('delegates search query to search service', async () => {
    const search = vi.spyOn(SearchService.prototype, 'query').mockResolvedValue([activeRootHit])
    const { caller } = await createSearchCaller()

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
    const { caller } = await createSearchCaller()

    await expect(caller.search.query({ query: 'auth' })).rejects.toThrow(/scope/i)
  })

  it('delegates explicit Reference scope through the Search subscription', async () => {
    const queryReactive = vi.spyOn(SearchService.prototype, 'queryReactive').mockResolvedValue([])
    const { caller } = await createSearchCaller()

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

  it('keeps two public subscribers current after one physical Owned Spec edit', async () => {
    const { caller, projectDir } = await createSearchCaller()
    const adapter = new OpenSpecAdapter(projectDir)
    await adapter.writeSpec('auth', createSpecMarkdown('initial marker'))
    const firstCollectionStarted = createDeferred<void>()
    const releaseFirstCollection = createDeferred<void>()
    const secondQueryEntered = createDeferred<void>()
    const listSpecsWithMeta = OpenSpecAdapter.prototype.listSpecsWithMeta
    const queryReactive = SearchService.prototype.queryReactive
    let collectionCount = 0
    let queryCount = 0
    vi.spyOn(OpenSpecAdapter.prototype, 'listSpecsWithMeta').mockImplementation(async function (
      this: OpenSpecAdapter
    ) {
      collectionCount += 1
      if (collectionCount === 1) {
        firstCollectionStarted.resolve()
        await releaseFirstCollection.promise
      }
      return listSpecsWithMeta.call(this)
    })
    vi.spyOn(SearchService.prototype, 'queryReactive').mockImplementation(async function (
      this: SearchService,
      input
    ) {
      queryCount += 1
      if (queryCount === 2) secondQueryEntered.resolve()
      return queryReactive.call(this, input)
    })

    const firstValues: SearchHit[][] = []
    const secondValues: SearchHit[][] = []
    const firstErrors: unknown[] = []
    const secondErrors: unknown[] = []
    const firstSubscription = (
      await caller.search.subscribe({ query: 'routerproof', scope: 'active-root' })
    ).subscribe({
      next(value) {
        firstValues.push(value)
      },
      error(error) {
        firstErrors.push(error)
      },
    })
    await firstCollectionStarted.promise
    const secondSubscription = (
      await caller.search.subscribe({ query: 'routerproof', scope: 'active-root' })
    ).subscribe({
      next(value) {
        secondValues.push(value)
      },
      error(error) {
        secondErrors.push(error)
      },
    })
    await secondQueryEntered.promise
    releaseFirstCollection.resolve()

    await vi.waitFor(() => {
      expect(firstValues).toHaveLength(1)
      expect(secondValues).toHaveLength(1)
    })
    expect(firstValues[0]).toEqual([])
    expect(secondValues[0]).toEqual([])

    await adapter.writeSpec('auth', createSpecMarkdown('routerproof'))

    await vi.waitFor(() => {
      expect(
        firstValues.some((hits) => hits.some((hit) => hit.documentId === 'spec:owned:auth'))
      ).toBe(true)
      expect(
        secondValues.some((hits) => hits.some((hit) => hit.documentId === 'spec:owned:auth'))
      ).toBe(true)
    })
    for (const values of [firstValues, secondValues]) {
      expect(values.find((hits) => hits.length > 0)).toEqual([
        expect.objectContaining({
          documentId: 'spec:owned:auth',
          scope: 'active-root',
        }),
      ])
    }
    expect(collectionCount).toBeGreaterThanOrEqual(4)
    expect(firstErrors).toEqual([])
    expect(secondErrors).toEqual([])

    firstSubscription.unsubscribe()
    secondSubscription.unsubscribe()
  })
})
