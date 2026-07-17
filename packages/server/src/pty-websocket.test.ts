/**
 * Orthogonal intents (created 2026-07-17 Asia/Shanghai):
 * 1. Prove PTY creation reports failures and preserves backend-resolved session facts.
 * 2. Prove launch-project and Planning-root cwd targets are resolved only by the Server.
 * 3. Prove terminal control sequences preserve output while driving bounded notification fanout.
 * 4. Prove OSC and process-title precedence remains stable across updates.
 * 5. Prove reconnect retains the terminal target-title snapshot and session identity.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 */
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createPtyWebSocketHandler as createPtyWebSocketHandlerBase } from './pty-websocket.js'

function createPtyWebSocketHandler(
  ptyManager: Parameters<typeof createPtyWebSocketHandlerBase>[0],
  notificationService?: Parameters<typeof createPtyWebSocketHandlerBase>[1]
) {
  return createPtyWebSocketHandlerBase(ptyManager, notificationService, {
    withCwdTarget: async (cwdTarget, task) =>
      task({
        cwdTarget,
        cwd: cwdTarget === 'planning-root' ? '/planning' : '/launch',
      }),
  })
}

class MockWebSocket extends EventEmitter {
  readonly OPEN = 1
  readyState = 1
  readonly sent: string[] = []

  send(payload: string): void {
    this.sent.push(payload)
  }
}

function createMockPtySession(opts: { id?: string; title?: string; command?: string } = {}) {
  let oscIconTitle = ''
  let oscWindowTitle = ''
  const session = new EventEmitter() as EventEmitter & {
    id: string
    title: string
    targetTitle: string
    command: string
    args: string[]
    platform: string
    isExited: boolean
    exitCode: number | null
    cwdTarget: 'launch-project' | 'planning-root'
    initialCwd: string
    resize: ReturnType<typeof vi.fn>
    getBuffer: () => string
    oscTitle: string
    setTargetTitle: (title: string, target: 'icon' | 'window' | 'both') => void
  }
  session.id = opts.id ?? 'pty-1'
  session.title = opts.title ?? opts.command ?? 'Shell'
  session.targetTitle = session.title || opts.command || 'Shell'
  session.oscTitle = ''
  session.command = opts.command ?? 'bash'
  session.args = []
  session.platform = 'common'
  session.isExited = false
  session.exitCode = null
  session.cwdTarget = 'launch-project'
  session.initialCwd = '/launch'
  session.resize = vi.fn()
  session.getBuffer = () => ''
  session.setTargetTitle = (title: string, target: 'icon' | 'window' | 'both') => {
    const trimmed = title.trim()
    if (!trimmed) return
    if (target === 'icon' || target === 'both') {
      oscIconTitle = trimmed
    }
    if (target === 'window' || target === 'both') {
      oscWindowTitle = trimmed
    }
    session.oscTitle = oscIconTitle || oscWindowTitle
    session.targetTitle = session.oscTitle || session.title || session.command
  }
  return session
}

