import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class MockFitAddon {
  fit(): void {
    // noop
  }
}

class MockWebLinksAddon {}

interface MockTerminalOptions {
  [key: string]: unknown
}

class MockTerminal {
  static instances: MockTerminal[] = []

  cols = 80
  rows = 24
  element: HTMLElement | null = null
  options: MockTerminalOptions
  private onDataListeners: Array<(data: string) => void> = []

  constructor(options: MockTerminalOptions) {
    this.options = options
    MockTerminal.instances.push(this)
  }

  static reset(): void {
    MockTerminal.instances = []
  }

  loadAddon(_addon: unknown): void {
    // noop
  }

  onData(listener: (data: string) => void): void {
    this.onDataListeners.push(listener)
  }

  emitData(data: string): void {
    for (const listener of this.onDataListeners) {
      listener(data)
    }
  }

  open(container: HTMLElement): void {
    const el = document.createElement('div')
    this.element = el
    container.appendChild(el)
  }

  attachCustomKeyEventHandler(_handler: (event: KeyboardEvent) => boolean): void {
    // noop
  }

  write(_data: string): void {
    // noop
  }

  dispose(): void {
    // noop
  }
}

class MockInputPanelAddon {
  static mountTarget: HTMLElement | null = null

  constructor(_options: { onInput: (data: string) => void }) {
    // noop
  }

  attachListeners(): void {
    // noop
  }
}

vi.mock('@xterm/xterm', () => ({
  Terminal: MockTerminal,
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: MockFitAddon,
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: MockWebLinksAddon,
}))

vi.mock('xterm-input-panel', () => ({
  InputPanelAddon: MockInputPanelAddon,
}))

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  sent: string[] = []

  constructor(url: string | URL) {
    this.url = String(url)
    MockWebSocket.instances.push(this)
  }

  static reset(): void {
    MockWebSocket.instances = []
  }

  send(data: string): void {
    this.sent.push(String(data))
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  emitJson(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>)
  }
}

function parseSent(ws: MockWebSocket): Array<Record<string, unknown>> {
  return ws.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>)
}

async function loadTerminalController() {
  vi.resetModules()
  const mod = await import('./terminal-controller')
  return mod.terminalController
}

describe('terminal-controller PTY behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockTerminal.reset()
    MockWebSocket.reset()
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('maps local requestId to server sessionId for PTY input', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = MockWebSocket.instances[0]
    expect(ws).toBeDefined()
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-100' })
    terminalController.writeToSession(localId, 'echo hi\n')

    const sent = parseSent(ws)
    expect(sent.some((msg) => msg.type === 'create' && msg.requestId === localId)).toBe(true)
    expect(sent.some((msg) => msg.type === 'input' && msg.sessionId === 'pty-100')).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('flushes explicit close after reconnect when close happens offline', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws1 = MockWebSocket.instances[0]
    ws1.emitOpen()

    const localId = terminalController.createSession()
    ws1.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-200' })

    ws1.close()
    terminalController.closeSession(localId)

    vi.advanceTimersByTime(1000)
    const ws2 = MockWebSocket.instances[1]
    expect(ws2).toBeDefined()
    ws2.emitOpen()

    const sent2 = parseSent(ws2)
    expect(sent2.some((msg) => msg.type === 'close' && msg.sessionId === 'pty-200')).toBe(true)

    unsubscribe()
  })

  it('re-attaches existing session on reconnect after list discovery', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws1 = MockWebSocket.instances[0]
    ws1.emitOpen()

    const localId = terminalController.createSession()
    ws1.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-300' })

    ws1.close()
    vi.advanceTimersByTime(1000)
    const ws2 = MockWebSocket.instances[1]
    ws2.emitOpen()
    ws2.emitJson({
      type: 'list',
      sessions: [
        {
          id: 'pty-300',
          title: 'bash',
          command: '/bin/bash',
          args: [],
          isExited: false,
          exitCode: null,
        },
      ],
    })

    const sent2 = parseSent(ws2)
    expect(sent2.some((msg) => msg.type === 'attach' && msg.sessionId === 'pty-300')).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('closes exited session when user presses any key', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = MockWebSocket.instances[0]
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-400' })
    ws.emitJson({ type: 'exit', sessionId: 'pty-400', exitCode: 0 })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal!.emitData('x')

    const sent = parseSent(ws)
    expect(sent.some((msg) => msg.type === 'close' && msg.sessionId === 'pty-400')).toBe(true)
    expect(terminalController.getSnapshot().sessions.some((s) => s.id === localId)).toBe(false)

    unsubscribe()
  })
})
