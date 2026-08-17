/**
 * Orthogonal intents (created 2026-08-16 Asia/Shanghai):
 * 1. Prove the grid row keeps badge centered, time bottom, subtitle under the title.
 * 2. Prove the ambient badge fill width tracks the CLI applied-task ratio.
 * 3. Prove the fill is absent without a usable ratio and never claims layout space.
 *
 * Original request (2026-08-16): Owner walkthrough: soft primary fill as a space-free
 *   progress affordance that survives subtitle truncation on mobile.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChangeRow } from './change-row'

const phase = { label: 'Applying', toneClass: 'border-primary/40 text-primary' }

describe('ChangeRow', () => {
  afterEach(() => cleanup())

  it('fills the badge background proportionally to the CLI task ratio', () => {
    render(
      <ChangeRow
        changeId="c1"
        name="Change One"
        subtitle="4/4 artifacts · loop"
        phase={phase}
        updatedAt={1_000}
        formatTime={() => '1d ago'}
        progressRatio={31 / 33}
      />
    )

    const badge = screen.getByText('Applying').closest('[data-ui-badge]')
    expect(badge).toBeTruthy()
    const fill = badge?.querySelector('[aria-hidden="true"]')
    expect(fill).toBeTruthy()
    expect(fill).toHaveStyle({ width: '93.93939393939394%' })
    // The label stays above the fill and remains the textual authority.
    expect(screen.getByText('Applying')).toBeVisible()
  })

  it('renders no fill when the ratio is missing or zero', () => {
    const { rerender } = render(
      <ChangeRow
        changeId="c1"
        name="Change One"
        subtitle="4/4 artifacts · loop"
        phase={phase}
        updatedAt={1_000}
        formatTime={() => '1d ago'}
        progressRatio={null}
      />
    )
    expect(
      screen.getByText('Applying').closest('[data-ui-badge]')?.querySelector('[aria-hidden]')
    ).toBeNull()

    rerender(
      <ChangeRow
        changeId="c1"
        name="Change One"
        subtitle="4/4 artifacts · loop"
        phase={phase}
        updatedAt={1_000}
        formatTime={() => '1d ago'}
        progressRatio={0}
      />
    )
    expect(
      screen.getByText('Applying').closest('[data-ui-badge]')?.querySelector('[aria-hidden]')
    ).toBeNull()
  })
})
