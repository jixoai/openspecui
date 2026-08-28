/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Lock the 1.11-session rendering: MODIFIED diff body, line roles, exact upstream warning,
 *    and CLI provenance are visible in the direct evidence layer.
 * 2. Lock the near-miss contract: a delta carrying both warning and diff renders both.
 * 3. Prove 1.10 and static sessions never issue the diff transport call and degrade without
 *    fabricated evidence.
 * 4. Prove absent diff fields, command failure, and transport failure render typed evidence
 *    instead of a crash or an invented diff.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import { isStaticMode } from '@/lib/static-mode'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      cli: { available: true, version: '1.11.0' },
    },
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
 * jsdom keeps collapsed Accordion panels out of the visibility tree, so panel assertions
 * open the disclosure through its trigger — the same pattern the archived-validation
 * evidence tests use.
 */
function openDisclosure() {
  fireEvent.click(screen.getByRole('button', { name: /Requirement diffs/ }))
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
        cli: { available: true, version: '1.11.0' },
      },
      observedAt: 1,
    }
  })

  it('renders the MODIFIED delta diff with line roles, warning, and CLI provenance on 1.11', async () => {
    diffEvidenceQuery.mockResolvedValue(executedEvidence())
    const { container } = render(<ChangeDiffEvidence changeId="add-search" />)

    await waitFor(() => expect(diffEvidenceQuery).toHaveBeenCalledWith({ id: 'add-search' }))
    await waitFor(() => expect(container.querySelector('[data-diff-body]')).not.toBeNull())
    openDisclosure()

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

    await waitFor(() => expect(container.querySelector('[data-diff-body]')).not.toBeNull())
    openDisclosure()
    expect(container.querySelector('[data-diff-warning]')).not.toBeNull()
    expect(container.querySelector('[data-diff-warning]')?.textContent).toBe(NEAR_MISS_WARNING)
    expect(container.querySelector('[data-diff-line="remove"]')).not.toBeNull()
  })

  it('never issues the transport call on an admitted 1.10 session and degrades', () => {
    setSessionVersion('1.10.0')
    render(<ChangeDiffEvidence changeId="add-search" />)
    openDisclosure()

    expect(diffEvidenceQuery).toHaveBeenCalledTimes(0)
    expect(screen.getByText('Unavailable on this CLI line')).toBeVisible()
    expect(screen.getByText(/detected 1\.10\.0/)).toBeVisible()
    expect(document.querySelector('[data-diff-body]')).toBeNull()
    expect(document.querySelector('[data-diff-warning]')).toBeNull()
  })

  it('never issues the transport call in a static snapshot', () => {
    vi.mocked(isStaticMode).mockReturnValue(true)
    render(<ChangeDiffEvidence changeId="add-search" />)
    openDisclosure()

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

    await waitFor(() => expect(screen.getByText(/CLI provided no diff fields/)).toBeInTheDocument())
    openDisclosure()
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

    // The fetch settles into a fresh disclosure; wait for its trigger summary, then open it.
    const settled = await screen.findByRole('button', { name: /CLI evidence unavailable/ })
    fireEvent.click(settled)

    await waitFor(() =>
      expect(screen.getByText(/FS-001: No active change found with that name/)).toBeVisible()
    )
    expect(document.querySelector('[data-diff-body]')).toBeNull()
  })

  it('surfaces a transport failure as direct alert evidence', async () => {
    diffEvidenceQuery.mockRejectedValue(new Error('planning root unresolved'))
    render(<ChangeDiffEvidence changeId="add-search" />)
    openDisclosure()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('planning root unresolved')
    )
  })
})
