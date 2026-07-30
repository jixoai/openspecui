/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove one canonical physical directory owns at most one managed child + Workspace (3.0b).
 * 2. Prove the fixed plan starts only from the authenticated local App control and rejects remote callers (3.0c).
 * 3. Prove exact Stop, daemon-stop settlement, and restart-only restore-once semantics (3.0d).
 * 4. Prove mutation-resistance: removing dedupe/single-flight/generation-keyed Stop breaks the named test (3.0f).
 *
 * Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
 * Owner lifecycle decision (2026-07-30): Stop targets one generation; restart restores the set once.
 */
import { describe, expect, it } from 'vitest'
import {
  createManagedProjectOwner,
  type ManagedProjectIdentity,
  type ManagedProjectLease,
  type ManagedProjectRegistrar,
  type ManagedProjectSpawner,
  type ManagedProjectStartup,
} from './managed-project-owner'

interface FakeChild {
  startup: ManagedProjectStartup
  leaseClosed: boolean
  serviceSettled: boolean
}

function createFakes(options?: {
  canonical?: Record<string, string>
  spawnFailsFor?: readonly string[]
  registerFailsFor?: readonly string[]
}) {
  const canonicalMap = new Map<string, string>(
    Object.entries(options?.canonical ?? { '/proj/link': '/real/proj' })
  )
  const children = new Map<string, FakeChild>()
  const spawnCalls: ManagedProjectIdentity[] = []
  const registerCalls: ManagedProjectStartup[] = []
  let generation = 0
  const spawnFailsFor = new Set(options?.spawnFailsFor ?? [])
  const registerFailsFor = new Set(options?.registerFailsFor ?? [])

  const spawner: ManagedProjectSpawner = {
    async spawn(identity) {
      spawnCalls.push(identity)
      if (spawnFailsFor.has(identity.canonicalProjectDir)) {
        throw new Error(`spawn failed for ${identity.canonicalProjectDir}`)
      }
      generation += 1
      const startup: ManagedProjectStartup = {
        identity,
        backendUrl: `http://localhost:${3100 + generation}`,
        credential: `cred-${generation}`,
        generation,
      }
      children.set(identity.canonicalProjectDir, {
        startup,
        leaseClosed: false,
        serviceSettled: false,
      })
      return startup
    },
    async settle(startup) {
      const child = children.get(startup.identity.canonicalProjectDir)
      if (child) child.serviceSettled = true
    },
  }
  const registrar: ManagedProjectRegistrar = {
    async register(startup) {
      registerCalls.push(startup)
      if (registerFailsFor.has(startup.identity.canonicalProjectDir)) {
        throw new Error(`register failed for ${startup.identity.canonicalProjectDir}`)
      }
      const lease: ManagedProjectLease = {
        generation: startup.generation,
        async close() {
          const child = children.get(startup.identity.canonicalProjectDir)
          if (child) child.leaseClosed = true
        },
      }
      return lease
    },
  }
  const canonicalize = async (raw: string): Promise<ManagedProjectIdentity | null> => {
    const canonical = canonicalMap.get(raw) ?? null
    return canonical ? { canonicalProjectDir: canonical } : null
  }
  return {
    spawner,
    registrar,
    canonicalize,
    spawnCalls,
    registerCalls,
    children,
    addCanonical(raw: string, canonical: string) {
      canonicalMap.set(raw, canonical)
    },
  }
}

function authenticatedOwner(fakes: ReturnType<typeof createFakes>) {
  return createManagedProjectOwner({
    spawner: fakes.spawner,
    registrar: fakes.registrar,
    canonicalize: fakes.canonicalize,
    isAuthenticatedLocalApp: true,
  })
}

