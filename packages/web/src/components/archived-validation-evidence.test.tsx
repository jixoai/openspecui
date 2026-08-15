/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Present the typed 1.9 archived-validation report with items, issues, totals, and root.
 * 2. Preserve CLI failure evidence without repair or automatic archive actions.
 * 3. Identify the evidence as unavailable in static snapshots instead of fabricating it.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
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
      cli: { available: true, version: '1.9.0' },
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
        cli: { available: true, version: '1.9.0' },
      },
      observedAt: 1,
    }
  })

  it('offers on-demand archived validation without any repair action', async () => {
    validateMock.mockResolvedValue(archivedReport())
    render(<ArchivedValidationEvidence />)

    fireEvent.click(screen.getByRole('button', { name: /Archived validation/ }))
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

    fireEvent.click(screen.getByRole('button', { name: /Archived validation/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    expect(await screen.findByText('CLI failure evidence')).toBeVisible()
    expect(screen.getByText(/items: Required/)).toBeVisible()
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument()
  })

  it('identifies the evidence as unavailable in a static snapshot without fabricating it', () => {
    vi.mocked(isStaticMode).mockReturnValueOnce(true)
    render(<ArchivedValidationEvidence />)

    expect(screen.getByText('Unavailable in static snapshot')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Archived validation/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /Archived validation/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    await waitFor(() => expect(validateMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('CLI failure evidence')).toBeVisible())
    expect(screen.queryByText(/passed ·/)).toBeNull()
  })

  it('offers no command on a detected OpenSpec 1.8 session', () => {
    rootActionStateMock.state = {
      ...rootActionStateMock.state,
      context: { cli: { available: true, version: '1.8.0' } },
    }
    render(<ArchivedValidationEvidence />)

    expect(screen.getByText('Unavailable on this CLI line')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Archived validation/ }))
    expect(screen.getByText(/requires the OpenSpec 1.9 line/)).toBeVisible()
    expect(screen.getByText(/detected 1\.8\.0/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Validate archived tasks' })
    ).not.toBeInTheDocument()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('surfaces transport errors with a rerun control', async () => {
    validateMock.mockRejectedValue(new Error('planning root unresolved'))
    render(<ArchivedValidationEvidence />)

    fireEvent.click(screen.getByRole('button', { name: /Archived validation/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate archived tasks' }))

    expect(await screen.findByText(/planning root unresolved/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Rerun' })).toBeVisible()
  })
})
