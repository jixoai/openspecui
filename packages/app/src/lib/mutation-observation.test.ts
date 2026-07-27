/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove locator deduplication and isolated mutation-ledger projections.
 * 2. Prove snapshot, reconnect, cursor, and callback-epoch provenance.
 * 3. Prove malformed lifecycle payloads fail closed without replacing evidence.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { StoreMutationEnvelope } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import {
  createMutationObservationOwner,
  type MutationLifecycleCallbacks,
  type MutationLifecycleTransport,
  type MutationObservationOwner,
  type MutationObservationTransportFactory,
} from './mutation-observation'
import type { HostedShellTab } from './shell-state'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

function tab(id: string, apiBaseUrl: string): HostedShellTab {
  return { id, sessionId: `session-${id}`, apiBaseUrl, createdAt: id.length }
}

function record(requestId: string, status: 'accepted' | 'running' = 'accepted') {
  return {
    requestId,
    envUri: `openspecui-env://1/${requestId}`,
    kind: 'register',
    status,
    observedAt: 1,
  } satisfies StoreMutationEnvelope
}

interface ControlledTransport extends MutationLifecycleTransport {
  apiBaseUrl: string
  callbacks: MutationLifecycleCallbacks
  unsubscribed: boolean
}

function createControlledFactory(): MutationObservationTransportFactory & {
  transports: ControlledTransport[]
} {
  const transports: ControlledTransport[] = []
  return {
    transports,
    connect(apiBaseUrl, callbacks) {
      const transport: ControlledTransport = {
        apiBaseUrl,
        callbacks,
        unsubscribed: false,
        unsubscribe() {
          transport.unsubscribed = true
        },
      }
      transports.push(transport)
      return transport
    },
  }
}

function projection(owner: MutationObservationOwner, apiBaseUrl = API_A) {
  const value = owner
    .getSnapshot()
    .projections.find((candidate) => candidate.apiBaseUrl === apiBaseUrl)
  if (!value) throw new Error(`Missing mutation projection for ${apiBaseUrl}.`)
  return value
}

describe('mutation observation owner', () => {
  it('registers the epoch before a transport can synchronously publish its first snapshot', () => {
    const owner = createMutationObservationOwner({
      connect(_apiBaseUrl, callbacks) {
        callbacks.onData({ type: 'snapshot', cursor: 0, records: [record('sync')] })
        return { unsubscribe() {} }
      },
    })

    owner.setTabs([tab('a', API_A)])

    expect(projection(owner)).toMatchObject({
      lifecycle: 'current',
      current: true,
      cursor: 0,
      records: [{ requestId: 'sync' }],
    })
  })

  it('deduplicates same-locator tabs while keeping different locator records isolated', () => {
    const factory = createControlledFactory()
    const owner = createMutationObservationOwner(factory)

    owner.setTabs([tab('a-1', `${API_A}/`), tab('a-2', API_A), tab('b', API_B)])

    expect(factory.transports.map(({ apiBaseUrl }) => apiBaseUrl)).toEqual([API_A, API_B])
    factory.transports[0]?.callbacks.onData({
      type: 'snapshot',
      cursor: 1,
      records: [record('request-a')],
    })
    factory.transports[1]?.callbacks.onData({
      type: 'snapshot',
      cursor: 4,
      records: [record('request-b')],
    })

    expect(projection(owner, API_A).records.map(({ requestId }) => requestId)).toEqual([
      'request-a',
    ])
    expect(projection(owner, API_B).records.map(({ requestId }) => requestId)).toEqual([
      'request-b',
    ])
  })

  it('retains A as display-only during reconnect and requires B snapshot replacement', () => {
    const factory = createControlledFactory()
    const owner = createMutationObservationOwner(factory)
    owner.setTabs([tab('a', API_A)])
    const transport = factory.transports[0]
    if (!transport) throw new Error('Missing controlled transport.')
    transport.callbacks.onData({ type: 'snapshot', cursor: 2, records: [record('request-a')] })

    transport.callbacks.onConnectionState('connecting')
    expect(projection(owner)).toMatchObject({
      lifecycle: 'reconnecting',
      current: false,
      cursor: 2,
      records: [{ requestId: 'request-a' }],
    })

    transport.callbacks.onData({
      type: 'changed',
      cursor: 3,
      record: record('must-wait-for-snapshot'),
    })
    expect(projection(owner)).toMatchObject({
      lifecycle: 'contract-error',
      current: false,
      records: [{ requestId: 'request-a' }],
    })

    transport.callbacks.onData({ type: 'snapshot', cursor: 0, records: [] })
    expect(projection(owner)).toMatchObject({
      lifecycle: 'current',
      current: true,
      cursor: 0,
      records: [],
      error: null,
    })
  })

  it('makes every callback from a removed and re-added locator epoch inert', () => {
    const factory = createControlledFactory()
    const owner = createMutationObservationOwner(factory)
    owner.setTabs([tab('old-a', API_A)])
    const retired = factory.transports[0]
    if (!retired) throw new Error('Missing retired transport.')
    retired.callbacks.onData({ type: 'snapshot', cursor: 1, records: [record('retired')] })

    owner.setTabs([])
    owner.setTabs([tab('new-a', API_A)])
    const current = factory.transports[1]
    if (!current) throw new Error('Missing replacement transport.')
    current.callbacks.onData({ type: 'snapshot', cursor: 0, records: [] })

    const lateEvents: Array<() => void> = [
      () => retired.callbacks.onData({ type: 'snapshot', cursor: 9, records: [record('late')] }),
      () => retired.callbacks.onError(new Error('late error')),
      () => retired.callbacks.onConnectionState('pending'),
      () => retired.callbacks.onStopped(),
      () => retired.callbacks.onComplete(),
    ]
    for (const publishLate of lateEvents) publishLate()

    expect(retired.unsubscribed).toBe(true)
    expect(projection(owner)).toMatchObject({
      ownerEpoch: 2,
      lifecycle: 'current',
      current: true,
      cursor: 0,
      records: [],
      error: null,
    })
  })

  it.each([
    {
      name: 'malformed event',
      before: null,
      event: { type: 'unknown' },
      retained: [] as readonly StoreMutationEnvelope[],
    },
    {
      name: 'changed before snapshot',
      before: null,
      event: { type: 'changed', cursor: 1, record: record('early') },
      retained: [] as readonly StoreMutationEnvelope[],
    },
    {
      name: 'non-monotonic cursor',
      before: { type: 'snapshot', cursor: 2, records: [record('stable')] },
      event: { type: 'changed', cursor: 2, record: record('invalid') },
      retained: [record('stable')],
    },
  ])('fails closed for $name', ({ before, event, retained }) => {
    const factory = createControlledFactory()
    const owner = createMutationObservationOwner(factory)
    owner.setTabs([tab('a', API_A)])
    const transport = factory.transports[0]
    if (!transport) throw new Error('Missing controlled transport.')
    if (before) transport.callbacks.onData(before)

    transport.callbacks.onData(event)

    expect(projection(owner)).toMatchObject({
      lifecycle: 'contract-error',
      current: false,
    })
    expect(projection(owner).records).toEqual(retained)
  })
})
