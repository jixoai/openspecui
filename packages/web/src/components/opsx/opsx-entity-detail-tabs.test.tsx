/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Prove caller-owned supplementary tabs append after the shared Artifact and Folder tabs.
 * 2. Preserve the shared Archive/Change tab builder's existing primary order.
 *
 * Original request (2026-08-03): use a dedicated Change Detail tab as the carrier for complete evidence.
 */
import { describe, expect, it } from 'vitest'
import { buildOpsxEntityDetailTabs } from './opsx-entity-detail-tabs'

describe('buildOpsxEntityDetailTabs', () => {
  it('appends supplementary tabs after Folder', () => {
    const tabs = buildOpsxEntityDetailTabs({
      artifacts: [{ id: 'proposal', outputPath: 'proposal.md', status: 'ready' }],
      hideEmptyArtifacts: false,
      folder: { changeId: 'add-auth' },
      supplementaryTabs: [{ id: 'evidence', label: 'Evidence', content: 'evidence' }],
    })

    expect(tabs.map((tab) => tab.id)).toEqual(['proposal', 'folder', 'evidence'])
  })

  it('keeps Archive-compatible output unchanged when no supplementary tabs are supplied', () => {
    const tabs = buildOpsxEntityDetailTabs({
      artifacts: [],
      hideEmptyArtifacts: true,
      folder: { changeId: 'archived-change', archived: true },
    })

    expect(tabs.map((tab) => tab.id)).toEqual(['folder'])
  })
})
