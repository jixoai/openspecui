/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Prove the shiny lifecycle badge renders label/tooltip/live-region without a layout block.
 * 2. Prove RootActionNotice keeps blocked alerts direct while checking collapses to the badge.
 *
 * Original request (2026-08-15): 刷新/解析中的块级 Alert 改为 Animated Shiny Text + Tooltip。
 */
import type { RootActionState } from '@/lib/use-root-action-state'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RootActionNotice, RootCheckingBadge } from '../root-action-notice'
import { AnimatedShinyText, ShinyStatusBadge } from './shiny-status'

afterEach(cleanup)

const checkingState: Extract<RootActionState, { status: 'checking' }> = {
  status: 'checking',
  disabled: true,
  context: null,
  observedAt: 1,
  title: 'Resolving planning root',
  message: 'Root-dependent actions remain locked until OpenSpec resolves the planning root.',
  evidence: [],
}

const blockedState: Extract<RootActionState, { status: 'blocked' }> = {
  status: 'blocked',
  disabled: true,
  context: null,
  observedAt: 1,
  title: 'Planning root unavailable (root-unhealthy)',
  message: 'Root selection failed.',
  evidence: ['Doctor exit: 1'],
}

describe('AnimatedShinyText', () => {
  it('renders its label with the shimmer visual-language class', () => {
    render(<AnimatedShinyText>Refreshing</AnimatedShinyText>)
    const node = screen.getByText('Refreshing')
    expect(node.className).toContain('rt-shiny-text')
  })
})

describe('ShinyStatusBadge', () => {
  it('keeps the complete meaning keyboard-retrievable without a bordered block', () => {
    const { container } = render(
      <ShinyStatusBadge label="Resolving planning root" message={checkingState.message} />
    )

    const badge = screen.getByRole('note', { name: checkingState.message })
    expect(badge).toHaveTextContent('Resolving planning root')
    expect(badge.getAttribute('tabindex')).toBe('0')
    expect(badge.className).not.toContain('border-destructive')
    expect(screen.getByRole('status')).toHaveTextContent(checkingState.message)
    expect(container.querySelector('.rt-shiny-text')).not.toBeNull()
  })
})

describe('RootCheckingBadge', () => {
  it('renders the checking lifecycle as one inline badge', () => {
    render(<RootCheckingBadge state={checkingState} />)
    expect(screen.getByRole('note', { name: checkingState.message })).toHaveTextContent(
      'Resolving planning root'
    )
  })

  it('renders nothing once the root state is ready or blocked', () => {
    const readyState = {
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 0,
      title: null,
      message: null,
      evidence: [],
    } as const
    const { container } = render(
      <>
        <RootCheckingBadge state={readyState as RootActionState} />
        <RootCheckingBadge state={blockedState} />
      </>
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RootActionNotice', () => {
  it('keeps a blocked root a direct alert with its CLI evidence disclosure', () => {
    render(<RootActionNotice state={blockedState} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Planning root unavailable (root-unhealthy)')
    expect(alert).toHaveTextContent('Root selection failed.')
    expect(screen.getByText('Root command evidence')).toBeTruthy()
  })

  it('renders no block for the normal checking lifecycle', () => {
    const { container } = render(<RootActionNotice state={checkingState} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('div[class*="rounded-md"]')).toBeNull()
  })
})
