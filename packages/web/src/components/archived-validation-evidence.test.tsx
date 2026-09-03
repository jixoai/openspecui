/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Present the typed admitted-line archived-validation report with items, issues, totals, and root.
 * 2. Preserve CLI failure evidence without repair or automatic archive actions.
 * 3. Identify the evidence as unavailable in static snapshots instead of fabricating it.
 * 4. Lock the OpenSpec 1.11 Purpose-placeholder WARNING rendering: the exact upstream message
 *    stays visible on the `overview` path without truncation or rewriting.
 * 5. Lock the workspace row-chip facts: pass/fail derive only from the typed report, degradation
 *    reports `unavailable`, and an unexecuted session reports no chip.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { isStaticMode } from '@/lib/static-mode'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArchivedValidationEvidence } from './archived-validation-evidence'

const validateMock = vi.fn()

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    cli: {
      validate: {
        mutate: (...args: unknown[]) => validateMock(...args),
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: vi.fn(() => false),
}))

const rootActionStateMock = vi.hoisted(() => ({
  state: {
    status: 'ready',
    disabled: false,
    title: '',
    message: '',
    evidence: [],
    context: {
      cli: { available: true, version: '1.12.0' },
    },
    observedAt: 1,
  },
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionStateMock.state,
}))

function archivedReport(overrides: Record<string, unknown> = {}) {
  return {
    success: false,
    stdout: '',
    stderr: '',
    exitCode: 1,
    data: {
      items: [
        {
          id: '2026-01-01-incomplete',
          type: 'change',
          valid: false,
          issues: [
            {
              level: 'ERROR',
              path: 'tasks.md',
              message: '2 incomplete tasks (0/2 completed)',
            },
          ],
          durationMs: 4,
        },
        {
          id: '2026-01-02-complete',
          type: 'change',
          valid: true,
          issues: [],
          durationMs: 2,
        },
      ],
      summary: {
        totals: { items: 2, passed: 1, failed: 1 },
        byType: { change: { items: 2, passed: 1, failed: 1 } },
      },
      version: '1.0',
      root: { path: '/repo', source: 'nearest' },
    },
    payload: null,
    diagnostics: [],
    contractError: undefined,
    ...overrides,
  }
}

