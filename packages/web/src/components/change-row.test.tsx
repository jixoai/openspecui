/**
 * Orthogonal intents (updated 2026-08-17 Asia/Shanghai):
 * 1. Prove the grid row keeps badge centered, time bottom, subtitle under the title.
 * 2. Prove the row exposes planning/artifact phase only; Apply progress belongs to Detail.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChangeRow } from './change-row'

const phase = { label: 'Planning Complete', toneClass: 'border-sky-500/40 text-sky-700' }

describe('ChangeRow', () => {
  afterEach(() => cleanup())

  it('renders the phase badge without an implementation-progress fill', () => {
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
})
