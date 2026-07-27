/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove the real tRPC WebSocket adapter enforces Access Gate admission before router execution.
 * 2. Prove immutable browser shell delivery is public while HTTP data and PTY remain guarded.
 * 3. Prove Server-issued environment identity is stable and reused by Store mutation ownership.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  generateAccessGateCredential,
  isHostedBackendHealthResponse,
  type AccessGateCredential,
  type HostedBackendHealthResponse,
} from '@openspecui/core'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { TRPCConnectionParamsMessage, TRPCRequestMessage } from '@trpc/server/rpc'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { findAvailablePort } from './port-utils.js'
import { startServer, type AppRouter, type RunningServer } from './server.js'

const runningServers: RunningServer[] = []
const sockets: WebSocket[] = []
const tempDirs: string[] = []
let nextPreferredPort = 35_100

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await Promise.all(runningServers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  vi.unstubAllEnvs()
})

async function createTempDir(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(directory)
  return directory
}

async function startTestServer(options?: {
  accessGate?: AccessGateCredential
  hostIdentity?: string
}): Promise<RunningServer> {
  const projectDir = await createTempDir('openspecui-hosted-admission-project-')
  const port = await findAvailablePort(nextPreferredPort, 100)
  nextPreferredPort = port + 1
  const hostIdentity = options?.hostIdentity
  const server = await startServer(
    {
      projectDir,
      port,
      enableWatcher: false,
      accessGate: options?.accessGate,
      hostIdentityProvider: hostIdentity === undefined ? undefined : () => hostIdentity,
    },
    (app) => {
      app.get('/', (context) => context.html('<!doctype html><div id="root"></div>'))
      app.get('/assets/project-web.js', (context) =>
        context.body('globalThis.__projectWebLoaded = true', 200, {
          'Content-Type': 'application/javascript',
        })
      )
    }
  )
  runningServers.push(server)
  return server
}

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve())
    socket.once('error', reject)
  })
}

function waitForMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for WebSocket message.')),
      2_000
    )
    socket.once('message', (data) => {
      clearTimeout(timeout)
      try {
        const parsed: unknown = JSON.parse(data.toString())
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    })
    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function openSocket(url: string, authorizationHeader?: string): WebSocket {
  const socket = new WebSocket(
    url,
    authorizationHeader ? { headers: { Authorization: authorizationHeader } } : undefined
  )
  sockets.push(socket)
  return socket
}

async function runSystemStatusQuery(options: {
  url: string
  authorizationHeader?: string
  connectionParams?: Record<string, string>
}): Promise<unknown> {
  const expectsConnectionParams = options.connectionParams !== undefined
  const socket = openSocket(
    `${options.url}/trpc${expectsConnectionParams ? '?connectionParams=1' : ''}`,
    options.authorizationHeader
  )
  const response = waitForMessage(socket)
  await waitForOpen(socket)
  if (options.connectionParams) {
    const connectionMessage = {
      method: 'connectionParams',
      data: options.connectionParams,
    } satisfies TRPCConnectionParamsMessage
    socket.send(JSON.stringify(connectionMessage))
  }
  const query = {
    id: 1,
    method: 'query',
    params: { path: 'system.status', input: undefined },
  } satisfies TRPCRequestMessage
  socket.send(JSON.stringify(query))
  return response
}

async function readHealth(
  server: RunningServer,
  authorizationHeader?: string
): Promise<HostedBackendHealthResponse> {
  const response = await fetch(`${server.url}/api/health`, {
    headers: authorizationHeader ? { Authorization: authorizationHeader } : undefined,
  })
  expect(response.status).toBe(200)
  const payload: unknown = await response.json()
  if (!isHostedBackendHealthResponse(payload)) {
    throw new Error('Expected a hosted backend health response.')
  }
  return payload
}

describe('hosted transport admission', () => {
  it('loads immutable Project Web shell assets without granting protected backend data', async () => {
    const credential = generateAccessGateCredential()
    const server = await startTestServer({ accessGate: credential })

    const shell = await fetch(server.url)
    const shellAsset = await fetch(`${server.url}/assets/project-web.js`)
    const protectedHealth = await fetch(`${server.url}/api/health`)

    expect(shell.status).toBe(200)
    expect(shellAsset.status).toBe(200)
    expect(protectedHealth.status).toBe(401)
  })

  it('rejects missing and invalid WebSocket connection credentials before router execution', async () => {
    const credential = generateAccessGateCredential()
    const server = await startTestServer({ accessGate: credential })

    const missing = await runSystemStatusQuery({ url: server.url.replace('http:', 'ws:') })
    const invalid = await runSystemStatusQuery({
      url: server.url.replace('http:', 'ws:'),
      connectionParams: { authorization: 'Bearer wrong' },
    })

    expect(JSON.stringify(missing)).toContain('Authorization credential is required')
    expect(JSON.stringify(invalid)).toContain('Authorization credential was rejected')
    expect(JSON.stringify(missing)).not.toContain('projectDir')
    expect(JSON.stringify(invalid)).not.toContain('projectDir')
  })

  it('accepts valid connection params, reconnect, Authorization header, and unguarded WebSockets', async () => {
    const credential = generateAccessGateCredential()
    const guarded = await startTestServer({ accessGate: credential })
    const unguarded = await startTestServer()
    const guardedWsUrl = guarded.url.replace('http:', 'ws:')

    const connectionParams = { authorization: credential.authorizationHeader }
    const first = await runSystemStatusQuery({ url: guardedWsUrl, connectionParams })
    const reconnect = await runSystemStatusQuery({ url: guardedWsUrl, connectionParams })
    const header = await runSystemStatusQuery({
      url: guardedWsUrl,
      authorizationHeader: credential.authorizationHeader,
    })
    const open = await runSystemStatusQuery({ url: unguarded.url.replace('http:', 'ws:') })

    for (const response of [first, reconnect, header, open]) {
      expect(JSON.stringify(response)).toContain('projectDir')
      expect(JSON.stringify(response)).not.toContain('UNAUTHORIZED')
    }
  })

  it('enforces the Access Gate through real HTTP and PTY transport owners', async () => {
    const credential = generateAccessGateCredential()
    const server = await startTestServer({ accessGate: credential })

    const missingHttp = await fetch(`${server.url}/api/health`)
    const invalidHttp = await fetch(`${server.url}/api/health`, {
      headers: { Authorization: 'Bearer wrong' },
    })
    const validHttp = await fetch(`${server.url}/api/health`, {
      headers: { Authorization: credential.authorizationHeader },
    })
    expect(missingHttp.status).toBe(401)
    expect(invalidHttp.status).toBe(401)
    expect(validHttp.status).toBe(200)

    const missingPty = openSocket(`${server.url.replace('http:', 'ws:')}/ws/pty`)
    const missingPtyResponse = waitForMessage(missingPty)
    await waitForOpen(missingPty)
    missingPty.send(JSON.stringify({ type: 'attach', sessionId: 'missing' }))
    expect(JSON.stringify(await missingPtyResponse)).toContain('UNAUTHORIZED')

    const invalidPty = openSocket(`${server.url.replace('http:', 'ws:')}/ws/pty`)
    const invalidPtyResponse = waitForMessage(invalidPty)
    await waitForOpen(invalidPty)
    invalidPty.send(JSON.stringify({ type: 'auth', credential: 'wrong' }))
    expect(JSON.stringify(await invalidPtyResponse)).toContain('UNAUTHORIZED')

    const validPty = openSocket(`${server.url.replace('http:', 'ws:')}/ws/pty`)
    const validPtyResponse = waitForMessage(validPty)
    await waitForOpen(validPty)
    validPty.send(JSON.stringify({ type: 'auth', credential: credential.credential }))
    validPty.send(JSON.stringify({ type: 'attach', sessionId: 'missing' }))
    expect(JSON.stringify(await validPtyResponse)).toContain('SESSION_NOT_FOUND')
  })
})

describe('Server-issued environment identity', () => {
  it('is stable across projects and ports and changes with host identity or effective data home', async () => {
    const dataHomeA = await createTempDir('openspecui-hosted-data-a-')
    const dataHomeB = await createTempDir('openspecui-hosted-data-b-')
    vi.stubEnv('XDG_DATA_HOME', dataHomeA)
    const serverA = await startTestServer({ hostIdentity: 'host-a' })
    const serverB = await startTestServer({ hostIdentity: 'host-a' })
    const serverHostB = await startTestServer({ hostIdentity: 'host-b' })
    vi.stubEnv('XDG_DATA_HOME', dataHomeB)
    const serverDataHomeB = await startTestServer({ hostIdentity: 'host-a' })

    const [healthA, healthB, healthHostB, healthDataHomeB] = await Promise.all([
      readHealth(serverA),
      readHealth(serverB),
      readHealth(serverHostB),
      readHealth(serverDataHomeB),
    ])

    expect(healthA.envUri).toBe(healthB.envUri)
    expect(healthA.envUri).not.toBe(healthHostB.envUri)
    expect(healthA.envUri).not.toBe(healthDataHomeB.envUri)
    expect(healthA.envUri).not.toContain('host-a')
    expect(healthA.envUri).not.toContain(dataHomeA)
  })

  it('reuses the exact health-issued envUri for Store mutation ownership', async () => {
    const credential = generateAccessGateCredential()
    const server = await startTestServer({ accessGate: credential, hostIdentity: 'store-host' })
    const health = await readHealth(server, credential.authorizationHeader)
    const client = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${server.url}/trpc`,
          headers: { Authorization: credential.authorizationHeader },
        }),
      ],
    })

    const mutation = await client.stores.mutate.mutate({
      requestId: `identity-${Date.now()}`,
      kind: 'setup',
      path: await createTempDir('openspecui-hosted-store-path-'),
    })

    expect(mutation.envUri).toBe(health.envUri)
    expect(mutation.status).toBe('accepted')
  })
})
