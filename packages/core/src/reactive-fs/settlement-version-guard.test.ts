/**
 * Orthogonal intents (created 2026-11-05 Asia/Shanghai):
 * 1. Pin the pass-side ordering guard: a settlement pass may never publish a value it read before a
 *    publisher committed, so the pre-write value can never be republished over the newer one.
 * 2. Cover both publisher classes the plan names — the write-settlement core
 *    (`settleReactivePathMutation`) and direct cache publication (`updateReactiveFileCache`) — so a
 *    "publishers bump it" rule cannot pass while missing one of them.
 * 3. Pin per-registration skipping: only the registration whose version moved is skipped; the rest
 *    of the pass still commits (not a whole-pass abort).
 * 4. Pin the bounded retry: a publisher that lands *during* a read makes the pass re-read once and
 *    commit the re-read when no further publication interleaves.
 * 5. Construct every interleaving with the exported commit gate or a one-shot readFile
 *    implementation — never by sleeping and hoping.
 * 6. Pin the two conflict modes of `settleRegisteredReadsUnder`: `'skip'` drops a registration
 *    whose publisher committed at the commit gate (the trigger-pass semantics), while
 *    `'force-commit'` answers the same conflicts with bounded re-reads and commits a read that
 *    started after every observed publication — the freshness `settlePaths` exposes to one-shot
 *    consumers. Existing assertions above stay default-mode (`'skip'`) pins and are not relaxed.
 * 7. Pin the attempt bound: a publisher landing at every decision point still terminates in at
 *    most three attempts plus exactly one forced read, whose value is the disk current value.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S3 (CP3): the per-registration commit version guard.
 * Review correction (2026-11-05, S4/BLK-1): the skip branch's "the publisher that moved it already
 *   wrote the newer value" rationale does not hold for event/poll publishers, whose own read can
 *   start before this pass; the one-shot path now spends bounded re-reads and forces a final read
 *   instead of skipping, and `'skip'` is documented as a trigger-pass policy, not a freshness mode.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `vi.spyOn` cannot redefine ESM namespace exports, so module spies are installed as mocks that
// keep the real implementations and only record calls.
vi.mock('node:fs/promises', { spy: true })

import { cleanupTempDir, createTempDir } from '../__tests__/test-utils.js'
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'
import {
  clearCache,
  reactiveReadDir,
  reactiveReadFile,
  setSettlementCommitGateForTests,
  settlePaths,
  settleReactivePathMutation,
  settleRegisteredReadsUnder,
  updateReactiveFileCache,
} from './reactive-fs.js'

interface CommitGate {
  /** Resolves once a settlement pass reached the gate (i.e. its read phase is over). */
  entered: Promise<void>
  /** Releases the pass into its synchronous commit block. */
  release: () => void
}

function createCommitGate(): CommitGate {
  let release!: () => void
  let enter!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let enteredOnce = false
  const entered = new Promise<void>((resolve) => {
    enter = resolve
  })

  setSettlementCommitGateForTests(async () => {
    if (!enteredOnce) {
      enteredOnce = true
      enter()
    }
    await released
  })

  return { entered, release }
}

