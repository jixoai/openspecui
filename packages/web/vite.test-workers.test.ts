/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove Windows worker pressure is capped by both four workers and host capacity.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { describe, expect, it } from 'vitest'
import { resolveWebUnitMaxWorkers } from './vite.test-workers'

describe('Web unit worker ownership', () => {
  it('caps Windows without oversubscribing a smaller host', () => {
    expect(resolveWebUnitMaxWorkers('win32', 16)).toBe(4)
    expect(resolveWebUnitMaxWorkers('win32', 2)).toBe(2)
  })

  it('preserves the existing non-Windows percentage policy', () => {
    expect(resolveWebUnitMaxWorkers('darwin', 16)).toBe('50%')
    expect(resolveWebUnitMaxWorkers('linux', 16)).toBe('50%')
  })
})
