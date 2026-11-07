/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Prove V1(i): the awaited settle inside `ensurePhysicalObservation` precedes the retained
 *    projection's first read — asserted with a read-phase gate (nothing read while the settle is
 *    held) plus filesystem call order, never with a sleep, and with the post-settle truth as the
 *    behavioural half (a stale warmed listing cannot produce that first frame).
 * 2. Prove V1(ii): a second `subscribe` re-settles nothing, because `observationStartPromise`
 *    memoization means the root loop — and therefore the environment and the pool — is never
 *    entered again. That is the declared residual, pinned rather than implied.
 * 3. Keep every other read real: only the fs module is wrapped in recording spies.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S1 (V1): the one named consumer hook.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `vi.spyOn` cannot redefine ESM namespace exports, so module spies are installed as mocks that
// keep the real implementations and only record calls.
vi.mock('node:fs/promises', { spy: true })

import {
  clearCache,
  closeAllWatchers,
  ReactiveObservationEnvironment,
  reactiveReadDir,
  resolveRealPathThroughExistingAncestor,
  setSettlementPassHookForTests,
  type CliProjectionNotice,
  type EnvironmentGlobalProjectionData,
  type SettlementPassHookEvent,
} from '@openspecui/core'
import {
  AgentDeliveryProjectionService,
  type AgentDeliveryEnvironmentAuthority,
  type AgentDeliveryProjection,
  type AgentDeliveryProjectionEvent,
} from './agent-delivery-projection-service.js'
import type { ProjectionWorkSubscription } from './projection-work/index.js'

const cliCommandAuthority = {
  getCliCommand: async () => ['not-an-importable-openspec-runner'],
}

const environmentFixture: EnvironmentGlobalProjectionData = {
  kind: 'environment-global',
  owner: {
    kind: 'runtime-environment',
    dataScope: {
      path: '/tmp/openspecui-agent-delivery-settlement-data',
      source: 'user-home-default',
      environmentVariable: null,
    },
  },
  configPath: '/tmp/openspecui-agent-delivery-settlement-config.json',
  config: {},
  defaultStore: { state: 'absent', id: null },
  profileState: {
    available: true,
    profile: 'custom',
    delivery: 'skills',
    workflows: ['update'],
    driftStatus: 'in-sync',
    warningText: null,
  },
  evidence: {
    path: { success: true, stdout: '', stderr: '', exitCode: 0 },
    config: {
      success: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
      data: {},
      payload: {},
      diagnostics: [],
    },
    drift: { success: true, stdout: '', stderr: '', exitCode: 0 },
  },
}

class EnvironmentAuthorityFixture implements AgentDeliveryEnvironmentAuthority {
  readonly projection = environmentFixture

  async getCurrent(): Promise<EnvironmentGlobalProjectionData> {
    return this.projection
  }

  refresh(): void {}

  subscribe(_listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription {
    return { unsubscribe: () => {} }
  }
}

/** The environment the service actually talks to, counting root acquisitions. */
class CountingObservationEnvironment extends ReactiveObservationEnvironment {
  acquireRootCount = 0

  override async acquireRoot(rootPath: string) {
    this.acquireRootCount += 1
    return super.acquireRoot(rootPath)
  }
}

function createGate(): { promise: Promise<void>; release: () => void } {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/**
 * Let pending microtask chains and a bounded number of macrotask turns run to completion.
 *
 * The interleaving under test is built by the read-phase gate, never by this drain. The drain only
 * gives a *non-awaited* settle room to let the projection run ahead, which is what makes the gated
 * assertions below discriminating: measured on this fixture, a fire-and-forget settle reveals
 * itself on the first turn, so the same assertion holds for the awaited implementation at any
 * number of turns.
 */
async function drainAsyncTurns(turns = 16): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await new Promise<void>((resolve) => {
      setImmediate(() => resolve())
    })
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0)
    })
  }
}

/**
 * Record read-phase entries and let a test await them. The wait is resolved by the gate itself;
 * the bounded guard exists only so a missing settle fails as itself instead of as a timeout.
 */
