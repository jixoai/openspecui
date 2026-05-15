import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, CountBadge, formatCountBadgeValue } from './badge'

describe('Badge', () => {
  it('renders shared badge attributes and tone classes', () => {
    const { getByText } = render(
      <Badge tone="subtle" size="sm" shape="box">
        3
      </Badge>
    )

    const badge = getByText('3')
    expect(badge.getAttribute('data-ui-badge')).toBe('true')
    expect(badge.className).toContain('bg-primary/10')
    expect(badge.className).toContain('rounded')
  })

  it('allows domain components to own semantic color classes', () => {
    const { getByText } = render(
      <Badge tone="custom" className="border-zinc-500/35 bg-zinc-500/10 text-zinc-700">
        git
      </Badge>
    )

    const badge = getByText('git')
    expect(badge.getAttribute('data-ui-badge')).toBe('true')
    expect(badge.className).toContain('border-zinc-500/35')
    expect(badge.className).not.toContain('bg-primary')
  })
})

describe('CountBadge', () => {
  it('formats capped count values', () => {
    expect(formatCountBadgeValue(3)).toBe('3')
    expect(formatCountBadgeValue(120)).toBe('99+')
    expect(formatCountBadgeValue(120, 9)).toBe('9+')
  })

  it('can hide zero values', () => {
    const { container } = render(<CountBadge count={0} hideWhenZero />)

    expect(container.firstChild).toBeNull()
  })
})
