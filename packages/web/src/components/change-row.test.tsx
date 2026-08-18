/**
 * Orthogonal intents (updated 2026-08-17 Asia/Shanghai):
 * 1. Prove the grid row keeps badge centered, time bottom, subtitle under the title.
 * 2. Prove CLI Apply progress can remain visible beside the phase badge.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChangeRow } from './change-row'

const phase = { label: 'Planning Complete', toneClass: 'border-sky-500/40 text-sky-700' }

describe('ChangeRow', () => {
  afterEach(() => cleanup())

  it('renders the phase badge without a fill when no CLI progress is supplied', () => {
    render(
      <ChangeRow
        changeId="c1"
        name="Change One"
        subtitle="4/4 artifacts · loop"
        phase={phase}
        updatedAt={1_000}
        formatTime={() => '1d ago'}
      />
    )

    const badge = screen.getByText('Planning Complete').closest('[data-ui-badge]')
    expect(badge).toBeTruthy()
    expect(screen.getByText('Planning Complete')).toBeVisible()
    expect(badge?.querySelector('[aria-hidden]')).toBeNull()
  })

  it('renders a CLI Apply progress fill without changing the phase label', () => {
    render(
      <ChangeRow
        changeId="c1"
        name="Change One"
        subtitle={
          <span title="Task counts reported by the OpenSpec CLI for this Change.">Tasks 31/33</span>
        }
        phase={{ label: 'Applying', toneClass: 'border-primary/40 text-primary' }}
        updatedAt={1_000}
        formatTime={() => '1d ago'}
        progressRatio={31 / 33}
      />
    )

    const badge = screen.getByText('Applying').closest('[data-ui-badge]')
    expect(badge).toBeTruthy()
    expect(screen.getByText('Tasks 31/33')).toBeVisible()
    expect(badge?.querySelector('[aria-hidden]')).toHaveStyle({ width: '93.93939393939394%' })
  })
})