function recordSettlementPasses(): {
  events: SettlementPassHookEvent[]
  waitForPassCount(count: number, timeoutMs?: number): Promise<void>
} {
  const events: SettlementPassHookEvent[] = []
  const waiters: Array<() => void> = []
  setSettlementPassHookForTests((event) => {
    events.push(event)
    for (const resolve of waiters.splice(0)) resolve()
  })

  return {
    events,
    async waitForPassCount(count: number, timeoutMs = 5_000): Promise<void> {
      while (events.length < count) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`settlement pass ${count} never began (only ${events.length})`)),
            timeoutMs
          )
          waiters.push(() => {
            clearTimeout(timer)
            resolve()
          })
        })
      }
    },
  }
}

async function waitForFirstSnapshot(
  stage: string,
  events: readonly AgentDeliveryProjectionEvent[]
): Promise<AgentDeliveryProjection> {
  await vi.waitFor(
    () => {
      const failure = events.find((event) => event.type === 'failed')
      if (failure?.type === 'failed') throw failure.error
      expect(
        events.some((event) => event.type === 'snapshot'),
        stage
      ).toBe(true)
    },
    { timeout: 5_000, interval: 25 }
  )
  const first = events.find((event) => event.type === 'snapshot')
  if (!first || first.type !== 'snapshot') {
    throw new Error(`Expected a first Agent delivery snapshot during ${stage}.`)
  }
  return first.projection
}

async function writeGeneratedSkill(projectDir: string): Promise<void> {
  const path = join(projectDir, '.claude', 'skills', 'openspec-update-change', 'SKILL.md')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    '---\nname: openspec-update-change\nmetadata:\n  generatedBy: 1.16.1\n---\n',
    'utf8'
  )
}

function readdirCallsUnder(
  readdirSpy: { mock: { calls: unknown[][] } },
  root: string
): unknown[][] {
  return readdirSpy.mock.calls.filter(
    ([path]) => typeof path === 'string' && (path === root || path.startsWith(`${root}/`))
  )
}

