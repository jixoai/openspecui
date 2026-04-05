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
