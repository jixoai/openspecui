/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Prove the public PTY protocol strips arbitrary client cwd input.
 * 2. Prove the real WebSocket handler resolves cwd at create-message handling time.
 * 3. Prove real PtyManager creation and list replies preserve cwd target identity.
 * 4. Prove unavailable Planning-root resolution prevents process spawn.
 * 5. Prove workflow input requires current Root evidence and a compatible live terminal.
 *
 * Original request (2026-07-16): "3.8 Terminal exposes explicit launch-project cwd and planning-root cwd while preserving inherited XDG_DATA_HOME"
 * Owner-reported defect (2026-07-21): Same-generation Agent terminals are unavailable to Send.
 * Owner clarification (2026-07-22): Existing Launch Agent terminals must remain valid Send targets.
 */
import type { IEvent, IPty } from '@lydell/node-pty'
import {
  PtyClientMessageSchema,
  PtyServerMessageSchema,
  type PtyServerMessage,
  type TerminalCwdTarget,
} from '@openspecui/core'
import { closeSync, openSync } from 'node:fs'
import { devNull } from 'node:os'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer, type RawData } from 'ws'
import { PtyManager } from './pty-manager.js'
import { createPtyWebSocketHandler } from './pty-websocket.js'

const { spawnMock, writeMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<typeof import('@lydell/node-pty').spawn>(),
  writeMock: vi.fn(),
}))

vi.mock('@lydell/node-pty', () => ({
  spawn: spawnMock,
}))

type HandlerOptions = Parameters<typeof createPtyWebSocketHandler>[2]
type PtySocket = Parameters<ReturnType<typeof createPtyWebSocketHandler>>[0]

interface SocketHarness {
  client: WebSocket
  manager: PtyManager
  server: WebSocketServer
}

interface MockPtyWithFd extends IPty {
  readonly fd: number
}

const mockPtyFd = openSync(devNull, 'w')

function createPtyEvent<T>(): IEvent<T> {
  return () => ({ dispose: () => {} })
}

function createMockPty(): MockPtyWithFd {
  return {
    fd: mockPtyFd,
    pid: 42,
    cols: 80,
    rows: 24,
    process: 'mock-shell',
    handleFlowControl: false,
    onData: createPtyEvent<string>(),
    onExit: createPtyEvent<{ exitCode: number; signal?: number }>(),
    resize: () => {},
    clear: () => {},
    write: writeMock,
    kill: () => {},
    pause: () => {},
    resume: () => {},
  }
}

function waitForListening(server: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
}

function waitForOpen(client: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('open', resolve)
    client.once('error', reject)
  })
}

function waitForMessage(client: WebSocket): Promise<PtyServerMessage> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      client.off('message', onMessage)
      reject(error)
    }
    const onMessage = (raw: RawData) => {
      client.off('error', onError)
      try {
        const payload: unknown = JSON.parse(raw.toString())
        resolve(PtyServerMessageSchema.parse(payload))
      } catch (error) {
        reject(error)
      }
    }
    client.once('error', onError)
    client.once('message', onMessage)
  })
}

