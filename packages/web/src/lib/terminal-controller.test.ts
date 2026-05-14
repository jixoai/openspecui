import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class MockFitAddon {
  fit(): void {
    // noop
  }
}

class MockWebLinksAddon {}
class MockUrlRegexProvider {}

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
  protected customKeyEventHandler: ((event: KeyboardEvent) => boolean) | null = null
  disposed = false
  focusCalls = 0

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
    this.customKeyEventHandler = _handler
  }

  write(_data: string): void {
    // noop
  }

  focus(): void {
    this.focusCalls += 1
  }

  emitKeydown(
    key: string,
    code: string,
    options?: {
      altKey?: boolean
      ctrlKey?: boolean
      keyCode?: number
      metaKey?: boolean
      shiftKey?: boolean
    }
  ): void {
    const event = new KeyboardEvent('keydown', {
      key,
      code,
      altKey: options?.altKey ?? false,
      ctrlKey: options?.ctrlKey ?? false,
      metaKey: options?.metaKey ?? false,
      shiftKey: options?.shiftKey ?? false,
      bubbles: true,
    })
    Object.defineProperty(event, 'keyCode', { value: options?.keyCode ?? 0 })
    const allowNativeHandling = this.customKeyEventHandler?.(event) ?? true
    if (!allowNativeHandling) return
    const fallbackInput =
      key === 'ArrowLeft' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        ? '\x1bOD'
        : key === 'ArrowRight' &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey
          ? '\x1bOC'
          : null
    if (fallbackInput) {
      this.emitData(fallbackInput)
    }
  }

  dispose(): void {
    this.disposed = true
  }
}

class MockGhosttyTerminal extends MockTerminal {
  static instances: MockGhosttyTerminal[] = []
  linkProviders: unknown[] = []
  writes: string[] = []

  constructor(options: MockTerminalOptions) {
    super(options)
    MockGhosttyTerminal.instances.push(this)
  }

  static reset(): void {
    MockGhosttyTerminal.instances = []
  }

  registerLinkProvider(provider: unknown): void {
    if (!this.element) {
      throw new Error('Terminal must be opened before registering link providers')
    }
    this.linkProviders.push(provider)
  }

  override open(container: HTMLElement): void {
    // Simulate engines that treat the mount container itself as terminal.element.
    this.element = container
  }

  override write(data: string): void {
    if (!this.element) {
      throw new Error('Terminal must be opened before use. Call terminal.open(parent) first.')
    }
    this.writes.push(data)
  }

  override emitKeydown(
    key: string,
    code: string,
    options?: {
      altKey?: boolean
      ctrlKey?: boolean
      keyCode?: number
      metaKey?: boolean
      shiftKey?: boolean
    }
  ): void {
    const event = new KeyboardEvent('keydown', {
      key,
      code,
      altKey: options?.altKey ?? false,
      ctrlKey: options?.ctrlKey ?? false,
      metaKey: options?.metaKey ?? false,
      shiftKey: options?.shiftKey ?? false,
      bubbles: true,
    })
    Object.defineProperty(event, 'keyCode', { value: options?.keyCode ?? 0 })
    const consumed = this.customKeyEventHandler?.(event)
    if (consumed) return
    if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.emitData(key)
    }
  }
}

const ghosttyInitMock = vi.fn(async () => {})

class MockInputPanelAddon {
  static mountTarget: HTMLElement | null = null
  static instances: MockInputPanelAddon[] = []
  static active: MockInputPanelAddon | null = null
  static options: Array<{ showFab?: boolean }> = []

  private onInput: (data: string) => void
  private isOpen = false

  constructor(options: { onInput: (data: string) => void; showFab?: boolean }) {
    this.onInput = options.onInput
    MockInputPanelAddon.options.push({ showFab: options.showFab })
    MockInputPanelAddon.instances.push(this)
  }

  attachListeners(): void {
    // noop
  }

  setPlatform(_platform: 'windows' | 'macos' | 'common'): void {
    // noop
  }

  setDefaultLayout(_layout: 'fixed' | 'floating'): void {
    // noop
  }

  open(): void {
    if (this.isOpen) return
    MockInputPanelAddon.active?.close()
    this.isOpen = true
    MockInputPanelAddon.active = this
  }

  close(): void {
    this.isOpen = false
    if (MockInputPanelAddon.active === this) {
      MockInputPanelAddon.active = null
    }
  }

