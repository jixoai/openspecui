/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Pin the settlement net's matching space: registrations and settlement roots meet in
 *    realpath-normalized space, so the macOS `/var` -> `/private/var` TMPDIR split cannot silently
 *    cover zero reads on a developer machine while passing on a Linux runner.
 * 2. Pin the negative direction: an un-normalized lexical root covers nothing, so no lexical or
 *    bidirectional fallback can quietly reappear in the matcher.
 * 3. Pin the empty case: a root with no registered reads performs zero filesystem reads.
 * 4. Pin "resolved once at registration": a settlement pass calls no `realpathSync`, which is the
 *    mutation check against a recompute-per-pass fake.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S0 (S5.3): one matching space for the settlement net.
 */
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// `vi.spyOn` cannot redefine ESM namespace exports, so module spies are installed as mocks that
// keep the real implementations and only record calls.
vi.mock('node:fs', { spy: true })
vi.mock('node:fs/promises', { spy: true })

import { cleanupTempDir, createTempDir } from '../__tests__/test-utils.js'
import {
  clearCache,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
  settleRegisteredReadsUnder,
} from './reactive-fs.js'

interface DivergentPathSpaces {
  /** Lexical `resolve()`-space root: what registration keys and watch subscriptions see. */
  lexicalRoot: string
  /** Realpath-normalized root: what watcher event paths and the settlement net must use. */
  realRoot: string
}

/**
 * Build one directory whose lexical path objectively differs from its realpath.
 *
 * macOS gives this for free (`os.tmpdir()` sits under the `/var` -> `/private/var` link); other
 * platforms get a link owned by this test rather than a skip, and the fixture is accepted only
 * after `realpathSync` proves the two spaces differ.
 */
async function createDivergentPathSpaces(baseDir: string): Promise<DivergentPathSpaces | null> {
  const naturalRoot = await mkdtemp(join(baseDir, 'natural-'))
  const naturalRealRoot = realpathSync(naturalRoot)
  if (naturalRealRoot !== naturalRoot) {
    return { lexicalRoot: naturalRoot, realRoot: naturalRealRoot }
  }

  const linkTarget = await mkdtemp(join(baseDir, 'target-'))
  const linkRoot = join(baseDir, 'link-')
  await symlink(linkTarget, linkRoot, process.platform === 'win32' ? 'junction' : 'dir')
  const realRoot = realpathSync(linkRoot)
  if (realRoot === linkRoot) return null
  return { lexicalRoot: linkRoot, realRoot }
}

describe('settlement coverage', () => {
  let baseDir: string
  let spaces: DivergentPathSpaces | null

  beforeAll(async () => {
    baseDir = await createTempDir()
    spaces = await createDivergentPathSpaces(baseDir)
  })

  afterEach(() => {
    clearCache()
  })

  afterAll(async () => {
    clearCache()
    await cleanupTempDir(baseDir)
  })

  it('covers a read registered under a lexical/realpath split when settled by its realpath root', async (ctx) => {
    ctx.skip(spaces === null, 'no lexical/realpath path-space divergence in this environment')
    if (!spaces) return
    expect(spaces.lexicalRoot).not.toBe(spaces.realRoot)

    const filePath = join(spaces.lexicalRoot, 'covered.txt')
    await writeFile(filePath, 'before', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')

    // No lease exists in this fixture, so nothing except a settlement pass can observe this write.
    await writeFile(filePath, 'after', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')

    await expect(settleRegisteredReadsUnder(spaces.realRoot)).resolves.toBe(1)
    await expect(reactiveReadFile(filePath)).resolves.toBe('after')
  })

  it('does not cover a normalized registration when matched by the lexical root', async (ctx) => {
    ctx.skip(spaces === null, 'no lexical/realpath path-space divergence in this environment')
    if (!spaces) return

    const filePath = join(spaces.lexicalRoot, 'uncovered.txt')
    await writeFile(filePath, 'before', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')
    await writeFile(filePath, 'after', 'utf8')

    await expect(settleRegisteredReadsUnder(spaces.lexicalRoot)).resolves.toBe(0)
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')
  })

  it('performs zero filesystem reads for a root with no registered reads', async () => {
    const fsPromises = await import('node:fs/promises')
    const readFileSpy = vi.mocked(fsPromises.readFile)
    const readdirSpy = vi.mocked(fsPromises.readdir)
    const statSpy = vi.mocked(fsPromises.stat)
    readFileSpy.mockClear()
    readdirSpy.mockClear()
    statSpy.mockClear()

    await expect(settleRegisteredReadsUnder(join(baseDir, 'no-registered-reads'))).resolves.toBe(0)

    expect(readFileSpy).not.toHaveBeenCalled()
    expect(readdirSpy).not.toHaveBeenCalled()
    expect(statSpy).not.toHaveBeenCalled()

    // Positive control: the module spies observe the very registration reads this primitive would
    // reuse, so the zero counts above are evidence rather than missing interception.
    const probeDir = join(baseDir, 'probe-read-owners')
    await mkdir(probeDir)
    const probeFile = join(probeDir, 'entry.txt')
    await writeFile(probeFile, 'content', 'utf8')
    await expect(reactiveReadFile(probeFile)).resolves.toBe('content')
    await expect(reactiveReadDir(probeDir)).resolves.toContain('entry.txt')
    await expect(reactiveStat(probeFile)).resolves.toMatchObject({ isFile: true })
    expect(readFileSpy).toHaveBeenCalled()
    expect(readdirSpy).toHaveBeenCalled()
    expect(statSpy).toHaveBeenCalled()
  })

  it('resolves registration paths once and never during a settlement pass', async () => {
    const fs = await import('node:fs')
    const realpathSyncSpy = vi.mocked(fs.realpathSync)

    const rootDir = join(baseDir, 'resolved-once')
    await mkdir(rootDir)
    const filePath = join(rootDir, 'value.txt')
    await writeFile(filePath, 'before', 'utf8')

    const callsBeforeRegistration = realpathSyncSpy.mock.calls.length
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')
    // Positive control: registration itself must cross the realpath owner this spy observes,
    // otherwise the zero-call assertion below would pass for the wrong reason.
    expect(realpathSyncSpy.mock.calls.length).toBeGreaterThan(callsBeforeRegistration)

    const realRoot = realpathSync(rootDir)
    realpathSyncSpy.mockClear()
    await expect(settleRegisteredReadsUnder(realRoot)).resolves.toBe(1)
    expect(realpathSyncSpy).not.toHaveBeenCalled()
  })
})
