/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Exercise Structured and Raw Active Root mode-local drafts in a naturally expanding Chromium page layout.
 * 2. Prove the Config owner remains horizontally contained without JS viewport-height ownership or an extra card shell.
 * 3. Stop at component-browser preparation rather than claiming owner visual acceptance.
 *
 * Original request (2026-08-01): Active Root keeps official Structured controls beside complete Raw YAML.
 * Owner correction (2026-08-03): expand Active Root directly in its page and remove JS-constrained height plus the extra shell.
 * Owner acceptance boundary (2026-07-20): final end-to-end visual walkthrough belongs to the owner.
 */
import type { ActiveRootRevision } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActiveRootConfigSection } from './active-root-config-section'

const { activeRootSubscriptionMock, viewportHeightMock } = vi.hoisted(() => ({
  activeRootSubscriptionMock: vi.fn(),
  viewportHeightMock: vi.fn(() => 320),
}))

vi.mock('@/lib/use-planning-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/use-planning-config')>()),
  useActiveRootConfigViewSubscription: activeRootSubscriptionMock,
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => ({
    status: 'ready',
    disabled: false,
    context: null,
    observedAt: 1,
    title: null,
    message: null,
    evidence: [],
  }),
}))

vi.mock('@/lib/trpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/trpc')>()),
  trpcClient: { planningConfig: { writeActiveRoot: { mutate: vi.fn() } } },
}))

vi.mock('@/components/scroll-spy', () => ({
  useViewportConstrainedHeight: viewportHeightMock,
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string
    onChange?: (value: string) => void
    readOnly?: boolean
  }) => (
    <textarea
      aria-label="Raw YAML editor"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-w-0 max-w-full"
    />
  ),
}))

const revision = `sha256:${'a'.repeat(64)}` as ActiveRootRevision

function NarrowActiveRootHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <main data-testid="active-root-narrow-host" style={{ width: '320px', height: '560px' }}>
        <ActiveRootConfigSection isStatic={false} />
      </main>
    </QueryClientProvider>
  )
}

describe('ActiveRootConfigSection narrow browser interaction', () => {
  it('retains both mode-local drafts without introducing horizontal overflow', async () => {
    activeRootSubscriptionMock.mockReturnValue({
      data: {
        content: 'schema: spec-driven\ncontext: original\nteam-key: retained\n',
        exists: true,
        filePath: '/stores/shared/openspec/config.yaml',
        owner: {
          kind: 'planning-root',
          path: '/stores/shared',
          source: 'store',
          storeId: 'shared',
          externalToLaunchProject: true,
        },
        revision,
        official: {
          schema: 'spec-driven',
          context: 'original',
          rules: { proposal: ['Keep intent explicit.'] },
          operations: {
            apply: { guidance: ['Run focused tests.'] },
            archive: { guidance: ['Record evidence.'] },
          },
        },
        diagnostics: [],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
    })
    render(<NarrowActiveRootHarness />)

    const host = screen.getByTestId('active-root-narrow-host')
    await waitFor(() => expect(host.getBoundingClientRect().width).toBe(320))
    const surface = screen.getByTestId('active-root-config-surface')
    expect(viewportHeightMock).not.toHaveBeenCalled()
    expect(surface.style.height).toBe('')
    expect(surface).not.toHaveClass('bg-card', 'border', 'rounded-lg', 'overflow-hidden')
    expect(getComputedStyle(screen.getByLabelText('Structured Active Root fields')).overflowY).toBe(
      'visible'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'narrow-schema' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Raw YAML' }))
    fireEvent.change(screen.getByLabelText('Raw YAML editor'), {
      target: { value: 'schema: raw-narrow\nteam-key: retained\n' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Structured' }))

    expect(screen.getByLabelText('Schema')).toHaveValue('narrow-schema')
    fireEvent.click(screen.getByRole('tab', { name: 'Raw YAML' }))
    expect(screen.getByLabelText('Raw YAML editor')).toHaveValue(
      'schema: raw-narrow\nteam-key: retained\n'
    )
    expect(screen.getByRole('note', { name: 'Shared Store write impact' })).toBeVisible()
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
  })
})