  syncFocusLifecycle(): void {
    if (MockInputPanelAddon.active && MockInputPanelAddon.active !== this) {
      this.open()
    }
  }

  emitInput(data: string): void {
    this.onInput(data)
  }

  static reset(): void {
    MockInputPanelAddon.mountTarget = null
    MockInputPanelAddon.instances = []
    MockInputPanelAddon.active = null
    MockInputPanelAddon.options = []
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

vi.mock('ghostty-web', () => ({
  init: ghosttyInitMock,
  Terminal: MockGhosttyTerminal,
  FitAddon: MockFitAddon,
  UrlRegexProvider: MockUrlRegexProvider,
}))

vi.mock('xterm-input-panel', () => ({
  InputPanelAddon: MockInputPanelAddon,
}))

const terminalBellPlayMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('./terminal-bell-sound-engine', () => ({
  TerminalBellSoundEngine: class {
    init(): void {
      // noop
    }

    play(sound: string, volume: number): Promise<void> {
      return terminalBellPlayMock(sound, volume)
    }
  },
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

class MockResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe(_target: Element): void {}
  disconnect(): void {}
}

function parseSent(ws: MockWebSocket): Array<Record<string, unknown>> {
  return ws.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>)
}

function getPtySockets(): MockWebSocket[] {
  return MockWebSocket.instances.filter((ws) => ws.url.includes('/ws/pty'))
}

function getPtySocket(index: number): MockWebSocket {
  const ws = getPtySockets()[index]
  expect(ws).toBeDefined()
  return ws as MockWebSocket
}

async function loadTerminalController() {
  vi.resetModules()
  const mod = await import('./terminal-controller')
  return mod.terminalController
}

describe('terminal-controller PTY behavior', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    vi.useFakeTimers()
    MockTerminal.reset()
    MockGhosttyTerminal.reset()
    MockInputPanelAddon.reset()
    MockWebSocket.reset()
    terminalBellPlayMock.mockClear()
    ghosttyInitMock.mockReset()
    ghosttyInitMock.mockResolvedValue(undefined)
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    vi.stubGlobal('ResizeObserver', MockResizeObserver as unknown as typeof ResizeObserver)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses hosted api base URL for PTY websocket connections', async () => {
    window.history.replaceState({}, '', '/dashboard?api=http://127.0.0.1:3102/&session=session-a')

    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)

    expect(ws.url).toBe('ws://127.0.0.1:3102/ws/pty')

    terminalController.closeAll()
    unsubscribe()
  })

