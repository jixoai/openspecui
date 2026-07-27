/**
 * Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
 * 1. Verify change-scoped OPSX compose route and evidence-source mapping.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import { describe, expect, it } from 'vitest'
import {
  buildOpsxComposeDraft,
  buildOpsxComposeHref,
  parseOpsxComposeLocationSearch,
  resolveOpsxPromptSource,
  type OpsxComposeInput,
} from './opsx-compose'

describe('opsx-compose helpers', () => {
  it('builds and parses compose href', () => {
    const href = buildOpsxComposeHref({
      action: 'continue',
      changeId: 'add-search',
      artifactId: 'design',
    })

    expect(href).toBe('/opsx-compose?action=continue&change=add-search&artifact=design')

    const parsed = parseOpsxComposeLocationSearch(
      '?action=continue&change=add-search&artifact=design'
    )

    expect(parsed).toEqual<OpsxComposeInput>({
      action: 'continue',
      changeId: 'add-search',
      artifactId: 'design',
    })
  })

  it('maps apply to instructions apply source', () => {
    const source = resolveOpsxPromptSource({
      action: 'apply',
      changeId: 'add-search',
    })

    expect(source).toEqual({
      command: 'openspec',
      args: ['instructions', 'apply', '--change', 'add-search'],
    })
  })

  it.each(['update', 'sync'] as const)('builds and parses the %s change action', (action) => {
    const href = buildOpsxComposeHref({ action, changeId: 'add-search' })

    expect(href).toBe(`/opsx-compose?action=${action}&change=add-search`)
    expect(parseOpsxComposeLocationSearch(`?action=${action}&change=add-search`)).toEqual({
      action,
      changeId: 'add-search',
      artifactId: undefined,
    })
    expect(resolveOpsxPromptSource({ action, changeId: 'add-search' })).toEqual({
      command: 'openspec',
      args: ['status', '--change', 'add-search'],
    })
  })

  it('returns null source when artifact-dependent action misses artifact', () => {
    const source = resolveOpsxPromptSource({
      action: 'continue',
      changeId: 'add-search',
    })

    expect(source).toBeNull()
  })

  it('builds archive draft from status output', () => {
    const draft = buildOpsxComposeDraft(
      {
        action: 'archive',
        changeId: 'add-search',
      },
      'status text'
    )

    expect(draft).toContain('Archive planning for change "add-search".')
    expect(draft).toContain('status text')
  })
})