describe('settlement commit version guard', () => {
  const tempDirs: string[] = []

  async function createTempRoot(): Promise<string> {
    const dir = await createTempDir()
    tempDirs.push(dir)
    return dir
  }

  afterEach(async () => {
    setSettlementCommitGateForTests(null)
    clearCache()
    await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)))
  })

  it('never republishes a pre-write directory listing that the write-settlement core already refreshed', async () => {
    const dir = await createTempRoot()
    await writeFile(join(dir, 'before.txt'), 'before', 'utf8')
    await expect(reactiveReadDir(dir)).resolves.toEqual(['before.txt'])

    const gate = createCommitGate()
    const pass = settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(dir))
    await gate.entered

    // The pass has read the listing. Now publisher class (1) — the write-settlement core — commits
    // the post-write listing while the pass is still before its commit.
    const appeared = join(dir, 'appeared.txt')
    await writeFile(appeared, 'content', 'utf8')
    await settleReactivePathMutation(appeared)

    gate.release()
    // The only covered registration was already refreshed by the publisher, so the pass skips it —
    // the pre-write listing is never republished over the newer one.
    await expect(pass).resolves.toBe(0)
    await expect(reactiveReadDir(dir)).resolves.toEqual(
      expect.arrayContaining(['appeared.txt', 'before.txt'])
    )
  })

  it('never republishes a pre-write file value that updateReactiveFileCache already published', async () => {
    const dir = await createTempRoot()
    const target = join(dir, 'value.txt')
    await writeFile(target, 'before', 'utf8')
    await expect(reactiveReadFile(target)).resolves.toBe('before')

    const gate = createCommitGate()
    const pass = settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(dir))
    await gate.entered

    // The pass read 'before'. Now publisher class (2) — direct cache publication — commits 'after'
    // (its caller wrote the file to disk first, exactly like config/global-settings do).
    await writeFile(target, 'after', 'utf8')
    updateReactiveFileCache(target, 'after')

    gate.release()
    await pass

    await expect(reactiveReadFile(target)).resolves.toBe('after')
  })

  it('skips only the registration whose version moved, not the whole pass', async () => {
    const dir = await createTempRoot()
    const published = join(dir, 'published.txt')
    const untouched = join(dir, 'untouched.txt')
    await writeFile(published, 'published-before', 'utf8')
    await writeFile(untouched, 'untouched-before', 'utf8')
    await expect(reactiveReadFile(published)).resolves.toBe('published-before')
    await expect(reactiveReadFile(untouched)).resolves.toBe('untouched-before')

    const gate = createCommitGate()
    const pass = settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(dir))
    await gate.entered

    await writeFile(published, 'published-after', 'utf8')
    updateReactiveFileCache(published, 'published-after')

    gate.release()
    // Exactly one registration commits (the untouched file); the published one is skipped
    // per-registration, and the pass does not abort as a whole.
    await expect(pass).resolves.toBe(1)
    await expect(reactiveReadFile(published)).resolves.toBe('published-after')
  })

  it('re-reads once and commits the re-read when no further publication interleaves', async () => {
    const dir = await createTempRoot()
    const target = join(dir, 'value.txt')
    await writeFile(target, 'before', 'utf8')
    await expect(reactiveReadFile(target)).resolves.toBe('before')

    // The pass's first read is where the publisher lands: the read resolves with the pre-write
    // value, while the publication (class 2, caller already wrote the file) commits during it.
    const fsPromises = await import('node:fs/promises')
    vi.mocked(fsPromises.readFile).mockImplementationOnce(async () => {
      await writeFile(target, 'after', 'utf8')
      updateReactiveFileCache(target, 'after')
      return 'before'
    })

    // The version moved during the read, so the guard re-reads once: no further publication
    // interleaves and the re-read (disk truth) commits, so the registration is served, not skipped.
    await expect(
      settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(dir))
    ).resolves.toBe(1)
    await expect(reactiveReadFile(target)).resolves.toBe('after')
  })

  it('keeps the guard per-registration and per-root, so another root still commits afterwards', async () => {
    const guardedRoot = await createTempRoot()
    const otherRoot = await createTempRoot()
    const guardedFile = join(guardedRoot, 'guarded.txt')
    const otherDir = join(otherRoot, 'other-dir')
    await mkdir(otherDir)
    await writeFile(guardedFile, 'guarded-before', 'utf8')
    await writeFile(join(otherDir, 'other.txt'), 'other', 'utf8')
    await expect(reactiveReadFile(guardedFile)).resolves.toBe('guarded-before')
    await expect(reactiveReadDir(otherDir)).resolves.toEqual(['other.txt'])

    const gate = createCommitGate()
    const pass = settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(guardedRoot))
    await gate.entered

    await writeFile(guardedFile, 'guarded-after', 'utf8')
    updateReactiveFileCache(guardedFile, 'guarded-after')

    gate.release()
    await expect(pass).resolves.toBe(0)
    // A settlement of another root is not affected by this root's guard.
    await expect(
      settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(otherRoot))
    ).resolves.toBe(1)
  })

  it("drops a gate-conflicted registration in the default 'skip' mode and returns it uncommitted", async () => {
    const dir = await createTempRoot()
    const target = join(dir, 'skip-value.txt')
    await writeFile(target, 'v1', 'utf8')
    await expect(reactiveReadFile(target)).resolves.toBe('v1')

    // Exactly one publication lands where the guard looks: after this pass's read, before its
    // commit. The pass has read 'v1' and must not overwrite the publisher's newer value with it.
    let gateCalls = 0
    setSettlementCommitGateForTests(async () => {
      gateCalls += 1
      if (gateCalls !== 1) return
      await writeFile(target, 'v2', 'utf8')
      updateReactiveFileCache(target, 'v2')
    })

    await expect(
      settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(dir))
    ).resolves.toBe(0)
    // 'skip' drops the registration instead of re-reading: the returned count excludes it and the
    // retained value is the publisher's, not this pass's older read.
    expect(gateCalls).toBe(1)
    await expect(reactiveReadFile(target)).resolves.toBe('v2')
  })

  it("answers gate conflicts with bounded re-reads in 'force-commit' mode", async () => {
    const dir = await createTempRoot()
    const target = join(dir, 'force-value.txt')
    await writeFile(target, 'v1', 'utf8')
    await expect(reactiveReadFile(target)).resolves.toBe('v1')

    // Two conflicts land where the guard looks: the first at the commit gate (this pass's read is
    // over, its commit pending), the second inside the re-read window it forces. The pass must end
    // on a read that started after both publications and commit exactly that read — the disk
    // current value, never v1 or v2.
    let gateCalls = 0
    setSettlementCommitGateForTests(async () => {
      gateCalls += 1
      if (gateCalls > 2) return
      const next = `v${gateCalls + 1}`
      await writeFile(target, next, 'utf8')
      updateReactiveFileCache(target, next)
    })

    const fsPromises = await import('node:fs/promises')
    const readFileSpy = vi.mocked(fsPromises.readFile)
    readFileSpy.mockClear()

    await expect(
      settleRegisteredReadsUnder(resolveRealPathThroughExistingAncestor(dir), {
        conflictMode: 'force-commit',
      })
    ).resolves.toBe(1)

    // Attempts: v1 (conflicted), v2 (conflicted), v3 (clean) — bounded to three, no forced read.
    expect(readFileSpy.mock.calls.length).toBe(3)
    expect(gateCalls).toBe(3)
    await expect(reactiveReadFile(target)).resolves.toBe('v3')
    await expect(readFile(target, 'utf8')).resolves.toBe('v3')
  })

  it('forces exactly one final read after the bounded attempts are spent and commits disk truth', async () => {
    const dir = await createTempRoot()
    const target = join(dir, 'forced-value.txt')
    await writeFile(target, 'v1', 'utf8')
    await expect(reactiveReadFile(target)).resolves.toBe('v1')

    // A publisher lands at every decision point, so every bounded attempt conflicts and only the
    // forced read remains. That read starts after the last observed publication, so its value is
    // the disk current value — the freshness `settlePaths` promises its one-shot consumers.
    let gateCalls = 0
    setSettlementCommitGateForTests(async () => {
      gateCalls += 1
      const next = `v${gateCalls + 1}`
      await writeFile(target, next, 'utf8')
      updateReactiveFileCache(target, next)
    })

    const fsPromises = await import('node:fs/promises')
    const readFileSpy = vi.mocked(fsPromises.readFile)
    readFileSpy.mockClear()

    await expect(settlePaths([dir])).resolves.toBe(1)

    // Bounded: three attempts (v1, v2, v3) plus exactly one forced read (v4) — never more.
    expect(readFileSpy.mock.calls.length).toBe(4)
    expect(gateCalls).toBe(3)
    await expect(reactiveReadFile(target)).resolves.toBe('v4')
    await expect(readFile(target, 'utf8')).resolves.toBe('v4')
  })
})
