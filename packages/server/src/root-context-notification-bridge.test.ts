/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Prove Root Context terminal transitions publish only local Server health records.
 * 2. Prove resolved-root identity excludes generation/data scope while lifecycle retirement remains strict.
 * 3. Prove refresh, duplicate error, late generation, and disposal callbacks remain inert.
 * 4. Prove root-context records target Config-owned Resolved Context.
 *
 * Original checkpoint (2026-07-16): "6.15 Notifications remain project-backend scoped and add root/context health without cross-backend record merging."
 * Independent review correction (2026-07-22): disposed observers are rejected by epoch, not a hidden flag.
 * Owner Context direction (2026-07-29): route health notifications to `/config/context`.
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { observable, type Observer } from '@trpc/server/observable'
import { describe, expect, it } from 'vitest'
import { NotificationService } from './notification-service.js'
import { createRootContextNotificationBridge } from './root-context-notification-bridge.js'

function createControlledRootContextObservable() {
  let observer: Observer<RootContextState, unknown> | null = null
  const rootContext = observable<RootContextState>((next) => {
    observer = next
    return () => undefined
  })

  return {
    rootContext,
    emit(state: RootContextState): void {
      observer?.next(state)
    },
    emitLate(state: RootContextState): void {
      observer?.next(state)
    },
  }
}

function rootContext(
  path: string,
  generation: string,
  observedAt: number,
  dataScopePath = '/data/openspec'
): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: { path, source: 'nearest', healthy: true, status: [] },
    storeId: null,
    generation,
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: dataScopePath,
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt,
  }
}

function ready(
  path: string,
  generation: string,
  observedAt: number,
  dataScopePath?: string
): RootContextState {
  return {
    state: 'ready',
    data: rootContext(path, generation, observedAt, dataScopePath),
    attempt: null,
    error: null,
    observedAt,
  }
}

function refreshing(path: string, generation: string, observedAt: number): RootContextState {
  return {
    state: 'refreshing',
    data: rootContext(path, generation, observedAt),
    attempt: null,
    error: null,
    observedAt,
  }
}

function unavailable(
  path: string,
  generation: string,
  observedAt: number,
  dataScopePath?: string
): RootContextState {
  return {
    state: 'error',
    data: null,
    attempt: rootContext(path, generation, observedAt, dataScopePath),
    error: { code: 'root-unhealthy', message: 'Hidden CLI evidence must stay on Context.' },
    observedAt,
  }
}

describe('Root Context notification bridge', () => {
  it('baselines ready A, ignores refreshes, and publishes one root change for ready B', () => {
    const service = new NotificationService()
    const source = createControlledRootContextObservable()
    const bridge = createRootContextNotificationBridge({
      notificationService: service,
      rootContext: source.rootContext,
    })
    bridge.start()

    source.emit(ready('/planning-a', 'generation-a', 1))
    source.emit(refreshing('/planning-a', 'generation-a', 2))
    source.emitLate(ready('/planning-a', 'generation-a', 3))
    expect(service.list()).toEqual([])

    source.emit(ready('/planning-b', 'generation-b', 4))

    expect(service.list()).toMatchObject([
      {
        title: 'Planning root changed',
        source: { type: 'root-context' },
        actions: [{ type: 'href.open', target: { href: '/config/context' } }],
      },
    ])
    bridge.dispose()
  })

  it('publishes one unavailable transition and one recovery while repeated errors stay silent', () => {
    const service = new NotificationService()
    const source = createControlledRootContextObservable()
    const bridge = createRootContextNotificationBridge({
      notificationService: service,
      rootContext: source.rootContext,
    })
    bridge.start()

    source.emit(ready('/planning-a', 'generation-a', 1))
    source.emit(unavailable('/planning-a', 'generation-a', 2))
    source.emit(unavailable('/planning-a', 'generation-a', 3))
    source.emit(ready('/planning-a', 'generation-b', 4))

    expect(service.list().map((notification) => notification.title)).toEqual([
      'Planning root recovered',
      'Planning root unavailable',
    ])
    expect(service.list()[1]?.body).toBe('OpenSpec root resolution failed: root-unhealthy.')
    bridge.dispose()
  })

  it('drops a late Root A error after B is current while allowing a later Root A generation', () => {
    const service = new NotificationService()
    const source = createControlledRootContextObservable()
    const bridge = createRootContextNotificationBridge({
      notificationService: service,
      rootContext: source.rootContext,
    })
    bridge.start()

    source.emit(ready('/planning-a', 'generation-a', 1))
    source.emit(ready('/planning-b', 'generation-b', 2))
    source.emitLate(unavailable('/planning-a', 'generation-a', 3))
    expect(service.list().map((notification) => notification.title)).toEqual([
      'Planning root changed',
    ])

    source.emit(ready('/planning-a', 'generation-c', 4))
    expect(service.list().map((notification) => notification.title)).toEqual([
      'Planning root changed',
      'Planning root changed',
    ])

    bridge.dispose()
    source.emitLate(unavailable('/planning-b', 'generation-b', 5))
    expect(service.list()).toHaveLength(2)
  })

  it('retires an errored Root A generation before accepting ready B', () => {
    const service = new NotificationService()
    const source = createControlledRootContextObservable()
    const bridge = createRootContextNotificationBridge({
      notificationService: service,
      rootContext: source.rootContext,
    })
    bridge.start()

    source.emit(ready('/planning-a', 'generation-a', 1))
    source.emit(unavailable('/planning-a', 'generation-a', 2))
    source.emit(ready('/planning-b', 'generation-b', 3))
    source.emitLate(ready('/planning-a', 'generation-a', 4))

    expect(service.list().map((notification) => notification.title)).toEqual([
      'Planning root recovered',
      'Planning root unavailable',
    ])
    bridge.dispose()
  })

  it('silently refreshes same Root identity while retiring its prior generation', () => {
    const service = new NotificationService()
    const source = createControlledRootContextObservable()
    const bridge = createRootContextNotificationBridge({
      notificationService: service,
      rootContext: source.rootContext,
    })
    bridge.start()

    source.emit(ready('/planning-a', 'generation-a', 1, '/data/a'))
    source.emit(ready('/planning-a', 'generation-b', 2, '/data/b'))
    source.emitLate(unavailable('/planning-a', 'generation-a', 3, '/data/a'))

    expect(service.list()).toEqual([])
    bridge.dispose()
  })

  it('uses the retired subscription epoch to reject a held current-B observer after disposal', () => {
    const service = new NotificationService()
    const source = createControlledRootContextObservable()
    const bridge = createRootContextNotificationBridge({
      notificationService: service,
      rootContext: source.rootContext,
    })
    bridge.start()

    source.emit(ready('/planning-a', 'generation-a', 1))
    source.emit(ready('/planning-b', 'generation-b', 2))
    bridge.dispose()
    source.emitLate(unavailable('/planning-b', 'generation-b', 3))

    expect(service.list().map((notification) => notification.title)).toEqual([
      'Planning root changed',
    ])
  })
})