describe('createPtyWebSocketHandler', () => {
  it('returns PTY_CREATE_FAILED when session creation throws', async () => {
    const ptyManager = {
      create: vi.fn(() => {
        throw new Error('File not found')
      }),
    }

    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never)

    handler(ws as never)
    ws.emit(
      'message',
      JSON.stringify({
        type: 'create',
        requestId: 'term-1',
        cwdTarget: 'launch-project',
      })
    )

    await vi.waitFor(() => expect(ws.sent.length).toBe(1))
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'term-1',
      message: 'File not found',
    })
  })

  it('resolves launch and planning cwd targets before PTY creation', async () => {
    const session = createMockPtySession()
    const create = vi.fn(
      (input: { cwdTarget: 'launch-project' | 'planning-root'; cwd: string }) => {
        session.cwdTarget = input.cwdTarget
        session.initialCwd = input.cwd
        return session
      }
    )
    const withCwdTarget = vi.fn(
      async <T>(
        cwdTarget: 'launch-project' | 'planning-root',
        task: (cwd: { cwdTarget: 'launch-project' | 'planning-root'; cwd: string }) => T
      ) =>
        task({
          cwdTarget,
          cwd: cwdTarget === 'planning-root' ? '/planning' : '/launch',
        })
    )
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandlerBase({ create } as never, undefined, {
      withCwdTarget,
    })

    handler(ws as never)
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
        expect.objectContaining({
          cwdTarget: 'planning-root',
          cwd: '/planning',
        })
      )
    })
    expect(withCwdTarget).toHaveBeenCalledWith('planning-root', expect.any(Function))
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      type: 'created',
      requestId: 'term-planning',
      cwdTarget: 'planning-root',
      initialCwd: '/planning',
    })
  })

  it('rejects planning-root creation when current Root Context cannot resolve it', async () => {
    const create = vi.fn()
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandlerBase({ create } as never, undefined, {
      withCwdTarget: vi.fn(async () => {
        throw new Error('Planning root cwd is unavailable.')
      }),
    })

    handler(ws as never)
    ws.emit(
      'message',
      JSON.stringify({
        type: 'create',
        requestId: 'term-planning-unavailable',
        cwdTarget: 'planning-root',
      })
    )

    await vi.waitFor(() => expect(ws.sent.length).toBe(1))
    expect(create).not.toHaveBeenCalled()
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'term-planning-unavailable',
      message: 'Planning root cwd is unavailable.',
    })
  })

  it('emits terminal bell locally and publishes OSC notifications while preserving output', () => {
    const session = createMockPtySession({ title: 'Shell', command: 'bash' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit(
      'message',
      JSON.stringify({
        type: 'attach',
        sessionId: 'pty-1',
      })
    )
    session.emit('data', 'a\x07b\x1b]9;Done\x07c')

    const outputMessages = ws.sent.map((payload) => JSON.parse(payload))
    expect(outputMessages).toContainEqual({
      type: 'bell',
      sessionId: 'pty-1',
      createdAt: expect.any(Number),
    })
    expect(outputMessages).toContainEqual({ type: 'output', sessionId: 'pty-1', data: 'abc' })
    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Shell',
        body: 'Done',
        source: { type: 'terminal', sessionId: 'pty-1', title: 'Shell' },
      })
    )
  })

  it('emits progress controls without publishing bogus OSC 9;4 notifications', () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', 'a\x1b]9;4;3;\x07b\x1b]9;4;0;\x07c')

    const outputMessages = ws.sent.map((payload) => JSON.parse(payload))
    expect(outputMessages).toContainEqual({
      type: 'progress',
      sessionId: 'pty-1',
      state: 'indeterminate',
      value: null,
    })
    expect(outputMessages).toContainEqual({
      type: 'progress',
      sessionId: 'pty-1',
      state: 'clear',
      value: null,
    })
    expect(outputMessages).toContainEqual({ type: 'output', sessionId: 'pty-1', data: 'abc' })
    expect(notificationService.publish).not.toHaveBeenCalled()
  })

  it('coalesces cross-protocol notification fanout inside the same PTY output chunk', () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit(
      'data',
      '\x1b]9;Permission requested\x07\x1b]777;notify;Claude Code;Permission requested\x07'
    )

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: 'pty-1', title: 'Claude Code' },
      })
    )
  })

  it('keeps matching terminal notifications from separate PTY output chunks', () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]9;Permission requested\x07')
    session.emit('data', '\x1b]9;Permission requested\x07')

    expect(notificationService.publish).toHaveBeenCalledTimes(2)
  })

  it('keeps matching terminal notifications from the same protocol in one PTY output chunk', () => {
    const session = createMockPtySession({ title: 'Claude Code', command: 'claude' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]9;Permission requested\x07\x1b]9;Permission requested\x07')

    expect(notificationService.publish).toHaveBeenCalledTimes(2)
  })

  it('emits terminal control metadata separately from notification publishing', () => {
    const session = createMockPtySession({ title: 'Shell', command: 'bash' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]0;Claude Code\x07\x1b]7;file://host/tmp/project\x07\x1b]133;C\x07')

    const outputMessages = ws.sent.map((payload) => JSON.parse(payload))
    expect(outputMessages).toContainEqual({
      type: 'title',
      sessionId: 'pty-1',
      title: 'Claude Code',
    })
    expect(outputMessages).toContainEqual({ type: 'cwd', sessionId: 'pty-1', cwd: '/tmp/project' })
    expect(outputMessages).toContainEqual({
      type: 'prompt-state',
      sessionId: 'pty-1',
      state: 'command-start',
    })
    expect(notificationService.publish).not.toHaveBeenCalled()
  })

  it('publishes terminal notifications with the target title snapshot from the same moment', () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]0;Claude Code\x07\x1b]9;Permission requested\x07')

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: 'pty-1', title: 'Claude Code' },
      })
    )
  })

  it('keeps OSC tab title ahead of OSC window title for display and notification source', () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit(
      'data',
      '\x1b]1;了解地铁建设相关\x07\x1b]2;2.1.114\x07\x1b]9;Permission requested\x07'
    )

    const titleMessages = ws.sent
      .map((payload) => JSON.parse(payload))
      .filter((message) => message.type === 'title')
    expect(titleMessages.at(-1)).toMatchObject({
      type: 'title',
      sessionId: 'pty-1',
      title: '了解地铁建设相关',
    })
    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: '了解地铁建设相关',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: 'pty-1', title: '了解地铁建设相关' },
      })
    )
  })

  it('keeps the target title snapshot after a PTY websocket reconnect', () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)
    const firstWs = new MockWebSocket()

    handler(firstWs as never)
    firstWs.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]0;Claude Code\x07')
    firstWs.emit('close')

    const secondWs = new MockWebSocket()
    handler(secondWs as never)
    secondWs.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]9;Permission requested\x07')

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: 'pty-1', title: 'Claude Code' },
      })
    )
  })

  it('does not let process title overwrite the OSC target title snapshot', () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const notificationService = {
      publish: vi.fn(),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never, notificationService as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('data', '\x1b]0;Claude Code\x07')
    session.emit('title', 'zsh')
    session.emit('data', '\x1b]9;Permission requested\x07')

    expect(notificationService.publish).toHaveBeenCalledTimes(1)
    expect(notificationService.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Claude Code',
        body: 'Permission requested',
        source: { type: 'terminal', sessionId: 'pty-1', title: 'Claude Code' },
      })
    )
  })

  it('emits PTY process title metadata plus backend-resolved display title', () => {
    const session = createMockPtySession({ title: 'zsh', command: 'zsh' })
    const ptyManager = {
      get: vi.fn(() => session),
    }
    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never)

    handler(ws as never)
    ws.emit('message', JSON.stringify({ type: 'attach', sessionId: 'pty-1' }))
    session.emit('title', 'claude')

    const outputMessages = ws.sent.map((payload) => JSON.parse(payload))
    expect(outputMessages).toContainEqual({
      type: 'process-title',
      sessionId: 'pty-1',
      title: 'zsh',
    })
    expect(outputMessages).toContainEqual({
      type: 'process-title',
      sessionId: 'pty-1',
      title: 'claude',
    })
    session.title = 'claude'
    session.targetTitle = 'claude'
    session.emit('title', 'claude')

    const updatedOutputMessages = ws.sent.map((payload) => JSON.parse(payload))
    expect(updatedOutputMessages).toContainEqual({
      type: 'process-title',
      sessionId: 'pty-1',
      title: 'claude',
    })
    expect(updatedOutputMessages).toContainEqual({
      type: 'title',
      sessionId: 'pty-1',
      title: 'claude',
    })
  })
})
