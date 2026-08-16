/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Keep Node-bound Core barrel values out of the browser production graph by static contract.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。" (Owner walkthrough crash follow-up)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Collect production (non-test) TypeScript/TSX sources under the web src root. */
function collectProductionSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectProductionSources(full, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

describe('core barrel browser boundary', () => {
  it('forbids value imports of the Node-bound Core barrel in production sources', () => {
    // The Core barrel re-exports Node-only values (reactive-fs instantiates
    // AsyncLocalStorage at module scope), so a value import from '@openspecui/core'
    // drags async_hooks into the browser bundle and crashes module init. Types are
    // erased at build time and stay allowed; runtime values must come from the
    // browser-safe subpath exports instead.
    const offenders: string[] = []
    for (const file of collectProductionSources(join(__dirname, '..'))) {
      const source = readFileSync(file, 'utf-8')
      const valueImport =
        /^import\s+(?!\s*type\b)[^'"]*?\{[^}]*\}\s*from\s+'@openspecui\/core'\s*$/m
      const sideEffectOrDefault = /^import\s+(?!\s*type\b)[^\n]*from\s+'@openspecui\/core'\s*$/m
      if (valueImport.test(source) || sideEffectOrDefault.test(source)) offenders.push(file)
    }
    expect(
      offenders,
      'Production files must import Core runtime values from browser-safe subpaths, not the barrel (Node-bound reactive-fs breaks browser module init).'
    ).toEqual([])
  })
})
