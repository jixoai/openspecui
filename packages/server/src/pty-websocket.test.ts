/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove PTY creation reports failures and preserves backend-resolved session facts.
 * 2. Prove launch-project and Planning-root cwd targets are resolved only by the Server.
 * 3. Prove terminal control sequences preserve output while driving bounded notification fanout.
 * 4. Prove OSC and process-title precedence remains stable across updates.
 * 5. Prove reconnect retains terminal identity through host-native cwd fixtures.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-20): PTY create carries opaque planning-root generation evidence.
 * Owner-reported defect (2026-07-21): Starting an Agent terminal can starve the Server and page.
 * Owner clarification (2026-07-22): The whole application becomes unresponsive, not only one PTY socket.
 * Review correction (2026-07-22): Handler evidence must compile against real Manager, Session, WebSocket, and protocol contracts.
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import type { IEvent, IPty } from '@lydell/node-pty'
import {
  PtyServerMessageSchema,
  type PtyServerMessage,
  type TerminalCwdTarget,
  type TerminalTitleTarget,
} from '@openspecui/core'
import { closeSync, openSync } from 'node:fs'
import { devNull } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'
import { NotificationService } from './notification-service.js'
import { PtyManager, PtySession } from './pty-manager.js'
import { createPtyWebSocketHandler as createPtyWebSocketHandlerBase } from './pty-websocket.js'

const { spawnMock, nativeWriteMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<typeof import('@lydell/node-pty').spawn>(),
  nativeWriteMock: vi.fn(),
}))

vi.mock('@lydell/node-pty', () => ({
  spawn: spawnMock,
}))

type HandlerOptions = Parameters<typeof createPtyWebSocketHandlerBase>[2]

interface MockPtyWithFd extends IPty {
  readonly fd: number
}

const mockPtyFd = openSync(devNull, 'w')
const sessions: TestPtySession[] = []
const LAUNCH_CWD = process.cwd()
const PLANNING_CWD = resolve(LAUNCH_CWD, '..')

function createPtyEvent<T>(): IEvent<T> {
  return () => ({ dispose: () => undefined })
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
    resize: () => undefined,
    clear: () => undefined,
    write: nativeWriteMock,
    kill: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
  }
}

class TestPtySession extends PtySession {
  private processTitle: string
  private iconTitle = ''
  private windowTitle = ''

  constructor(
    id: string,
    opts: {
      title: string
      command: string
      cwdTarget: TerminalCwdTarget
      cwd: string
      rootGeneration: string | null
    }
  ) {
    super(id, {
      command: process.execPath,
      cwd: opts.cwd,
      cwdTarget: opts.cwdTarget,
      rootGeneration: opts.rootGeneration,
      platform: 'common',
    })
    this.processTitle = opts.title
  }

  override get title(): string {
    return this.processTitle
  }

  override get targetTitle(): string {
    return this.iconTitle || this.windowTitle || this.processTitle || this.command
  }

  override get oscTitle(): string {
    return this.iconTitle || this.windowTitle
  }

  override setTargetTitle(title: string, target: TerminalTitleTarget): void {
    const trimmed = title.trim()
    if (!trimmed) return
    if (target === 'icon' || target === 'both') this.iconTitle = trimmed
    if (target === 'window' || target === 'both') this.windowTitle = trimmed
  }

  setProcessTitle(title: string): void {
    this.processTitle = title
    this.emit('title', title)
  }
}

const socketMessages = new WeakMap<WebSocket, string[]>()
const socketHarnesses: Array<{ socket: WebSocket; client: WebSocket }> = []
let socketServer: WebSocketServer | undefined
let socketPort: number | undefined

function createMockPtySession(
  opts: {
    id?: string
    title?: string
    command?: string
    cwdTarget?: TerminalCwdTarget
    cwd?: string
    rootGeneration?: string | null
  } = {}
): TestPtySession {
  const session = new TestPtySession(opts.id ?? 'pty-1', {
    title: opts.title ?? opts.command ?? 'Shell',
    command: opts.command ?? 'bash',
    cwdTarget: opts.cwdTarget ?? 'launch-project',
    cwd: opts.cwd ?? LAUNCH_CWD,
    rootGeneration: opts.rootGeneration ?? null,
  })
  sessions.push(session)
  return session
}

