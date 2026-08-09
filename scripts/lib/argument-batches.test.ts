/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove bounded argument batching preserves order across a Windows-safe budget.
 * 2. Prove empty inputs and an individually oversized path have explicit behavior.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { describe, expect, it } from 'vitest'
import { splitArgumentsByLength } from './argument-batches'

describe('splitArgumentsByLength', () => {
  it('preserves every path while bounding multi-value batches', () => {
    const paths = ['packages/a/one.ts', 'packages/b/two.ts', 'packages/c/three.ts']
    const batches = splitArgumentsByLength('pnpm.exe', ['exec', 'prettier', '--check'], paths, 70)

    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flat()).toEqual(paths)
    expect(batches.every((batch) => batch.length > 0)).toBe(true)
  })

  it('returns no batches when there are no values', () => {
    expect(splitArgumentsByLength('pnpm.exe', ['exec'], [], 40)).toEqual([])
  })

  it('keeps one oversized path intact for the subprocess to report', () => {
    expect(splitArgumentsByLength('pnpm.exe', ['exec'], ['a'.repeat(100)], 20)).toEqual([
      ['a'.repeat(100)],
    ])
  })
})
