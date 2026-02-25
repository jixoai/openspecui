import type { ITerminalAddon, Terminal } from '@xterm/xterm'
import { iconKeyboard, iconMousePointer2 } from './icons.js'
import type { InputPanelLayout, InputPanelTab } from './input-panel.js'
import type { HostPlatform } from './platform.js'

const SENSITIVITY = 1.5
const EDGE_SCROLL_ZONE = 30
const EDGE_SCROLL_INTERVAL = 50
const EDGE_SCROLL_OVERSHOOT = 15
const STATE_STORAGE_KEY = 'xtermInputPanelState'

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export interface InputPanelHistoryItem {
  text: string
  time: number
}

export interface InputPanelSettingsPayload {
  fixedHeight: number
  floatingWidth: number
  floatingHeight: number
  vibrationIntensity: number
  historyLimit: number
}

interface InputPanelSessionState {
  activeTab: InputPanelTab
  inputDraft: string
}

interface InputMethodTabElement extends HTMLElement {
  value: string
}

interface InputPanelElement extends HTMLElement {
  activeTab: InputPanelTab
}

function isInputPanelTab(value: unknown): value is InputPanelTab {
  return (
    value === 'input' ||
    value === 'keys' ||
    value === 'shortcuts' ||
    value === 'trackpad' ||
    value === 'settings'
  )
}

interface InputPanelStateStore {
  lastActiveTab?: InputPanelTab
  sessions?: Record<string, Partial<InputPanelSessionState>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function loadPanelStateStore(): InputPanelStateStore {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? (parsed as InputPanelStateStore) : {}
  } catch {
    return {}
  }
}