function createManagerWithSession(session?: PtySession): PtyManager {
  const manager = new PtyManager()
  if (session) {
    vi.spyOn(manager, 'get').mockImplementation((id) => (id === session.id ? session : undefined))
  }
  return manager
}

function createNotificationService(): NotificationService {
  const service = new NotificationService()
  vi.spyOn(service, 'publish')
  return service
}

function createPtyWebSocketHandler(
  ptyManager: PtyManager,
  notificationService?: NotificationService
) {
  return createPtyWebSocketHandlerBase(ptyManager, notificationService, {
    withCwdTarget: async (cwdTarget, task) =>
      task({
        cwdTarget,
        cwd: cwdTarget === 'planning-root' ? PLANNING_CWD : LAUNCH_CWD,
        rootGeneration: cwdTarget === 'planning-root' ? 'test-planning-generation' : null,
      }),
  })
}

function parseMessage(payload: string): PtyServerMessage {
  const value: unknown = JSON.parse(payload)
  return PtyServerMessageSchema.parse(value)
}

function sentFor(ws: WebSocket): string[] {
  const sent = socketMessages.get(ws)
  if (!sent) throw new Error('Socket is not registered in the test harness.')
  return sent
}

function readMessage(ws: WebSocket, index: number): PtyServerMessage {
  const payload = sentFor(ws)[index]
  if (payload === undefined) throw new Error(`Expected PTY message at index ${index}.`)
  return parseMessage(payload)
}

function readMessages(ws: WebSocket): PtyServerMessage[] {
  return sentFor(ws).map(parseMessage)
}

async function createMockWebSocket(): Promise<WebSocket> {
  if (!socketServer || socketPort === undefined) {
    throw new Error('Socket server is not ready.')
  }

  const accepted = new Promise<WebSocket>((resolve) => {
    socketServer?.once('connection', resolve)
  })
  const client = new WebSocket(`ws://127.0.0.1:${socketPort}`)
  await new Promise<void>((resolve, reject) => {
    client.once('open', () => resolve())
    client.once('error', reject)
  })
  const socket = await accepted
  const sent: string[] = []
  vi.spyOn(socket, 'send').mockImplementation((data) => {
    if (typeof data !== 'string') throw new Error('Expected a serialized PTY message.')
    sent.push(data)
  })
  socketMessages.set(socket, sent)
  socketHarnesses.push({ socket, client })
  return socket
}

