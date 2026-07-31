/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Pull the daemon's complete runtime Workspace ledger from the same-origin App shell.
 * 2. Convert typed SSE invalidations into serialized replacement Pulls.
 * 3. Treat absent daemon endpoints as unsupported while surfacing real local control failures.
 * 4. Dispatch opaque browser, managed directory, and daemon-persisted favorite commands.
 * 5. Pull the daemon-owned Favorites/Recent snapshot without browser persistence.
 *
 * Original request (2026-07-29): "如果已经有 app daemon，那么默认投递到 app 中。"
 * Owner-reported defect (2026-07-31): an older daemon HTML fallback must not surface as raw JSON syntax.
 */
import {
  AppDaemonInvalidationSchema,
  AppDaemonOpenWorkspaceResponseSchema,
  AppDaemonStartManagedProjectResponseSchema,
  AppDaemonStopManagedProjectResponseSchema,
  AppDaemonWorkspaceSnapshotSchema,
  type AppDaemonStartManagedProjectResponse,
  type AppDaemonStopManagedProjectResponse,
  type AppDaemonWorkspaceSnapshot,
} from '@openspecui/core/app-daemon-control'
import {
  AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema,
  AppDaemonWorkspaceDirectorySnapshotSchema,
  type AppDaemonWorkspaceDirectorySnapshot,
} from '@openspecui/core/workspace-directory-catalog'

export type DaemonWorkspaceControlAvailability = 'supported' | 'unsupported'

export const DAEMON_CONTROL_UPGRADE_REQUIRED_MESSAGE =
  'The OpenSpecUI App daemon is outdated. Restart the App daemon to continue.'

export interface DaemonWorkspaceEventSource {
  addEventListener(type: 'invalidate', listener: EventListener): void
  removeEventListener(type: 'invalidate', listener: EventListener): void
  close(): void
}

