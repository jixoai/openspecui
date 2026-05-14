import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps fulfilled activity actions semantic without firing clicks', () => {
    const onClick = vi.fn()
    render(
      <Button activity onClick={onClick}>
        Saved
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Saved' })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('data-activity', 'true')

    fireEvent.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires clicks for ordinary actions', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps native disabled for blocked actions', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Saving...
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Saving...' })
    expect(button).toBeDisabled()

    fireEvent.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })
})
