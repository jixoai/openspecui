import {
  PtyServerMessageSchema,
  type PtyClientMessage,
  type PtyPlatform,
  type PtyServerMessage,
} from '@openspecui/core/pty-protocol'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import {
  InputPanelAddon,
  type InputPanelLayout,
  type InputPanelSettingsPayload,
} from 'xterm-input-panel'
import { navController } from './nav-controller'
import { TerminalInputHistoryStore } from './terminal-input-history'

// --- Types ---

export const TERMINAL_RENDERER_ENGINES = ['xterm', 'ghostty'] as const
export type TerminalRendererEngine = (typeof TERMINAL_RENDERER_ENGINES)[number]

export function isTerminalRendererEngine(value: string): value is TerminalRendererEngine {
  return (TERMINAL_RENDERER_ENGINES as readonly string[]).includes(value)
}

export interface TerminalConfig {
  fontSize: number
  fontFamily: string
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
  scrollback: number
  rendererEngine: TerminalRendererEngine
}

type TerminalLike = {
  cols: number
  rows: number
  element: HTMLElement | null
  options: {
    fontSize?: number
    fontFamily?: string
    cursorBlink?: boolean
    cursorStyle?: 'block' | 'underline' | 'bar'
    scrollback?: number
    allowTransparency?: boolean
    theme?: {
      background?: string
    }
  }
  onData: (listener: (data: string) => void) => void
  loadAddon: (addon: unknown) => void
  open: (container: HTMLElement) => void
  focus?: () => void
  attachCustomKeyEventHandler: (handler: (event: KeyboardEvent) => boolean) => void
  write: (data: string) => void
  dispose: () => void
}

type FitAddonLike = {
  fit: () => void
}

type GhosttyModule = typeof import('ghostty-web')
type GhosttyTerminalLike = TerminalLike & {
  registerLinkProvider?: (provider: unknown) => void
}

const DEFAULT_FONT_FAMILY = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  fontSize: 13,
  fontFamily: '',
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 1000,
  rendererEngine: 'xterm',
}

const OUTPUT_IDLE_THRESHOLD = 1500
const RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 10000
const DEFAULT_PTY_PLATFORM: PtyPlatform = 'common'
const MAX_PREOPEN_OUTPUT_BYTES = 512 * 1024

const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 32
const FONT_SIZE_DEFAULT = 13
const CONFIG_PERSIST_DEBOUNCE = 800

export const GOOGLE_FONT_PRESETS = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Inconsolata',
  'Roboto Mono',
  'Ubuntu Mono',
  'Space Mono',
]

// --- Font loading helpers ---

/** Already-injected font sources, used for deduplication */
const loadedFontSources = new Set<string>()

/** Extract a font name from a URL pathname (strip extension, replace dashes with spaces) */
function extractFontName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop() ?? ''
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'CustomFont'
  } catch {
    return 'CustomFont'
  }
}

/**
 * Load a font source.
 * - Plain font name → return as-is
 * - URL (text/css) → inject <link> → return '' (font name defined in CSS)
 * - URL (font/*) → inject @font-face → return extracted font-family name
 */
