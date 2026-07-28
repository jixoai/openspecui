/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove hashed Vite SSG server entries resolve only through the build manifest.
 * 2. Prove malformed and escaping manifest entries are rejected.
 *
 * Owner-reported defect (2026-07-27): static export failed after a clean SSG build because the
 * exporter assumed an un-hashed server filename.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveSsgServerEntryPath,
  SSG_SERVER_ENTRY_MANIFEST,
  SSG_SERVER_ENTRY_SOURCE,
} from './server-entry'

function createServerDir(): string {
  return mkdtempSync(join(tmpdir(), 'openspecui-ssg-server-entry-'))
}

describe('SSG server entry manifest', () => {
  it('resolves the exact hashed Vite entry', () => {
    const serverDir = createServerDir()
    mkdirSync(join(serverDir, 'assets'))
    writeFileSync(join(serverDir, 'assets/entry-server-a1b2c3.js'), 'export const render = true')
    writeFileSync(
      join(serverDir, SSG_SERVER_ENTRY_MANIFEST),
      JSON.stringify({
        [SSG_SERVER_ENTRY_SOURCE]: {
          file: 'assets/entry-server-a1b2c3.js',
          isEntry: true,
        },
      })
    )

    expect(resolveSsgServerEntryPath(serverDir)).toBe(
      join(serverDir, 'assets/entry-server-a1b2c3.js')
    )
  })

  it.each([
    { label: 'missing source key', entry: {} },
    {
      label: 'non-entry chunk',
      entry: { [SSG_SERVER_ENTRY_SOURCE]: { file: 'assets/chunk.js', isEntry: false } },
    },
    {
      label: 'escaping path',
      entry: { [SSG_SERVER_ENTRY_SOURCE]: { file: '../outside.js', isEntry: true } },
    },
  ])('rejects a $label', ({ entry }) => {
    const serverDir = createServerDir()
    writeFileSync(join(serverDir, SSG_SERVER_ENTRY_MANIFEST), JSON.stringify(entry))
    expect(() => resolveSsgServerEntryPath(serverDir)).toThrow(/SSG server/)
  })
})