describe('ArchivedValidationEvidence', () => {
  afterEach(() => {
    cleanup()
    validateMock.mockReset()
    rootActionStateMock.state = {
      status: 'ready',
      disabled: false,
      title: '',
      message: '',
      evidence: [],
      context: {
        cli: { available: true, version: '1.12.0' },
      },
      observedAt: 1,
    }
  })

  it('offers on-demand archived validation without any repair action', async () => {
    validateMock.mockResolvedValue(archivedReport())
    render(<ArchivedValidationEvidence />)

    // The de-accordioned section presents its content directly in the detail pane.
    expect(screen.getByText(/never repairs or archives/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /repair/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    await waitFor(() => expect(validateMock).toHaveBeenCalledWith({ kind: 'archived' }))
    await waitFor(() => expect(document.body.textContent).toContain('1 passed · 1 failed'))
    // A non-zero exit with a typed report is report content, never failure-only evidence.
    expect(screen.queryByText('CLI failure evidence')).not.toBeInTheDocument()
    expect(screen.getByText(/2026-01-01-incomplete/)).toBeVisible()
    expect(screen.getByText(/2026-01-02-complete/)).toBeVisible()
    expect(screen.getByText('ERROR · tasks.md · 2 incomplete tasks (0/2 completed)')).toBeVisible()
    expect(screen.getByText('/repo')).toBeVisible()
  })

  it('preserves a CLI failure as failure evidence instead of rendering success', async () => {
    validateMock.mockResolvedValue(
      archivedReport({
        success: true,
        exitCode: 0,
        data: null,
        contractError: 'items: Required',
      })
    )
    render(<ArchivedValidationEvidence />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    expect(await screen.findByText('CLI failure evidence')).toBeVisible()
    expect(screen.getByText(/items: Required/)).toBeVisible()
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument()
  })

  it('identifies the evidence as unavailable in a static snapshot without fabricating it', () => {
    vi.mocked(isStaticMode).mockReturnValueOnce(true)
    render(<ArchivedValidationEvidence />)

    expect(screen.getByText('Unavailable in static snapshot')).toBeVisible()
    expect(screen.getByText(/not captured in this static snapshot/)).toBeVisible()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('renders CLI failure evidence for a malformed report payload instead of crashing', async () => {
    // Shallow items/summary/root keys pass a shape guard but the nested contract is invalid;
    // the evidence boundary must reject the whole report rather than render broken totals.
    validateMock.mockResolvedValue(
      archivedReport({
        data: {
          items: [],
          summary: { totals: { items: 'not-a-number' }, byType: {} },
          version: 7,
          root: '/bare-string-root',
        },
      })
    )

    render(<ArchivedValidationEvidence />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    await waitFor(() => expect(validateMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('CLI failure evidence')).toBeVisible())
    expect(screen.queryByText(/passed ·/)).toBeNull()
  })

  it('surfaces the typed schema diagnostic for a malformed report payload', async () => {
    validateMock.mockResolvedValue(
      archivedReport({
        data: {
          items: [],
          summary: { totals: { items: 'not-a-number' }, byType: {} },
          version: '1.0',
          root: { path: '/repo', source: 'nearest' },
        },
      })
    )

    render(<ArchivedValidationEvidence />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    await waitFor(() => expect(screen.getByText('CLI failure evidence')).toBeVisible())
    // The schema path/message is rendered instead of a generic failure string.
    await waitFor(() => expect(document.body.textContent).toContain('summary.totals.items'))
  })

  it('retains the CLI-supplied payload for a valid nonzero-exit report', async () => {
    const payload = { items: [], summary: { totals: { items: 1, passed: 0, failed: 1 } } }
    validateMock.mockResolvedValue(archivedReport({ payload, exitCode: 1 }))

    render(<ArchivedValidationEvidence />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    await waitFor(() => expect(document.body.textContent).toContain('1 passed · 1 failed'))
    // Exit evidence stays visible for the nonzero-exit typed report.
    expect(document.body.textContent).toContain('Exit')
  })

  it('offers no command on a detected retired OpenSpec CLI session', () => {
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: { cli: { available: true, version: '1.9.0' } },
    }
    render(<ArchivedValidationEvidence />)

    expect(screen.getByText('Unavailable on this CLI line')).toBeVisible()
    expect(screen.getByText(/requires an admitted OpenSpec CLI line/)).toBeVisible()
    expect(screen.getByText(/detected 1\.9\.0/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Validate archived tasks' })
    ).not.toBeInTheDocument()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('surfaces transport errors with a rerun control', async () => {
    validateMock.mockRejectedValue(new Error('planning root unresolved'))
    render(<ArchivedValidationEvidence />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    expect(await screen.findByText(/planning root unresolved/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Rerun' })).toBeVisible()
  })

  it('renders the 1.11 Purpose-placeholder WARNING verbatim on the overview path', async () => {
    // Exact upstream text from OpenSpec 1.11 `validation/constants.ts` PURPOSE_IS_PLACEHOLDER.
    const purposePlaceholderWarning =
      'Purpose section is still a placeholder rather than a Purpose anyone wrote (the sentence `openspec archive` ' +
      'writes for a new capability, or a `TBD`/`TODO` marker left in its place). Replace it with what this ' +
      'capability is for, editing the main spec directly: a `## Purpose` in a delta is read only when the ' +
      'capability is created, so it cannot replace this one.'
    validateMock.mockResolvedValue(
      archivedReport({
        data: {
          items: [
            {
              id: 'capability-search',
              type: 'spec',
              valid: true,
              issues: [
                {
                  level: 'WARNING',
                  path: 'overview',
                  line: 3,
                  message: purposePlaceholderWarning,
                },
              ],
              durationMs: 4,
            },
          ],
          summary: {
            totals: { items: 1, passed: 1, failed: 0 },
            byType: { spec: { items: 1, passed: 1, failed: 0 } },
          },
          version: '1.0',
          root: { path: '/repo', source: 'nearest' },
        },
      })
    )

    render(<ArchivedValidationEvidence />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    // The complete upstream message renders as one untruncated, unrewritten evidence line.
    const line = await screen.findByText(
      (content, element) =>
        element?.tagName === 'LI' &&
        content.startsWith('WARNING · overview · Purpose section is still a placeholder') &&
        content.endsWith(purposePlaceholderWarning)
    )
    expect(line).toBeVisible()
    expect(document.body.textContent).toContain(purposePlaceholderWarning)
  })

  it('reports pass/fail row chips only from the typed report and none before a run', async () => {
    const onChip = vi.fn()
    validateMock.mockResolvedValue(archivedReport())
    render(<ArchivedValidationEvidence onChip={onChip} />)

    // Before any run there is no fact to project — no fabricated chip.
    expect(onChip).toHaveBeenLastCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))
    await waitFor(() =>
      expect(onChip).toHaveBeenLastCalledWith({ label: 'fail', tone: 'negative' })
    )

    // An all-pass report projects `pass`.
    const passingChip = vi.fn()
    validateMock.mockResolvedValueOnce(
      archivedReport({
        data: {
          items: [],
          summary: { totals: { items: 0, passed: 0, failed: 0 }, byType: {} },
          version: '1.0',
          root: { path: '/repo', source: 'nearest' },
        },
      })
    )
    cleanup()
    render(<ArchivedValidationEvidence onChip={passingChip} />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))
    await waitFor(() =>
      expect(passingChip).toHaveBeenLastCalledWith({ label: 'pass', tone: 'positive' })
    )
  })

  it('reports an unavailable row chip on static and retired CLI sessions', () => {
    const staticChip = vi.fn()
    vi.mocked(isStaticMode).mockReturnValueOnce(true)
    const { unmount } = render(<ArchivedValidationEvidence onChip={staticChip} />)
    expect(staticChip).toHaveBeenLastCalledWith({ label: 'unavailable', tone: 'unavailable' })
    unmount()

    const retiredChip = vi.fn()
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: { cli: { available: true, version: '1.9.0' } },
    }
    render(<ArchivedValidationEvidence onChip={retiredChip} />)
    expect(retiredChip).toHaveBeenLastCalledWith({ label: 'unavailable', tone: 'unavailable' })
  })
})
