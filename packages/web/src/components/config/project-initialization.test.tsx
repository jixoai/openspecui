/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Prove the automatic Init Alert never mutates before explicit confirmation.
 * 2. Prove terminal success waits for the reactive local initialization fact before exposing Guide.
 * 3. Prove dismissal is mount-local while the shared Config action can reopen the Alert.
 * 4. Keep cancellation pending until the Server confirms process settlement.
 *
 * Original request (2026-08-01): Initialize Project requires confirmation and page-session-only dismissal.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectInitializationProvider, useProjectInitialization } from './project-initialization'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  statusSubscribe: vi.fn(),
  initSubscribe: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    init: {
      get: { query: mocks.get },
      subscribe: { subscribe: mocks.statusSubscribe },
      initStream: { subscribe: mocks.initSubscribe },
      cancel: { mutate: mocks.cancel },
    },
  },
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => ({
    status: 'ready',
    context: {
      planningRoot: { path: '/stores/shared', source: 'store' },
      storeId: 'shared',
    },
  }),
}))

const missing = {
  initialized: false,
  launchProjectPath: '/repo/demo project',
  openspecPath: '/repo/demo project/openspec',
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function ConfigAction() {
  const initialization = useProjectInitialization()
  return <button onClick={initialization?.open}>Open Init</button>
}

beforeEach(() => {
  mocks.get.mockResolvedValue(missing)
  mocks.statusSubscribe.mockImplementation((_input, handlers) => {
    handlers.onData(missing)
    return { unsubscribe: vi.fn() }
  })
  mocks.initSubscribe.mockReturnValue({ unsubscribe: vi.fn() })
  mocks.cancel.mockResolvedValue({ reason: 'cancelled', exitCode: null })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProjectInitializationProvider', () => {
  it('waits for confirmation and local reactive settlement before success actions', async () => {
    let streamHandlers: Record<string, (value: unknown) => void> | undefined
    let statusHandlers: Record<string, (value: unknown) => void> | undefined
    mocks.statusSubscribe.mockImplementation((_input, handlers) => {
      statusHandlers = handlers
      handlers.onData(missing)
      return { unsubscribe: vi.fn() }
    })
    mocks.initSubscribe.mockImplementation((_input, handlers) => {
      streamHandlers = handlers
      return { unsubscribe: vi.fn() }
    })

    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText(JSON.stringify(['openspec', 'init', '/repo/demo project', '--tools=none']))
    ).toBeInTheDocument()
    expect(screen.getByText(/Effective Root: \/stores\/shared/)).toHaveTextContent('Store shared')
    expect(mocks.initSubscribe).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Initialize' }))
    expect(mocks.initSubscribe).toHaveBeenCalledOnce()
    await act(async () => {
      streamHandlers?.onData({ type: 'exit', exitCode: 0 })
      await Promise.resolve()
    })
    expect(screen.queryByRole('button', { name: 'Start Guide' })).toBeNull()

    statusHandlers?.onData({ ...missing, initialized: true })
    expect(await screen.findByRole('button', { name: 'Start Guide' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ok' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('emits the typed Guide handoff only after settled success', async () => {
    let streamHandlers: Record<string, (value: unknown) => void> | undefined
    let statusHandlers: Record<string, (value: unknown) => void> | undefined
    mocks.statusSubscribe.mockImplementation((_input, handlers) => {
      statusHandlers = handlers
      handlers.onData(missing)
      return { unsubscribe: vi.fn() }
    })
    mocks.initSubscribe.mockImplementation((_input, handlers) => {
      streamHandlers = handlers
      return { unsubscribe: vi.fn() }
    })
    const guideHandoff = vi.fn()
    window.addEventListener('openspecui:start-config-guide', guideHandoff)

    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Initialize' }))
    streamHandlers?.onData({ type: 'exit', exitCode: 0 })
    expect(guideHandoff).not.toHaveBeenCalled()
    statusHandlers?.onData({ ...missing, initialized: true })

    fireEvent.click(await screen.findByRole('button', { name: 'Start Guide' }))
    expect(guideHandoff).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    window.removeEventListener('openspecui:start-config-guide', guideHandoff)
  })

  it('suppresses automatic reopening only in the mounted runtime and keeps Config reopen available', async () => {
    const mounted = render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Open Init' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(mocks.initSubscribe).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    mounted.unmount()
    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('preserves stdout and objective failure evidence and retries the same owner', async () => {
    let streamHandlers: Record<string, (value: unknown) => void> | undefined
    mocks.initSubscribe.mockImplementation((_input, handlers) => {
      streamHandlers = handlers
      return { unsubscribe: vi.fn() }
    })
    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Initialize' }))
    act(() => {
      streamHandlers?.onData({
        type: 'command',
        data: JSON.stringify(['openspec', 'init', '/repo/demo project', '--tools=none']),
      })
      streamHandlers?.onData({ type: 'stdout', data: 'Creating openspec/\n' })
      streamHandlers?.onData({ type: 'stderr', data: 'permission denied\n' })
      streamHandlers?.onData({ type: 'exit', exitCode: 13 })
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('exit code 13')
    expect(screen.getByText(/Creating openspec/)).toHaveTextContent('permission denied')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.initSubscribe).toHaveBeenCalledTimes(2)
  })

  it('keeps retry locked until cancellation settlement returns', async () => {
    const cancellation = createDeferred<{ reason: 'cancelled'; exitCode: null }>()
    let streamHandlers: Record<string, (value: unknown) => void> | undefined
    mocks.cancel.mockReturnValue(cancellation.promise)
    mocks.initSubscribe.mockImplementation((_input, handlers) => {
      streamHandlers = handlers
      return { unsubscribe: vi.fn() }
    })
    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Initialize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Cancelling and waiting for process settlement…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    streamHandlers?.onData({ type: 'exit', exitCode: null })
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    cancellation.resolve({ reason: 'cancelled', exitCode: null })
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(mocks.initSubscribe.mock.calls[0]?.[0]).toMatchObject({ requestId: expect.any(String) })
    expect(mocks.cancel).toHaveBeenCalledWith({
      requestId: mocks.initSubscribe.mock.calls[0]?.[0].requestId,
    })
  })

  it('keeps mutation controls locked when cancellation transport fails', async () => {
    mocks.cancel.mockRejectedValueOnce(new Error('network unavailable'))
    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Initialize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'process settlement is still unknown'
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    mocks.cancel.mockResolvedValueOnce({ reason: 'cancelled', exitCode: null })
    fireEvent.click(screen.getByRole('button', { name: 'Retry Cancel' }))
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('keeps cancellation authority when the Init subscription errors', async () => {
    const cancellation = createDeferred<{ reason: 'cancelled'; exitCode: null }>()
    let streamHandlers: Record<string, (value: unknown) => void> | undefined
    mocks.cancel
      .mockReturnValueOnce(cancellation.promise)
      .mockResolvedValueOnce({ reason: 'cancelled', exitCode: null })
    mocks.initSubscribe.mockImplementation((_input, handlers) => {
      streamHandlers = handlers
      return { unsubscribe: vi.fn() }
    })
    render(
      <ProjectInitializationProvider enabled>
        <ConfigAction />
      </ProjectInitializationProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Initialize' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    streamHandlers?.onError(new Error('socket disconnected'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'process settlement is still unknown'
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    const requestId = mocks.initSubscribe.mock.calls[0]?.[0].requestId

    fireEvent.click(screen.getByRole('button', { name: 'Retry Cancel' }))
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(mocks.cancel).toHaveBeenNthCalledWith(2, { requestId })
  })
})
