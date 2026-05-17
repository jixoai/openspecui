import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { OpenSpecAdapter } from './adapter.js'
import { parseOpsxSchemaDetail } from './opsx-schema-detail.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

describe('OPSX entity detail', () => {
  let tempDir: string
  let adapter: OpenSpecAdapter

  beforeEach(async () => {
    tempDir = await createTempDir()
    adapter = new OpenSpecAdapter(tempDir)
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('reads custom-schema archive detail from directory files without root proposal.md', async () => {
    const archiveId = '2026-05-17-security-audit'
    const archiveRoot = join(tempDir, 'openspec', 'changes', 'archive', archiveId)
    await mkdir(join(archiveRoot, 'reports'), { recursive: true })
    await writeFile(join(archiveRoot, '.openspec.yaml'), 'schema: security-audit\n', 'utf-8')
    await writeFile(
      join(archiveRoot, 'reports', 'summary.md'),
      '# Audit Summary\n\nNo root proposal exists.\n',
      'utf-8'
    )

    const detail = await adapter.readEntityDetail('archive', archiveId, {
      schemas: {
        'security-audit': {
          name: 'security-audit',
          artifacts: [{ id: 'summary', outputPath: 'reports/summary.md', requires: [] }],
          applyRequires: [],
        },
      },
    })

    expect(detail).toMatchObject({
      stage: 'archive',
      id: archiveId,
      exists: true,
      schemaName: 'security-audit',
    })
    expect(detail?.files.some((file) => file.path === '.openspec.yaml')).toBe(true)
    expect(detail?.artifacts).toHaveLength(1)
    expect(detail?.artifacts[0]).toMatchObject({
      id: 'summary',
      outputPath: 'reports/summary.md',
      files: [{ path: 'reports/summary.md', type: 'file' }],
    })
  })

  it('returns archive files and diagnostics when schema binding is stale', async () => {
    const archiveId = '2026-05-17-old-custom-schema'
    const archiveRoot = join(tempDir, 'openspec', 'changes', 'archive', archiveId)
    await mkdir(join(archiveRoot, 'notes'), { recursive: true })
    await writeFile(join(archiveRoot, '.openspec.yaml'), 'schema: retired-schema\n', 'utf-8')
    await writeFile(
      join(archiveRoot, 'notes', 'decision.md'),
      '# Decision\n\nKeep visible.\n',
      'utf-8'
    )

    const detail = await adapter.readEntityDetail('archive', archiveId, { schemas: {} })

    expect(detail).not.toBeNull()
    expect(detail?.exists).toBe(true)
    expect(detail?.schemaName).toBe('retired-schema')
    expect(detail?.files.find((file) => file.path === 'notes/decision.md')).toMatchObject({
      type: 'file',
      content: '# Decision\n\nKeep visible.\n',
    })
    expect(detail?.artifacts).toEqual([])
    expect(detail?.diagnostics.some((item) => item.level === 'warning')).toBe(true)
    expect(detail?.diagnostics.map((item) => item.message).join('\n')).toContain('retired-schema')
  })

  it('preserves schema diagnostics from the entity read options', async () => {
    const archiveId = '2026-05-17-upgraded-schema'
    const archiveRoot = join(tempDir, 'openspec', 'changes', 'archive', archiveId)
    await mkdir(join(archiveRoot, 'reports'), { recursive: true })
    await writeFile(join(archiveRoot, '.openspec.yaml'), 'schema: upgraded-schema\n', 'utf-8')
    await writeFile(join(archiveRoot, 'reports', 'summary.md'), '# Summary\n', 'utf-8')

    const detail = await adapter.readEntityDetail('archive', archiveId, {
      schemas: {
        'upgraded-schema': {
          name: 'upgraded-schema',
          artifacts: [{ id: 'summary', outputPath: 'reports/summary.md', requires: [] }],
          applyRequires: [],
        },
      },
      schemaDiagnostics: {
        'upgraded-schema': [
          {
            level: 'warning',
            path: 'schema:upgraded-schema',
            message: 'Schema artifact is missing a usable id or output path and was skipped.',
          },
        ],
      },
    })

    expect(detail?.artifacts[0]?.files.map((file) => file.path)).toEqual(['reports/summary.md'])
    expect(detail?.diagnostics).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('missing a usable id or output path'),
      })
    )
  })

  it('parses usable schema artifacts while reporting incompatible artifact entries', () => {
    const parsed = parseOpsxSchemaDetail(
      `
name: upgraded-schema
artifacts:
  - id: summary
    generates: reports/summary.md
    requires:
      - intake
    futureField:
      nested: value
  - id: broken
    futureOutput:
      path: reports/broken.md
apply:
  requires:
    - summary
  newPolicy:
    mode: strict
`,
      'fallback-schema'
    )

    expect(parsed.detail.name).toBe('upgraded-schema')
    expect(parsed.detail.artifacts).toEqual([
      {
        id: 'summary',
        outputPath: 'reports/summary.md',
        requires: ['intake'],
        description: undefined,
        template: undefined,
        instruction: undefined,
      },
    ])
    expect(parsed.detail.applyRequires).toEqual(['summary'])
    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        level: 'warning',
        message: expect.stringContaining('missing a usable id or output path'),
      }),
    ])
  })
})