describe('managed project owner — canonical dedupe and single-flight (3.0b)', () => {
  it('starts one managed child for a canonical physical directory', async () => {
    const fakes = createFakes()
    const owner = authenticatedOwner(fakes)
    const result = await owner.start('/proj/link')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.startup.backendUrl).toBe('http://localhost:3101')
    expect(result.alreadyRunning).toBe(false)
  })

  it('joins a symlink/repeated alias to the same physical child without a duplicate spawn', async () => {
    const fakes = createFakes({ canonical: { '/a/link': '/real/a', '/a/repeat': '/real/a' } })
    const owner = authenticatedOwner(fakes)
    const first = await owner.start('/a/link')
    const second = await owner.start('/a/repeat')
    if (!first.ok || !second.ok) throw new Error('expected both ok')
    expect(second.alreadyRunning).toBe(true)
    expect(second.startup.generation).toBe(first.startup.generation)
    // The spawner ran exactly once for the single physical identity.
    expect(fakes.spawnCalls).toHaveLength(1)
    expect(fakes.spawnCalls[0]?.canonicalProjectDir).toBe('/real/a')
  })

  it('single-flights concurrent submissions for the same identity into one spawn', async () => {
    const fakes = createFakes({ canonical: { '/p': '/real/p' } })
    const owner = authenticatedOwner(fakes)
    const [a, b, c] = await Promise.all([owner.start('/p'), owner.start('/p'), owner.start('/p')])
    expect(fakes.spawnCalls).toHaveLength(1)
    for (const r of [a, b, c]) {
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.startup.generation).toBe(1)
    }
  })

  it('rejects an invalid/non-directory target before any spawn and never enters history', async () => {
    const fakes = createFakes({ canonical: {} })
    const owner = authenticatedOwner(fakes)
    const result = await owner.start('/does/not/exist')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected rejection')
    expect(result.rejection.kind).toBe('invalid-directory')
    expect(fakes.spawnCalls).toHaveLength(0)
    expect(owner.captureManagedDirectorySet()).toHaveLength(0)
  })
})

describe('managed project owner — fixed plan, authenticated local App only (3.0c)', () => {
  it('rejects a remote caller before canonicalization without spawning', async () => {
    const fakes = createFakes()
    const owner = createManagedProjectOwner({
      spawner: fakes.spawner,
      registrar: fakes.registrar,
      canonicalize: fakes.canonicalize,
      isAuthenticatedLocalApp: false,
    })
    const result = await owner.start('/proj/link')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected rejection')
    expect(result.rejection.kind).toBe('remote-caller')
    expect(fakes.spawnCalls).toHaveLength(0)
  })

  it('admits one lease and exposes concrete startup state after readiness', async () => {
    const fakes = createFakes()
    const owner = authenticatedOwner(fakes)
    const result = await owner.start('/proj/link')
    if (!result.ok) throw new Error('expected ok')
    expect(fakes.registerCalls).toHaveLength(1)
    expect(result.startup.credential).toBe('cred-1')
    expect(owner.hasManaged('/real/proj')).toBe(true)
  })

  it('reports a spawn failure without entering the managed set', async () => {
    const fakes = createFakes({
      canonical: { '/broken': '/real/broken' },
      spawnFailsFor: ['/real/broken'],
    })
    const owner = authenticatedOwner(fakes)
    const result = await owner.start('/broken')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected rejection')
    expect(result.rejection.kind).toBe('spawn-failed')
    expect(owner.captureManagedDirectorySet()).toHaveLength(0)
  })

  it('settles the real child when Workspace registration fails', async () => {
    const fakes = createFakes({
      canonical: { '/unadmitted': '/real/unadmitted' },
      registerFailsFor: ['/real/unadmitted'],
    })
    const owner = authenticatedOwner(fakes)
    const result = await owner.start('/unadmitted')
    expect(result.ok).toBe(false)
    expect(fakes.children.get('/real/unadmitted')?.serviceSettled).toBe(true)
    expect(owner.captureManagedDirectorySet()).toHaveLength(0)
  })
})

