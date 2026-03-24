import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './tooltip'

describe('Tooltip', () => {
  it('renders popup content on focus', async () => {
    render(
      <Tooltip content="March 23, 2026 10:00" delay={0}>
        <button type="button">3m ago</button>
      </Tooltip>
    )

    fireEvent.focus(screen.getByRole('button', { name: '3m ago' }))

    expect(await screen.findByText('March 23, 2026 10:00')).toBeTruthy()
  })
})