  it('maps local requestId to server sessionId for PTY input', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-100', platform: 'common' })
    terminalController.writeToSession(localId, 'echo hi\n')

    const sent = parseSent(ws)
    expect(sent.some((msg) => msg.type === 'create' && msg.requestId === localId)).toBe(true)
    expect(sent.some((msg) => msg.type === 'input' && msg.sessionId === 'pty-100')).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('handles PTY bell as terminal-local sound and snapshot feedback', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-bell', platform: 'common' })
    ws.emitJson({ type: 'bell', sessionId: 'pty-bell', createdAt: 1234 })

    const session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.lastBellAt).toBe(1234)
    expect(terminalBellPlayMock).toHaveBeenCalledWith('builtin:Tink', 1)

    terminalController.closeAll()
    unsubscribe()
  })

  it('keeps process title and OSC title as separate terminal metadata', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession({ label: 'fallback' })
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-meta', platform: 'common' })
    ws.emitJson({ type: 'process-title', sessionId: 'pty-meta', title: 'zsh' })

    let session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.processTitle).toBe('zsh')
    expect(session?.oscTitle).toBeNull()
    expect(session?.displayTitle).toBe('zsh')

    ws.emitJson({ type: 'title', sessionId: 'pty-meta', title: 'Claude Code' })
    session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.processTitle).toBe('zsh')
    expect(session?.oscTitle).toBe('Claude Code')
    expect(session?.displayTitle).toBe('Claude Code')

    terminalController.setCustomTitle(localId, 'Pinned title')
    session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.displayTitle).toBe('Pinned title')

    terminalController.closeAll()
    unsubscribe()
  })

  it('uses backend-resolved OSC display title without letting window title override tab title', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession({ label: 'fallback' })
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-meta', platform: 'common' })
    ws.emitJson({ type: 'process-title', sessionId: 'pty-meta', title: 'zsh' })
    ws.emitJson({
      type: 'title',
      sessionId: 'pty-meta',
      title: '了解地铁建设相关',
    })

    const session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.processTitle).toBe('zsh')
    expect(session?.oscTitle).toBe('了解地铁建设相关')
    expect(session?.displayTitle).toBe('了解地铁建设相关')

    terminalController.closeAll()
    unsubscribe()
  })

  it('stores terminal control metadata from PTY messages', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({
      type: 'created',
      requestId: localId,
      sessionId: 'pty-controls',
      platform: 'common',
    })
    ws.emitJson({ type: 'cwd', sessionId: 'pty-controls', cwd: '/tmp/project' })
    ws.emitJson({
      type: 'progress',
      sessionId: 'pty-controls',
      state: 'indeterminate',
      value: null,
    })
    ws.emitJson({
      type: 'prompt-state',
      sessionId: 'pty-controls',
      state: 'command-start',
    })

    let session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.cwd).toBe('/tmp/project')
    expect(session?.progress).toEqual({ state: 'indeterminate', value: null })
    expect(session?.promptState).toBe('command-start')

    ws.emitJson({ type: 'progress', sessionId: 'pty-controls', state: 'clear', value: null })
    session = terminalController.getSnapshot().sessions.find((item) => item.id === localId)
    expect(session?.progress).toBeNull()

    terminalController.closeAll()
    unsubscribe()
  })

  it('flushes explicit close after reconnect when close happens offline', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws1 = getPtySocket(0)
    ws1.emitOpen()

    const localId = terminalController.createSession()
    ws1.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-200', platform: 'common' })

    ws1.close()
    terminalController.closeSession(localId)

    vi.advanceTimersByTime(1000)
    const ws2 = getPtySocket(1)
    ws2.emitOpen()

    const sent2 = parseSent(ws2)
    expect(sent2.some((msg) => msg.type === 'close' && msg.sessionId === 'pty-200')).toBe(true)

    unsubscribe()
  })

  it('re-attaches existing session on reconnect after list discovery', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws1 = getPtySocket(0)
    ws1.emitOpen()

    const localId = terminalController.createSession()
    ws1.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-300', platform: 'common' })

    ws1.close()
    vi.advanceTimersByTime(1000)
    const ws2 = getPtySocket(1)
    ws2.emitOpen()
    ws2.emitJson({
      type: 'list',
      sessions: [
        {
          id: 'pty-300',
          title: 'bash',
          command: '/bin/bash',
          args: [],
          platform: 'common',
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
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-400', platform: 'common' })
    ws.emitJson({ type: 'exit', sessionId: 'pty-400', exitCode: 0 })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal!.emitData('x')

    const sent = parseSent(ws)
    expect(sent.some((msg) => msg.type === 'close' && msg.sessionId === 'pty-400')).toBe(true)
    expect(terminalController.getSnapshot().sessions.some((s) => s.id === localId)).toBe(false)

    unsubscribe()
  })

  it('runs internal close callback for exited session', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession({
      closeCallbackUrl: { '0': '/changes/add-search' },
    })
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-500', platform: 'common' })
    ws.emitJson({ type: 'exit', sessionId: 'pty-500', exitCode: 0 })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal!.emitData('x')

    expect(window.location.pathname).toBe('/changes/add-search')
    unsubscribe()
  })

  it('runs external close callback in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession({
      closeCallbackUrl: 'https://example.com/result',
    })
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-600', platform: 'common' })
    ws.emitJson({ type: 'exit', sessionId: 'pty-600', exitCode: 1 })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal!.emitData('x')

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/result',
      '_blank',
      'noopener,noreferrer'
    )
    openSpy.mockRestore()
    unsubscribe()
  })

  it('switches renderer engine and rebuilds terminal instances', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-700', platform: 'common' })

    const beforeCount = MockTerminal.instances.length
    const firstInstance = MockTerminal.instances[0]
    expect(firstInstance).toBeDefined()

    await terminalController.setRendererEngine('ghostty')

    expect(ghosttyInitMock).toHaveBeenCalled()
    expect(MockTerminal.instances.length).toBeGreaterThan(beforeCount)
    expect(firstInstance?.disposed).toBe(true)
    expect(terminalController.getConfig().rendererEngine).toBe('ghostty')

    terminalController.closeAll()
    unsubscribe()
  })

  it('uses default terminal theme palette for new xterm sessions', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    terminalController.createSession()

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    expect(terminal?.options.allowTransparency).toBe(false)
    expect(terminal?.options.theme).toEqual(
      expect.objectContaining({
        background: '#f6f5f2',
        foreground: '#1b1b1b',
      })
    )

    terminalController.closeAll()
    unsubscribe()
  })

  it('re-resolves palette when theme context changes in app mode', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    terminalController.createSession()
    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()

    terminalController.setThemeContext({ appDarkMode: false, systemDarkMode: true })
    expect(terminal?.options.theme).toEqual(
      expect.objectContaining({
        background: '#f6f5f2',
        foreground: '#1b1b1b',
      })
    )

    terminalController.setThemeContext({ appDarkMode: true, systemDarkMode: false })
    expect(terminal?.options.theme).toEqual(
      expect.objectContaining({
        background: '#141414',
        foreground: '#e5dfd2',
      })
    )

    terminalController.closeAll()
    unsubscribe()
  })

  it('prefers system color scheme when terminal useTheme is system', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    terminalController.createSession()
    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()

    terminalController.applyConfig({
      useTheme: 'system',
      lightTheme: 'solarized-light',
      darkTheme: 'solarized-dark',
    })
    terminalController.setThemeContext({ appDarkMode: false, systemDarkMode: false })
    expect(terminal?.options.theme).toEqual(
      expect.objectContaining({
        background: '#fdf6e3',
        foreground: '#586e75',
      })
    )

    terminalController.setThemeContext({ appDarkMode: false, systemDarkMode: true })
    expect(terminal?.options.theme).toEqual(
      expect.objectContaining({
        background: '#002b36',
        foreground: '#93a1a1',
      })
    )

    terminalController.closeAll()
    unsubscribe()
  })

  it('registers ghostty link provider after terminal open', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-710', platform: 'common' })

    const container = document.createElement('div')
    terminalController.mount(localId, container)

    await expect(terminalController.setRendererEngine('ghostty')).resolves.toBeUndefined()

    const ghostty = MockGhosttyTerminal.instances.at(-1)
    expect(ghostty).toBeDefined()
    expect(ghostty?.element).not.toBeNull()
    expect(ghostty?.linkProviders.length).toBe(1)

    terminalController.closeAll()
    unsubscribe()
  })

  it('does not throw on remount when terminal element contains next container', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-711', platform: 'common' })

    const containerA = document.createElement('div')
    terminalController.mount(localId, containerA)
    await terminalController.setRendererEngine('ghostty')

    terminalController.unmount(localId)
    const containerB = document.createElement('div')
    containerA.appendChild(containerB)

    expect(() => terminalController.mount(localId, containerB)).not.toThrow()

    terminalController.closeAll()
    unsubscribe()
  })

  it('buffers server output before mount and flushes after mount in ghostty mode', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-712', platform: 'common' })
    await terminalController.setRendererEngine('ghostty')

    expect(() =>
      ws.emitJson({ type: 'buffer', sessionId: 'pty-712', data: 'hello-buffer' })
    ).not.toThrow()

    const ghostty = MockGhosttyTerminal.instances.at(-1)
    expect(ghostty).toBeDefined()
    expect(ghostty?.writes).toHaveLength(0)

    const container = document.createElement('div')
    terminalController.mount(localId, container)

    expect(ghostty?.writes.join('')).toContain('hello-buffer')

    terminalController.closeAll()
    unsubscribe()
  })

  it('focuses ghostty terminal when mounted', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-713', platform: 'common' })
    await terminalController.setRendererEngine('ghostty')

    const container = document.createElement('div')
    terminalController.mount(localId, container)
    vi.runAllTimers()

    const ghostty = MockGhosttyTerminal.instances.at(-1)
    expect(ghostty).toBeDefined()
    expect(ghostty?.focusCalls).toBeGreaterThan(0)

    terminalController.closeAll()
    unsubscribe()
  })

  it('keeps resolved terminal theme background for ghostty renderer', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-715', platform: 'common' })
    terminalController.setThemeContext({ appDarkMode: true, systemDarkMode: false })
    await terminalController.setRendererEngine('ghostty')

    const wrapper = document.createElement('div')
    wrapper.style.backgroundColor = 'rgb(12, 34, 56)'
    const container = document.createElement('div')
    wrapper.appendChild(container)
    terminalController.mount(localId, container)

    const ghostty = MockGhosttyTerminal.instances.at(-1)
    expect(ghostty).toBeDefined()
    expect(ghostty?.options.allowTransparency).toBe(false)
    expect(ghostty?.options.theme).toEqual(
      expect.objectContaining({
        background: '#141414',
      })
    )

    terminalController.closeAll()
    unsubscribe()
  })

  it('exposes the resolved terminal theme for shell consumers', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    terminalController.applyConfig({
      useTheme: 'light',
      lightTheme: 'solarized-light',
      darkTheme: 'monokai',
    })

    expect(terminalController.getResolvedTheme().definition.palette.background).toBe('#fdf6e3')
    expect(terminalController.getResolvedTheme().definition.palette.foreground).toBe('#586e75')

    terminalController.applyConfig({ useTheme: 'dark' })

    expect(terminalController.getResolvedTheme().definition.palette.background).toBe('#272822')
    expect(terminalController.getResolvedTheme().definition.palette.foreground).toBe('#f8f8f2')

    terminalController.closeAll()
    unsubscribe()
  })

  it('allows regular key input in ghostty mode', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-714', platform: 'common' })
    await terminalController.setRendererEngine('ghostty')

    const container = document.createElement('div')
    terminalController.mount(localId, container)

    const ghostty = MockGhosttyTerminal.instances.at(-1)
    expect(ghostty).toBeDefined()
    ghostty?.emitKeydown('a', 'KeyA')

    const sent = parseSent(ws)
    expect(
      sent.some((msg) => msg.type === 'input' && msg.sessionId === 'pty-714' && msg.data === 'a')
    ).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('lets xterm handle plain left/right arrows while normalizing up/down fallbacks', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-716', platform: 'macos' })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal?.emitKeydown('ArrowUp', 'ArrowUp', { keyCode: 38 })
    terminal?.emitKeydown('ArrowDown', 'ArrowDown', { keyCode: 40 })
    terminal?.emitKeydown('ArrowLeft', 'ArrowLeft', { keyCode: 37 })
    terminal?.emitKeydown('ArrowRight', 'ArrowRight', { keyCode: 39 })

    const sent = parseSent(ws)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-716' && msg.data === '\x1b[A'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-716' && msg.data === '\x1b[B'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-716' && msg.data === '\x1b[D'
      )
    ).toBe(false)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-716' && msg.data === '\x1b[C'
      )
    ).toBe(false)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-716' && msg.data === '\x1bOD'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-716' && msg.data === '\x1bOC'
      )
    ).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('lets xterm handle keycode-less browser left/right arrows', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-717', platform: 'macos' })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal?.emitKeydown('ArrowLeft', 'ArrowLeft', { keyCode: 0 })
    terminal?.emitKeydown('ArrowRight', 'ArrowRight', { keyCode: 0 })

    const sent = parseSent(ws)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-717' && msg.data === '\x1b[D'
      )
    ).toBe(false)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-717' && msg.data === '\x1b[C'
      )
    ).toBe(false)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-717' && msg.data === '\x1bOD'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-717' && msg.data === '\x1bOC'
      )
    ).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('maps macOS Option+arrow to terminal navigation sequences', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-718', platform: 'macos' })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal?.emitKeydown('ArrowUp', 'ArrowUp', { altKey: true, keyCode: 38 })
    terminal?.emitKeydown('ArrowDown', 'ArrowDown', { altKey: true, keyCode: 40 })
    terminal?.emitKeydown('ArrowLeft', 'ArrowLeft', { altKey: true, keyCode: 37 })
    terminal?.emitKeydown('ArrowRight', 'ArrowRight', { altKey: true, keyCode: 39 })

    const sent = parseSent(ws)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-718' && msg.data === '\x1b[1;3A'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-718' && msg.data === '\x1b[1;3B'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-718' && msg.data === '\x1bb'
      )
    ).toBe(true)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-718' && msg.data === '\x1bf'
      )
    ).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('maps macOS Command+arrow to shell line-boundary sequences', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: localId, sessionId: 'pty-719', platform: 'macos' })

    const terminal = MockTerminal.instances.at(-1)
    expect(terminal).toBeDefined()
    terminal?.emitKeydown('ArrowUp', 'ArrowUp', { metaKey: true, keyCode: 38 })
    terminal?.emitKeydown('ArrowDown', 'ArrowDown', { metaKey: true, keyCode: 40 })
    terminal?.emitKeydown('ArrowLeft', 'ArrowLeft', { metaKey: true, keyCode: 37 })
    terminal?.emitKeydown('ArrowRight', 'ArrowRight', { metaKey: true, keyCode: 39 })

    const sent = parseSent(ws)
    const lineBoundaryInputs = sent.flatMap((msg) =>
      msg.type === 'input' && msg.sessionId === 'pty-719' ? [msg.data] : []
    )
    expect(lineBoundaryInputs).toEqual(['\x01', '\x05', '\x01', '\x05'])
    expect(
      sent.some((msg) => msg.type === 'input' && msg.sessionId === 'pty-719' && msg.data === '\x01')
    ).toBe(true)
    expect(
      sent.some((msg) => msg.type === 'input' && msg.sessionId === 'pty-719' && msg.data === '\x05')
    ).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('migrates input panel active target when focus switches to another session', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const firstId = terminalController.createSession()
    const secondId = terminalController.createSession()
    ws.emitJson({ type: 'created', requestId: firstId, sessionId: 'pty-801', platform: 'common' })
    ws.emitJson({ type: 'created', requestId: secondId, sessionId: 'pty-802', platform: 'common' })

    terminalController.mount(firstId, document.createElement('div'))
    terminalController.mount(secondId, document.createElement('div'))

    const firstAddon = MockInputPanelAddon.instances[0]
    const secondAddon = MockInputPanelAddon.instances[1]
    expect(firstAddon).toBeDefined()
    expect(secondAddon).toBeDefined()

    firstAddon?.open()
    expect(MockInputPanelAddon.active).toBe(firstAddon)

    terminalController.focusSession(secondId)
    expect(MockInputPanelAddon.active).toBe(secondAddon)

    MockInputPanelAddon.active?.emitInput('echo switch\n')

    const sent = parseSent(ws)
    expect(
      sent.some(
        (msg) => msg.type === 'input' && msg.sessionId === 'pty-802' && msg.data === 'echo switch\n'
      )
    ).toBe(true)

    terminalController.closeAll()
    unsubscribe()
  })

  it('disables native input panel FAB because web uses toolbar entry', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    terminalController.createSession()

    expect(MockInputPanelAddon.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ showFab: false })])
    )

    terminalController.closeAll()
    unsubscribe()
  })

  it('publishes activation requests for existing server sessions', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const activationListener = vi.fn()
    const unsubscribeActivation = terminalController.subscribeActivation(activationListener)
    const ws = getPtySocket(0)
    ws.emitOpen()

    const localId = terminalController.createSession()
    ws.emitJson({
      type: 'created',
      requestId: localId,
      sessionId: 'pty-900',
      platform: 'common',
    })

    expect(terminalController.requestActivateServerSession('pty-900')).toBe(true)
    expect(activationListener).toHaveBeenCalledWith(localId)

    expect(terminalController.requestActivateServerSession('missing-pty')).toBe(false)
    expect(activationListener).toHaveBeenCalledTimes(1)

    unsubscribeActivation()
    terminalController.closeAll()
    unsubscribe()
  })

  it('tracks the active terminal session for visibility queries', async () => {
    const terminalController = await loadTerminalController()
    const unsubscribe = terminalController.subscribe(() => {})
    const ws = getPtySocket(0)
    ws.emitOpen()

    const firstLocalId = terminalController.createSession()
    const secondLocalId = terminalController.createSession()
    ws.emitJson({
      type: 'created',
      requestId: firstLocalId,
      sessionId: 'pty-active-1',
      platform: 'common',
    })
    ws.emitJson({
      type: 'created',
      requestId: secondLocalId,
      sessionId: 'pty-active-2',
      platform: 'common',
    })

    terminalController.setActiveSessionId(firstLocalId)
    expect(terminalController.isSessionActive(firstLocalId)).toBe(true)
    expect(terminalController.isSessionActive(secondLocalId)).toBe(false)

    expect(terminalController.requestActivateServerSession('pty-active-2')).toBe(true)
    expect(terminalController.isSessionActive(secondLocalId)).toBe(true)

    terminalController.closeSession(secondLocalId)
    expect(terminalController.isSessionActive(secondLocalId)).toBe(false)

    terminalController.closeAll()
    unsubscribe()
  })

  it('keeps current engine when ghostty initialization fails', async () => {
    ghosttyInitMock.mockRejectedValueOnce(new Error('ghostty init failed'))
    const terminalController = await loadTerminalController()

    await expect(terminalController.setRendererEngine('ghostty')).rejects.toThrow(
      'ghostty init failed'
    )
    expect(terminalController.getConfig().rendererEngine).toBe('xterm')
  })
})