function closeServer(server: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function createSocketHarness(options: HandlerOptions): Promise<SocketHarness> {
  const manager = new PtyManager()
  const handler = createPtyWebSocketHandler(manager, undefined, options)
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await waitForListening(server)

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP server address')
  const accepted = new Promise<void>((resolve) => {
    server.once('connection', (socket: PtySocket) => {
      handler(socket)
      resolve()
    })
  })
  const client = new WebSocket(`ws://127.0.0.1:${address.port}`)
  await Promise.all([waitForOpen(client), accepted])
  return { client, manager, server }
}

async function disposeSocketHarness(harness: SocketHarness): Promise<void> {
  harness.manager.closeAll()
  harness.client.terminate()
  await closeServer(harness.server)
}

describe('PTY cwd public contract', () => {
  const harnesses: SocketHarness[] = []

  afterAll(() => closeSync(mockPtyFd))

  beforeEach(() => {
    spawnMock.mockReset()
    writeMock.mockReset()
    spawnMock.mockImplementation(() => createMockPty())
  })

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map(disposeSocketHarness))
  })

  it('strips client cwd and resolves the current Planning root immediately before spawn', async () => {
    let planningCwd = '/planning-old'
    const resolvedTargets: TerminalCwdTarget[] = []
    const rootGeneration = 'planning-generation-current'
    const withCwdTarget: HandlerOptions['withCwdTarget'] = async (target, task) => {
      resolvedTargets.push(target)
      const resolvedTarget = {
        cwdTarget: target,
        cwd: target === 'planning-root' ? planningCwd : '/launch',
        rootGeneration: target === 'planning-root' ? rootGeneration : null,
      }
      return task(resolvedTarget)
    }
    const harness = await createSocketHarness({ withCwdTarget })
    harnesses.push(harness)
    planningCwd = '/planning-current'
    const createPayload = {
      type: 'create',
      requestId: 'planning-terminal',
      cwdTarget: 'planning-root',
      command: '/bin/sh',
      cwd: '/attacker',
    }

    const parsedMessage = PtyClientMessageSchema.parse(createPayload)
    expect(parsedMessage).not.toHaveProperty('cwd')

    const createdReply = waitForMessage(harness.client)
    harness.client.send(JSON.stringify(createPayload))
    const created = await createdReply

    expect(resolvedTargets).toEqual(['planning-root'])
    expect(spawnMock).toHaveBeenCalledWith(
      '/bin/sh',
      [],
      expect.objectContaining({ cwd: '/planning-current' })
    )
    expect(created).toMatchObject({
      type: 'created',
      requestId: 'planning-terminal',
      cwdTarget: 'planning-root',
      initialCwd: '/planning-current',
      rootGeneration,
    })

    const listReply = waitForMessage(harness.client)
    harness.client.send(JSON.stringify({ type: 'list' }))
    expect(await listReply).toMatchObject({
      type: 'list',
      sessions: [
        expect.objectContaining({
          cwdTarget: 'planning-root',
          initialCwd: '/planning-current',
          rootGeneration,
        }),
      ],
    })
  })

  it('accepts workflow input only while the target session and current Root generation match', async () => {
    let currentGeneration = 'planning-generation-a'
    const withCwdTarget: HandlerOptions['withCwdTarget'] = async (
      target,
      task,
      expectedRootGeneration
    ) => {
      if (expectedRootGeneration && expectedRootGeneration !== currentGeneration) {
        throw new Error('Planning root changed before terminal input. Prepare the workflow again.')
      }
      const resolvedTarget = {
        cwdTarget: target,
        cwd: target === 'planning-root' ? '/planning' : '/launch',
        rootGeneration: target === 'planning-root' ? currentGeneration : null,
      }
      return task(resolvedTarget)
    }
    const harness = await createSocketHarness({ withCwdTarget })
    harnesses.push(harness)

    const createdReply = waitForMessage(harness.client)
    harness.client.send(
      JSON.stringify({
        type: 'create',
        requestId: 'planning-terminal',
        cwdTarget: 'planning-root',
      })
    )
    const created = await createdReply
    if (created.type !== 'created') throw new Error('Expected a created Planning terminal.')

    const acceptedReply = waitForMessage(harness.client)
    harness.client.send(
      JSON.stringify({
        type: 'workflow-input',
        requestId: 'workflow-input-a',
        sessionId: created.sessionId,
        expectedRootGeneration: 'planning-generation-a',
        data: 'apply this change\n',
      })
    )
    await expect(acceptedReply).resolves.toMatchObject({
      type: 'workflow-input-accepted',
      requestId: 'workflow-input-a',
      sessionId: created.sessionId,
    })
    if (process.platform === 'win32') {
      expect(writeMock).toHaveBeenCalledWith('apply this change\n')
    } else {
      expect(writeMock).not.toHaveBeenCalled()
    }

    currentGeneration = 'planning-generation-b'
    const rejectedReply = waitForMessage(harness.client)
    harness.client.send(
      JSON.stringify({
        type: 'workflow-input',
        requestId: 'workflow-input-stale',
        sessionId: created.sessionId,
        expectedRootGeneration: 'planning-generation-a',
        data: 'must not run\n',
      })
    )
    await expect(rejectedReply).resolves.toMatchObject({
      type: 'workflow-input-rejected',
      requestId: 'workflow-input-stale',
      sessionId: created.sessionId,
      message: 'Planning root changed before terminal input. Prepare the workflow again.',
    })
    expect(writeMock).toHaveBeenCalledTimes(process.platform === 'win32' ? 1 : 0)
  })

  it('rejects workflow input when the terminal closes while its Planning owner lease resolves', async () => {
    let releaseInputLease!: () => void
    const inputLease = new Promise<void>((resolve) => {
      releaseInputLease = resolve
    })
    const rootGeneration = 'planning-generation-current'
    const withCwdTarget: HandlerOptions['withCwdTarget'] = async (
      target,
      task,
      expectedRootGeneration
    ) => {
      if (expectedRootGeneration) await inputLease
      return task({
        cwdTarget: target,
        cwd: target === 'planning-root' ? '/planning' : '/launch',
        rootGeneration: target === 'planning-root' ? rootGeneration : null,
      })
    }
    const harness = await createSocketHarness({ withCwdTarget })
    harnesses.push(harness)

    const createdReply = waitForMessage(harness.client)
    harness.client.send(
      JSON.stringify({
        type: 'create',
        requestId: 'closing-planning-terminal',
        cwdTarget: 'planning-root',
      })
    )
    const created = await createdReply
    if (created.type !== 'created') throw new Error('Expected a created Planning terminal.')

    const rejectedReply = waitForMessage(harness.client)
    harness.client.send(
      JSON.stringify({
        type: 'workflow-input',
        requestId: 'workflow-input-closing',
        sessionId: created.sessionId,
        expectedRootGeneration: rootGeneration,
        data: 'must not reach a closed terminal\n',
      })
    )
    harness.client.send(JSON.stringify({ type: 'close', sessionId: created.sessionId }))
    await vi.waitFor(() => expect(harness.manager.get(created.sessionId)).toBeUndefined())
    releaseInputLease()

    await expect(rejectedReply).resolves.toMatchObject({
      type: 'workflow-input-rejected',
      requestId: 'workflow-input-closing',
      sessionId: created.sessionId,
      message:
        'Selected terminal is unavailable or stale. Choose a Launch terminal or a current Planning terminal.',
    })
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('does not spawn when the current Planning root is unavailable', async () => {
    const withCwdTarget: HandlerOptions['withCwdTarget'] = async () => {
      throw new Error('Planning root cwd is unavailable.')
    }
    const harness = await createSocketHarness({ withCwdTarget })
    harnesses.push(harness)
    const errorReply = waitForMessage(harness.client)

    harness.client.send(
      JSON.stringify({
        type: 'create',
        requestId: 'unavailable-planning-terminal',
        cwdTarget: 'planning-root',
      })
    )

    expect(await errorReply).toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'unavailable-planning-terminal',
      message: 'Planning root cwd is unavailable.',
    })
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
