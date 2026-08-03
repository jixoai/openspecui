/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Prove the real Chromium Init Dialog blocks implicit dismissal while the CLI stream owns execution.
 * 2. Prove explicit cancellation keeps controls locked until Server settlement in a narrow viewport.
 *
 * Original request (2026-08-02): agents provide only basic component Playwright evidence before owner visual review.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectInitializationProvider } from './project-initialization'

const mocks = vi.hoisted(() => ({
  initSubscribe: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    init: {
      get: {
        query: vi.fn().mockResolvedValue({
          initialized: false,
          launchProjectPath: '/repo/demo',
          openspecPath: '/repo/demo/openspec',
        }),
      },
      subscribe: {
        subscribe: vi.fn((_input, handlers) => {
          handlers.onData({
            initialized: false,
            launchProjectPath: '/repo/demo',
            openspecPath: '/repo/demo/openspec',
          })
          return { unsubscribe: vi.fn() }
        }),
      },
      initStream: { subscribe: mocks.initSubscribe },
      cancel: { mutate: mocks.cancel },
    },
  },
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => ({ status: 'ready', context: null }),
}))

afterEach(() => {
  document.querySelectorAll('dialog').forEach((dialog) => dialog.close())
  vi.clearAllMocks()
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('Initialize Project Alert browser contract', () => {
  it('locks implicit dismissal and Retry until cancellation settles', async () => {
    const cancellation = createDeferred<{ reason: 'cancelled'; exitCode: null }>()
    mocks.initSubscribe.mockReturnValue({ unsubscribe: vi.fn() })
    mocks.cancel.mockReturnValue(cancellation.promise)
    render(
      <div style={{ width: 320, height: 520 }}>
        <ProjectInitializationProvider enabled>
          <div>Project surface</div>
        </ProjectInitializationProvider>
      </div>
    )

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Initialize' }))
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Cancelling and waiting for process settlement…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    cancellation.resolve({ reason: 'cancelled', exitCode: null })
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
