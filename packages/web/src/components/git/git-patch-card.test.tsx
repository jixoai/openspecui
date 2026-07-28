/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove Git patch cards preserve DOM registration across ordinary rerenders.
 * 2. Prove ordinary lazy-patch admission uses stable local skeleton geometry without visible loading copy.
 *
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下）。"
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GitPatchCard } from './git-patch-card'

const baseFile = {
  fileId: 'file-1',
  source: 'tracked' as const,
  path: 'src/git-panel.ts',
  displayPath: 'src/git-panel.ts',
  previousPath: null,
  changeType: 'modified' as const,
  diff: { state: 'ready' as const, files: 1, insertions: 3, deletions: 1 },
}

afterEach(() => {
  cleanup()
})

describe('GitPatchCard', () => {
  it('renders lazy patch admission as local skeleton geometry', () => {
    const { container } = render(
      <GitPatchCard file={baseFile} patch={null} status="loading" error={null} />
    )

    expect(container.querySelector('[data-testid="git-patch-loading"]')).toBeTruthy()
    expect(container.querySelectorAll('.rt-skeleton')).toHaveLength(3)
    expect(container.textContent).not.toContain('Loading patch…')
  })

  it('does not re-register the same DOM node on ordinary rerenders', () => {
    const onRegisterCard = vi.fn<(fileId: string, node: HTMLElement | null) => void>()

    const { rerender, unmount } = render(
      <GitPatchCard
        file={baseFile}
        patch={null}
        status="idle"
        error={null}
        onRegisterCard={onRegisterCard}
      />
    )

    const registeredNode = onRegisterCard.mock.calls[0]?.[1]
    expect(onRegisterCard).toHaveBeenCalledTimes(1)
    expect(registeredNode).toBeInstanceOf(HTMLElement)

    rerender(
      <GitPatchCard
        file={{ ...baseFile }}
        patch={{
          ...baseFile,
          patch: 'diff --git a/src/git-panel.ts b/src/git-panel.ts',
          state: 'available',
        }}
        status="ready"
        error={null}
        onRegisterCard={onRegisterCard}
      />
    )

    expect(onRegisterCard).toHaveBeenCalledTimes(1)
    expect(onRegisterCard.mock.calls[0]?.[1]).toBe(registeredNode)

    unmount()

    expect(onRegisterCard).toHaveBeenCalledTimes(2)
    expect(onRegisterCard.mock.calls[1]).toEqual([baseFile.fileId, null])
  })
})
