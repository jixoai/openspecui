/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove daemon registration is only a candidate fact, never sufficient Running evidence.
 * 2. Prove Running requires both a compatible Health API result and an established WebSocket subscription.
 * 3. Prove WebSocket loss immediately retires Running status while retaining the registered backend row.
 *
 * Owner correction (2026-07-31): "runnings必须客观表达目前正在运行中的backend，也就是说，对于External backend，你必须基于 health-api，必须建立WebSocket才能确定它的状况"
 */
import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import type { AppDaemonWorkspaceBinding } from '@openspecui/core/app-daemon-control'
import { describe, expect, it } from 'vitest'
import type { CliProjectionTransportCallbacks } from './cli-projection-transport'
import { createRunningBackendObservationOwner } from './running-backend-observation'

const WORKSPACE: AppDaemonWorkspaceBinding = {
  id: 'workspace-a',
  backendUrl: 'http://localhost:3100',
  credential: null,
  projectDir: '/projects/a',
  ownership: 'external',
  registeredAt: 1,
  managedGeneration: null,
  shutdown: 'close-only',
  git: null,
}

describe('running backend observation owner', () => {
  it('requires both Health API and an established WebSocket before reporting Running', async () => {
    let callbacks: CliProjectionTransportCallbacks | null = null
    const owner = createRunningBackendObservationOwner({
      probe: async () => ({
        reachability: 'online',
        health: buildBackendHealthPayload({
          projectDir: '/projects/a',
          projectName: 'a',
          watcherEnabled: true,
          openspecuiVersion: '6.0.0',
          embeddedUiUrl: 'http://localhost:3100',
          apiBaseUrl: 'http://localhost:3100',
          envUri: 'env:a',
        }),
        errorMessage: null,
      }),
      projectionTransportFactory: {
        connect(_apiBaseUrl, _selector, nextCallbacks) {
          callbacks = nextCallbacks
          return { unsubscribe() {} }
        },
      },
    })

    owner.setWorkspaces([WORKSPACE])
    await owner.refresh()
    expect(owner.getSnapshot().observations[0]?.state).toBe('checking')

    if (!callbacks) throw new Error('WebSocket callbacks were not installed.')
    callbacks.onConnectionState('pending')
    expect(owner.getSnapshot().observations[0]?.state).toBe('running')

    callbacks.onStopped()
    expect(owner.getSnapshot().observations[0]?.state).toBe('realtime-unavailable')
    owner.dispose()
  })
})
