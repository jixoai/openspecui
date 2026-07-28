/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove production argument parsing plus explicit prerelease entry and continuation.
 * 2. Prove explicit exit and interrupted-exit continuation.
 * 3. Prove ambiguous, unsafe, or conflicting modes fail closed.
 *
 * Original request (2026-07-28): "我想先发布一个beta版本"
 */

import { describe, expect, it } from 'vitest'

import { parseChangeversionOptions, planPrereleaseMode } from './prerelease-mode'

describe('changeversion prerelease mode', () => {
  it('parses --pre beta without treating the default false exit flag as supplied', () => {
    expect(
      parseChangeversionOptions(['bun', 'scripts/changeversion-auto.ts', '--pre', 'beta'])
    ).toEqual({ exitPre: false, preTag: 'beta' })
  })

  it('leaves a truly supplied conflicting flag for the typed planner to reject', () => {
    const options = parseChangeversionOptions([
      'bun',
      'scripts/changeversion-auto.ts',
      '--pre',
      'beta',
      '--exit-pre',
    ])
    expect(() => planPrereleaseMode({ ...options, state: null })).toThrow(
      /either --pre <channel> or --exit-pre/
    )
  })

  it('enters beta when no prerelease state exists', () => {
    expect(planPrereleaseMode({ exitPre: false, preTag: 'beta', state: null })).toEqual({
      args: ['pre', 'enter', 'beta'],
      kind: 'enter',
    })
  })

  it('continues the same beta channel without re-entering it', () => {
    expect(
      planPrereleaseMode({
        exitPre: false,
        preTag: 'beta',
        state: { mode: 'pre', tag: 'beta' },
      })
    ).toBeNull()
  })

  it('plans prerelease exit and tolerates an already-persisted exit', () => {
    expect(
      planPrereleaseMode({
        exitPre: true,
        preTag: null,
        state: { mode: 'pre', tag: 'beta' },
      })
    ).toEqual({ args: ['pre', 'exit'], kind: 'exit' })
    expect(
      planPrereleaseMode({
        exitPre: true,
        preTag: null,
        state: { mode: 'exit', tag: 'beta' },
      })
    ).toBeNull()
  })

  it.each([
    { exitPre: false, preTag: 'rc', state: { mode: 'pre' as const, tag: 'beta' } },
    { exitPre: false, preTag: null, state: { mode: 'pre' as const, tag: 'beta' } },
    { exitPre: false, preTag: 'latest', state: null },
    { exitPre: true, preTag: 'beta', state: null },
  ])('rejects ambiguous or conflicting input %#', (input) => {
    expect(() => planPrereleaseMode(input)).toThrow()
  })
})
