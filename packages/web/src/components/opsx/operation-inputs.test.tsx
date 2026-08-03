/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Prove project context and operation guidance retain separate labels.
 * 2. Prove empty operation input presentation remains explicit when requested.
 * 3. Prove Change Detail exposes non-empty Apply inputs through an Action-owned Dialog.
 *
 * Original request (2026-08-01): preserve OpenSpec 1.7 operation inputs without conflating artifact rules.
 * Original request (2026-08-03): keep Apply inputs collapsed on the Change Detail default surface.
 * Owner correction (2026-08-03): make Apply inputs an Action that opens a Dialog.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OperationInputs, OperationInputsDialogAction } from './operation-inputs'

describe('OperationInputs', () => {
  afterEach(() => cleanup())

  it('labels project context and operation guidance independently', () => {
    render(
      <OperationInputs
        title="Apply inputs"
        context="Authentication changes require a threat model."
        operationGuidance={['Run security-focused tests.']}
      />
    )

    expect(screen.getByRole('region', { name: 'Apply inputs' })).toBeTruthy()
    expect(screen.getByText('Project context')).toBeTruthy()
    expect(screen.getByText('Operation guidance')).toBeTruthy()
    expect(screen.getByText('Authentication changes require a threat model.')).toBeTruthy()
    expect(screen.getByText('Run security-focused tests.')).toBeTruthy()
  })

  it('can state that the selected Root has no operation inputs', () => {
    render(<OperationInputs title="Archive inputs" showEmpty />)

    expect(screen.getByText('No project context or operation guidance configured.')).toBeTruthy()
  })

  it('opens Change Apply inputs from an Action-owned Dialog', () => {
    render(
      <OperationInputsDialogAction
        title="Apply inputs"
        context="Authentication changes require a threat model."
        operationGuidance={['Run security-focused tests.']}
      />
    )

    expect(screen.getByRole('button', { name: 'Apply inputs' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Authentication changes require a threat model.')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Apply inputs' }))
    expect(screen.getByRole('dialog', { name: 'Apply inputs' })).toBeVisible()
    expect(screen.getByText('Authentication changes require a threat model.')).toBeVisible()
    expect(screen.getByText('Run security-focused tests.')).toBeVisible()
  })

  it('omits the Apply inputs Action when the CLI provides no inputs', () => {
    render(<OperationInputsDialogAction title="Apply inputs" />)

    expect(screen.queryByRole('button', { name: 'Apply inputs' })).toBeNull()
  })
})