function savePanelStateStore(store: InputPanelStateStore): void {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

function loadPanelSessionState(sessionKey: string): InputPanelSessionState | null {
  const store = loadPanelStateStore()
  const sessions = store.sessions
  if (!sessions) return null
  const rawState = sessions[sessionKey]
  if (!isRecord(rawState)) return null

  const state: InputPanelSessionState = {
    activeTab: 'input',
    inputDraft: '',
  }

  if (isInputPanelTab(rawState.activeTab)) {
    state.activeTab = rawState.activeTab
  }
  if (typeof rawState.inputDraft === 'string') {
    state.inputDraft = rawState.inputDraft
  }

  return state
}

function loadLastActiveTab(): InputPanelTab {
  const store = loadPanelStateStore()
  return isInputPanelTab(store.lastActiveTab) ? store.lastActiveTab : 'input'
}

/**
 * xterm.js addon that provides full InputPanel integration.
 *
 * **DOM Mounting**: All addon UI (panel, FAB, cursor) mounts into the
 * terminal's own container (`terminal.element.parentElement`) by default.
 * For multi-terminal layouts, set `InputPanelAddon.mountTarget` to a shared
 * ancestor so the singleton panel and FAB live in one place.
 *
 * **Singleton**: Only one `<input-panel>` element exists at a time across all
 * terminal instances. When a different terminal receives focus, the panel
 * migrates automatically (previous addon closes, new one opens).
 *
 * **Native FAB**: On touch devices, a draggable floating action button is
 * created automatically inside the mount target. No React needed.
 *
 * Usage:
 * ```ts
 * import { InputPanelAddon } from 'xterm-input-panel'
 *
 * // Optional: shared container for multi-terminal layouts
 * InputPanelAddon.mountTarget = document.getElementById('app')
 *
 * const addon = new InputPanelAddon({
 *   onInput: (data) => pty.write(data),
 * })
 * terminal.loadAddon(addon)
 * // After terminal.open(container):
 * addon.attachListeners()
 * ```
 */
export class InputPanelAddon implements ITerminalAddon {
  private static _lastActiveTab: InputPanelTab = 'input'
  // ── Singleton state ──

  /** The currently active (open) addon instance, or null. */
  private static _active: InputPanelAddon | null = null

  /** The most recently focused terminal's addon (FAB opens this). */
  private static _lastFocused: InputPanelAddon | null = null

  /** All alive addon instances (for FAB fallback when _lastFocused is null). */
  private static _instances = new Set<InputPanelAddon>()

  /** Global callback for singleton state changes. */
  private static _onActiveChangeFn: ((addon: InputPanelAddon | null) => void) | null = null

  /**
   * Shared mount target for multi-terminal scenarios.
   * When set, both `<input-panel>` and FAB mount here instead of each
   * terminal's individual container. Set this to a common ancestor element
   * (e.g. the app shell or terminal panel wrapper).
   */
  private static _mountTarget: HTMLElement | null = null

  /** Get the currently active instance (the one with the open panel). */
  static get activeInstance(): InputPanelAddon | null {
    return InputPanelAddon._active
  }

  /** Subscribe to singleton state changes (open/close/migration). */
  static set onActiveChange(fn: ((addon: InputPanelAddon | null) => void) | null) {
    InputPanelAddon._onActiveChangeFn = fn
  }

  /**
   * Set a shared mount target for all InputPanelAddon instances.
   * The `<input-panel>` element and FAB will be appended here.
   * If null (default), each addon mounts into its own terminal container.
   */
  static set mountTarget(el: HTMLElement | null) {
    InputPanelAddon._mountTarget = el
    // Migrate existing FAB to the new target
    if (InputPanelAddon._fabEl && el) {
      el.appendChild(InputPanelAddon._fabEl)
    }
  }

  static get mountTarget(): HTMLElement | null {
    return InputPanelAddon._mountTarget
  }

  // ── Native FAB (static singleton) ──

  private static _fabEl: HTMLButtonElement | null = null
  private static _fabSubscriberCount = 0

  /**
   * Create the native FAB button and mount it into the given container.
   * The FAB is a static singleton — created once, then moved between
   * containers as terminals gain/lose focus.
   */
  private static _ensureFab(mountTarget: HTMLElement): void {
    if (InputPanelAddon._fabEl) {
      // FAB already exists — just ensure it's in the right container
      if (InputPanelAddon._fabEl.parentElement !== mountTarget) {
        mountTarget.appendChild(InputPanelAddon._fabEl)
      }
      return
    }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = 'Open InputPanel'
    btn.replaceChildren(iconKeyboard(24))

    Object.assign(btn.style, {
      position: 'fixed',
      zIndex: '50',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      border: '2px solid currentColor',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      touchAction: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
      webkitTouchCallout: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      background: 'var(--primary, #e04a2f)',
      color: 'var(--primary-foreground, #fff)',
      padding: '0',
      margin: '0',
      outline: 'none',
    })

    // Load saved position
    let posX = window.innerWidth - 72
    let posY = window.innerHeight - 140
    try {
      const saved = localStorage.getItem('input-panel-fab-pos')
      if (saved) {
        const p = JSON.parse(saved)
        posX = p.x ?? posX
        posY = p.y ?? posY
      }
    } catch {
      /* ignore */
    }
    posX = Math.max(0, Math.min(window.innerWidth - 56, posX))
    posY = Math.max(0, Math.min(window.innerHeight - 56, posY))
    btn.style.left = `${posX}px`
    btn.style.top = `${posY}px`

    // Drag state
    let dragging = false
    let wasDragged = false
    let startX = 0
    let startY = 0
    let origX = 0
    let origY = 0

    const doOpen = () => {
      const preferred = InputPanelAddon._lastFocused
      const target =
        (preferred && InputPanelAddon._instances.has(preferred) ? preferred : null) ??
        [...InputPanelAddon._instances].find((instance) => instance._terminal != null) ??
        null

      if (target) {
        InputPanelAddon._lastFocused = target
        target.open()
      }
    }

    btn.addEventListener('pointerdown', (e) => {
      dragging = true
      wasDragged = false
      startX = e.clientX
      startY = e.clientY
      origX = parseInt(btn.style.left) || 0
      origY = parseInt(btn.style.top) || 0
      btn.setPointerCapture(e.pointerId)
      e.preventDefault()
    })

    btn.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) wasDragged = true
      const newX = Math.max(0, Math.min(window.innerWidth - 56, origX + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - 56, origY + dy))
      btn.style.left = `${newX}px`
      btn.style.top = `${newY}px`
    })

    btn.addEventListener('pointerup', () => {
      if (!dragging) return
      dragging = false
      try {
        localStorage.setItem(
          'input-panel-fab-pos',
          JSON.stringify({
            x: parseInt(btn.style.left),
            y: parseInt(btn.style.top),
          })
        )
      } catch {
        /* ignore */
      }
      if (!wasDragged) doOpen()
    })

    btn.addEventListener('pointercancel', () => {
      dragging = false
    })

    // Click fallback for environments where pointer events are unreliable
    let pointerDownFired = false
    btn.addEventListener(
      'pointerdown',
      () => {
        pointerDownFired = true
      },
      { capture: true }
    )
    btn.addEventListener('click', () => {
      if (pointerDownFired) {
        pointerDownFired = false
        return
      }
      doOpen()
    })

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    btn.addEventListener('dragstart', (e) => {
      e.preventDefault()
    })

    // Keep in bounds on resize
    window.addEventListener('resize', () => {
      const x = Math.min(parseInt(btn.style.left) || 0, window.innerWidth - 56)
      const y = Math.min(parseInt(btn.style.top) || 0, window.innerHeight - 56)
      btn.style.left = `${Math.max(0, x)}px`
      btn.style.top = `${Math.max(0, y)}px`
    })

    mountTarget.appendChild(btn)
    InputPanelAddon._fabEl = btn
  }

  private static _setFabVisible(visible: boolean): void {
    if (InputPanelAddon._fabEl) {
      InputPanelAddon._fabEl.style.display =
        visible && InputPanelAddon._fabSubscriberCount > 0 ? 'flex' : 'none'
    }
  }

  // ── Instance state ──

  private _terminal: Terminal | null = null
  private _panel: HTMLElement | null = null
  private _cursorEl: HTMLElement | null = null
  private _cursorPos = { x: 0, y: 0 }
  private _isDragging = false
  private _isOpen = false
  private _edgeScrollTimer: ReturnType<typeof setInterval> | null = null
  private _cleanups: Array<() => void> = []
  private _persistentCleanups: Array<() => void> = []
  private _listenersAttached = false

  private _onInput: (data: string) => void
  private _onOpenCb: (() => void) | null
  private _onCloseCb: (() => void) | null
  private _getHistory: (() => Promise<readonly InputPanelHistoryItem[]>) | null
  private _addHistory: ((text: string) => Promise<void> | void) | null
  private _subscribeHistory:
    | ((listener: (items: readonly InputPanelHistoryItem[]) => void) => () => void)
    | null
  private _onSettingsChange: ((settings: InputPanelSettingsPayload) => Promise<void> | void) | null
  private _platform: HostPlatform
  private _defaultLayout: InputPanelLayout
  private _showFab: boolean
  private _fabSubscribed: boolean
  private _panelSessionState: InputPanelSessionState
  private _stateKey: string
  private _hasOwnPersistedState: boolean

  constructor(opts?: {
    onInput?: (data: string) => void
    onOpen?: () => void
    onClose?: () => void
    getHistory?: () => Promise<readonly InputPanelHistoryItem[]>
    addHistory?: (text: string) => Promise<void> | void
    subscribeHistory?: (listener: (items: readonly InputPanelHistoryItem[]) => void) => () => void
    onSettingsChange?: (settings: InputPanelSettingsPayload) => Promise<void> | void
    platform?: HostPlatform
    defaultLayout?: InputPanelLayout
    showFab?: boolean
    stateKey?: string
  }) {
    this._onInput = opts?.onInput ?? (() => {})
    this._onOpenCb = opts?.onOpen ?? null
    this._onCloseCb = opts?.onClose ?? null
    this._getHistory = opts?.getHistory ?? null
    this._addHistory = opts?.addHistory ?? null
    this._subscribeHistory = opts?.subscribeHistory ?? null
    this._onSettingsChange = opts?.onSettingsChange ?? null
    this._platform = opts?.platform ?? 'common'
    this._defaultLayout = opts?.defaultLayout ?? 'floating'
    this._showFab = opts?.showFab ?? true
    this._fabSubscribed = false
    this._stateKey = opts?.stateKey?.trim() ? opts.stateKey : 'default'
    this._hasOwnPersistedState = false
    this._panelSessionState = {
      activeTab: 'input',
      inputDraft: '',
    }
    const persistedState = loadPanelSessionState(this._stateKey)
    if (persistedState) {
      this._panelSessionState = persistedState
      this._hasOwnPersistedState = true
    } else {
      this._panelSessionState.activeTab = InputPanelAddon._lastActiveTab || loadLastActiveTab()
    }
  }

  get isOpen(): boolean {
    return this._isOpen
  }

  /** Allow changing callbacks after construction. */
  set onOpen(fn: (() => void) | null) {
    this._onOpenCb = fn
  }
  set onClose(fn: (() => void) | null) {
    this._onCloseCb = fn
  }
  set onInput(fn: (data: string) => void) {
    this._onInput = fn
  }

  setPlatform(platform: HostPlatform): void {
    this._platform = platform
    this._applyPlatformToPanel()
  }

  setDefaultLayout(layout: InputPanelLayout): void {
    this._defaultLayout = layout
  }

  private _persistPanelState(): void {
    InputPanelAddon._lastActiveTab = this._panelSessionState.activeTab
    const store = loadPanelStateStore()
    const nextSessions = {
      ...store.sessions,
      [this._stateKey]: {
        activeTab: this._panelSessionState.activeTab,
        inputDraft: this._panelSessionState.inputDraft,
      },
    }
    savePanelStateStore({
      ...store,
      lastActiveTab: this._panelSessionState.activeTab,
      sessions: nextSessions,
    })
  }

  /**
   * Resolve the mount target for this addon instance.
   * Priority: static mountTarget > terminal container > document.body
   */
  private _getMountTarget(): HTMLElement {
    return InputPanelAddon._mountTarget ?? this._getTerminalHostElement() ?? document.body
  }

  /**
   * Resolve the visual host element used for overlay UI (cursor/panel).
   *
   * xterm renderer usually exposes `.xterm` as `terminal.element`, while
   * ghostty may expose the mount container itself.
   */
  private _getTerminalHostElement(): HTMLElement | null {
    const termElement = this._terminal?.element
    if (!(termElement instanceof HTMLElement)) return null
    if (termElement.classList.contains('xterm')) {
      return termElement.parentElement instanceof HTMLElement
        ? termElement.parentElement
        : termElement
    }
    return termElement
  }

  private _detectTerminalEngine(): 'xterm' | 'non-xterm' {
    const termElement = this._terminal?.element
    if (termElement instanceof HTMLElement && termElement.classList.contains('xterm')) {
      return 'xterm'
    }
    return 'non-xterm'
  }

  activate(terminal: Terminal): void {
    this._terminal = terminal
    InputPanelAddon._instances.add(this)
  }

  dispose(): void {
    this.close()
    for (const fn of this._persistentCleanups) fn()
    this._persistentCleanups = []
    this._listenersAttached = false
    if (this._fabSubscribed) {
      InputPanelAddon._fabSubscriberCount = Math.max(0, InputPanelAddon._fabSubscriberCount - 1)
      this._fabSubscribed = false
      InputPanelAddon._setFabVisible(InputPanelAddon._active === null)
    }
    InputPanelAddon._instances.delete(this)
    if (InputPanelAddon._lastFocused === this) {
      InputPanelAddon._lastFocused = null
    }
    this._terminal = null
  }

  // ── Public API ──

  /**
   * Set up persistent listeners for auto-open behavior.
   * Must be called after terminal.open(container) so that DOM elements exist.
   *
   * On touch devices:
   * - Permanently sets inputmode='none' to suppress native keyboard
   * - Creates the native FAB inside the mount target
   * - textarea focus → opens InputPanel (migrates from other terminal if needed)
   */
  attachListeners(): void {
    if (this._listenersAttached || !this._terminal) return
    const textarea = this._terminal.textarea
    if (!textarea) return

    this._listenersAttached = true

    // Ensure native FAB exists in the correct mount target
    if (this._showFab) {
      InputPanelAddon._ensureFab(this._getMountTarget())
      if (!this._fabSubscribed) {
        InputPanelAddon._fabSubscriberCount += 1
        this._fabSubscribed = true
      }
      InputPanelAddon._setFabVisible(true)
    } else {
      // Hide legacy/stale FAB when current runtime has no FAB subscribers.
      if (InputPanelAddon._fabSubscriberCount === 0) {
        InputPanelAddon._setFabVisible(false)
      }
    }

    // Default FAB target to the first terminal that attaches listeners
    if (!InputPanelAddon._lastFocused) {
      InputPanelAddon._lastFocused = this
    }

    // Track last focused terminal for FAB
    // textarea focus → open InputPanel (migration via singleton)
    const onFocus = () => {
      InputPanelAddon._lastFocused = this
      if (isTouchDevice() && !this._isOpen) this.open()
    }
    textarea.addEventListener('focus', onFocus)
    this._persistentCleanups.push(() => textarea.removeEventListener('focus', onFocus))

    // Permanently suppress native keyboard on touch devices only
    if (isTouchDevice()) {
      textarea.setAttribute('inputmode', 'none')
    }
  }

  open(): void {
    if (!this._terminal) return
    if (this._isOpen) {
      // Recover from host unmount/remount: panel DOM can be removed while addon
      // still thinks it is open. In that case, close stale state and re-open.
      if (this._panel?.isConnected) return
      this.close()
    }

    // Singleton: close any other active instance (migration)
    if (InputPanelAddon._active && InputPanelAddon._active !== this) {
      InputPanelAddon._active.close()
    }

    this._isOpen = true
    InputPanelAddon._active = this
    InputPanelAddon._lastFocused = this

    // Hide FAB while panel is open
    if (this._showFab) {
      InputPanelAddon._setFabVisible(false)
    }

    this._suppressKeyboard()

    if (!this._hasOwnPersistedState) {
      const fallbackActiveTab = loadLastActiveTab()
      this._panelSessionState.activeTab = fallbackActiveTab
      InputPanelAddon._lastActiveTab = fallbackActiveTab
    }

    // Build the element tree
    const panel = document.createElement('input-panel') as InputPanelElement
    panel.setAttribute('layout', this._defaultLayout)
    this._applyPanelThemeBindings(panel)
    panel.activeTab = this._panelSessionState.activeTab

    const inputTab = document.createElement('input-method-tab') as InputMethodTabElement
    inputTab.setAttribute('slot', 'input')
    inputTab.value = this._panelSessionState.inputDraft
    panel.appendChild(inputTab)

    const keysTab = document.createElement('virtual-keyboard-tab')
    keysTab.setAttribute('slot', 'keys')
    keysTab.setAttribute('floating', '')
    keysTab.setAttribute('platform', this._platform)
    panel.appendChild(keysTab)

    const shortcutsTab = document.createElement('shortcut-tab')
    shortcutsTab.setAttribute('slot', 'shortcuts')
    shortcutsTab.setAttribute('platform', this._platform)
    panel.appendChild(shortcutsTab)

    const trackpadTab = document.createElement('virtual-trackpad-tab')
    trackpadTab.setAttribute('slot', 'trackpad')
    trackpadTab.setAttribute('floating', '')
    panel.appendChild(trackpadTab)

    this._panel = panel

    const renderHistory = (items: readonly InputPanelHistoryItem[]) => {
      this._renderHistory(inputTab, items)
    }

    if (this._getHistory) {
      void this._getHistory()
        .then((items) => renderHistory(items))
        .catch(() => {})
    }

    if (this._subscribeHistory) {
      try {
        const unsubscribe = this._subscribeHistory((items) => {
          renderHistory(items)
        })
        this._cleanups.push(unsubscribe)
      } catch {
        // ignore history subscription failures
      }
    }

    // Wire panel events
    this._on(panel, 'input-panel:close', () => this.close())
    this._on(panel, 'input-panel:send', (e) => {
      const data = (e as CustomEvent).detail?.data
      if (data) this._onInput(data)

      const source = e.composedPath()[0]
      if (source === inputTab && this._addHistory && data) {
        const normalized = this._normalizeHistoryText(data)
        if (normalized) {
          Promise.resolve(this._addHistory(normalized))
            .then(() => this._getHistory?.())
            .then((items) => {
              if (items) renderHistory(items)
            })
            .catch(() => {})
        }
      }
    })
    this._on(inputTab, 'input-panel:input-change', (e) => {
      const value = (e as CustomEvent).detail?.value
      if (typeof value === 'string') {
        this._panelSessionState.inputDraft = value
        this._hasOwnPersistedState = true
        this._persistPanelState()
      }
    })
    this._on(panel, 'input-panel:tab-change', (e) => {
      const tab = (e as CustomEvent).detail?.tab
      if (isInputPanelTab(tab)) {
        this._panelSessionState.activeTab = tab
        this._hasOwnPersistedState = true
        this._persistPanelState()
      }
      if (tab === 'trackpad') this._showCursor()
      else this._hideCursor()
    })
    this._on(panel, 'input-panel:settings-change', (e) => {
      if (!this._onSettingsChange) return
      const detail = (e as CustomEvent).detail
      if (typeof detail !== 'object' || detail == null) return
      const payload = detail as Partial<InputPanelSettingsPayload>
      if (
        typeof payload.fixedHeight !== 'number' ||
        typeof payload.floatingWidth !== 'number' ||
        typeof payload.floatingHeight !== 'number' ||
        typeof payload.vibrationIntensity !== 'number' ||
        typeof payload.historyLimit !== 'number'
      ) {
        return
      }

      void this._onSettingsChange({
        fixedHeight: payload.fixedHeight,
        floatingWidth: payload.floatingWidth,
        floatingHeight: payload.floatingHeight,
        vibrationIntensity: payload.vibrationIntensity,
        historyLimit: payload.historyLimit,
      })
    })

    // Wire trackpad gesture events
    this._on(panel, 'trackpad:move', (e) => {
      const { dx, dy } = (e as CustomEvent).detail
      this._moveCursor(dx, dy)
    })
    this._on(panel, 'trackpad:tap', () => this._dispatchClick(1))
    this._on(panel, 'trackpad:double-tap', () => this._dispatchDblClick())
    this._on(panel, 'trackpad:long-press', () => this._dispatchRightClick())
    this._on(panel, 'trackpad:two-finger-tap', () => this._dispatchRightClick())
    this._on(panel, 'trackpad:drag-start', () => {
      this._isDragging = true
      this._dispatchMouse('mousedown', { detail: 1 })
    })
    this._on(panel, 'trackpad:drag-move', (e) => {
      const { dx, dy } = (e as CustomEvent).detail
      this._moveCursor(dx, dy)
      this._dispatchMouse('mousemove', { buttons: 1 })
      this._updateEdgeScroll()
    })
    this._on(panel, 'trackpad:drag-end', () => {
      this._isDragging = false
      this._stopEdgeScroll()
      this._dispatchMouse('mouseup', { detail: 1 })
    })
    this._on(panel, 'trackpad:scroll', (e) => {
      const { deltaY } = (e as CustomEvent).detail
      this._dispatchWheel(deltaY)
    })

    // Mount panel into the terminal's container (or shared mount target)
    this._getMountTarget().appendChild(panel)

    // Create cursor overlay inside terminal container
    this._createCursor()

    // Focus terminal textarea to show blinking cursor
    this._focusTerminal()

    this._onOpenCb?.()
    InputPanelAddon._onActiveChangeFn?.(this)
  }

  private _applyPlatformToPanel(): void {
    if (!this._panel) return
    const keysTab = this._panel.querySelector('virtual-keyboard-tab')
    const shortcutsTab = this._panel.querySelector('shortcut-tab')
    keysTab?.setAttribute('platform', this._platform)
    shortcutsTab?.setAttribute('platform', this._platform)
  }

  private _readThemeVar(
    style: CSSStyleDeclaration,
    names: readonly string[],
    fallback: string
  ): string {
    for (const name of names) {
      const value = style.getPropertyValue(name).trim()
      if (value) return value
    }
    return fallback
  }

  private _applyPanelThemeBindings(panel: HTMLElement): void {
    const scope = this._getTerminalHostElement() ?? this._getMountTarget()
    const style = getComputedStyle(scope)

    const background = this._readThemeVar(
      style,
      ['--input-panel-background', '--terminal', '--background'],
      '#1a1a1a'
    )
    const foreground = this._readThemeVar(
      style,
      ['--input-panel-foreground', '--terminal-foreground', '--foreground'],
      '#ffffff'
    )
    const primary = this._readThemeVar(style, ['--input-panel-primary', '--primary'], '#e04a2f')
    const primaryForeground = this._readThemeVar(
      style,
      ['--input-panel-primary-foreground', '--primary-foreground'],
      '#ffffff'
    )
    const border = this._readThemeVar(
      style,
      ['--input-panel-border', '--border'],
      `color-mix(in srgb, ${foreground} 24%, transparent)`
    )
    const muted = this._readThemeVar(
      style,
      ['--input-panel-muted', '--muted'],
      `color-mix(in srgb, ${background} 86%, ${foreground} 14%)`
    )
    const mutedForeground = this._readThemeVar(
      style,
      ['--input-panel-muted-foreground', '--muted-foreground'],
      `color-mix(in srgb, ${foreground} 62%, transparent)`
    )

    panel.style.setProperty('--input-panel-background', background)
    panel.style.setProperty('--input-panel-foreground', foreground)
    panel.style.setProperty('--input-panel-primary', primary)
    panel.style.setProperty('--input-panel-primary-foreground', primaryForeground)
    panel.style.setProperty('--input-panel-border', border)
    panel.style.setProperty('--input-panel-muted', muted)
    panel.style.setProperty('--input-panel-muted-foreground', mutedForeground)
  }

  close(): void {
    if (!this._isOpen) return
    this._isOpen = false

    if (InputPanelAddon._active === this) {
      InputPanelAddon._active = null
    }

    this._stopEdgeScroll()
    for (const fn of this._cleanups) fn()
    this._cleanups = []

    this._panel?.remove()
    this._panel = null

    this._cursorEl?.remove()
    this._cursorEl = null

    if (!isTouchDevice()) {
      this._restoreKeyboard()
    }

    // Show FAB again
    if (this._showFab) {
      InputPanelAddon._setFabVisible(true)
    }

    this._onCloseCb?.()
    InputPanelAddon._onActiveChangeFn?.(null)
  }

  toggle(): void {
    if (this._isOpen) {
      this.close()
      return
    }
    this.open()
  }

  /**
   * Sync addon singleton state when host marks this terminal as active.
   *
   * Lifecycle:
   * 1) Always refresh `_lastFocused` so FAB targets the current terminal.
   * 2) If another terminal owns an open panel, migrate panel ownership here.
   * 3) If this panel is already open, keep terminal focus in sync.
   */
  syncFocusLifecycle(): void {
    InputPanelAddon._lastFocused = this

    if (this._isOpen && !this._panel?.isConnected) {
      this.open()
      return
    }

    if (InputPanelAddon._active && InputPanelAddon._active !== this) {
      this.open()
      return
    }

    if (this._isOpen) {
      this._focusTerminal()
    }
  }

  // ── Terminal focus ──

  private _focusTerminal(): void {
    const textarea = this._terminal?.textarea
    if (!textarea) return
    if (isTouchDevice()) {
      textarea.setAttribute('inputmode', 'none')
    }
    textarea.focus()
  }

  // ── Cursor overlay ──

  private _createCursor(): void {
    const container = this._getTerminalHostElement()
    if (!container) return

    const el = document.createElement('div')
    el.setAttribute('data-input-panel-cursor', 'virtual-mouse')
    el.setAttribute('data-terminal-engine', this._detectTerminalEngine())
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText =
      'position:absolute;z-index:10;pointer-events:none;opacity:0;transition:opacity 0.15s;color:#fff;'
    const pointer = iconMousePointer2(20)
    pointer.style.filter = 'drop-shadow(0 0 1px rgba(0,0,0,0.9))'
    el.replaceChildren(pointer)
    container.appendChild(el)
    this._cursorEl = el

    const rect = container.getBoundingClientRect()
    this._cursorPos = { x: rect.width / 2, y: rect.height / 2 }
    this._positionCursor()
  }

  private _positionCursor(): void {
    if (!this._cursorEl) return
    this._cursorEl.style.left = `${this._cursorPos.x - 4}px`
    this._cursorEl.style.top = `${this._cursorPos.y - 2}px`
  }

  private _showCursor(): void {
    if (!this._cursorEl) this._createCursor()
    if (this._cursorEl) {
      const container = this._getTerminalHostElement()
      if (container) {
        const rect = container.getBoundingClientRect()
        this._cursorPos = { x: rect.width / 2, y: rect.height / 2 }
        this._positionCursor()
      }
      this._cursorEl.style.opacity = '1'
    }
  }

  private _hideCursor(): void {
    if (this._cursorEl) this._cursorEl.style.opacity = '0.3'
  }

  private _moveCursor(dx: number, dy: number): void {
    const container = this._getTerminalHostElement()
    if (!container) return
    const rect = container.getBoundingClientRect()
    this._cursorPos.x = Math.max(0, Math.min(rect.width, this._cursorPos.x + dx * SENSITIVITY))
    this._cursorPos.y = Math.max(0, Math.min(rect.height, this._cursorPos.y + dy * SENSITIVITY))
    this._positionCursor()
  }

  // ── Mouse event dispatch ──

  private _getClientCoords(): { clientX: number; clientY: number } | null {
    const container = this._getTerminalHostElement()
    if (!container) return null
    const rect = container.getBoundingClientRect()
    return {
      clientX: rect.left + this._cursorPos.x,
      clientY: rect.top + this._cursorPos.y,
    }
  }

  private _resolveTarget(clientX: number, clientY: number): Element {
    const container = this._getTerminalHostElement()
    if (!container) return document.body
    const el = document.elementFromPoint(clientX, clientY)
    if (el && container.contains(el)) return el
    return container.querySelector('.xterm-screen') ?? container
  }

  private _dispatchMouse(
    type: string,
    opts: { button?: number; detail?: number; buttons?: number } = {}
  ): void {
    const coords = this._getClientCoords()
    if (!coords) return
    const button = opts.button ?? 0
    const detail = opts.detail ?? 1
    const buttons =
      opts.buttons ?? (type === 'mousedown' ? (button === 0 ? 1 : button === 2 ? 2 : 4) : 0)
    const target = this._resolveTarget(coords.clientX, coords.clientY)
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail,
        clientX: coords.clientX,
        clientY: coords.clientY,
        button,
        buttons,
      })
    )
  }

  private _dispatchClick(detail: number): void {
    this._dispatchMouse('mousedown', { detail })
    this._dispatchMouse('mouseup', { detail })
    this._dispatchMouse('click', { detail })
  }

  private _dispatchDblClick(): void {
    this._dispatchMouse('mousedown', { detail: 2 })
    this._dispatchMouse('mouseup', { detail: 2 })
    this._dispatchMouse('click', { detail: 2 })
    this._dispatchMouse('dblclick', { detail: 2 })
  }

  private _dispatchRightClick(): void {
    this._dispatchMouse('mousedown', { button: 2 })
    this._dispatchMouse('mouseup', { button: 2 })
    this._dispatchMouse('contextmenu', { button: 2 })
  }

  private _dispatchWheel(deltaY: number): void {
    const coords = this._getClientCoords()
    if (!coords) return
    const target = this._resolveTarget(coords.clientX, coords.clientY)
    target.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: coords.clientX,
        clientY: coords.clientY,
        deltaY,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      })
    )
  }

  // ── Edge scroll (during drag selection) ──

  private _updateEdgeScroll(): void {
    const container = this._getTerminalHostElement()
    if (!container || !this._isDragging) {
      this._stopEdgeScroll()
      return
    }
    const rect = container.getBoundingClientRect()
    const nearTop = this._cursorPos.y < EDGE_SCROLL_ZONE
    const nearBottom = this._cursorPos.y > rect.height - EDGE_SCROLL_ZONE
    if (!nearTop && !nearBottom) {
      this._stopEdgeScroll()
      return
    }

    this._stopEdgeScroll()
    this._edgeScrollTimer = setInterval(() => {
      const container = this._getTerminalHostElement()
      if (!container || !this._isDragging) {
        this._stopEdgeScroll()
        return
      }
      const rect = container.getBoundingClientRect()
      const clientX = rect.left + this._cursorPos.x
      const clientY =
        this._cursorPos.y < EDGE_SCROLL_ZONE
          ? rect.top - EDGE_SCROLL_OVERSHOOT
          : rect.bottom + EDGE_SCROLL_OVERSHOOT
      const target = this._resolveTarget(
        rect.left + this._cursorPos.x,
        rect.top + this._cursorPos.y
      )
      target.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY,
          button: 0,
          buttons: 1,
        })
      )
    }, EDGE_SCROLL_INTERVAL)
  }

  private _stopEdgeScroll(): void {
    if (this._edgeScrollTimer) {
      clearInterval(this._edgeScrollTimer)
      this._edgeScrollTimer = null
    }
  }

  // ── Keyboard suppression ──

  private _suppressKeyboard(): void {
    if (!isTouchDevice()) return
    const textarea = this._terminal?.textarea
    if (textarea) textarea.setAttribute('inputmode', 'none')
  }

  private _restoreKeyboard(): void {
    const textarea = this._terminal?.textarea
    if (textarea) textarea.removeAttribute('inputmode')
  }

  // ── Event helper ──

  private _on(target: EventTarget, event: string, handler: EventListener): void {
    target.addEventListener(event, handler)
    this._cleanups.push(() => target.removeEventListener(event, handler))
  }

  private _normalizeHistoryText(raw: string): string | null {
    const text = raw.replace(/[\r\n]+$/u, '').trim()
    return text ? text : null
  }

  private _renderHistory(inputTab: HTMLElement, items: readonly InputPanelHistoryItem[]): void {
    inputTab.querySelectorAll('[data-input-history-root="true"]').forEach((node) => node.remove())
    if (items.length === 0) return

    const root = document.createElement('div')
    root.dataset.inputHistoryRoot = 'true'
    root.setAttribute('slot', 'history')
    root.style.display = 'flex'
    root.style.flexDirection = 'column'
    root.style.gap = '4px'
    root.style.padding = '4px 0'

    for (const item of items) {
      const button = document.createElement('button')
      button.type = 'button'
      button.title = item.text
      button.style.display = 'flex'
      button.style.alignItems = 'center'
      button.style.gap = '8px'
      button.style.width = '100%'
      button.style.padding = '4px 6px'
      button.style.border = '1px solid transparent'
      button.style.borderRadius = '4px'
      button.style.background = 'transparent'
      button.style.color = 'var(--foreground, #fff)'
      button.style.fontFamily = 'inherit'
      button.style.fontSize = '12px'
      button.style.textAlign = 'left'

      const time = document.createElement('span')
      time.textContent = new Date(item.time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
      time.style.opacity = '0.65'
      time.style.fontSize = '10px'
      time.style.flexShrink = '0'

      const content = document.createElement('span')
      content.textContent = item.text
      content.style.overflow = 'hidden'
      content.style.textOverflow = 'ellipsis'
      content.style.whiteSpace = 'nowrap'

      button.appendChild(time)
      button.appendChild(content)
      button.addEventListener('click', () => {
        this._onInput(`${item.text}\n`)
      })
      root.appendChild(button)
    }

    inputTab.appendChild(root)
  }
}
