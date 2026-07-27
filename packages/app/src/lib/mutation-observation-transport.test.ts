/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
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
  type MutationObservationTransportFactory,
} from './mutation-observation'
import { createTRPCMutationObservationTransportFactory } from './mutation-observation-transport'
import type { HostedShellTab } from './shell-state'

const credentialA: AccessGateCredential = {
  credential: 'p3b-credential-a',
  authorizationHeader: 'Bearer p3b-credential-a',
  fingerprint: 'p3b-test-a',
}
const credentialB: AccessGateCredential = {
  credential: 'p3b-credential-b',
  authorizationHeader: 'Bearer p3b-credential-b',
  fingerprint: 'p3b-test-b',
}
const runningServers: RunningServer[] = []
const tempDirs: string[] = []
const credentialLocators = new Set<string>()

afterEach(async () => {
  for (const apiBaseUrl of credentialLocators) clearLaunchCredential(apiBaseUrl)
  credentialLocators.clear()
  await Promise.all(runningServers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function waitForProjection(
  owner: MutationObservationOwner,
  apiBaseUrl: string,
  predicate: (projection: MutationLocatorProjection) => boolean,
  label: string
): Promise<MutationLocatorProjection> {
  const select = () =>
    owner.getSnapshot().projections.find((projection) => projection.apiBaseUrl === apiBaseUrl)
  const current = select()
  if (current && predicate(current)) return current
  return new Promise<MutationLocatorProjection>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error(`Timed out waiting for ${label}.`))
    }, 10_000)
    const unsubscribe = owner.subscribe(() => {
      const projection = select()
      if (!projection || !predicate(projection)) return
      clearTimeout(timeout)
      unsubscribe()
      resolve(projection)
    })
  })
}

function tab(id: string, apiBaseUrl: string): HostedShellTab {
  return { id, sessionId: `session-${id}`, apiBaseUrl, createdAt: id.length }
}

function bindCredential(apiBaseUrl: string, credential: string): void {
  if (!bindLaunchCredential(apiBaseUrl, credential)) {
    throw new Error(`Failed to bind fixture credential for ${apiBaseUrl}.`)
  }
  credentialLocators.add(apiBaseUrl)
}

function isTerminal(status: string): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'indeterminate'
}

describe('App mutation observation tRPC transport', () => {
  it('uses only the matching locator credential for snapshot and lifecycle observation', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-app-p3b-'))
    tempDirs.push(projectDir)
    const server = await startServer({
      projectDir,
      port: 36_500,
      enableWatcher: false,
      accessGate: credentialA,
    })
    runningServers.push(server)
    const factory = createTRPCMutationObservationTransportFactory({ retryDelayMs: () => 30_000 })

    const missing = createMutationObservationOwner(factory)
    missing.setTabs([tab('missing', server.url)])
    expect(
      await waitForProjection(
        missing,
        server.url,
        ({ lifecycle }) => lifecycle === 'error',
        'missing auth error'
      )
    ).toMatchObject({ current: false, records: [] })
    missing.dispose()

    bindCredential(server.url, 'wrong-credential')
    const wrong = createMutationObservationOwner(factory)
    wrong.setTabs([tab('wrong', server.url)])
    expect(
      await waitForProjection(
        wrong,
        server.url,
        ({ lifecycle }) => lifecycle === 'error',
        'wrong auth error'
      )
    ).toMatchObject({ current: false, records: [] })
    wrong.dispose()

    clearLaunchCredential(server.url)
    bindCredential(server.url, credentialA.credential)
    const matching = createMutationObservationOwner(factory)
    matching.setTabs([tab('matching', server.url)])
    await waitForProjection(
      matching,
      server.url,
      ({ current }) => current,
      'guarded lifecycle snapshot'
    )
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
      server.url,
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

  it('isolates simultaneous guarded locator credentials across reconnect handshakes', async () => {
    const projectDirA = await mkdtemp(join(tmpdir(), 'openspecui-app-p3b-a-'))
    const projectDirB = await mkdtemp(join(tmpdir(), 'openspecui-app-p3b-b-'))
    tempDirs.push(projectDirA, projectDirB)
    const serverA = await startServer({
      projectDir: projectDirA,
      port: 36_600,
      enableWatcher: false,
      accessGate: credentialA,
    })
    const serverB = await startServer({
      projectDir: projectDirB,
      port: 36_700,
      enableWatcher: false,
      accessGate: credentialB,
    })
    runningServers.push(serverA, serverB)
    bindCredential(serverA.url, credentialA.credential)
    bindCredential(serverB.url, credentialB.credential)

    const transport = createTRPCMutationObservationTransportFactory({ retryDelayMs: () => 25 })
    const connectCount = new Map<string, number>()
    const countedTransport: MutationObservationTransportFactory = {
      connect(apiBaseUrl, callbacks) {
        connectCount.set(apiBaseUrl, (connectCount.get(apiBaseUrl) ?? 0) + 1)
        return transport.connect(apiBaseUrl, callbacks)
      },
    }
    const owner = createMutationObservationOwner(countedTransport)
    owner.setTabs([tab('a-1', serverA.url), tab('a-2', `${serverA.url}/`), tab('b', serverB.url)])
    await Promise.all([
      waitForProjection(owner, serverA.url, ({ current }) => current, 'A snapshot'),
      waitForProjection(owner, serverB.url, ({ current }) => current, 'B snapshot'),
    ])
    expect(connectCount).toEqual(
      new Map([
        [serverA.url, 1],
        [serverB.url, 1],
      ])
    )

    await Promise.all([
      mutateBackendStore(
        { apiBaseUrl: serverA.url },
        { requestId: 'request-a', kind: 'register', path: join(projectDirA, 'missing-a') }
      ),
      mutateBackendStore(
        { apiBaseUrl: serverB.url },
        { requestId: 'request-b', kind: 'register', path: join(projectDirB, 'missing-b') }
      ),
    ])
    const [ledgerA, ledgerB] = await Promise.all([
      waitForProjection(
        owner,
        serverA.url,
        ({ records }) =>
          records.some(({ requestId, status }) => requestId === 'request-a' && isTerminal(status)),
        'A terminal ledger'
      ),
      waitForProjection(
        owner,
        serverB.url,
        ({ records }) =>
          records.some(({ requestId, status }) => requestId === 'request-b' && isTerminal(status)),
        'B terminal ledger'
      ),
    ])
    expect(ledgerA.records.map(({ requestId }) => requestId)).toEqual(['request-a'])
    expect(ledgerB.records.map(({ requestId }) => requestId)).toEqual(['request-b'])

    // Force the existing B WebSocket transport to perform a fresh handshake. Borrowing A's credential
    // must reject B while A's independent ledger remains current and untouched.
    bindCredential(serverB.url, credentialA.credential)
    await serverB.close()
    const restartedB = await startServer({
      projectDir: projectDirB,
      port: serverB.port,
      enableWatcher: false,
      accessGate: credentialB,
    })
    runningServers.push(restartedB)
    expect(restartedB.url).toBe(serverB.url)
    await waitForProjection(
      owner,
      serverB.url,
      ({ lifecycle, error }) =>
        lifecycle === 'error' && /credential was rejected/i.test(error ?? ''),
      'borrowed B credential rejection'
    )
    expect(
      await waitForProjection(
        owner,
        serverA.url,
        ({ current }) => current,
        'uncontaminated A ledger'
      )
    ).toMatchObject({ records: [{ requestId: 'request-a' }] })

    owner.dispose()
  }, 30_000)
})
