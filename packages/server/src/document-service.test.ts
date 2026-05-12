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

function createAdapter(): Pick<OpenSpecAdapter, 'readSpecRaw'> {
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
})
