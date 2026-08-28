/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Present the typed spec-scope validation report with items, issues, totals, and root.
 * 2. Target mapping is contract-true: the list action runs the `specs` scope, the owned-spec
 *    detail action runs the single-item spec validation.
 * 3. Preserve CLI failure and contract-drift evidence without any repair action.
 * 4. Identify the evidence as unavailable in static snapshots instead of fabricating it.
 *
 * Original request (2026-08-28): Specifications 列表右上角提供"校验全部 specs"，单 spec 详情右上角提供单项校验。
 */
import { isStaticMode } from '@/lib/static-mode'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpecValidationEvidence } from './spec-validation-evidence'

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

function specReport(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
    data: {
      items: [
        {
          id: 'billing',
          type: 'spec',
          valid: true,
          issues: [],
          durationMs: 3,
        },
        {
          id: 'placeholder-cap',
          type: 'spec',
          valid: true,
          issues: [
            {
              level: 'WARNING',
              path: 'overview',
              line: 5,
              message:
                'Purpose section is still a placeholder rather than a Purpose anyone wrote. Replace it with what this capability is for.',
            },
          ],
          durationMs: 1,
        },
      ],
      summary: {
        totals: { items: 2, passed: 2, failed: 0 },
        byType: { spec: { items: 2, passed: 2, failed: 0 } },
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

describe('SpecValidationEvidence', () => {
  afterEach(() => {
    cleanup()
    validateMock.mockReset()
    vi.mocked(isStaticMode).mockReturnValue(false)
  })

  it('runs the all-specs scope from the list action', async () => {
    validateMock.mockResolvedValue(specReport())
    render(<SpecValidationEvidence target={{ kind: 'specs' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate specs' }))

    await waitFor(() =>
      expect(validateMock).toHaveBeenCalledWith({ kind: 'scope', scope: 'specs' })
    )
    await waitFor(() =>
      expect(document.body.textContent).toContain('2 passed · 0 failed · 2 specs')
    )
    // A warning-only item stays a valid item with visible warning evidence — no verdict rewriting.
    expect(screen.getByText(/placeholder-cap/)).toBeVisible()
    expect(screen.getByText(/Purpose section is still a placeholder/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /repair/i })).not.toBeInTheDocument()
  })

  it('runs the single-item spec validation from the owned-spec detail action', async () => {
    validateMock.mockResolvedValue(specReport())
    render(<SpecValidationEvidence target={{ kind: 'spec', specId: 'platform/auth' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate this spec' }))

    await waitFor(() =>
      expect(validateMock).toHaveBeenCalledWith({ kind: 'item', id: 'platform/auth', type: 'spec' })
    )
    await waitFor(() => expect(document.body.textContent).toContain('/repo'))
  })

  it('renders an unexecuted session as a bare action without any fabricated verdict', () => {
    render(<SpecValidationEvidence target={{ kind: 'specs' }} />)

    expect(screen.getByRole('button', { name: 'Validate specs' })).toBeVisible()
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument()
  })

  it('preserves a malformed report as typed contract-drift evidence', async () => {
    validateMock.mockResolvedValue(specReport({ data: { items: 'not-an-array' } }))
    render(<SpecValidationEvidence target={{ kind: 'specs' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate specs' }))

    // The transport envelope parsed; the report payload failed the contract schema, so the
    // schema drift itself is the visible evidence.
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Expected array, received string/)
    )
    expect(screen.getByRole('button', { name: 'Rerun' })).toBeVisible()
  })

  it('surfaces a transport error as failure evidence instead of success', async () => {
    validateMock.mockRejectedValue(new Error('CLI runner unavailable'))
    render(<SpecValidationEvidence target={{ kind: 'spec', specId: 'billing' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate this spec' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('CLI runner unavailable')
    )
  })

  it('identifies the evidence as unavailable in a static snapshot without a run control', () => {
    vi.mocked(isStaticMode).mockReturnValue(true)
    render(<SpecValidationEvidence target={{ kind: 'specs' }} />)

    expect(screen.getByText(/not captured in this static snapshot/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /validate/i })).not.toBeInTheDocument()
  })
})
