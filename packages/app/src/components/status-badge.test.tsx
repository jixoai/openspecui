// @vitest-environment jsdom

import { act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StatusBadge, StatusDot } from './status-badge'

async function renderAt(element: ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  return container
}

describe('StatusBadge', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the label with role=status and aria-label for assistive tech', async () => {
    const container = await renderAt(<StatusBadge variant="healthy" label="OK" />)
    const badge = container.querySelector('[role="status"]')
    expect(badge?.getAttribute('aria-label')).toBe('OK')
    expect(container.textContent).toContain('OK')
  })

  it('renders an icon by default and hides it when hideIcon', async () => {
    const withIcon = await renderAt(<StatusBadge variant="issue" label="warn" />)
    expect(withIcon.querySelector('svg')).toBeTruthy()

    document.body.innerHTML = ''
    const noIcon = await renderAt(<StatusBadge variant="issue" label="warn" hideIcon />)
    expect(noIcon.querySelector('svg')).toBeNull()
  })

  it('spins the icon only for pending variant', async () => {
    const pending = await renderAt(<StatusBadge variant="pending" label="running" />)
    expect(pending.querySelector('svg.animate-spin')).toBeTruthy()

    document.body.innerHTML = ''
    const healthy = await renderAt(<StatusBadge variant="healthy" label="ok" />)
    expect(healthy.querySelector('svg.animate-spin')).toBeNull()
  })

  it('uses a custom ariaLabel when provided', async () => {
    const container = await renderAt(
      <StatusBadge variant="neutral" label="offline" ariaLabel="Backend offline" />
    )
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Backend offline'
    )
  })
})

describe('StatusDot', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders an accessible role=status dot with aria-label', async () => {
    const container = await renderAt(<StatusDot variant="healthy" ariaLabel="healthy" />)
    const dot = container.querySelector('[role="status"]')
    expect(dot?.getAttribute('aria-label')).toBe('healthy')
  })

  it('pulses only for pending variant', async () => {
    const pending = await renderAt(<StatusDot variant="pending" ariaLabel="checking" />)
    expect(pending.querySelector('.animate-pulse')).toBeTruthy()

    document.body.innerHTML = ''
    const healthy = await renderAt(<StatusDot variant="healthy" ariaLabel="ok" />)
    expect(healthy.querySelector('.animate-pulse')).toBeNull()
  })
})