export interface DaemonWorkspaceControl {
  openWorkspaceInBrowser(workspaceId: string): Promise<void>
  startManagedProject(projectDir: string): Promise<AppDaemonStartManagedProjectResponse>
  stopManagedProject(generation: number): Promise<AppDaemonStopManagedProjectResponse>
  setDirectoryFavorite(canonicalPath: string, favorite: boolean): Promise<void>
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
  onDirectorySnapshot?(snapshot: AppDaemonWorkspaceDirectorySnapshot): void
  onError(error: Error): void
  fetch?: DaemonControlFetch
  createEventSource?: (url: string) => DaemonWorkspaceEventSource | null
}): DaemonWorkspaceControl {
  const fetchSnapshot = options.fetch ?? ((input, init) => fetch(input, init))
  const createEventSource = options.createEventSource ?? defaultEventSource
  const snapshotUrl = new URL('/api/daemon/workspaces', options.baseUrl).toString()
  const eventsUrl = new URL('/api/daemon/events', options.baseUrl).toString()
  const managedStartUrl = new URL('/api/daemon/managed-projects/start', options.baseUrl).toString()
  const managedStopUrl = new URL('/api/daemon/managed-projects/stop', options.baseUrl).toString()
  const directorySnapshotUrl = new URL(
    '/api/daemon/workspace-directories',
    options.baseUrl
  ).toString()
  const directoryFavoriteUrl = new URL(
    '/api/daemon/workspace-directories/favorite',
    options.baseUrl
  ).toString()
  let stopped = false
  let currentRevision = -1
  let currentDirectoryRevision = -1
  let pullRunning = false
  let pullQueued = false
  let eventSource: DaemonWorkspaceEventSource | null = null
  let pendingWorkspaceSnapshot: AppDaemonWorkspaceSnapshot | null = null

  const pullWorkspaceOnce = async (): Promise<DaemonWorkspaceControlAvailability> => {
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
        pendingWorkspaceSnapshot = snapshot
      }
    } catch {
      options.onError(
        new Error('The OpenSpecUI App daemon returned an invalid Workspace snapshot.')
      )
    }
    return 'supported'
  }

  const pullDirectoryOnce = async (): Promise<DaemonWorkspaceControlAvailability> => {
    if (!options.onDirectorySnapshot) return 'supported'
    let response: Response
    try {
      response = await fetchSnapshot(directorySnapshotUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
    } catch (error) {
      options.onError(toError(error, DAEMON_CONTROL_UPGRADE_REQUIRED_MESSAGE))
      return 'unsupported'
    }
    if (!response.ok) {
      options.onError(new Error(DAEMON_CONTROL_UPGRADE_REQUIRED_MESSAGE))
      return 'unsupported'
    }
    if (response.headers.get('content-type')?.includes('text/html')) {
      options.onError(new Error(DAEMON_CONTROL_UPGRADE_REQUIRED_MESSAGE))
      return 'unsupported'
    }
    try {
      const payload: unknown = JSON.parse(await response.text())
      const snapshot = AppDaemonWorkspaceDirectorySnapshotSchema.parse(payload)
      if (!stopped && snapshot.revision > currentDirectoryRevision) {
        currentDirectoryRevision = snapshot.revision
        options.onDirectorySnapshot(snapshot)
      }
    } catch (error) {
      options.onError(toError(error, DAEMON_CONTROL_UPGRADE_REQUIRED_MESSAGE))
      return 'unsupported'
    }
    return 'supported'
  }

  const pullOnce = async (): Promise<DaemonWorkspaceControlAvailability> => {
    const availability = await pullWorkspaceOnce()
    if (availability === 'supported') {
      const directoryAvailability = await pullDirectoryOnce()
      if (directoryAvailability === 'supported' && pendingWorkspaceSnapshot !== null) {
        options.onSnapshot(pendingWorkspaceSnapshot)
      }
      pendingWorkspaceSnapshot = null
      return directoryAvailability
    }
    return availability
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
    async startManagedProject(projectDir) {
      let response: Response
      try {
        response = await fetchSnapshot(managedStartUrl, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectDir }),
        })
      } catch {
        throw new Error('OpenSpecUI App daemon is unavailable.')
      }
      let payload: unknown
      try {
        payload = JSON.parse(await response.text())
      } catch {
        throw new Error('Daemon managed start returned an invalid response.')
      }
      const parsed = AppDaemonStartManagedProjectResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Daemon managed start returned an invalid response.')
      return parsed.data
    },
    async stopManagedProject(generation) {
      let response: Response
      try {
        response = await fetchSnapshot(managedStopUrl, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ generation }),
        })
      } catch {
        throw new Error('OpenSpecUI App daemon is unavailable.')
      }
      let payload: unknown
      try {
        payload = JSON.parse(await response.text())
      } catch {
        throw new Error('Daemon managed Stop returned an invalid response.')
      }
      const parsed = AppDaemonStopManagedProjectResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Daemon managed Stop returned an invalid response.')
      return parsed.data
    },
    async setDirectoryFavorite(canonicalPath, favorite) {
      let response: Response
      try {
        response = await fetchSnapshot(directoryFavoriteUrl, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ canonicalPath, favorite }),
        })
      } catch {
        throw new Error('OpenSpecUI App daemon is unavailable.')
      }
      let payload: unknown
      try {
        payload = JSON.parse(await response.text())
      } catch {
        throw new Error('Daemon favorite command returned an invalid response.')
      }
      const parsed = AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Daemon favorite command returned an invalid response.')
      if (!parsed.data.ok) throw new Error(parsed.data.error.message)
    },
    async openWorkspaceInBrowser(workspaceId) {
      const actionUrl = new URL(
        `/api/daemon/workspaces/${encodeURIComponent(workspaceId)}/open`,
        options.baseUrl
      ).toString()
      let response: Response
      try {
        response = await fetchSnapshot(actionUrl, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
        })
      } catch {
        throw new Error('OpenSpecUI App daemon is unavailable.')
      }
      let payload: unknown
      try {
        payload = JSON.parse(await response.text())
      } catch {
        throw new Error('Daemon browser action returned an invalid response.')
      }
      const parsed = AppDaemonOpenWorkspaceResponseSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error('Daemon browser action returned an invalid response.')
      }
      const result = parsed.data
      if (!result.ok) throw new Error(result.error.message)
    },
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
