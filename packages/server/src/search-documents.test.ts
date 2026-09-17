/**
 * Orthogonal intents (created 2026-09-17 Asia/Shanghai):
 * 1. Prove change-document enumeration subtracts the CLI structural namespace-name set so
 *    a namespaced directory never becomes a searchable change document.
 * 2. Prove search degrades to today's behavior when no namespace set is available — the
 *    enumeration is local-listing-driven and never CLI-gated.
 *
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 */
import { OpenSpecAdapter } from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectSearchDocuments } from './search-documents.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

/** Physical fixture: `area` is a namespace-shaped directory that also carries a proposal. */
async function createFixtureAdapter(): Promise<OpenSpecAdapter> {
  const root = await mkdtemp(join(tmpdir(), 'openspecui-search-nested-'))
  tempDirs.push(root)
  const areaDir = join(root, 'openspec', 'changes', 'area')
  await mkdir(join(areaDir, 'alpha'), { recursive: true })
  await writeFile(join(areaDir, 'proposal.md'), '# Area namespace wrapper\n', 'utf-8')
  const realDir = join(root, 'openspec', 'changes', 'real-change')
  await mkdir(realDir, { recursive: true })
  await writeFile(join(realDir, 'proposal.md'), '# Real change proposal\n', 'utf-8')
  return new OpenSpecAdapter(root)
}

describe('collectSearchDocuments namespace subtraction (OpenSpec 1.13.1)', () => {
  it('does not index a namespaced directory when the namespace-name set is available', async () => {
    const adapter = await createFixtureAdapter()

    const documents = await collectSearchDocuments(adapter, undefined, undefined, [], {
      namespaceNames: new Set(['area']),
    })

    const changeIds = documents
      .filter((document) => document.kind === 'change')
      .map((document) => document.id)
    expect(changeIds).toEqual(['change:real-change'])
    expect(changeIds).not.toContain('change:area')
  })

  it('keeps indexing the local listing when no namespace set is available (degradation)', async () => {
    const adapter = await createFixtureAdapter()

    const documents = await collectSearchDocuments(adapter)

    const changeIds = documents
      .filter((document) => document.kind === 'change')
      .map((document) => document.id)
      .sort()
    // Today's behavior: the enumeration is file-driven; without a CLI namespace set every
    // locally listed change directory stays searchable.
    expect(changeIds).toEqual(['change:area', 'change:real-change'])
  })
})