describe('AgentDeliveryProjectionService settlement seam', () => {
  let projectDir: string | null = null
  let previousCodexHome: string | undefined

  afterEach(async () => {
    setSettlementPassHookForTests(null)
    clearCache()
    await closeAllWatchers()
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = previousCodexHome
    previousCodexHome = undefined
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true })
      projectDir = null
    }
  })

  async function createServiceFixture(): Promise<{
    projectDir: string
    normalizedProjectDir: string
    observationEnvironment: CountingObservationEnvironment
    service: AgentDeliveryProjectionService
    cliAvailabilityCalls(): number
  }> {
    clearCache()
    projectDir = await mkdtemp(join(tmpdir(), 'openspecui-agent-delivery-settlement-'))
    previousCodexHome = process.env.CODEX_HOME
    process.env.CODEX_HOME = join(projectDir, 'codex-home')
    const observationEnvironment = new CountingObservationEnvironment()
    // The projection's own pre-read step is test-owned: it is what proves the projection chain is
    // (or is not) still parked on the settlement before its first read.
    let availabilityCalls = 0
    const cliExecutor = {
      async checkAvailability() {
        availabilityCalls += 1
        return { available: true, version: '1.16.1' }
      },
    }
    const service = new AgentDeliveryProjectionService({
      projectDir,
      environmentGlobalProjectionService: new EnvironmentAuthorityFixture(),
      observationEnvironment,
      cliExecutor,
      cliCommandAuthority,
    })
    return {
      projectDir,
      normalizedProjectDir: resolveRealPathThroughExistingAncestor(projectDir),
      observationEnvironment,
      service,
      cliAvailabilityCalls: () => availabilityCalls,
    }
  }

  it('settles its observation roots before the retained projection reads them', async () => {
    const fixture = await createServiceFixture()
    const events: AgentDeliveryProjectionEvent[] = []

    // Warm a covering read while the directory is still empty: the retained projection serves its
    // root listing from this cache, and the write below happens before any native watcher is armed,
    // so no event can refresh it. Only the settle can.
    await expect(reactiveReadDir(fixture.projectDir, { includeHidden: true })).resolves.toEqual([])
    await writeGeneratedSkill(fixture.projectDir)

    const fsPromises = await import('node:fs/promises')
    const readdirSpy = vi.mocked(fsPromises.readdir)
    readdirSpy.mockClear()

    const gate = createGate()
    const projectPasses: SettlementPassHookEvent[] = []
    let signalEntered!: () => void
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve
    })
    setSettlementPassHookForTests(async (event) => {
      if (event.rootPath !== fixture.normalizedProjectDir) return
      projectPasses.push(event)
      signalEntered()
      if (projectPasses.length === 1) await gate.promise
    })

    try {
      fixture.service.subscribe((event) => events.push(event))
      await entered

      // Held at the settle's read-phase entry: the retained projection chain is parked on the
      // settle, so it cannot have resolved its own generator evidence nor read anything yet. The
      // generator-evidence call is purely microtask work, so a single macrotask turn is enough for
      // a non-awaited settle to let the projection run ahead — this is the mutation discriminator.
      await drainAsyncTurns()
      expect(fixture.cliAvailabilityCalls()).toBe(0)
      expect(events).toEqual([])
      expect(readdirCallsUnder(readdirSpy, fixture.projectDir)).toHaveLength(0)

      gate.release()
      await projectPasses[0]?.completed

      // Behavioural half: the first frame carries post-settle truth, which the stale warmed
      // listing cannot produce.
      const first = await waitForFirstSnapshot('settled retained projection', events)
      expect(first.states.find((state) => state.toolId === 'claude')).toMatchObject({
        status: 'initialized',
        installedSkillWorkflows: ['update'],
      })

      // Ordering half: the settle's re-read of the project listing precedes the projection's first
      // read of the skill root, so the projection read behind a settled cache.
      const settleReadIndex = readdirSpy.mock.calls.findIndex(
        ([path]) => path === fixture.projectDir
      )
      const projectionReadIndex = readdirSpy.mock.calls.findIndex(
        ([path]) => path === join(fixture.projectDir, '.claude')
      )
      expect(settleReadIndex).toBeGreaterThanOrEqual(0)
      expect(projectionReadIndex).toBeGreaterThanOrEqual(0)
      const settleReadOrder = readdirSpy.mock.invocationCallOrder[settleReadIndex] ?? -1
      const projectionReadOrder = readdirSpy.mock.invocationCallOrder[projectionReadIndex] ?? -1
      expect(projectionReadOrder).toBeGreaterThan(settleReadOrder)
    } finally {
      await fixture.service.dispose()
      await fixture.observationEnvironment.dispose()
    }
  })

  it('does not re-settle on a second subscribe and still serves it from the memoized observation', async () => {
    const fixture = await createServiceFixture()
    const recorder = recordSettlementPasses()
    const firstEvents: AgentDeliveryProjectionEvent[] = []
    fixture.service.subscribe((event) => firstEvents.push(event))

    try {
      await waitForFirstSnapshot('first subscriber', firstEvents)
      // Every settle this observation produced has already recorded its read-phase entry.
      const passesAfterFirstSubscribe = recorder.events.length
      const acquisitionsAfterFirstSubscribe = fixture.observationEnvironment.acquireRootCount
      expect(passesAfterFirstSubscribe).toBeGreaterThan(0)

      const secondEvents: AgentDeliveryProjectionEvent[] = []
      fixture.service.subscribe((event) => secondEvents.push(event))
      await drainAsyncTurns()

      // The declared residual: the physical observation promise is memoized, so the root loop (and
      // with it the environment's attach branch and the pool's arm trigger) is never entered again.
      expect(fixture.observationEnvironment.acquireRootCount).toBe(acquisitionsAfterFirstSubscribe)
      expect(recorder.events).toHaveLength(passesAfterFirstSubscribe)

      // Positive control: the second subscription is still served from the retained observation.
      await waitForFirstSnapshot('second subscriber', secondEvents)
    } finally {
      await fixture.service.dispose()
      await fixture.observationEnvironment.dispose()
    }
  })
})
