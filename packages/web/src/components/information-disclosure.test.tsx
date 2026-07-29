/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove compact scan facts expose complete accessible Tooltip content on keyboard focus.
 * 2. Prove verbose evidence is collapsed by default and revealed through the real Accordion trigger.
 * 3. Prove direct failures remain visible while supporting evidence is collapsed.
 *
 * Original request (2026-07-28): preserve every 6.x fact while restoring 5.x-like visual clarity.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EvidenceDisclosure, InformationBadge } from './information-disclosure'

afterEach(cleanup)

describe('InformationBadge', () => {
  it('makes the complete scan fact keyboard reachable through Tooltip', async () => {
    render(
      <InformationBadge
        ariaLabel="Planning Store shared-specs"
        tooltip="The current Planning root was selected from Store shared-specs."
      >
        Store shared-specs
      </InformationBadge>
    )

    const badge = screen.getByRole('note', { name: 'Planning Store shared-specs' })
    expect(badge.getAttribute('tabindex')).toBe('0')

    fireEvent.focus(badge)
    expect(
      await screen.findByText('The current Planning root was selected from Store shared-specs.')
    ).toBeTruthy()
  })
})

describe('EvidenceDisclosure', () => {
  it('keeps verbose evidence collapsed until the real Accordion trigger is activated', () => {
    render(
      <EvidenceDisclosure title="CLI evidence" summary="doctor + context">
        <span>raw stdout evidence</span>
      </EvidenceDisclosure>
    )

    const trigger = screen.getByRole('button', { name: /CLI evidence/ })
    const evidence = screen.getByText('raw stdout evidence')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(evidence).not.toBeVisible()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(evidence).toBeVisible()
  })

  it('does not make a direct failure depend on disclosure expansion', () => {
    render(
      <div>
        <div role="alert">Root resolution failed.</div>
        <EvidenceDisclosure title="Root command evidence">
          <span>doctor stderr</span>
        </EvidenceDisclosure>
      </div>
    )

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByText('doctor stderr')).not.toBeVisible()
  })
})
