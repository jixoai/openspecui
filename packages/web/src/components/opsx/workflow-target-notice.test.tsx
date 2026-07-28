/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove WorkflowTargetNotice renders the Server-owned planning target.
 * 2. Prove direct Reference counts remain keyboard-retrievable while errors stay direct.
 * 3. Prove same-target rerenders refresh the displayed evidence without local state.
 * 4. Prove static target absence does not fabricate planning or Reference data.
 *
 * Original request (2026-07-20): "WorkflowTargetNotice must include direct-Reference diagnostic counts."
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip while OPSX stays primary.
 */
import type { WorkflowInvocationTargetV2 } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkflowTargetNotice } from './workflow-target-notice'

function target(
  references: WorkflowInvocationTargetV2['references'] = []
): WorkflowInvocationTargetV2 {
  return {
    launchProject: { path: '/workspace/launch' },
    planningRoot: {
      path: '/workspace/planning',
      source: 'declared',
      store_id: 'platform',
      healthy: true,
      status: [],
    },
    storeId: 'platform',
    generation: 'generation-a',
    observedAt: 1,
    rootSelector: { store: 'platform' },
    references,
    diagnostics: { root: [], doctor: [], context: [] },
    rootEvidence: { doctor: null, context: null },
  }
}

describe('WorkflowTargetNotice', () => {
  afterEach(() => cleanup())

  it('keeps target path direct and zero Reference diagnostics keyboard-retrievable', async () => {
    render(<WorkflowTargetNotice target={target([{ store_id: 'shared', status: [] }])} />)

    expect(screen.getByText('/workspace/planning')).toBeTruthy()
    expect(screen.getByText('declared')).toBeTruthy()
    expect(screen.getByText('Store platform')).toBeTruthy()
    const references = screen.getByRole('note', {
      name: '1 direct Reference · 0 errors · 0 warnings · 0 infos · 0 total',
    })
    expect(references.textContent).toBe('References 1')
    fireEvent.focus(references)
    expect(
      await screen.findByText('1 direct Reference · 0 errors · 0 warnings · 0 infos · 0 total')
    ).toBeTruthy()
  })

  it('keeps Reference errors direct and aggregate counts objective', async () => {
    render(
      <WorkflowTargetNotice
        target={target([
          {
            store_id: 'shared',
            status: [
              { severity: 'error', code: 'missing', message: 'Missing.' },
              { severity: 'warning', code: 'stale', message: 'Stale.' },
            ],
          },
          {
            store_id: 'platform',
            status: [{ severity: 'info', code: 'observed', message: 'Observed.' }],
          },
        ])}
      />
    )

    expect(screen.getByText('Reference errors: shared (1)')).toBeTruthy()
    const references = screen.getByRole('note', {
      name: '2 direct References · 1 error · 1 warning · 1 info · 3 total',
    })
    fireEvent.focus(references)
    expect(
      await screen.findByText('2 direct References · 1 error · 1 warning · 1 info · 3 total')
    ).toBeTruthy()
    expect(screen.queryByText(/healthy|unhealthy|complete|completeness|coverage/i)).toBeNull()
  })

  it('updates evidence on a same-target rerender', () => {
    const view = render(
      <WorkflowTargetNotice target={target([{ store_id: 'shared', status: [] }])} />
    )
    expect(
      screen.getByRole('note', {
        name: '1 direct Reference · 0 errors · 0 warnings · 0 infos · 0 total',
      })
    ).toBeTruthy()

    view.rerender(
      <WorkflowTargetNotice
        target={target([
          {
            store_id: 'shared',
            status: [{ severity: 'warning', code: 'changed', message: 'Changed.' }],
          },
        ])}
      />
    )

    expect(
      screen.getByRole('note', {
        name: '1 direct Reference · 0 errors · 1 warning · 0 infos · 1 total',
      })
    ).toBeTruthy()
    expect(screen.getByText('/workspace/planning')).toBeTruthy()
  })

  it('keeps stale dispatch authority directly visible', () => {
    render(<WorkflowTargetNotice target={target()} stale />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Planning target is stale; dispatch is locked.'
    )
  })

  it('renders no target in static mode', () => {
    const { container } = render(<WorkflowTargetNotice target={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