async function loadFontSource(source: string): Promise<string> {
  const trimmed = source.trim()
  if (!trimmed) return ''

  // Not a URL → plain font name
  if (!/^https?:\/\//i.test(trimmed)) return trimmed

  // Already loaded → skip injection but still return name
  if (loadedFontSources.has(trimmed)) {
    return extractFontName(trimmed)
  }

  try {
    const resp = await fetch(trimmed, { method: 'HEAD' })
    const ct = resp.headers.get('content-type') ?? ''

    if (ct.includes('text/css')) {
      // CSS stylesheet — inject <link>
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = trimmed
      link.dataset.fontSrc = trimmed
      document.head.appendChild(link)
      loadedFontSources.add(trimmed)
      return '' // font name is inside the CSS
    }

    if (ct.startsWith('font/')) {
      // Font file — inject @font-face
      const name = extractFontName(trimmed)
      const style = document.createElement('style')
      style.dataset.fontSrc = trimmed
      style.textContent = `@font-face { font-family: '${name}'; src: url('${trimmed}'); }`
      document.head.appendChild(style)
      loadedFontSources.add(trimmed)
      return name
    }
  } catch {
    // fetch failed → treat as plain font name
  }

  return trimmed
}

/** Load a Google Font by injecting a stylesheet link */
function loadGoogleFont(fontName: string): void {
  const key = `google:${fontName}`
  if (loadedFontSources.has(key)) return

  const lang = navigator.language ?? ''
  const apiHost = /^zh\b/i.test(lang)
    ? 'https://fonts.googleapis.cn'
    : 'https://fonts.googleapis.com'

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${apiHost}/css2?family=${fontName.replace(/ /g, '+')}&display=swap`
  link.dataset.fontSrc = key
  document.head.appendChild(link)
  loadedFontSources.add(key)
}

interface TerminalInstance {
  id: string
  serverSessionId: string | null
  terminal: TerminalLike
  fitAddon: FitAddonLike
  inputPanelAddon: InputPanelAddon
  isConnected: boolean
  label: string
  customTitle: string | null
  processTitle: string | null
  isDedicated: boolean
  isExited: boolean
  exitCode: number | null
  command?: string
  args?: string[]
  closeTip?: string
  closeCallbackUrl?: string | Record<string, string>
  mountedContainer: HTMLElement | null
  resizeObserver: ResizeObserver | null
  /** Whether terminal.open() has been called (can only be called once) */
  hasOpened: boolean
  /** Hook that must run after first terminal.open() */
  afterOpenHook: (() => void) | null
  /** Output chunks received before terminal.open() */
  pendingOutput: string[]
  pendingOutputBytes: number
  lastOutputTime: number
  outputIdleTimer: ReturnType<typeof setTimeout> | null
  /** Whether this session was restored from a server-side list (not locally created) */
  restored: boolean
  platform: PtyPlatform
  rendererEngine: TerminalRendererEngine
}

export interface TerminalSessionSnapshot {
  id: string
  label: string
  customTitle: string | null
  processTitle: string | null
  displayTitle: string
  isDedicated: boolean
  isExited: boolean
  exitCode: number | null
  outputActive: boolean
  command?: string
  args?: string[]
  closeTip?: string
  closeCallbackUrl?: string | Record<string, string>
  platform: PtyPlatform
}

export interface TerminalSnapshot {
  sessions: TerminalSessionSnapshot[]
}

// --- WebSocket URL ---

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/pty`
}

// --- Controller ---

class TerminalController {
  private instances = new Map<string, TerminalInstance>()
  private listeners = new Set<() => void>()
  private idCounter = 0
  private config: TerminalConfig = { ...DEFAULT_TERMINAL_CONFIG }
  private snapshotCache: TerminalSnapshot | null = null
  private inputHistoryStore = new TerminalInputHistoryStore()
  private ghosttyModule: GhosttyModule | null = null
  private ghosttyInitPromise: Promise<GhosttyModule> | null = null

  // Shared WebSocket
  private ws: WebSocket | null = null
  private wsConnected = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = RECONNECT_DELAY
  private pendingCreates: Array<{
    requestId: string
    command?: string
    args?: string[]
    closeTip?: string
    closeCallbackUrl?: string | Record<string, string>
    cols: number
    rows: number
  }> = []
  private pendingCloseSessionIds = new Set<string>()
  private serverToLocalSessionId = new Map<string, string>()
  private hasDiscoveredSessions = false
  private inputPanelDefaultLayout: InputPanelLayout = 'floating'

  // --- Session lifecycle ---

  createSession(opts?: {
    label?: string
    command?: string
    args?: string[]
    isDedicated?: boolean
    closeTip?: string
    closeCallbackUrl?: string | Record<string, string>
  }): string {
    const id = `term-${++this.idCounter}`
    const label = opts?.label ?? `Shell ${this.idCounter}`

    const instance = this.createTerminalInstance(id, {
      label,
      command: opts?.command,
      args: opts?.args,
      isDedicated: opts?.isDedicated ?? false,
      closeTip: opts?.closeTip,
      closeCallbackUrl: opts?.closeCallbackUrl,
      restored: false,
      serverSessionId: null,
      platform: DEFAULT_PTY_PLATFORM,
    })

    this.instances.set(id, instance)

    // Apply resolved fonts to the new session (async, fire-and-forget)
    this._applyFonts()

    this.bindTerminalInput(instance)

    // Send create via shared WS (or queue if not connected yet)
    if (this.wsConnected && this.ws) {
      this.wsSend({
        type: 'create',
        requestId: id,
        cols: instance.terminal.cols || 80,
        rows: instance.terminal.rows || 24,
        command: opts?.command,
        args: opts?.args,
        closeTip: opts?.closeTip,
        closeCallbackUrl: opts?.closeCallbackUrl,
      })
    } else {
      this.pendingCreates.push({
        requestId: id,
        command: opts?.command,
        args: opts?.args,
        closeTip: opts?.closeTip,
        closeCallbackUrl: opts?.closeCallbackUrl,
        cols: instance.terminal.cols || 80,
        rows: instance.terminal.rows || 24,
      })
      this.ensureWsConnected()
    }

    this.notify()
    return id
  }

  private createTerminalInstance(
    id: string,
    opts: {
      label: string
      command?: string
      args?: string[]
      isDedicated: boolean
      closeTip?: string
      closeCallbackUrl?: string | Record<string, string>
      restored: boolean
      serverSessionId: string | null
      platform: PtyPlatform
    }
  ): TerminalInstance {
    const { terminal, fitAddon, afterOpenHook, engine } = this.createRendererTerminal()
    const inputPanelAddon = this.createInputPanelAddon(id, opts.platform)
    terminal.loadAddon(inputPanelAddon)
    this.attachTerminalShortcuts(terminal, engine)

    return {
      id,
      serverSessionId: opts.serverSessionId,
      terminal,
      fitAddon,
      inputPanelAddon,
      isConnected: false,
      label: opts.label,
      customTitle: null,
      processTitle: null,
      isDedicated: opts.isDedicated,
      isExited: false,
      exitCode: null,
      command: opts.command,
      args: opts.args,
      closeTip: opts.closeTip,
      closeCallbackUrl: opts.closeCallbackUrl,
      mountedContainer: null,
      resizeObserver: null,
      hasOpened: false,
      afterOpenHook,
      pendingOutput: [],
      pendingOutputBytes: 0,
      lastOutputTime: 0,
      outputIdleTimer: null,
      restored: opts.restored,
      platform: opts.platform,
      rendererEngine: engine,
    }
  }

  private getTerminalOptions(): ConstructorParameters<typeof Terminal>[0] {
    return {
      cursorBlink: this.config.cursorBlink,
      cursorStyle: this.config.cursorStyle,
      fontSize: this.config.fontSize,
      fontFamily: DEFAULT_FONT_FAMILY,
      theme: { background: 'transparent' },
      allowTransparency: true,
      convertEol: true,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      scrollback: this.config.scrollback,
    }
  }

  private createRendererTerminal(): {
    terminal: TerminalLike
    fitAddon: FitAddonLike
    afterOpenHook: (() => void) | null
    engine: TerminalRendererEngine
  } {
    const options = this.getTerminalOptions()
    if (this.config.rendererEngine === 'xterm') {
      const terminal = new Terminal(options)
      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(new WebLinksAddon())
      return {
        terminal: terminal as TerminalLike,
        fitAddon: fitAddon as FitAddonLike,
        afterOpenHook: null,
        engine: 'xterm',
      }
    }

    const ghosttyModule = this.ghosttyModule
    if (!ghosttyModule) {
      throw new Error('ghostty-web is not initialized. Open Settings and switch engine again.')
    }

    const terminal = new ghosttyModule.Terminal(options)
    const fitAddon = new ghosttyModule.FitAddon()
    terminal.loadAddon(fitAddon)
    const afterOpenHook = () => {
      const ghosttyTerminal = terminal as GhosttyTerminalLike
      if (!ghosttyTerminal.registerLinkProvider) return
      ghosttyTerminal.registerLinkProvider(new ghosttyModule.UrlRegexProvider(terminal))
    }
    return {
      terminal: terminal as unknown as TerminalLike,
      fitAddon: fitAddon as FitAddonLike,
      afterOpenHook,
      engine: 'ghostty',
    }
  }

  private createInputPanelAddon(sessionId: string, platform: PtyPlatform): InputPanelAddon {
    return new InputPanelAddon({
      onInput: (data) => this.writeToSession(sessionId, data),
      getHistory: async () => this.inputHistoryStore.list(),
      addHistory: async (text) => this.inputHistoryStore.add(text),
      subscribeHistory: (listener) => this.inputHistoryStore.subscribe(listener),
      platform,
      defaultLayout: this.inputPanelDefaultLayout,
      stateKey: sessionId,
      onSettingsChange: async (settings: InputPanelSettingsPayload) => {
        await this.inputHistoryStore.setLimit(settings.historyLimit)
      },
    })
  }

  private applyGhosttyBackground(instance: TerminalInstance, container: HTMLElement): void {
    if (instance.rendererEngine !== 'ghostty') return

    const background = this.resolveNearestOpaqueBackground(container)
    const currentTheme = instance.terminal.options.theme ?? {}
    instance.terminal.options.allowTransparency = false
    instance.terminal.options.theme = {
      ...currentTheme,
      background,
    }
  }

  private isTransparentColor(value: string): boolean {
    const normalized = value.trim().toLowerCase()
    return (
      normalized.length === 0 ||
      normalized === 'transparent' ||
      normalized === 'rgba(0, 0, 0, 0)' ||
      normalized === 'rgba(0,0,0,0)'
    )
  }

  private resolveNearestOpaqueBackground(start: HTMLElement): string {
    let current: HTMLElement | null = start
    while (current) {
      const color = window.getComputedStyle(current).backgroundColor
      if (!this.isTransparentColor(color)) {
        return color
      }
      current = current.parentElement
    }
    return 'rgb(26, 26, 26)'
  }

  private attachTerminalShortcuts(terminal: TerminalLike, engine: TerminalRendererEngine): void {
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (event.type !== 'keydown' || !mod) {
        // xterm: true => allow, false => block
        // ghostty-web: true => block, false => allow
        return engine === 'xterm'
      }

      let handled = false

      if ((event.key === '=' || event.key === '+') && mod) {
        this.zoomFont(1)
        handled = true
      }
      if (event.key === '-' && mod && !handled) {
        this.zoomFont(-1)
        handled = true
      }
      if (event.key === '0' && mod && !handled) {
        this.resetFontSize()
        handled = true
      }
      if (engine === 'xterm') {
        return !handled
      }
      return handled
    })
  }

  private bindTerminalInput(instance: TerminalInstance): void {
    instance.terminal.onData((data) => {
      if (instance.isExited) {
        this.closeSession(instance.id)
        return
      }
      const sessionId = this.resolveServerSessionId(instance.id)
      if (!sessionId) return
      this.wsSend({ type: 'input', sessionId, data })
    })
  }

  private isTerminalNotOpenedError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    const message = error.message
    return (
      message.includes('Terminal must be opened before use') ||
      message.includes('Call terminal.open(parent) first')
    )
  }

  private enqueuePendingOutput(instance: TerminalInstance, data: string): void {
    if (!data) return
    instance.pendingOutput.push(data)
    instance.pendingOutputBytes += data.length

    while (
      instance.pendingOutputBytes > MAX_PREOPEN_OUTPUT_BYTES &&
      instance.pendingOutput.length
    ) {
      const removed = instance.pendingOutput.shift()
      if (!removed) break
      instance.pendingOutputBytes -= removed.length
    }
  }

  private writeTerminalOutput(instance: TerminalInstance, data: string): void {
    if (!data) return

    if (!instance.hasOpened) {
      this.enqueuePendingOutput(instance, data)
      return
    }

    try {
      instance.terminal.write(data)
    } catch (error) {
      if (this.isTerminalNotOpenedError(error)) {
        this.enqueuePendingOutput(instance, data)
        return
      }
      console.error('[terminal] failed to write output:', error)
    }
  }

  private flushPendingOutput(instance: TerminalInstance): void {
    if (!instance.hasOpened || instance.pendingOutput.length === 0) return

    const data = instance.pendingOutput.join('')
    instance.pendingOutput = []
    instance.pendingOutputBytes = 0
    this.writeTerminalOutput(instance, data)
  }

  private replaceInstanceRenderer(instance: TerminalInstance): void {
    const mountedContainer = instance.mountedContainer
    const serverSessionId = instance.serverSessionId

    if (instance.mountedContainer) {
      this.unmount(instance.id)
    }

    instance.terminal.dispose()

    const { terminal, fitAddon, afterOpenHook, engine } = this.createRendererTerminal()
    const inputPanelAddon = this.createInputPanelAddon(instance.id, instance.platform)
    terminal.loadAddon(inputPanelAddon)
    this.attachTerminalShortcuts(terminal, engine)

    instance.terminal = terminal
    instance.fitAddon = fitAddon
    instance.inputPanelAddon = inputPanelAddon
    instance.hasOpened = false
    instance.afterOpenHook = afterOpenHook
    instance.mountedContainer = null
    instance.resizeObserver = null
    instance.rendererEngine = engine
    this.bindTerminalInput(instance)

    if (mountedContainer) {
      this.mount(instance.id, mountedContainer)
    }

    if (serverSessionId) {
      this.wsSend({
        type: 'attach',
        sessionId: serverSessionId,
        cols: instance.terminal.cols || 80,
        rows: instance.terminal.rows || 24,
      })
    }
  }

  private async ensureGhosttyModule(): Promise<GhosttyModule> {
    if (this.ghosttyModule) {
      return this.ghosttyModule
    }
    if (!this.ghosttyInitPromise) {
      this.ghosttyInitPromise = import('ghostty-web')
        .then(async (mod) => {
          await mod.init()
          this.ghosttyModule = mod
          return mod
        })
        .finally(() => {
          this.ghosttyInitPromise = null
        })
    }
    return this.ghosttyInitPromise
  }

  async setRendererEngine(engine: TerminalRendererEngine): Promise<void> {
    if (engine === this.config.rendererEngine) return

    if (engine === 'ghostty') {
      await this.ensureGhosttyModule()
    }

    this.config.rendererEngine = engine
    for (const instance of this.instances.values()) {
      this.replaceInstanceRenderer(instance)
    }
    this._applyFonts()
    this.notify()
  }

  closeSession(id: string, opts?: { triggerCloseCallback?: boolean }): void {
    const instance = this.instances.get(id)
    if (!instance) return
    const shouldTriggerCloseCallback = opts?.triggerCloseCallback !== false

    // Unmount first if mounted
    if (instance.mountedContainer) {
      this.unmount(id)
    }

    // Clear idle timer
    if (instance.outputIdleTimer) {
      clearTimeout(instance.outputIdleTimer)
      instance.outputIdleTimer = null
    }

    this.pendingCreates = this.pendingCreates.filter((pending) => pending.requestId !== id)

    // Tell server to close the PTY
    if (instance.serverSessionId) {
      const serverSessionId = instance.serverSessionId
      this.serverToLocalSessionId.delete(serverSessionId)
      if (this.wsConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.wsSend({ type: 'close', sessionId: serverSessionId })
      } else {
        this.pendingCloseSessionIds.add(serverSessionId)
      }
    }

    // Dispose terminal
    instance.terminal.dispose()

    if (shouldTriggerCloseCallback) {
      this.runCloseCallback(instance)
    }

    // Cleanup
    this.instances.delete(id)
    this.notify()
  }

  closeAll(): void {
    for (const id of this.instances.keys()) {
      this.closeSession(id, { triggerCloseCallback: false })
    }
  }

  // --- DOM mount/unmount ---

  mount(id: string, container: HTMLElement): void {
    const instance = this.instances.get(id)
    if (!instance) return

    // Already mounted to this container
    if (instance.mountedContainer === container) {
      // Just re-fit in case dimensions changed (e.g. Activity visible transition)
      requestAnimationFrame(() => {
        try {
          instance.fitAddon.fit()
        } catch {
          /* ignore */
        }
      })
      return
    }

    // If mounted elsewhere, unmount first
    if (instance.mountedContainer) {
      this.unmount(id)
    }

    if (!instance.hasOpened) {
      this.applyGhosttyBackground(instance, container)
      // First mount — call open() to create the xterm DOM
      instance.terminal.open(container)
      instance.hasOpened = true
      instance.afterOpenHook?.()
      instance.afterOpenHook = null
      this.flushPendingOutput(instance)

      // Set up InputPanel auto-open listeners now that DOM elements exist
      instance.inputPanelAddon.attachListeners()
    } else {
      // Re-mount — move the existing xterm DOM element into the new container
      const termEl = instance.terminal.element
      if (termEl) {
        // Some engines may expose `element` as the mount container itself (or its ancestor).
        // In that case, re-parenting would throw a HierarchyRequestError.
        const causesCycle = termEl.contains(container)
        if (!causesCycle && termEl.parentNode !== container) {
          container.appendChild(termEl)
        }
      }
      this.flushPendingOutput(instance)
      this.applyGhosttyBackground(instance, container)
    }

    instance.mountedContainer = container

    // Fit after a frame to ensure container has dimensions
    requestAnimationFrame(() => {
      try {
        instance.fitAddon.fit()
      } catch {
        // Container may not have dimensions yet
      }
    })

    // ResizeObserver for auto-fit
    const observer = new ResizeObserver(() => {
      try {
        instance.fitAddon.fit()
        if (instance.terminal.cols && instance.terminal.rows) {
          const sessionId = this.resolveServerSessionId(id)
          if (!sessionId) return
          this.wsSend({
            type: 'resize',
            sessionId,
            cols: instance.terminal.cols,
            rows: instance.terminal.rows,
          })
        }
      } catch {
        // Terminal may be disposed
      }
    })
    observer.observe(container)
    instance.resizeObserver = observer

    requestAnimationFrame(() => {
      this.focusSession(id)
    })
  }

  unmount(id: string): void {
    const instance = this.instances.get(id)
    if (!instance || !instance.mountedContainer) return

    // Stop observing
    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect()
      instance.resizeObserver = null
    }

    // Don't remove the .xterm DOM — it can't be recreated by terminal.open().
    // Just clear the reference so mount() knows to re-attach.
    instance.mountedContainer = null
  }

  focusSession(id: string): void {
    const instance = this.instances.get(id)
    if (!instance || !instance.hasOpened) return

    let focused = false
    try {
      instance.terminal.focus?.()
      focused = true
    } catch {
      // Fallback below
    }

    if (!focused) {
      const termEl = instance.terminal.element
      if (termEl instanceof HTMLElement) {
        try {
          termEl.focus()
        } catch {
          // ignore
        }
      }
    }

    // Keep InputPanel singleton lifecycle aligned with active terminal session.
    instance.inputPanelAddon.syncFocusLifecycle()
  }

  // --- Title ---

  setCustomTitle(id: string, title: string | null): void {
    const instance = this.instances.get(id)
    if (!instance) return
    instance.customTitle = title
    this.notify()
  }

  getDisplayTitle(id: string): string {
    const instance = this.instances.get(id)
    if (!instance) return ''
    return instance.customTitle ?? instance.processTitle ?? instance.label
  }

  // --- Config ---

  getConfig(): Readonly<TerminalConfig> {
    return { ...this.config }
  }

  applyConfig(config: Partial<TerminalConfig>): void {
    const { rendererEngine, ...restConfig } = config
    Object.assign(this.config, restConfig)

    for (const instance of this.instances.values()) {
      const t = instance.terminal
      t.options.fontSize = this.config.fontSize
      t.options.cursorBlink = this.config.cursorBlink
      t.options.cursorStyle = this.config.cursorStyle
      t.options.scrollback = this.config.scrollback
    }

    // Font resolution is async — fire-and-forget
    this._applyFonts()

    if (rendererEngine && rendererEngine !== this.config.rendererEngine) {
      void this.setRendererEngine(rendererEngine).catch((error) => {
        console.error('[terminal] failed to switch renderer engine:', error)
      })
    }

    this.notify()
  }

  private async _applyFonts(): Promise<void> {
    const raw = this.config.fontFamily
    if (!raw) {
      this._setFontFamily(DEFAULT_FONT_FAMILY)
      return
    }

    const entries = raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const resolved: string[] = []

    for (const entry of entries) {
      if (GOOGLE_FONT_PRESETS.includes(entry)) {
        loadGoogleFont(entry)
        resolved.push(entry)
      } else {
        const name = await loadFontSource(entry)
        if (name) resolved.push(name)
      }
    }

    // Append system fallback
    resolved.push(DEFAULT_FONT_FAMILY)
    this._setFontFamily(resolved.join(', '))
  }

  private _setFontFamily(fontFamily: string): void {
    for (const instance of this.instances.values()) {
      instance.terminal.options.fontFamily = fontFamily
      if (instance.mountedContainer) {
        try {
          instance.fitAddon.fit()
        } catch {
          // ignore
        }
      }
    }
  }

  // --- Font zoom ---

  private configPersistTimer: ReturnType<typeof setTimeout> | null = null

  private persistFontSize(): void {
    if (this.configPersistTimer) clearTimeout(this.configPersistTimer)
    this.configPersistTimer = setTimeout(() => {
      this.configPersistTimer = null
      import('./trpc')
        .then(({ trpcClient }) => {
          trpcClient.config.update.mutate({
            terminal: {
              fontSize: this.config.fontSize,
            },
          })
        })
        .catch(() => {
          /* ignore */
        })
    }, CONFIG_PERSIST_DEBOUNCE)
  }

  zoomFont(delta: number): void {
    const newSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, this.config.fontSize + delta))
    if (newSize === this.config.fontSize) return
    this.applyConfig({ fontSize: newSize })
    this.persistFontSize()
  }

  resetFontSize(): void {
    if (this.config.fontSize === FONT_SIZE_DEFAULT) return
    this.applyConfig({ fontSize: FONT_SIZE_DEFAULT })
    this.persistFontSize()
  }

  // --- External input ---

  writeToSession(id: string, data: string): boolean {
    const sessionId = this.resolveServerSessionId(id)
    if (!sessionId) return false
    return this.wsSend({ type: 'input', sessionId, data })
  }

  async addInputHistory(text: string): Promise<void> {
    await this.inputHistoryStore.add(text)
  }

  private resolveServerSessionId(localSessionId: string): string | null {
    const instance = this.instances.get(localSessionId)
    if (!instance) return null
    return instance.serverSessionId
  }

  private getInstanceByServerSessionId(serverSessionId: string): TerminalInstance | undefined {
    const mappedLocalId = this.serverToLocalSessionId.get(serverSessionId) ?? serverSessionId
    return this.instances.get(mappedLocalId)
  }

  private getLocalSessionIdByServerSessionId(serverSessionId: string): string {
    return this.serverToLocalSessionId.get(serverSessionId) ?? serverSessionId
  }

  private handleCreatedResponse(msg: Extract<PtyServerMessage, { type: 'created' }>): void {
    const instance = this.instances.get(msg.requestId)
    if (!instance) {
      this.wsSend({ type: 'close', sessionId: msg.sessionId })
      return
    }
    instance.serverSessionId = msg.sessionId
    instance.platform = msg.platform
    instance.inputPanelAddon.setPlatform(msg.platform)
    instance.isConnected = true
    this.serverToLocalSessionId.set(msg.sessionId, msg.requestId)
    this.notify()
  }

  private handleOutputResponse(msg: Extract<PtyServerMessage, { type: 'output' }>): void {
    const instance = this.getInstanceByServerSessionId(msg.sessionId)
    if (!instance) return
    this.writeTerminalOutput(instance, msg.data)
    instance.lastOutputTime = Date.now()
    this.notify()
    if (instance.outputIdleTimer) clearTimeout(instance.outputIdleTimer)
    instance.outputIdleTimer = setTimeout(() => {
      instance.outputIdleTimer = null
      this.notify()
    }, OUTPUT_IDLE_THRESHOLD)
  }

  private handleExitResponse(msg: Extract<PtyServerMessage, { type: 'exit' }>): void {
    const instance = this.getInstanceByServerSessionId(msg.sessionId)
    if (!instance) return
    instance.isExited = true
    instance.exitCode = msg.exitCode
    if (instance.closeTip || instance.isDedicated) {
      const tip = instance.closeTip ?? 'Press any key to close (equivalent to close action).'
      this.writeTerminalOutput(
        instance,
        `\r\n\x1b[90m[Process exited with code ${msg.exitCode}. ${tip}]\x1b[0m`
      )
    }
    this.notify()
  }

  private handleTitleResponse(msg: Extract<PtyServerMessage, { type: 'title' }>): void {
    const instance = this.getInstanceByServerSessionId(msg.sessionId)
    if (!instance) return
    instance.processTitle = msg.title
    this.notify()
  }

  private handleBufferResponse(msg: Extract<PtyServerMessage, { type: 'buffer' }>): void {
    const instance = this.getInstanceByServerSessionId(msg.sessionId)
    if (!instance || !msg.data) return
    this.writeTerminalOutput(instance, msg.data)
  }

  private handleErrorResponse(msg: Extract<PtyServerMessage, { type: 'error' }>): void {
    if (msg.code === 'PTY_CREATE_FAILED' && msg.sessionId) {
      const instance = this.instances.get(msg.sessionId)
      if (instance && !instance.serverSessionId) {
        instance.isExited = true
        instance.exitCode = -1
        this.writeTerminalOutput(
          instance,
          `\r\n\x1b[31m[Failed to start PTY: ${msg.message}]\x1b[0m`
        )
        this.notify()
      }
    }
    console.warn(`[pty] ${msg.code}: ${msg.message}`, msg)
  }

  /**
   * Set a shared mount target for the InputPanel addon's singleton UI
   * (panel + FAB). For multi-terminal tab layouts, this should be a stable
   * container that persists across tab switches.
   */
  setInputPanelMountTarget(el: HTMLElement | null): void {
    InputPanelAddon.mountTarget = el
  }

  setInputPanelDefaultLayout(layout: InputPanelLayout): void {
    this.inputPanelDefaultLayout = layout
    for (const instance of this.instances.values()) {
      instance.inputPanelAddon.setDefaultLayout(layout)
    }
  }

  /** Get terminal dimensions (cols/rows) for a session. */
  getTerminalDimensions(id: string): { cols: number; rows: number } | null {
    const instance = this.instances.get(id)
    if (!instance) return null
    return {
      cols: instance.terminal.cols || 80,
      rows: instance.terminal.rows || 24,
    }
  }

  // --- useSyncExternalStore integration ---

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    // Ensure WS connection on first subscriber
    this.ensureWsConnected()
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): TerminalSnapshot {
    if (this.snapshotCache) return this.snapshotCache

    const sessions: TerminalSessionSnapshot[] = []
    for (const inst of this.instances.values()) {
      sessions.push({
        id: inst.id,
        label: inst.label,
        customTitle: inst.customTitle,
        processTitle: inst.processTitle,
        displayTitle: inst.customTitle ?? inst.processTitle ?? inst.label,
        isDedicated: inst.isDedicated,
        isExited: inst.isExited,
        exitCode: inst.exitCode,
        outputActive:
          inst.lastOutputTime > 0 && Date.now() - inst.lastOutputTime < OUTPUT_IDLE_THRESHOLD,
        command: inst.command,
        args: inst.args,
        closeTip: inst.closeTip,
        closeCallbackUrl: inst.closeCallbackUrl,
        platform: inst.platform,
      })
    }

    this.snapshotCache = { sessions }
    return this.snapshotCache
  }

  // --- Private ---

  private notify(): void {
    this.snapshotCache = null
    for (const listener of this.listeners) {
      listener()
    }
  }

  private ensureWsConnected(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
    ) {
      return
    }
    this.connectSharedWebSocket()
  }

  private connectSharedWebSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const ws = new WebSocket(getWsUrl())
    this.ws = ws

    ws.onopen = () => {
      this.wsConnected = true
      this.reconnectDelay = RECONNECT_DELAY

      // Flush explicit close commands collected while offline.
      for (const sessionId of this.pendingCloseSessionIds) {
        this.wsSend({ type: 'close', sessionId })
      }
      this.pendingCloseSessionIds.clear()

      // Discover existing server-side sessions
      this.wsSend({ type: 'list' })

      // Send any pending creates
      for (const pending of this.pendingCreates) {
        this.wsSend({
          type: 'create',
          requestId: pending.requestId,
          cols: pending.cols,
          rows: pending.rows,
          command: pending.command,
          args: pending.args,
          closeTip: pending.closeTip,
          closeCallbackUrl: pending.closeCallbackUrl,
        })
      }
      this.pendingCreates = []

      // Re-attach any existing local sessions (reconnect scenario)
      for (const instance of this.instances.values()) {
        if (!instance.restored) {
          // This instance was already created via 'create' message or is pending
          // Only re-attach if it has a server-side counterpart (handled in list response)
          continue
        }
        // Restored sessions are re-attached in the list handler
      }

      this.notify()
    }

    ws.onmessage = (event) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }

      const parsedMessage = PtyServerMessageSchema.safeParse(parsed)
      if (!parsedMessage.success) {
        return
      }

      this.handleServerMessage(parsedMessage.data)
    }

    ws.onclose = () => {
      this.wsConnected = false
      this.ws = null

      // Don't mark sessions as exited on disconnect — attempt reconnect
      this.notify()

      // Schedule reconnect with exponential backoff
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        if (this.listeners.size > 0 || this.instances.size > 0) {
          this.connectSharedWebSocket()
        }
      }, this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, MAX_RECONNECT_DELAY)
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }

  private handleServerMessage(msg: PtyServerMessage): void {
    switch (msg.type) {
      case 'list': {
        this.handleListResponse(msg)
        break
      }
      case 'created': {
        this.handleCreatedResponse(msg)
        break
      }
      case 'buffer': {
        this.handleBufferResponse(msg)
        break
      }
      case 'output': {
        this.handleOutputResponse(msg)
        break
      }
      case 'exit': {
        this.handleExitResponse(msg)
        break
      }
      case 'title': {
        this.handleTitleResponse(msg)
        break
      }
      case 'error': {
        this.handleErrorResponse(msg)
        break
      }
    }
  }

  private handleListResponse(msg: Extract<PtyServerMessage, { type: 'list' }>): void {
    const serverSessionIds = new Set(msg.sessions.map((s) => s.id))

    // For each server session, create a local instance if it doesn't exist, then attach
    for (const serverSession of msg.sessions) {
      const localId = this.getLocalSessionIdByServerSessionId(serverSession.id)
      let instance = this.instances.get(localId)

      if (!instance) {
        // Restore session from server
        const label =
          serverSession.title || `${serverSession.command} ${serverSession.args.join(' ')}`.trim()
        instance = this.createTerminalInstance(serverSession.id, {
          label: label.length > 40 ? `${label.slice(0, 37)}...` : label,
          command: serverSession.command,
          args: serverSession.args,
          isDedicated: false,
          closeTip: serverSession.closeTip,
          closeCallbackUrl: serverSession.closeCallbackUrl,
          restored: true,
          serverSessionId: serverSession.id,
          platform: serverSession.platform ?? DEFAULT_PTY_PLATFORM,
        })

        if (serverSession.isExited) {
          instance.isExited = true
          instance.exitCode = serverSession.exitCode
        }

        this.bindTerminalInput(instance)

        this.instances.set(instance.id, instance)
        this._applyFonts()
      } else if (!instance.serverSessionId) {
        instance.serverSessionId = serverSession.id
      }
      instance.closeTip = serverSession.closeTip
      instance.closeCallbackUrl = serverSession.closeCallbackUrl
      instance.platform = serverSession.platform ?? DEFAULT_PTY_PLATFORM
      instance.inputPanelAddon.setPlatform(instance.platform)

      this.serverToLocalSessionId.set(serverSession.id, instance.id)

      // Send attach to get buffer replay and live events
      this.wsSend({
        type: 'attach',
        sessionId: serverSession.id,
        cols: instance.terminal.cols || 80,
        rows: instance.terminal.rows || 24,
      })
    }

    // For local instances that are restored but no longer on server, mark as exited
    for (const instance of this.instances.values()) {
      if (
        instance.restored &&
        instance.serverSessionId &&
        !serverSessionIds.has(instance.serverSessionId) &&
        !instance.isExited
      ) {
        instance.isExited = true
        instance.exitCode = -1
      }
    }

    this.hasDiscoveredSessions = true
    this.notify()
  }

  /** Check if session discovery has completed (for TerminalProvider to restore UI state) */
  get discoveredSessions(): boolean {
    return this.hasDiscoveredSessions
  }

  private runCloseCallback(instance: TerminalInstance): void {
    if (!instance.isExited) return

    const callbackUrl = resolveCloseCallbackUrl(instance.closeCallbackUrl, instance.exitCode)
    if (!callbackUrl) return

    navigateCloseCallback(callbackUrl)
  }

  private wsSend(msg: PtyClientMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }
}

function resolveCloseCallbackUrl(
  raw: string | Record<string, string> | undefined,
  exitCode: number | null
): string | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const exact = raw[exitCode == null ? 'null' : String(exitCode)]
  if (typeof exact === 'string' && exact.trim().length > 0) return exact.trim()
  const fallback = raw['*']
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback.trim()
  return null
}

function navigateCloseCallback(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl, window.location.origin)
  } catch {
    return
  }

  if (parsed.origin === window.location.origin) {
    const href = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const targetArea = navController.getAreaForPath(parsed.pathname)
    navController.push(targetArea, href, null)
    return
  }

  window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
}

// --- Singleton ---

export const terminalController = new TerminalController()
