/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Lock the admitted 1.12-session rendering: MODIFIED diff body, line roles, exact upstream
 *    warning, and CLI provenance are directly visible in the Evidence workspace detail pane.
 * 2. Lock the near-miss contract: a delta carrying both warning and diff renders both.
 * 3. Prove retired (1.10/1.11) and static sessions never issue the diff transport call and
 *    degrade without fabricated evidence.
 * 4. Prove absent diff fields, command failure, and transport failure render typed evidence
 *    instead of a crash or an invented diff.
 * 5. Lock the workspace row-chip facts: counts come only from CLI MODIFIED deltas, degradation
 *    reports `unavailable`, and undetected/pending sessions report no chip.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { isStaticMode } from '@/lib/static-mode'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangeDiffEvidence } from './change-diff-evidence'

const diffEvidenceQuery = vi.fn()

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    change: {
      diffEvidence: {
        query: (...args: unknown[]) => diffEvidenceQuery(...args),
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: vi.fn(() => false),
}))

const rootActionStateMock = vi.hoisted(() => ({
  state: {
    status: 'ready' as const,
    disabled: false as const,
    title: null,
    message: null,
    evidence: [] as string[],
    context: {
      cli: { available: true, version: '1.12.0' },
    } as { cli: { available: boolean; version: string } } | null,
    observedAt: 1,
  },
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionStateMock.state,
}))

const NEAR_MISS_WARNING =
  'The requirement header differs from the main spec only in case or spacing, so archive will not merge it. Verify this is the intended requirement.'

function executedEvidence(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'executed',
    deltas: [
      {
        spec: 'search',
        operation: 'MODIFIED',
        diff: '@@ Requirement: Keyword search @@\n-The system SHALL search by id.\n+The system SHALL search by keyword.\n context line',
        warning: NEAR_MISS_WARNING,
      },
      { spec: 'glossary', operation: 'ADDED', diff: null, warning: null },
    ],
    provenance: {
      command: 'openspec show add-search --json --diff',
      root: '/repo',
      rootSource: 'nearest',
      exitCode: 0,
    },
    ...overrides,
  }
}

function setSessionVersion(version: string) {
  rootActionStateMock.state = {
    ...rootActionStateMock.state,
    context: { cli: { available: true, version } },
  }
}

/**
 * The de-accordioned section must present its diff body directly — visible without any
 * disclosure interaction (the old Accordion kept it collapsed in jsdom's visibility tree).
 */
async function waitForVisibleDiffBody(container: HTMLElement) {
  await waitFor(() => {
    const body = container.querySelector<HTMLElement>('[data-diff-body]')
    expect(body).not.toBeNull()
    if (body) expect(body).toBeVisible()
  })
}

