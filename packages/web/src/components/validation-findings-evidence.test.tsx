/**
 * Orthogonal intents (updated 2026-09-04 Asia/Shanghai):
 * 1. Present the typed 1.12 findings document: INFO as a distinct informational class,
 *    `returnedItems` beside preserved full-run totals, CLI provenance, filtered labeling.
 * 2. Attribute findings to their owning change: the current change's entries are the
 *    primary list, other active changes' entries stay in a labeled secondary disclosure,
 *    and scope-level counts are never filtered to the current change.
 * 3. Keep the CLI-owned request-error envelope on the direct plane with its fix string.
 * 4. Identify the evidence as unavailable in static snapshots and on retired CLI sessions
 *    without fabricating it or offering a command.
 * 5. Validate payloads through the Core contract schemas: malformed documents become typed
 *    failure evidence instead of a crash.
 * 6. Lock the workspace row-chip facts: counts derive only from the typed findings document,
 *    degradation reports `unavailable`, and an unexecuted session reports no chip.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 * Owner walkthrough correction (2026-09-04): findings must attribute their owning change; the Evidence detail panel styling follows the vision review.
 */
import { isStaticMode } from '@/lib/static-mode'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ValidationFindingsEvidence } from './validation-findings-evidence'

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

/**
 * Transport fixture wrapping one findings payload. The executed 1.12 document keeps the
 * item `valid: true` while carrying the merge-conflict INFO finding — the projection must
 * never re-label that verdict.
 */
function findingsTransport(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    stdout: JSON.stringify(data ?? {}),
    stderr: '',
    exitCode: 0,
    data: data ?? null,
    payload: data ?? null,
    diagnostics: [],
    ...overrides,
  }
}

function findingsDocument(overrides: Record<string, unknown> = {}) {
  return {
    report: {
      kind: 'validation-findings',
      version: '1.0',
      scope: 'changes',
      returnedItems: 1,
      totalItems: 3,
    },
    itemFindings: [
      {
        id: 'test-change',
        type: 'change',
        valid: true,
        issues: [
          {
            level: 'INFO',
            path: 'missing-spec/spec.md',
            message:
              'Archive would refuse this delta: missing-spec: target spec does not exist; only ADDED requirements are allowed for new specs. MODIFIED and RENAMED operations require an existing spec.',
          },
        ],
        durationMs: 19,
      },
    ],
    summary: {
      totals: { items: 3, passed: 3, failed: 0 },
      byType: {
        change: { items: 1, passed: 1, failed: 0 },
        spec: { items: 2, passed: 2, failed: 0 },
      },
    },
    root: { path: '/repo', source: 'nearest' },
    ...overrides,
  }
}

