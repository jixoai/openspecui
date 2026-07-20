/**
 * Orthogonal intents (created 2026-07-21 Asia/Shanghai):
 * 1. Prove WorkflowTargetNotice renders the Server-owned planning target.
 * 2. Prove direct Reference diagnostic counts remain typed, objective evidence.
 * 3. Prove same-target rerenders refresh the displayed evidence without local state.
 * 4. Prove static target absence does not fabricate planning or Reference data.
 *
 * Original request (2026-07-20): "WorkflowTargetNotice must include direct-Reference diagnostic counts."
 */
import type { WorkflowInvocationTargetV2 } from '@openspecui/core'
import { cleanup, render, screen } from '@testing-library/react'
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

  it('renders zero direct Reference diagnostics from the prepared target', () => {
    render(<WorkflowTargetNotice target={target([{ store_id: 'shared', status: [] }])} />)

    expect(screen.getByText('Direct Reference diagnostics')).toBeTruthy()
    expect(
      screen.getByText('1 direct Reference · 0 errors · 0 warnings · 0 infos · 0 total')
    ).toBeTruthy()
    expect(screen.getByText('/workspace/planning')).toBeTruthy()
    expect(screen.getByText('declared · Store platform')).toBeTruthy()
  })

  it('renders aggregate severity counts without inferring Reference health or completeness', () => {
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

    expect(
      screen.getByText('2 direct References · 1 error · 1 warning · 1 info · 3 total')
    ).toBeTruthy()
    expect(screen.getByText('Direct Reference diagnostics')).toBeTruthy()
    expect(screen.queryByText(/healthy|unhealthy|complete|completeness|coverage/i)).toBeNull()
  })

  it('updates evidence on a same-target rerender', () => {
    const view = render(
      <WorkflowTargetNotice target={target([{ store_id: 'shared', status: [] }])} />
    )
    expect(
      screen.getByText('1 direct Reference · 0 errors · 0 warnings · 0 infos · 0 total')
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
      screen.getByText('1 direct Reference · 0 errors · 1 warning · 0 infos · 1 total')
    ).toBeTruthy()
    expect(screen.getByText('/workspace/planning')).toBeTruthy()
  })

  it('renders no target in static mode', () => {
    const { container } = render(<WorkflowTargetNotice target={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