describe('ChangeDiffEvidence', () => {
  afterEach(() => {
    cleanup()
    diffEvidenceQuery.mockReset()
    vi.mocked(isStaticMode).mockReturnValue(false)
    rootActionStateMock.state = {
      status: 'ready',
      disabled: false,
      title: null,
      message: null,
      evidence: [],
      context: {
        cli: { available: true, version: '1.12.0' },
      },
      observedAt: 1,
    }
  })

  it('renders the MODIFIED delta diff with line roles, warning, and CLI provenance on an admitted 1.12 session', async () => {
    diffEvidenceQuery.mockResolvedValue(executedEvidence())
    const { container } = render(<ChangeDiffEvidence changeId="add-search" />)

    await waitFor(() => expect(diffEvidenceQuery).toHaveBeenCalledWith({ id: 'add-search' }))

    // The de-accordioned section presents its content directly in the detail pane.
    const section = container.querySelector('[data-evidence-section="requirement-diffs"]')
    expect(section).not.toBeNull()
    await waitForVisibleDiffBody(container)

    // Unified diff body: every line role is present and colored through its data attribute.
    const roles = Array.from(container.querySelectorAll('[data-diff-line]')).map((line) =>
      line.getAttribute('data-diff-line')
    )
    expect(roles).toContain('hunk')
    expect(roles).toContain('remove')
    expect(roles).toContain('add')
    expect(roles).toContain('context')
    expect(container.querySelector('[data-diff-line="add"]')?.textContent).toContain(
      '+The system SHALL search by keyword.'
    )

    // The exact upstream warning text stays visible beside the diff (near-miss never swallowed).
    expect(screen.getByText(NEAR_MISS_WARNING)).toBeVisible()

    // CLI provenance: command, root, and exit are direct evidence.
    expect(screen.getByText('openspec show add-search --json --diff')).toBeVisible()
    expect(screen.getByText('/repo')).toBeVisible()
    expect(
      screen.getByText('CLI-owned `show --diff` evidence; never recomputed locally.')
    ).toBeVisible()

    // The ADDED delta carries no fabricated diff or warning.
    expect(container.querySelectorAll('[data-diff-delta]')).toHaveLength(1)
    expect(container.querySelector('[data-diff-delta="glossary"]')).toBeNull()
  })

  it('keeps the diff visible when a delta carries a warning without swallowing either', async () => {
    diffEvidenceQuery.mockResolvedValue(executedEvidence())
    const { container } = render(<ChangeDiffEvidence changeId="add-search" />)

    await waitForVisibleDiffBody(container)
    expect(container.querySelector('[data-diff-warning]')).not.toBeNull()
    expect(container.querySelector('[data-diff-warning]')?.textContent).toBe(NEAR_MISS_WARNING)
    expect(container.querySelector('[data-diff-line="remove"]')).not.toBeNull()
  })

  it('never issues the transport call on a retired 1.10 session and degrades', () => {
    setSessionVersion('1.10.0')
    render(<ChangeDiffEvidence changeId="add-search" />)

    expect(diffEvidenceQuery).toHaveBeenCalledTimes(0)
    expect(screen.getByText('Unavailable on this CLI line')).toBeVisible()
    expect(screen.getByText(/detected 1\.10\.0/)).toBeVisible()
    expect(document.querySelector('[data-diff-body]')).toBeNull()
    expect(document.querySelector('[data-diff-warning]')).toBeNull()
  })

  it('never issues the transport call in a static snapshot', () => {
    vi.mocked(isStaticMode).mockReturnValue(true)
    render(<ChangeDiffEvidence changeId="add-search" />)

    expect(diffEvidenceQuery).toHaveBeenCalledTimes(0)
    expect(screen.getByText('Unavailable in static snapshot')).toBeVisible()
    expect(screen.getByText(/not captured in this static snapshot/)).toBeVisible()
    expect(document.querySelector('[data-diff-body]')).toBeNull()
  })

  it('renders no fabricated diff when the CLI provides no diff fields', async () => {
    diffEvidenceQuery.mockResolvedValue(
      executedEvidence({
        deltas: [
          { spec: 'search', operation: 'MODIFIED', diff: null, warning: null },
          { spec: 'glossary', operation: 'ADDED', diff: null, warning: null },
        ],
      })
    )
    const { container } = render(<ChangeDiffEvidence changeId="add-search" />)

    await waitFor(() => expect(screen.getByText(/CLI provided no diff fields/)).toBeVisible())
    expect(container.querySelector('[data-diff-body]')).toBeNull()
    expect(container.querySelector('[data-diff-warning]')).toBeNull()
    expect(screen.getByText('openspec show add-search --json --diff')).toBeVisible()
  })

  it('projects a command failure as unavailable evidence without throwing', async () => {
    diffEvidenceQuery.mockResolvedValue({
      kind: 'unavailable',
      reason: 'command-failed',
      detail: 'FS-001: No active change found with that name',
      exitCode: 1,
    })
    render(<ChangeDiffEvidence changeId="missing-change" />)

    await waitFor(() =>
      expect(screen.getByText(/FS-001: No active change found with that name/)).toBeVisible()
    )
    expect(document.querySelector('[data-diff-body]')).toBeNull()
  })

  it('surfaces a transport failure as direct alert evidence', async () => {
    diffEvidenceQuery.mockRejectedValue(new Error('planning root unresolved'))
    render(<ChangeDiffEvidence changeId="add-search" />)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('planning root unresolved')
    )
  })

  it('reports the CLI MODIFIED-delta count as the only executed row-chip fact', async () => {
    const onChip = vi.fn()
    diffEvidenceQuery.mockResolvedValue(executedEvidence())
    const { container } = render(<ChangeDiffEvidence changeId="add-search" onChip={onChip} />)

    await waitForVisibleDiffBody(container)
    expect(onChip).toHaveBeenLastCalledWith({ label: '1 MODIFIED', tone: 'neutral' })
  })

  it('reports unavailable chips for static and retired sessions and none while undetected', () => {
    const staticChip = vi.fn()
    vi.mocked(isStaticMode).mockReturnValue(true)
    const { unmount } = render(<ChangeDiffEvidence changeId="add-search" onChip={staticChip} />)
    expect(staticChip).toHaveBeenLastCalledWith({ label: 'unavailable', tone: 'unavailable' })
    unmount()

    const legacyChip = vi.fn()
    setSessionVersion('1.10.0')
    render(<ChangeDiffEvidence changeId="add-search" onChip={legacyChip} />)
    expect(legacyChip).toHaveBeenLastCalledWith({ label: 'unavailable', tone: 'unavailable' })
  })

  it('reports an error chip for a transport failure and none while the CLI is undetected', async () => {
    const onChip = vi.fn()
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: null,
    }
    const { rerender } = render(<ChangeDiffEvidence changeId="add-search" onChip={onChip} />)
    expect(onChip).toHaveBeenLastCalledWith(null)

    diffEvidenceQuery.mockRejectedValue(new Error('planning root unresolved'))
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: { cli: { available: true, version: '1.12.0' } },
    }
    rerender(<ChangeDiffEvidence changeId="add-search" onChip={onChip} />)
    await waitFor(() => expect(onChip).toHaveBeenLastCalledWith({ label: 'error', tone: 'error' }))
  })
})