describe('ValidationFindingsEvidence', () => {
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

  it('renders the findings document with INFO distinct, filtered counts, and full-run totals', async () => {
    validateMock.mockResolvedValue(findingsTransport(findingsDocument()))
    render(<ValidationFindingsEvidence changeId="test-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    await waitFor(() =>
      expect(validateMock).toHaveBeenCalledWith({ kind: 'findings', scope: 'changes' })
    )
    // The filtered view is labeled as filtered, with returnedItems beside totalItems.
    expect(await screen.findByText('Filtered view · 1 of 3 items with findings')).toBeVisible()
    expect(screen.getByText(/1 of 3 \(changes scope\)/)).toBeVisible()
    // Provenance grid carries root and exit status beside the counts.
    const provenance = document.querySelector('[data-findings-provenance]')
    expect(provenance).not.toBeNull()
    expect(provenance?.textContent).toContain('/repo')
    expect(provenance?.textContent).toContain('Exit status')
    // Full-run totals stay visible beside the filtered counts — never replaced by them.
    expect(screen.getByText('3 passed')).toBeVisible()
    expect(screen.getByText('0 failed')).toBeVisible()
    expect(screen.getByText('3 items')).toBeVisible()
    // INFO renders as its own chip class, distinct from warnings and errors.
    const infoRow = document.querySelector('li[data-findings-issue="INFO"]')
    expect(infoRow).not.toBeNull()
    expect(infoRow?.textContent).toContain('missing-spec/spec.md')
    expect(infoRow?.querySelector('[data-findings-level="INFO"]')).not.toBeNull()
    // The merge-conflict advisory stays verbatim on the direct plane.
    expect(document.body.textContent).toContain('Archive would refuse this delta')
    // The item stays valid: the findings projection never re-labels the CLI verdict.
    expect(screen.getByText(/test-change/)).toBeVisible()
    // The footer names the exact CLI command and scope instead of a floating rerun button.
    expect(screen.getByText('openspec validate --report findings · changes scope')).toBeVisible()
  })

  it('attributes findings: this change is the primary list and other changes stay in a labeled secondary disclosure', async () => {
    validateMock.mockResolvedValue(
      findingsTransport(
        findingsDocument({
          report: {
            kind: 'validation-findings',
            version: '1.0',
            scope: 'changes',
            returnedItems: 2,
            totalItems: 3,
          },
          itemFindings: [
            {
              id: 'clean-change',
              type: 'change',
              valid: false,
              issues: [{ level: 'WARNING', path: 'proposal.md', message: 'Tasks list is empty.' }],
              durationMs: 5,
            },
            {
              id: 'conflict-change',
              type: 'change',
              valid: true,
              issues: [
                {
                  level: 'INFO',
                  path: 'missing-spec/spec.md',
                  message:
                    'Archive would refuse this delta: missing-spec: target spec does not exist.',
                },
              ],
              durationMs: 19,
            },
          ],
          summary: {
            totals: { items: 3, passed: 2, failed: 1 },
            byType: { change: { items: 3, passed: 2, failed: 1 } },
          },
        })
      )
    )
    render(<ValidationFindingsEvidence changeId="clean-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    expect(await screen.findByText('Filtered view · 2 of 3 items with findings')).toBeVisible()

    // Primary list carries only the current change's finding.
    expect(screen.getByRole('heading', { name: 'This change' })).toBeVisible()
    const own = document.querySelector('[data-findings-own]')
    expect(own).not.toBeNull()
    expect(own?.textContent).toContain('proposal.md')
    expect(own?.textContent).toContain('Tasks list is empty.')
    expect(own?.textContent).not.toContain('Archive would refuse this delta')

    // Other active changes land in a collapsed, clearly-labeled secondary disclosure.
    const other = document.querySelector('details[data-findings-other]')
    expect(other).not.toBeNull()
    expect(other?.hasAttribute('open')).toBe(false)
    expect(screen.getByText('Findings from other active changes (1)')).toBeVisible()
    // Each secondary entry is prefixed by its owning change id prominently.
    const otherEntry = document.querySelector('[data-findings-other-item]')
    expect(otherEntry).not.toBeNull()
    if (otherEntry) {
      const prefixedIds = Array.from(otherEntry.children).filter(
        (child) => child.tagName === 'DIV' && child.textContent === 'conflict-change'
      )
      expect(prefixedIds.length).toBe(1)
    }
    expect(other?.textContent).toContain('Archive would refuse this delta')

    // Scope-level facts stay unfiltered: both scope items count, full-run totals preserved.
    expect(screen.getByText(/2 of 3 \(changes scope\)/)).toBeVisible()
    expect(screen.getByText('2 passed')).toBeVisible()
    expect(screen.getByText('1 failed')).toBeVisible()
    expect(screen.getByText('3 items')).toBeVisible()
  })

  it('shows a clean change no primary finding while another change advisory stays attributed', async () => {
    validateMock.mockResolvedValue(
      findingsTransport(
        findingsDocument({
          itemFindings: [
            {
              id: 'conflict-change',
              type: 'change',
              valid: true,
              issues: [
                {
                  level: 'INFO',
                  path: 'missing-spec/spec.md',
                  message: 'Archive would refuse this delta: target spec does not exist.',
                },
              ],
              durationMs: 19,
            },
          ],
        })
      )
    )
    render(<ValidationFindingsEvidence changeId="clean-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    expect(await screen.findByText('Filtered view · 1 of 3 items with findings')).toBeVisible()
    // The walkthrough defect: clean-change must not read as the owner of the advisory.
    const own = document.querySelector('[data-findings-own]')
    expect(own).not.toBeNull()
    expect(own?.textContent).not.toContain('Archive would refuse this delta')
    expect(screen.getByText(/No findings for this change in the filtered scope/)).toBeVisible()
    expect(screen.getByText('Findings from other active changes (1)')).toBeVisible()
    // The full-run totals remain unfiltered scope facts.
    expect(screen.getByText('3 passed')).toBeVisible()
  })

  it('distinguishes the not-loaded, running, and loaded pre-run states', async () => {
    let resolveRun: (value: unknown) => void = () => {}
    validateMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve
      })
    )
    render(<ValidationFindingsEvidence changeId="test-change" />)

    // Not yet run: owned dashed container, plain-language copy, command as a code chip.
    expect(screen.getByText('Not yet run')).toBeVisible()
    expect(screen.getByText('No findings loaded')).toBeVisible()
    expect(screen.getByText('openspec validate --report findings')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    // Running is its own explicit state, distinct from not-loaded and loaded.
    expect(await screen.findByText('Running findings report…')).toBeVisible()
    expect(screen.queryByText('No findings loaded')).not.toBeInTheDocument()

    resolveRun(findingsTransport(findingsDocument()))
    expect(await screen.findByText('Filtered view · 1 of 3 items with findings')).toBeVisible()
    expect(screen.queryByText('Running findings report…')).not.toBeInTheDocument()
  })

  it('states the filtered view is not the complete validation result', async () => {
    validateMock.mockResolvedValue(findingsTransport(findingsDocument()))
    render(<ValidationFindingsEvidence changeId="test-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    await waitFor(() =>
      expect(screen.getByText(/complete validation result remains the full report/)).toBeVisible()
    )
  })

  it('renders the empty findings document as a normal success, not a failure', async () => {
    validateMock.mockResolvedValue(
      findingsTransport(
        findingsDocument({
          report: {
            kind: 'validation-findings',
            version: '1.0',
            scope: 'changes',
            returnedItems: 0,
            totalItems: 0,
          },
          itemFindings: [],
          summary: { totals: { items: 0, passed: 0, failed: 0 }, byType: {} },
        })
      )
    )
    render(<ValidationFindingsEvidence changeId="test-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    expect(await screen.findByText(/No item in this scope reported an issue/)).toBeVisible()
    expect(screen.getByText('0 of 0 (changes scope)')).toBeVisible()
    expect(screen.queryByText('CLI failure evidence')).not.toBeInTheDocument()
  })

  it('surfaces the CLI request-error envelope with its fix string on the direct plane', async () => {
    validateMock.mockResolvedValue(
      findingsTransport(
        {
          status: [
            {
              severity: 'error',
              code: 'invalid_validation_report_request',
              message: 'The findings report requires an explicit bulk scope.',
              fix: 'Use one of --all, --changes, --specs, or --archived with --report findings.',
            },
          ],
        },
        { exitCode: 1 }
      )
    )
    render(<ValidationFindingsEvidence changeId="test-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    const failure = await screen.findByText(
      /invalid_validation_report_request: The findings report requires an explicit bulk scope/
    )
    expect(failure).toBeVisible()
    expect(screen.getByText(/Use one of --all, --changes, --specs, or --archived/)).toBeVisible()
    expect(screen.queryByText(/Filtered view/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rerun' })).toBeVisible()
  })

  it('renders CLI failure evidence for a malformed findings payload instead of crashing', async () => {
    validateMock.mockResolvedValue(
      findingsTransport(
        findingsDocument({
          report: {
            kind: 'validation-findings',
            version: '1.0',
            // scope outside the CLI enum is contract drift at this boundary
            scope: 'bogus',
            returnedItems: 1,
            totalItems: 1,
          },
        })
      )
    )
    render(<ValidationFindingsEvidence changeId="test-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    expect(await screen.findByText('CLI failure evidence')).toBeVisible()
    // The schema path is rendered instead of a generic failure string.
    await waitFor(() => expect(document.body.textContent).toContain('report.scope'))
    expect(screen.queryByText(/Full-run totals/)).not.toBeInTheDocument()
  })

  it('identifies the evidence as unavailable in a static snapshot without fabricating it', () => {
    vi.mocked(isStaticMode).mockReturnValueOnce(true)
    render(<ValidationFindingsEvidence changeId="test-change" />)

    expect(screen.getByText('Unavailable in static snapshot')).toBeVisible()
    expect(screen.getByText(/not captured in this static snapshot/)).toBeVisible()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('offers no findings action on a retired CLI session', () => {
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: { cli: { available: true, version: '1.11.0' } },
    }
    render(<ValidationFindingsEvidence changeId="test-change" />)

    expect(screen.getByText('Unavailable on this CLI line')).toBeVisible()
    expect(
      screen.getByText(/Validation findings require the admitted OpenSpec CLI line/)
    ).toBeVisible()
    expect(screen.getByText(/detected 1\.11\.0/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Load validation findings' })
    ).not.toBeInTheDocument()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('surfaces transport errors with a rerun control', async () => {
    validateMock.mockRejectedValue(new Error('planning root unresolved'))
    render(<ValidationFindingsEvidence changeId="test-change" />)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))

    expect(await screen.findByText(/planning root unresolved/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Rerun' })).toBeVisible()
  })

  it('reports row chips only from the typed document and none before a run', async () => {
    const onChip = vi.fn()
    validateMock.mockResolvedValue(findingsTransport(findingsDocument()))
    render(<ValidationFindingsEvidence changeId="test-change" onChip={onChip} />)

    // Before any run there is no fact to project — no fabricated chip.
    expect(onChip).toHaveBeenLastCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))
    await waitFor(() =>
      expect(onChip).toHaveBeenLastCalledWith({ label: '1 findings', tone: 'neutral' })
    )

    // Full-run failures project a negative chip from the preserved totals.
    const failingChip = vi.fn()
    validateMock.mockResolvedValueOnce(
      findingsTransport(
        findingsDocument({
          summary: { totals: { items: 2, passed: 1, failed: 1 }, byType: {} },
        })
      )
    )
    cleanup()
    render(<ValidationFindingsEvidence changeId="test-change" onChip={failingChip} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load validation findings' }))
    await waitFor(() =>
      expect(failingChip).toHaveBeenLastCalledWith({ label: '1 failed', tone: 'negative' })
    )
  })

  it('reports an unavailable row chip on static and retired CLI sessions', () => {
    const staticChip = vi.fn()
    vi.mocked(isStaticMode).mockReturnValueOnce(true)
    const { unmount } = render(
      <ValidationFindingsEvidence changeId="test-change" onChip={staticChip} />
    )
    expect(staticChip).toHaveBeenLastCalledWith({ label: 'unavailable', tone: 'unavailable' })
    unmount()

    const retiredChip = vi.fn()
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: { cli: { available: true, version: '1.11.0' } },
    }
    render(<ValidationFindingsEvidence changeId="test-change" onChip={retiredChip} />)
    expect(retiredChip).toHaveBeenLastCalledWith({ label: 'unavailable', tone: 'unavailable' })
  })
})
