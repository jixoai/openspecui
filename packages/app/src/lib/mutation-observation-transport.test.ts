/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Cross a real guarded Server and the App mutation-ledger WebSocket transport.
 * 2. Prove locator credentials admit only their matching transport.
 * 3. Prove real lifecycle data commits through the framework-neutral owner.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { AccessGateCredential } from '@openspecui/core'
import { startServer, type RunningServer } from '@openspecui/server'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mutateBackendStore } from './backend-client'
import { bindLaunchCredential, clearLaunchCredential } from './launch-credential'
import {
  createMutationObservationOwner,
  type MutationLocatorProjection,
  type MutationObservationOwner,
} from './mutation-observation'
import { createTRPCMutationObservationTransportFactory } from './mutation-observation-transport'
import type { HostedShellTab } from './shell-state'

const credential: AccessGateCredential = {
  credential: 'p3b-matching-credential',
  authorizationHeader: 'Bearer p3b-matching-credential',
  fingerprint: 'p3b-test',
}
const runningServers: RunningServer[] = []
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function waitForProjection(
  owner: MutationObservationOwner,
  predicate: (projection: MutationLocatorProjection) => boolean,
  label: string
): Promise<MutationLocatorProjection> {
  const current = owner.getSnapshot().projections[0]
  if (current && predicate(current)) return current
  return new Promise<MutationLocatorProjection>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error(`Timed out waiting for ${label}.`))
    }, 10_000)
    const unsubscribe = owner.subscribe(() => {
      const projection = owner.getSnapshot().projections[0]
      if (!projection || !predicate(projection)) return
      clearTimeout(timeout)
      unsubscribe()
      resolve(projection)
    })
  })
}

function tab(apiBaseUrl: string): HostedShellTab {
  return { id: 'guarded', sessionId: 'guarded-session', apiBaseUrl, createdAt: 1 }
}

describe('App mutation observation tRPC transport', () => {
  it('uses only the matching locator credential for snapshot and lifecycle observation', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-app-p3b-'))
    tempDirs.push(projectDir)
    const server = await startServer({
      projectDir,
      port: 36_500,
      enableWatcher: false,
      accessGate: credential,
    })
    runningServers.push(server)
    const factory = createTRPCMutationObservationTransportFactory({ retryDelayMs: () => 30_000 })

    const missing = createMutationObservationOwner(factory)
    missing.setTabs([tab(server.url)])
    expect(
      await waitForProjection(
        missing,
        ({ lifecycle }) => lifecycle === 'error',
        'missing auth error'
      )
    ).toMatchObject({ current: false, records: [] })
    missing.dispose()

    bindLaunchCredential(server.url, 'wrong-credential')
    const wrong = createMutationObservationOwner(factory)
    wrong.setTabs([tab(server.url)])
    expect(
      await waitForProjection(wrong, ({ lifecycle }) => lifecycle === 'error', 'wrong auth error')
    ).toMatchObject({ current: false, records: [] })
    wrong.dispose()

    clearLaunchCredential(server.url)
    bindLaunchCredential(server.url, credential.credential)
    const matching = createMutationObservationOwner(factory)
    matching.setTabs([tab(server.url)])
    await waitForProjection(matching, ({ current }) => current, 'guarded lifecycle snapshot')
    const observedStatuses: string[] = []
    const unsubscribe = matching.subscribe(() => {
      const observed = matching
        .getSnapshot()
        .projections[0]?.records.find(({ requestId }) => requestId === 'guarded-request')
      if (observed && observedStatuses.at(-1) !== observed.status) {
        observedStatuses.push(observed.status)
      }
    })

    const admission = await mutateBackendStore(
      { apiBaseUrl: server.url },
      {
        requestId: 'guarded-request',
        kind: 'register',
        path: join(projectDir, 'missing-store'),
      }
    )
    expect(admission).toMatchObject({
      requestId: 'guarded-request',
      status: 'accepted',
      rejoined: false,
    })
    const terminal = await waitForProjection(
      matching,
      ({ records }) =>
        records.some(
          ({ requestId, status }) =>
            requestId === 'guarded-request' &&
            (status === 'succeeded' || status === 'failed' || status === 'indeterminate')
        ),
      'guarded terminal lifecycle'
    )

    unsubscribe()
    matching.dispose()
    clearLaunchCredential(server.url)
    expect(observedStatuses.slice(0, 2)).toEqual(['accepted', 'running'])
    expect(
      terminal.records.find(({ requestId }) => requestId === 'guarded-request')?.status
    ).toMatch(/^(succeeded|failed|indeterminate)$/)
  }, 30_000)
})
