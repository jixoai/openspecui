/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Pull the daemon's complete runtime Workspace ledger from the same-origin App shell.
 * 2. Convert typed SSE invalidations into serialized replacement Pulls.
 * 3. Treat absent daemon endpoints as unsupported while surfacing real local control failures.
 *
 * Original request (2026-07-29): "如果已经有 app daemon，那么默认投递到 app 中。"
 */
import {
  AppDaemonInvalidationSchema,
  AppDaemonWorkspaceSnapshotSchema,
  type AppDaemonWorkspaceSnapshot,
} from '@openspecui/core/app-daemon-control'

export type DaemonWorkspaceControlAvailability = 'supported' | 'unsupported'

export interface DaemonWorkspaceEventSource {
  addEventListener(type: 'invalidate', listener: EventListener): void
  removeEventListener(type: 'invalidate', listener: EventListener): void
  close(): void
}

export interface DaemonWorkspaceControl {
  start(): Promise<DaemonWorkspaceControlAvailability>
  stop(): void
}

type DaemonControlFetch = (input: string, init: RequestInit) => Promise<Response>

function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback)
}

function readEventData(event: Event): string {
  const candidate: unknown = event
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'data' in candidate &&
    typeof candidate.data === 'string'
  ) {
    return candidate.data
  }
  throw new Error('Daemon invalidation event did not contain string data.')
}

function defaultEventSource(url: string): DaemonWorkspaceEventSource | null {
  return typeof EventSource === 'undefined' ? null : new EventSource(url)
}

/** Create one App-lifetime daemon control owner without acquiring persistence or tab ownership. */
export function createDaemonWorkspaceControl(options: {
  baseUrl: string
  onSnapshot(snapshot: AppDaemonWorkspaceSnapshot): void
  onError(error: Error): void
  fetch?: DaemonControlFetch
  createEventSource?: (url: string) => DaemonWorkspaceEventSource | null
}): DaemonWorkspaceControl {
  const fetchSnapshot = options.fetch ?? ((input, init) => fetch(input, init))
  const createEventSource = options.createEventSource ?? defaultEventSource
  const snapshotUrl = new URL('/api/daemon/workspaces', options.baseUrl).toString()
  const eventsUrl = new URL('/api/daemon/events', options.baseUrl).toString()
  let stopped = false
  let currentRevision = -1
  let pullRunning = false
  let pullQueued = false
  let eventSource: DaemonWorkspaceEventSource | null = null

  const pullOnce = async (): Promise<DaemonWorkspaceControlAvailability> => {
    let response: Response
    try {
      response = await fetchSnapshot(snapshotUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
    } catch {
      return 'unsupported'
    }
    if (response.status === 404) return 'unsupported'
    if (!response.ok) {
      options.onError(new Error(`Daemon Workspace snapshot failed with HTTP ${response.status}.`))
      return 'supported'
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      return 'unsupported'
    }

    try {
      const payload: unknown = JSON.parse(await response.text())
      const snapshot = AppDaemonWorkspaceSnapshotSchema.parse(payload)
      if (!stopped && snapshot.revision > currentRevision) {
        currentRevision = snapshot.revision
        options.onSnapshot(snapshot)
      }
    } catch (error) {
      options.onError(toError(error, 'Daemon Workspace snapshot was invalid.'))
    }
    return 'supported'
  }

  const queuePull = () => {
    if (pullRunning) {
      pullQueued = true
      return
    }
    pullRunning = true
    void (async () => {
      try {
        do {
          pullQueued = false
          await pullOnce()
        } while (!stopped && pullQueued)
      } finally {
        pullRunning = false
      }
    })()
  }

  const onInvalidate: EventListener = (event) => {
    try {
      const payload: unknown = JSON.parse(readEventData(event))
      AppDaemonInvalidationSchema.parse(payload)
      queuePull()
    } catch (error) {
      options.onError(toError(error, 'Daemon Workspace invalidation was invalid.'))
    }
  }

  return {
    async start() {
      const availability = await pullOnce()
      if (stopped || availability === 'unsupported') return availability
      eventSource = createEventSource(eventsUrl)
      eventSource?.addEventListener('invalidate', onInvalidate)
      return availability
    },
    stop() {
      if (stopped) return
      stopped = true
      eventSource?.removeEventListener('invalidate', onInvalidate)
      eventSource?.close()
      eventSource = null
    },
  }
}