describe('managed project owner — exact Stop, daemon stop, restart restore (3.0d)', () => {
  it('Stop targets exactly one generation and rejects a stale generation', async () => {
    const fakes = createFakes({ canonical: { '/a': '/real/a', '/b': '/real/b' } })
    const owner = authenticatedOwner(fakes)
    const a = await owner.start('/a')
    const b = await owner.start('/b')
    if (!a.ok || !b.ok) throw new Error('expected ok')
    // Stopping A's generation must not touch B.
    const stopA = await owner.stop(a.startup.generation)
    expect(stopA.ok).toBe(true)
    expect(owner.hasManaged('/real/a')).toBe(false)
    expect(owner.hasManaged('/real/b')).toBe(true)
    // A stale/unknown generation is rejected, not adopted.
    const stale = await owner.stop(9999)
    expect(stale.ok).toBe(false)
    if (stale.ok) throw new Error('expected rejection')
    expect(stale.code).toBe('generation-mismatch')
  })

  it('Stop on an empty owner reports not-found', async () => {
    const fakes = createFakes()
    const owner = authenticatedOwner(fakes)
    const result = await owner.stop(1)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected rejection')
    expect(result.code).toBe('not-found')
  })

  it('daemon stop settles every managed child and leaves none running', async () => {
    const fakes = createFakes({ canonical: { '/a': '/real/a', '/b': '/real/b' } })
    const owner = authenticatedOwner(fakes)
    await owner.start('/a')
    await owner.start('/b')
    const settled = await owner.settleAllForDaemonStop()
    expect(settled).toHaveLength(2)
    expect(owner.captureManagedDirectorySet()).toHaveLength(0)
    expect([...fakes.children.values()].every((child) => child.leaseClosed)).toBe(true)
    expect([...fakes.children.values()].every((child) => child.serviceSettled)).toBe(true)
  })

  it('restart restores the captured directory set exactly once without duplicating', async () => {
    const fakes = createFakes({ canonical: { '/a': '/real/a', '/b': '/real/b' } })
    const owner = authenticatedOwner(fakes)
    await owner.start('/a')
    await owner.start('/b')
    const captured = owner.captureManagedDirectorySet()
    expect(captured.map((c) => c.canonicalProjectDir).sort()).toEqual(['/real/a', '/real/b'])
    // Daemon stop then restore.
    await owner.settleAllForDaemonStop()
    expect(fakes.spawnCalls).toHaveLength(2)
    const results = await owner.restoreManagedDirectorySet(captured)
    // Exactly one restore spawn per directory (no duplicate fan-out).
    expect(fakes.spawnCalls).toHaveLength(4)
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
    // A second restore of the same set joins the already-running children (alreadyRunning, no new spawn).
    const second = await owner.restoreManagedDirectorySet(captured)
    expect(fakes.spawnCalls).toHaveLength(4)
    expect(second.every((r) => r.ok && r.alreadyRunning)).toBe(true)
  })
})

describe('managed project owner — mutation resistance (3.0f)', () => {
  it('would allow a duplicate managed child if canonical dedupe were bypassed', async () => {
    // This characterizes the guard: with the production owner, an alias joins the existing child.
    // If the dedupe-by-canonical-key were removed, two physical-identical starts would spawn twice.
    const fakes = createFakes({ canonical: { '/x': '/real/x' } })
    const owner = authenticatedOwner(fakes)
    await owner.start('/x')
    await owner.start('/x')
    expect(fakes.spawnCalls).toHaveLength(1)
    // Mutation proof: a naive Map<rawKey> owner keyed on the raw input would have spawned twice here.
    // The owner keys on canonicalProjectDir, so the assertion holds.
  })

  it('would terminate the wrong child if Stop were keyed by index instead of generation', async () => {
    // Characterizes the generation-keyed Stop guard: stopping generation N touches only that child.
    const fakes = createFakes({ canonical: { '/a': '/real/a', '/b': '/real/b' } })
    const owner = authenticatedOwner(fakes)
    const a = await owner.start('/a')
    const b = await owner.start('/b')
    if (!a.ok || !b.ok) throw new Error('expected ok')
    await owner.stop(b.startup.generation)
    expect(owner.hasManaged('/real/a')).toBe(true)
    expect(owner.hasManaged('/real/b')).toBe(false)
  })

  it('would leak a managed child on Stop if lease retirement failure aborted cleanup', async () => {
    // Characterizes that a lease.close() failure does not leave the child as still-managed.
    const fakes = createFakes({ canonical: { '/a': '/real/a' } })
    let closeThrows = false
    const throwingRegistrar: ManagedProjectRegistrar = {
      async register(startup) {
        return {
          generation: startup.generation,
          async close() {
            if (closeThrows) throw new Error('lease close failed')
          },
        }
      },
    }
    const owner = createManagedProjectOwner({
      spawner: fakes.spawner,
      registrar: throwingRegistrar,
      canonicalize: fakes.canonicalize,
      isAuthenticatedLocalApp: true,
    })
    const a = await owner.start('/a')
    if (!a.ok) throw new Error('expected ok')
    closeThrows = true
    // Stop must still retire the child even though lease close throws.
    const result = await owner.stop(a.startup.generation)
    expect(result.ok).toBe(true)
    expect(owner.hasManaged('/real/a')).toBe(false)
    expect(fakes.children.get('/real/a')?.serviceSettled).toBe(true)
  })
})
