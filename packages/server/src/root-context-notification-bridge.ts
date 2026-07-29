/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Convert current Manager-owned Root Context terminal transitions into local health notifications.
 * 2. Derive root-change records from resolved root identity while retaining generation as lifecycle provenance.
 * 3. Retire late Root callbacks through explicit generation and subscription-epoch boundaries.
 *
 * Original checkpoint (2026-07-16): "6.15 Notifications remain project-backend scoped and add root/context health without cross-backend record merging."
 * Owner correction (2026-07-22): "每项先明确一个生产 owner、一个精准红例、一个绿例。"
 * Independent review correction (2026-07-22): Root identity excludes generation and data-scope diagnostics.
 * Owner Context direction (2026-07-29): route Root health actions to Config-owned Resolved Context.
 */
import type { RootContext, RootContextError, RootContextState } from '@openspecui/core'
import type { NotificationPublishInput } from '@openspecui/core/notifications'
import type { Observable, Unsubscribable } from '@trpc/server/observable'
import type { NotificationService } from './notification-service.js'

/** Local lifecycle handle for the Server-owned Root Context health bridge. */
export interface RootContextNotificationBridge {
  start(): void
  dispose(): void
}

type TerminalRootContext =
  | {
      kind: 'ready'
      identity: string
      generation: string | null
    }
  | {
      kind: 'error'
      identity: string
      generation: string | null
      error: RootContextError
    }

function resolvedRootIdentity(context: RootContext): string {
  const root = context.planningRoot
  return JSON.stringify({
    planningRoot: root
      ? {
          path: root.path,
          source: root.source,
        }
      : null,
    storeId: context.storeId,
  })
}

function terminalRootContext(state: RootContextState): TerminalRootContext | null {
  if (state.state === 'loading' || state.state === 'refreshing') return null
  if (state.state === 'ready') {
    return {
      kind: 'ready',
      identity: resolvedRootIdentity(state.data),
      generation: state.data.generation ?? null,
    }
  }
  return {
    kind: 'error',
    identity: JSON.stringify({
      code: state.error.code,
      attempt: resolvedRootIdentity(state.attempt),
    }),
    generation: state.attempt.generation ?? null,
    error: state.error,
  }
}

function contextAction(): NotificationPublishInput['actions'] {
  return [
    {
      type: 'href.open',
      label: 'Open Resolved Context',
      target: { href: '/config/context' },
    },
  ]
}

function errorNotification(error: RootContextError): NotificationPublishInput {
  return {
    title: 'Planning root unavailable',
    body: `OpenSpec root resolution failed: ${error.code}.`,
    source: { type: 'root-context' },
    actions: contextAction(),
    level: 'error',
  }
}

function recoveryNotification(): NotificationPublishInput {
  return {
    title: 'Planning root recovered',
    body: 'OpenSpec root resolution is ready again.',
    source: { type: 'root-context' },
    actions: contextAction(),
    level: 'success',
  }
}

function rootChangedNotification(): NotificationPublishInput {
  return {
    title: 'Planning root changed',
    body: 'Open Resolved Context for the current planning-root details.',
    source: { type: 'root-context' },
    actions: contextAction(),
    level: 'info',
  }
}

/**
 * Create one inactive bridge for one Server NotificationService. `start` is deliberately separate so
 * direct `createServer` fixtures do not retain an unowned reactive subscription.
 */
export function createRootContextNotificationBridge(input: {
  notificationService: NotificationService
  rootContext: Observable<RootContextState, unknown>
}): RootContextNotificationBridge {
  let current: TerminalRootContext | null = null
  const retiredGenerations = new Set<string>()
  let subscription: Unsubscribable | null = null
  let subscriptionEpoch = 0
  let disposed = false

  const handleState = (state: RootContextState, epoch: number): void => {
    if (epoch !== subscriptionEpoch) return
    const next = terminalRootContext(state)
    if (!next) return
    if (next.generation && retiredGenerations.has(next.generation)) {
      return
    }
    if (current === null) {
      current = next
      return
    }
    if (current.generation && current.generation !== next.generation) {
      retiredGenerations.add(current.generation)
    }
    if (current.identity === next.identity) {
      current = next
      return
    }
    if (next.kind === 'error') {
      input.notificationService.publish(errorNotification(next.error))
    } else if (current.kind === 'error') {
      input.notificationService.publish(recoveryNotification())
    } else {
      input.notificationService.publish(rootChangedNotification())
    }
    current = next
  }

  return {
    start() {
      if (disposed || subscription) return
      const epoch = ++subscriptionEpoch
      subscription = input.rootContext.subscribe({
        next(state) {
          handleState(state, epoch)
        },
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      subscriptionEpoch += 1
      subscription?.unsubscribe()
      subscription = null
    },
  }
}