function waitForPtyOutputBatch(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('createPtyWebSocketHandler', () => {
  beforeAll(async () => {
    socketServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    await new Promise<void>((resolve, reject) => {
      socketServer?.once('listening', () => resolve())
      socketServer?.once('error', reject)
    })
    const address = socketServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected socket server address.')
    socketPort = address.port
  })

  beforeEach(() => {
    spawnMock.mockReset()
    nativeWriteMock.mockReset()
    spawnMock.mockImplementation(() => createMockPty())
  })

  afterEach(() => {
    for (const session of sessions.splice(0)) session.close()
    for (const { socket, client } of socketHarnesses.splice(0)) {
      socket.terminate()
      client.terminate()
    }
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      socketServer?.close((error) => (error ? reject(error) : resolve()))
    })
    closeSync(mockPtyFd)
  })

  it('returns PTY_CREATE_FAILED when session creation throws', async () => {
    const ptyManager = createManagerWithSession()
    vi.spyOn(ptyManager, 'create').mockImplementation(() => {
      throw new Error('File not found')
    })
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager)

    handler(ws)
    ws.emit(
      'message',
      JSON.stringify({ type: 'create', requestId: 'term-1', cwdTarget: 'launch-project' })
    )

    await vi.waitFor(() => expect(sentFor(ws).length).toBe(1))
    expect(readMessage(ws, 0)).toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'term-1',
      message: 'File not found',
    })
  })

  it('resolves launch and planning cwd targets before PTY creation', async () => {
    const session = createMockPtySession({
      cwdTarget: 'planning-root',
      cwd: PLANNING_CWD,
      rootGeneration: 'planning-generation',
    })
    const ptyManager = createManagerWithSession()
    const create = vi.spyOn(ptyManager, 'create').mockReturnValue(session)
    const resolvedTargets: TerminalCwdTarget[] = []
    const withCwdTarget: HandlerOptions['withCwdTarget'] = async (cwdTarget, task) => {
      resolvedTargets.push(cwdTarget)
      return task({
        cwdTarget,
        cwd: cwdTarget === 'planning-root' ? PLANNING_CWD : LAUNCH_CWD,
        rootGeneration: cwdTarget === 'planning-root' ? 'planning-generation' : null,
      })
    }
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandlerBase(ptyManager, undefined, { withCwdTarget })

    handler(ws)
    ws.emit(
      'message',
      JSON.stringify({
        type: 'create',
        requestId: 'term-planning',
        cwdTarget: 'planning-root',
      })
    )

    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ cwdTarget: 'planning-root', cwd: PLANNING_CWD })
      )
    })
    expect(resolvedTargets).toEqual(['planning-root'])
    expect(readMessage(ws, 0)).toMatchObject({
      type: 'created',
      requestId: 'term-planning',
      cwdTarget: 'planning-root',
      initialCwd: PLANNING_CWD,
      rootGeneration: 'planning-generation',
    })
  })

  it('rejects planning-root creation when current Root Context cannot resolve it', async () => {
    const ptyManager = createManagerWithSession()
    const create = vi.spyOn(ptyManager, 'create')
    const withCwdTarget: HandlerOptions['withCwdTarget'] = async () => {
      throw new Error('Planning root cwd is unavailable.')
    }
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandlerBase(ptyManager, undefined, { withCwdTarget })

    handler(ws)
    ws.emit(
      'message',
      JSON.stringify({
        type: 'create',
        requestId: 'term-planning-unavailable',
        cwdTarget: 'planning-root',
      })
    )

    await vi.waitFor(() => expect(sentFor(ws).length).toBe(1))
    expect(create).not.toHaveBeenCalled()
    expect(readMessage(ws, 0)).toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'term-planning-unavailable',
      message: 'Planning root cwd is unavailable.',
    })
  })

  it('emits terminal bell locally and publishes OSC notifications while preserving output', async () => {
    const session = createMockPtySession({ title: 'Shell', command: 'bash' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', 'a\x07b\x1b]9;Done\x07c')
    await waitForPtyOutputBatch()

    const outputMessages = readMessages(ws)
    expect(outputMessages).toContainEqual({
      type: 'bell',
      sessionId: session.id,
      createdAt: expect.any(Number),
    })
    expect(outputMessages).toContainEqual({ type: 'output', sessionId: session.id, data: 'abc' })
    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Shell',
        body: 'Done',
        source: { type: 'terminal', sessionId: session.id, title: 'Shell' },
      })
    )
  })

  it('emits progress controls without publishing bogus OSC 9;4 notifications', async () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', 'a\x1b]9;4;3;\x07b\x1b]9;4;0;\x07c')
    await waitForPtyOutputBatch()

    const outputMessages = readMessages(ws)
    expect(outputMessages).toContainEqual({
      type: 'progress',
      sessionId: session.id,
      state: 'indeterminate',
      value: null,
    })
    expect(outputMessages).toContainEqual({
      type: 'progress',
      sessionId: session.id,
      state: 'clear',
      value: null,
    })
    expect(outputMessages).toContainEqual({ type: 'output', sessionId: session.id, data: 'abc' })
    expect(notificationService.publish).not.toHaveBeenCalled()
  })

  it('coalesces cross-protocol notification fanout inside the same PTY output chunk', async () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit(
      'data',
      '\x1b]9;Permission requested\x07\x1b]777;notify;Claude Code;Permission requested\x07'
    )
    await waitForPtyOutputBatch()

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: session.id, title: 'Claude Code' },
      })
    )
  })

  it('keeps matching terminal notifications from separate PTY output chunks', async () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]9;Permission requested\x07')
    session.emit('data', '\x1b]9;Permission requested\x07')
    await waitForPtyOutputBatch()

    expect(notificationService.publish).toHaveBeenCalledTimes(2)
  })

  it('keeps matching terminal notifications from the same protocol in one PTY output chunk', async () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]9;Permission requested\x07\x1b]9;Permission requested\x07')
    await waitForPtyOutputBatch()

    expect(notificationService.publish).toHaveBeenCalledTimes(2)
  })

  it('emits terminal control metadata separately from notification publishing', async () => {
    const session = createMockPtySession({ title: 'Shell', command: 'bash' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]0;Claude Code\x07\x1b]7;file://host/tmp/project\x07\x1b]133;C\x07')
    await waitForPtyOutputBatch()

    const outputMessages = readMessages(ws)
    expect(outputMessages).toContainEqual({
      type: 'title',
      sessionId: session.id,
      title: 'Claude Code',
    })
    expect(outputMessages).toContainEqual({
      type: 'cwd',
      sessionId: session.id,
      cwd: process.platform === 'win32' ? '\\\\host\\tmp\\project' : '/tmp/project',
    })
    expect(outputMessages).toContainEqual({
      type: 'prompt-state',
      sessionId: session.id,
      state: 'command-start',
    })
    expect(notificationService.publish).not.toHaveBeenCalled()
  })

  it('publishes terminal notifications with the target title snapshot from the same moment', async () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]0;Claude Code\x07\x1b]9;Permission requested\x07')
    await waitForPtyOutputBatch()

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: session.id, title: 'Claude Code' },
      })
    )
  })

  it('keeps OSC tab title ahead of OSC window title for display and notification source', async () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit(
      'data',
      '\x1b]1;了解地铁建设相关\x07\x1b]2;2.1.114\x07\x1b]9;Permission requested\x07'
    )
    await waitForPtyOutputBatch()

    const titleMessages = readMessages(ws).filter((message) => message.type === 'title')
    expect(titleMessages.at(-1)).toMatchObject({
      type: 'title',
      sessionId: session.id,
      title: '了解地铁建设相关',
    })
    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: '了解地铁建设相关',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: session.id, title: '了解地铁建设相关' },
      })
    )
  })

  it('keeps the target title snapshot after a PTY websocket reconnect', async () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)
    const firstWs = await createMockWebSocket()

    handler(firstWs)
    firstWs.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]0;Claude Code\x07')
    await waitForPtyOutputBatch()
    firstWs.emit('close')

    const secondWs = await createMockWebSocket()
    handler(secondWs)
    secondWs.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]9;Permission requested\x07')
    await waitForPtyOutputBatch()

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: session.id, title: 'Claude Code' },
      })
    )
  })

  it('does not let process title overwrite the OSC target title snapshot', async () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = createManagerWithSession(session)
    const notificationService = createNotificationService()
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager, notificationService)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.emit('data', '\x1b]0;Claude Code\x07')
    await waitForPtyOutputBatch()
    session.setProcessTitle('zsh')
    session.emit('data', '\x1b]9;Permission requested\x07')
    await waitForPtyOutputBatch()

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: session.id, title: 'Claude Code' },
      })
    )
  })

  it('emits PTY process title metadata plus backend-resolved display title', async () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = createManagerWithSession(session)
    const ws = await createMockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager)

    handler(ws)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: session.id }))
    session.setProcessTitle('claude')

    const outputMessages = readMessages(ws)
    expect(outputMessages).toContainEqual({
      type: 'process-title',
      sessionId: session.id,
      title: 'zsh',
    })
    expect(outputMessages).toContainEqual({
      type: 'process-title',
      sessionId: session.id,
      title: 'claude',
    })
    expect(outputMessages).toContainEqual({
      type: 'title',
      sessionId: session.id,
      title: 'claude',
    })
  })
})
