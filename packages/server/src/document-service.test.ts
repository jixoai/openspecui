import type { OnReadDocumentHookV1, OpenSpecAdapter } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { DocumentService } from './document-service.js'
import type { HookRuntime } from './hook-runtime.js'

function createRuntime(onReadDocument?: OnReadDocumentHookV1): HookRuntime {
  return {
    hooksPath: '/tmp/openspec/openspecui.hooks.ts',
    load: vi.fn().mockResolvedValue(onReadDocument ? { onReadDocument } : {}),
    onDispose: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  }
}

function createAdapter(): Pick<
  OpenSpecAdapter,
  'readSpecRaw' | 'readChangeFiles' | 'readArchivedChangeRaw'
> {
  return {
    readSpecRaw: vi.fn().mockResolvedValue(`# CLI Spec

## Purpose
CLI_0003

## Requirements
### Requirement: CLI_0003
The system SHALL show CLI_0003.

#### Scenario: Requirement id only
- WHEN reading the spec
- THEN CLI_0003 is visible
`),
    readChangeFiles: vi.fn().mockResolvedValue([
      {
        path: 'tasks.md',
        type: 'file',
        content: '# Tasks\n\n- [ ] Source task',
      },
      {
        path: 'specs/auth/spec.md',
        type: 'file',
        content:
          '# Delta\n\n## ADDED Requirements\n\n### Requirement: Source\n\nThe system SHALL work.\n\n#### Scenario: Source scenario\n\n- **WHEN** rendered\n- **THEN** source appears',
      },
      {
        path: 'notes.md',
        type: 'file',
        content: '# Notes\n\nSource note',
      },
    ]),
    readArchivedChangeRaw: vi.fn().mockResolvedValue({
      proposal: '# Archived Proposal',
      tasks: '# Archived Tasks\n\n- [x] Source archive task',
      deltaSpecs: [
        {
          specId: 'auth',
          content:
            '# Archived Delta\n\n## ADDED Requirements\n\n### Requirement: Source Archive\n\nThe system SHALL work.\n\n#### Scenario: Source archive scenario\n\n- **WHEN** rendered\n- **THEN** source appears',
        },
      ],
    }),
  }
}

describe('DocumentService', () => {
  it('bypasses onReadDocument for source reads', async () => {
    const adapter = createAdapter()
    const hook = vi.fn<OnReadDocumentHookV1>(async (_ctx, read) => {
      const result = await read()
      return { ...result, markdown: result.markdown.replaceAll('CLI_0003', 'Resolved title') }
    })
    const service = new DocumentService('/project', adapter as OpenSpecAdapter, createRuntime(hook))

    const result = await service.readSpecRaw('cli', 'view', 'source')

    expect(result?.markdown).toContain('CLI_0003')
    expect(result?.markdown).not.toContain('Resolved title')
    expect(hook).not.toHaveBeenCalled()
  })

  it('applies onReadDocument for processed reads and preserves sourceMarkdown', async () => {
    const adapter = createAdapter()
    const service = new DocumentService(
      '/project',
      adapter as OpenSpecAdapter,
      createRuntime(async (_ctx, read) => {
        const result = await read()
        return {
          ...result,
          markdown: result.markdown.replaceAll(
            'CLI_0003',
            'CLI_0003 - Reqstool enriched requirement'
          ),
        }
      })
    )

    const result = await service.readSpecRaw('cli', 'view', 'processed')

    expect(result?.markdown).toContain('Reqstool enriched requirement')
    expect(result?.sourceMarkdown).toContain('CLI_0003')
    expect(result?.sourceMarkdown).not.toContain('Reqstool enriched requirement')
  })

  it('fails open to source markdown with diagnostics when hook throws', async () => {
    const adapter = createAdapter()
    const service = new DocumentService(
      '/project',
      adapter as OpenSpecAdapter,
      createRuntime(async () => {
        throw new Error('daemon unavailable')
      })
    )

    const result = await service.readSpecRaw('cli', 'view', 'processed')

    expect(result?.markdown).toContain('CLI_0003')
    expect(result?.diagnostics?.[0]?.level).toBe('error')
    expect(result?.diagnostics?.[0]?.message).toContain('daemon unavailable')
  })

  it('applies onReadDocument to active change tasks artifact previews', async () => {
    const adapter = createAdapter()
    const hook = vi.fn<OnReadDocumentHookV1>(async (ctx, read) => {
      const result = await read()
      return {
        ...result,
        markdown: `${result.markdown}\n\nprocessed:${ctx.document.stage}:${ctx.document.kind}`,
      }
    })
    const service = new DocumentService('/project', adapter as OpenSpecAdapter, createRuntime(hook))

    const result = await service.readChangeArtifactOutput('add-auth', 'tasks.md')

    expect(result).toContain('processed:change:tasks')
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          stage: 'change',
          kind: 'tasks',
          changeId: 'add-auth',
          relativePath: 'openspec/changes/add-auth/tasks.md',
        }),
      }),
      expect.any(Function)
    )
  })

  it('applies onReadDocument to active change delta spec glob previews', async () => {
    const adapter = createAdapter()
    const hook = vi.fn<OnReadDocumentHookV1>(async (ctx, read) => {
      const result = await read()
      return {
        ...result,
        markdown: `${result.markdown}\n\nprocessed:${ctx.document.stage}:${ctx.document.kind}`,
      }
    })
    const service = new DocumentService('/project', adapter as OpenSpecAdapter, createRuntime(hook))

    const result = await service.readChangeGlobArtifactFiles('add-auth', 'specs/**/*.md')

    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('specs/auth/spec.md')
    expect(result[0]?.content).toContain('processed:change:delta-spec')
  })

  it('keeps unrecognized change markdown artifacts as source content', async () => {
    const adapter = createAdapter()
    const hook = vi.fn<OnReadDocumentHookV1>(async (_ctx, read) => {
      const result = await read()
      return { ...result, markdown: `${result.markdown}\n\nprocessed` }
    })
    const service = new DocumentService('/project', adapter as OpenSpecAdapter, createRuntime(hook))

    const result = await service.readChangeArtifactOutput('add-auth', 'notes.md')

    expect(result).toBe('# Notes\n\nSource note')
    expect(hook).not.toHaveBeenCalled()
  })

  it('applies onReadDocument to archived change tasks and delta spec reads', async () => {
    const adapter = createAdapter()
    const hook = vi.fn<OnReadDocumentHookV1>(async (ctx, read) => {
      const result = await read()
      return {
        ...result,
        markdown: `${result.markdown}\n\nprocessed:${ctx.document.stage}:${ctx.document.kind}`,
      }
    })
    const service = new DocumentService('/project', adapter as OpenSpecAdapter, createRuntime(hook))

    const result = await service.readArchivedChangeRaw('2026-01-01-add-auth')

    expect(result?.tasks.markdown).toContain('processed:archive:tasks')
    expect(result?.deltaSpecs[0]?.content).toContain('processed:archive:delta-spec')
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          stage: 'archive',
          kind: 'tasks',
          changeId: '2026-01-01-add-auth',
        }),
      }),
      expect.any(Function)
    )
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({
        document: expect.objectContaining({
          stage: 'archive',
          kind: 'delta-spec',
          changeId: '2026-01-01-add-auth',
        }),
      }),
      expect.any(Function)
    )
  })
})
