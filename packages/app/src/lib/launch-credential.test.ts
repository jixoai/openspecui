/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove the auto-launched credential fragment is consumed once into session memory.
 * 2. Prove the fragment is stripped from the URL and never persisted to localStorage/query params.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Section 8.12: auto-launch credential fragment consume + credential hygiene.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  clearLaunchCredential,
  consumeLaunchCredential,
  LAUNCH_CREDENTIAL_SESSION_KEY,
  readLaunchCredential,
} from './launch-credential'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key) {
      map.delete(key)
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
  }
}

describe('launch-credential', () => {
  it('consumes the credential from the fragment into session memory once', () => {
    const storage = memoryStorage()
    const replaceState = vi.fn()
    const credential = consumeLaunchCredential({
      hash: '#credential=bearer-secret',
      replaceState,
      sessionStorage: storage,
    })
    expect(credential).toBe('bearer-secret')
    expect(storage.getItem(LAUNCH_CREDENTIAL_SESSION_KEY)).toBe('bearer-secret')
    // The fragment is stripped (replaceState called with a URL that has no credential).
    expect(replaceState).toHaveBeenCalled()
    const replacedUrl = replaceState.mock.calls[0]?.[0] as string
    expect(replacedUrl).not.toContain('credential')
    expect(replacedUrl).not.toContain('bearer-secret')
  })

  it('returns null when no credential fragment is present', () => {
    const storage = memoryStorage()
    const credential = consumeLaunchCredential({
      hash: '#other=param',
      replaceState: vi.fn(),
      sessionStorage: storage,
    })
    expect(credential).toBeNull()
    expect(storage.getItem(LAUNCH_CREDENTIAL_SESSION_KEY)).toBeNull()
  })

  it('preserves other fragment params while removing only the credential', () => {
    const storage = memoryStorage()
    const replaceState = vi.fn()
    consumeLaunchCredential({
      hash: '#credential=secret&session=abc',
      replaceState,
      sessionStorage: storage,
    })
    const replacedUrl = replaceState.mock.calls[0]?.[0] as string
    expect(replacedUrl).toContain('session=abc')
    expect(replacedUrl).not.toContain('credential')
  })

  it('readLaunchCredential returns the in-session credential without consuming', () => {
    const storage = memoryStorage()
    storage.setItem(LAUNCH_CREDENTIAL_SESSION_KEY, 'persisted-secret')
    expect(readLaunchCredential(storage)).toBe('persisted-secret')
  })

  it('clearLaunchCredential removes the in-session credential', () => {
    const storage = memoryStorage()
    storage.setItem(LAUNCH_CREDENTIAL_SESSION_KEY, 'x')
    clearLaunchCredential(storage)
    expect(readLaunchCredential(storage)).toBeNull()
  })
})
