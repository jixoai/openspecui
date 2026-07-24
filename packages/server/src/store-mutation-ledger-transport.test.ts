/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Cross real HTTP mutation admission and WebSocket lifecycle delivery.
 * 2. Prove delayed CLI admission, request-id deduplication, and terminal invalidation order.
 * 3. Preserve pre-admission rejection and deterministic CLI failure as non-indeterminate evidence.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { ConfigManager, type StoreMutationLifecycleEvent } from '@openspecui/core'
import { createTRPCClient, createWSClient, httpBatchLink, wsLink } from '@trpc/client'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { findAvailablePort } from './port-utils.js'
import { startServer, type AppRouter, type RunningServer } from './server.js'
import { createDeferred } from './test-support/deferred.js'

const runningServers: RunningServer[] = []
const wsClients: Array<ReturnType<typeof createWSClient>> = []
const tempDirs: string[] = []

afterEach(async () => {
  for (const client of wsClients.splice(0)) client.close()
  await Promise.all(runningServers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function createTempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(directory)
  return directory
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

async function waitForFile(path: string): Promise<void> {
  while (
    !(await access(path).then(
      () => true,
      () => false
    ))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function startDelayedCliServer() {
  const projectDir = await createTempDir('openspecui-store-ledger-project-')
  const runnerPath = join(projectDir, 'delayed-store-runner.cjs')
  const spawnMarker = join(projectDir, 'spawn-marker.log')
  const releasePath = join(projectDir, 'release')
  await writeFile(
    runnerPath,
    [
      "const fs = require('node:fs')",
      `const spawnMarker = ${JSON.stringify(spawnMarker)}`,
      `const releasePath = ${JSON.stringify(releasePath)}`,
      'const args = process.argv.slice(2)',
      "if (args.includes('--version')) { process.stdout.write('1.6.0'); process.exit(0) }",
      "if (args[0] !== 'store' || args[1] !== 'setup') process.exit(2)",
      "fs.appendFileSync(spawnMarker, 'spawn\\n')",
      'const id = args[2]',
      'const finish = () => {',
      "  const payload = id === 'contract-drift'",
      "    ? { unexpected: 'retained raw fact', status: [{ severity: 'warning', code: 'STORE_DRIFT', message: 'Malformed Store payload.' }] }",
      '    : { store: null, registry: null, git: null, created_files: [], status: [] }',
      "  if (id === 'contract-drift') process.stderr.write('exit-zero contract drift\\n')",
      '  process.stdout.write(JSON.stringify(payload))',
      "  process.exit(id === 'failed' ? 1 : 0)",
      '}',
      'const timer = setInterval(() => { if (fs.existsSync(releasePath)) { clearInterval(timer); finish() } }, 10)',
    ].join('\n'),
    'utf8'
  )
  await new ConfigManager(projectDir).writeConfig({
    cli: { command: `${process.execPath} ${runnerPath}` },
  })
  const server = await startServer({
    projectDir,
    port: await findAvailablePort(35_500, 100),
    enableWatcher: false,
  })
  runningServers.push(server)
  return { projectDir, releasePath, server, spawnMarker }
}

describe('Store mutation ledger transport', () => {
  it('admits once before terminal, streams lifecycle evidence, and invalidates before one terminal publish', async () => {
    const fixture = await startDelayedCliServer()
    const wsClient = createWSClient({
      url: `ws://localhost:${fixture.server.port}/trpc`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    })
    wsClients.push(wsClient)
    const subscriptions = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
    const mutations = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${fixture.server.url}/trpc` })],
    })
    const statuses: string[] = []
    const ready = createDeferred<void>()
    const invalidationReady = createDeferred<void>()
    const acceptedRunning = createDeferred<void>()
    const terminal = createDeferred<void>()
    let terminalInvalidationObserved = false
    const invalidation = subscriptions.runtimeInvalidation.subscribe.subscribe(
      { facets: ['stores', 'context'] },
      {
        onData: (tokens) => {
          if (tokens.every((token) => token.generation === 0)) {
            invalidationReady.resolve()
            return
          }
          terminalInvalidationObserved = tokens.every((token) => token.generation >= 1)
        },
        onError: terminal.reject,
      }
    )
    const subscription = subscriptions.stores.subscribeMutations.subscribe(undefined, {
      onData: (event) => {
        if (event.type === 'snapshot') {
          ready.resolve()
          return
        }
        if (event.record.requestId !== 'request-a') return
        statuses.push(event.record.status)
        if (statuses.join(',') === 'accepted,running') acceptedRunning.resolve()
        if (event.record.status === 'succeeded') {
          expect(terminalInvalidationObserved).toBe(true)
          terminal.resolve()
        }
      },
      onError: terminal.reject,
    })

    await withTimeout(ready.promise, 'lifecycle snapshot')
    await withTimeout(invalidationReady.promise, 'invalidation snapshot')
    const start = await mutations.stores.mutate.mutate({
      requestId: 'request-a',
      kind: 'setup',
      path: join(fixture.projectDir, 'store-a'),
    })
    expect(start).toEqual({
      requestId: 'request-a',
      envUri: expect.stringMatching(/^openspecui-env:\/\/1\//),
      kind: 'setup',
      status: 'accepted',
      observedAt: expect.any(Number),
      rejoined: false,
    })
    const rejoin = await mutations.stores.mutate.mutate({
      requestId: 'request-a',
      kind: 'setup',
      path: join(fixture.projectDir, 'store-a'),
    })
    expect(rejoin).toMatchObject({
      requestId: start.requestId,
      envUri: start.envUri,
      kind: start.kind,
    })
    expect(['accepted', 'running']).toContain(rejoin.status)
    await withTimeout(acceptedRunning.promise, 'accepted then running lifecycle')
    await withTimeout(waitForFile(fixture.spawnMarker), 'CLI spawn marker')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect((await readFile(fixture.spawnMarker, 'utf8')).trim().split('\n')).toEqual(['spawn'])
    expect(rejoin.rejoined).toBe(true)

    await writeFile(fixture.releasePath, 'release', 'utf8')
    await withTimeout(terminal.promise, 'terminal lifecycle')
    subscription.unsubscribe()
    invalidation.unsubscribe()
    expect(statuses).toEqual(['accepted', 'running', 'succeeded'])
  })

  it('retains deterministic failed evidence and rejects malformed input before admission', async () => {
    const fixture = await startDelayedCliServer()
    const wsClient = createWSClient({
      url: `ws://localhost:${fixture.server.port}/trpc`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    })
    wsClients.push(wsClient)
    const subscriptions = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
    const client = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${fixture.server.url}/trpc` })],
    })
    const records: Array<{ requestId: string; status: string }> = []
    const ready = createDeferred<void>()
    const failed = createDeferred<void>()
    const subscription = subscriptions.stores.subscribeMutations.subscribe(undefined, {
      onData: (event) => {
        if (event.type === 'snapshot') {
          records.push(
            ...event.records.map((record) => ({
              requestId: record.requestId,
              status: record.status,
            }))
          )
          ready.resolve()
          return
        }
        records.push({ requestId: event.record.requestId, status: event.record.status })
        if (event.record.requestId === 'failed' && event.record.status === 'failed')
          failed.resolve()
      },
      onError: failed.reject,
    })
    await withTimeout(ready.promise, 'lifecycle snapshot')
    await expect(
      client.stores.mutate.mutate({ requestId: 'rejected', kind: 'setup' })
    ).rejects.toThrow('setup requires a path.')
    expect(records.some((record) => record.requestId === 'rejected')).toBe(false)

    const start = await client.stores.mutate.mutate({
      requestId: 'failed',
      kind: 'setup',
      storeId: 'failed',
      path: join(fixture.projectDir, 'store-failed'),
    })
    expect(start.status).toBe('accepted')
    await withTimeout(waitForFile(fixture.spawnMarker), 'CLI spawn marker')
    await writeFile(fixture.releasePath, 'release', 'utf8')
    await withTimeout(failed.promise, 'deterministic failed lifecycle')
    subscription.unsubscribe()
    expect(records.filter((record) => record.requestId === 'failed')).toEqual([
      { requestId: 'failed', status: 'accepted' },
      { requestId: 'failed', status: 'running' },
      { requestId: 'failed', status: 'failed' },
    ])
  })

  it('retains real exit-zero Store contract drift as exactly one failed terminal', async () => {
    const fixture = await startDelayedCliServer()
    const wsClient = createWSClient({
      url: `ws://localhost:${fixture.server.port}/trpc`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    })
    wsClients.push(wsClient)
    const subscriptions = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
    const mutations = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${fixture.server.url}/trpc` })],
    })
    const ready = createDeferred<void>()
    const terminal =
      createDeferred<Extract<StoreMutationLifecycleEvent, { type: 'changed' }>['record']>()
    const statuses: string[] = []
    const subscription = subscriptions.stores.subscribeMutations.subscribe(undefined, {
      onData: (event) => {
        if (event.type === 'snapshot') {
          ready.resolve()
          return
        }
        if (event.record.requestId !== 'contract-drift') return
        statuses.push(event.record.status)
        if (event.record.status === 'failed') terminal.resolve(event.record)
      },
      onError: terminal.reject,
    })
    await withTimeout(ready.promise, 'lifecycle snapshot')

    const start = await mutations.stores.mutate.mutate({
      requestId: 'contract-drift',
      kind: 'setup',
      storeId: 'contract-drift',
      path: join(fixture.projectDir, 'store-contract-drift'),
    })
    expect(start).toMatchObject({
      requestId: 'contract-drift',
      status: 'accepted',
      rejoined: false,
    })
    await withTimeout(waitForFile(fixture.spawnMarker), 'CLI spawn marker')
    await writeFile(fixture.releasePath, 'release', 'utf8')

    const failed = await withTimeout(terminal.promise, 'exit-zero contract failure')
    subscription.unsubscribe()
    expect(statuses).toEqual(['accepted', 'running', 'failed'])
    expect(failed).toMatchObject({
      status: 'failed',
      result: {
        exitStatus: 0,
        stdout: JSON.stringify({
          unexpected: 'retained raw fact',
          status: [
            {
              severity: 'warning',
              code: 'STORE_DRIFT',
              message: 'Malformed Store payload.',
            },
          ],
        }),
        stderr: 'exit-zero contract drift\n',
        diagnostics: [
          {
            severity: 'warning',
            code: 'STORE_DRIFT',
            message: 'Malformed Store payload.',
          },
        ],
        payload: {
          unexpected: 'retained raw fact',
          status: [
            {
              severity: 'warning',
              code: 'STORE_DRIFT',
              message: 'Malformed Store payload.',
            },
          ],
        },
        contractError: expect.stringMatching(/store|registry|git|created_files/i),
      },
    })
  })
})
