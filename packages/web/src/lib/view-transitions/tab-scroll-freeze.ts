import type { TabsHandle } from '@/components/tabs'

const DATA_VISIBLE_HEIGHT = 'tabVisibleHeight'
const DATA_TOP_INSET = 'tabTopInset'
const DATA_SCROLL_OFFSET = 'tabScrollOffset'
const DATA_LAYOUT_BRIDGE = 'tabLayoutBridge'
const DATA_LAYOUT_BRIDGE_BASE_PADDING = 'tabLayoutBridgeBasePadding'
const DATA_LAYOUT_BRIDGE_INLINE_PADDING = 'tabLayoutBridgeInlinePadding'
const TAB_SCROLL_ROOT_SELECTOR = '[data-tab-scroll-root="true"]'

export interface TabScrollMemory {
  innerScrollTop: number
  contentScrollTop: number
  topInset: number
  visibleHeight: number
  viewportScrollTop: number
}

export interface FrozenTabState {
  contentScrollRoot: HTMLElement | null
  contentScrollTop: number
  finalViewportScrollTop: number
  panel: HTMLElement
  previousStyles: {
    height: string
    maxHeight: string
    minHeight: string
    overflowY: string
  }
  viewport: HTMLElement
}

interface ResolvedTabScrollElements {
  panel: HTMLElement
  contentScrollRoot: HTMLElement | null
  viewport: HTMLElement
}

export type ViewportSelector = string | readonly string[]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function maxViewportScroll(viewport: HTMLElement): number {
  return Math.max(viewport.scrollHeight - viewport.clientHeight, 0)
}

function maxPanelScroll(panel: HTMLElement, visibleHeight: number): number {
  return Math.max(panel.scrollHeight - visibleHeight, 0)
}

function readPanelLayoutBridge(panel: HTMLElement): number {
  return Number(panel.dataset[DATA_LAYOUT_BRIDGE] ?? '0') || 0
}

function ensurePanelLayoutBridgeState(panel: HTMLElement): void {
  panel.dataset[DATA_LAYOUT_BRIDGE_BASE_PADDING] ||= window.getComputedStyle(panel).paddingBottom
  panel.dataset[DATA_LAYOUT_BRIDGE_INLINE_PADDING] ||= panel.style.paddingBottom
}

function setPanelLayoutBridge(panel: HTMLElement, extraHeight: number): void {
  ensurePanelLayoutBridgeState(panel)

  const normalizedHeight = Math.max(Math.ceil(extraHeight), 0)
  panel.dataset[DATA_LAYOUT_BRIDGE] = String(normalizedHeight)

  if (normalizedHeight <= 0) {
    panel.style.paddingBottom = panel.dataset[DATA_LAYOUT_BRIDGE_INLINE_PADDING] ?? ''
    return
  }

  const basePadding = panel.dataset[DATA_LAYOUT_BRIDGE_BASE_PADDING] ?? '0px'
  panel.style.paddingBottom = `calc(${basePadding} + ${normalizedHeight}px)`
}

function restoreViewportScroll(
  viewport: HTMLElement,
  panel: HTMLElement,
  targetScrollTop: number
): void {
  const applyScrollTop = () => {
    if (!viewport.isConnected || !panel.isConnected) {
      return true
    }

    const existingBridge = readPanelLayoutBridge(panel)
    const baseMaxViewportScroll = Math.max(maxViewportScroll(viewport) - existingBridge, 0)
    const requiredBridge = Math.max(targetScrollTop - baseMaxViewportScroll, 0)

    setPanelLayoutBridge(panel, requiredBridge)
    const nextScrollTop = clamp(targetScrollTop, 0, maxViewportScroll(viewport))
    viewport.scrollTop = nextScrollTop
    return viewport.scrollTop === nextScrollTop
  }

  if (applyScrollTop() || typeof requestAnimationFrame !== 'function') {
    return
  }

  let retriesRemaining = 10
  const retry = () => {
    if (applyScrollTop() || retriesRemaining <= 0) {
      return
    }

    retriesRemaining -= 1
    requestAnimationFrame(retry)
  }

  requestAnimationFrame(retry)
}

function hasVerticalScrollBehavior(overflowY: string): boolean {
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

function findScrollableDescendant(panel: HTMLElement): HTMLElement | null {
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT)
  let candidate: HTMLElement | null = null

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof HTMLElement)) {
      continue
    }

    const style = window.getComputedStyle(node)
    if (!hasVerticalScrollBehavior(style.overflowY) || node.scrollHeight <= node.clientHeight) {
      continue
    }

    if (node.scrollTop > 0) {
      return node
    }

    candidate ??= node
  }

  return candidate
}

function resolveContentScrollRoot(panel: HTMLElement): HTMLElement | null {
  const markedRoot = panel.matches(TAB_SCROLL_ROOT_SELECTOR)
    ? panel
    : panel.querySelector<HTMLElement>(TAB_SCROLL_ROOT_SELECTOR)

  if (markedRoot) {
    return markedRoot
  }

  return findScrollableDescendant(panel)
}

function panelDocumentTop(panel: HTMLElement, viewport: HTMLElement): number {
  const panelRect = panel.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  return viewport.scrollTop + panelRect.top - viewportRect.top
}

function setFrozenMetrics(panel: HTMLElement, snapshot: TabScrollMemory): void {
  panel.dataset[DATA_VISIBLE_HEIGHT] = String(snapshot.visibleHeight)
  panel.dataset[DATA_TOP_INSET] = String(snapshot.topInset)
  panel.dataset[DATA_SCROLL_OFFSET] = String(snapshot.innerScrollTop)
}

function clearFrozenMetrics(panel: HTMLElement): void {
  delete panel.dataset[DATA_VISIBLE_HEIGHT]
  delete panel.dataset[DATA_TOP_INSET]
  delete panel.dataset[DATA_SCROLL_OFFSET]
}

function applyFrozenStyles(
  panel: HTMLElement,
  snapshot: TabScrollMemory
): FrozenTabState['previousStyles'] {
  const previousStyles = {
    height: panel.style.height,
    maxHeight: panel.style.maxHeight,
    minHeight: panel.style.minHeight,
    overflowY: panel.style.overflowY,
  }
  const height = `${snapshot.visibleHeight}px`
  panel.style.height = height
  panel.style.minHeight = height
  panel.style.maxHeight = height
  panel.style.overflowY = 'hidden'
  setFrozenMetrics(panel, snapshot)
  return previousStyles
}

function restorePanel(panel: HTMLElement, previousStyles: FrozenTabState['previousStyles']): void {
  panel.style.height = previousStyles.height
  panel.style.maxHeight = previousStyles.maxHeight
  panel.style.minHeight = previousStyles.minHeight
  panel.style.overflowY = previousStyles.overflowY
  clearFrozenMetrics(panel)
}

function restoreContentScrollRoot(element: HTMLElement | null, targetScrollTop: number): void {
  if (!element) {
    return
  }

  const applyScrollTop = () => {
    if (!element.isConnected) {
      return true
    }

    element.scrollTop = targetScrollTop
    return element.scrollTop === targetScrollTop
  }

  if (applyScrollTop() || typeof requestAnimationFrame !== 'function') {
    return
  }

  let retriesRemaining = 10
  const retry = () => {
    if (applyScrollTop() || retriesRemaining <= 0) {
      return
    }

    retriesRemaining -= 1
    requestAnimationFrame(retry)
  }

  requestAnimationFrame(retry)
}

function normalizeViewportSelectors(viewportSelector: ViewportSelector): string[] {
  return typeof viewportSelector === 'string'
    ? viewportSelector.split(',').map((selector: string) => selector.trim())
    : [...viewportSelector]
}

function resolveViewportBoundary(
  panel: HTMLElement,
  viewportSelector: ViewportSelector
): HTMLElement | null {
  const selectors = normalizeViewportSelectors(viewportSelector)

  for (const selector of selectors) {
    if (!selector) {
      continue
    }

    try {
      const match = panel.closest(selector)
      if (match instanceof HTMLElement) {
        return match
      }
    } catch {
      return null
    }
  }

  return null
}

function resolveScrollViewport(
  panel: HTMLElement,
  boundary: HTMLElement | null
): HTMLElement | null {
  let current: HTMLElement | null = panel.parentElement

  while (current) {
    const style = window.getComputedStyle(current)
    if (hasVerticalScrollBehavior(style.overflowY) && current.scrollHeight > current.clientHeight) {
      return current
    }

    if (boundary && current === boundary) {
      break
    }

    current = current.parentElement
  }

  if (!boundary) {
    return null
  }

  const boundaryStyle = window.getComputedStyle(boundary)
  if (hasVerticalScrollBehavior(boundaryStyle.overflowY)) {
    return boundary
  }

  return null
}

export function resolveTabScrollElements(
  handle: TabsHandle | null,
  tabId: string,
  viewportSelector?: ViewportSelector
): ResolvedTabScrollElements | null {
  if (!viewportSelector) return null
  const panel = handle?.getPanel(tabId)
  if (!(panel instanceof HTMLElement)) {
    return null
  }

  const boundary = resolveViewportBoundary(panel, viewportSelector)
  const viewport = resolveScrollViewport(panel, boundary)
  if (!(viewport instanceof HTMLElement)) {
    return null
  }

  return {
    panel,
    contentScrollRoot: resolveContentScrollRoot(panel),
    viewport,
  }
}

export function restorePanelContentScroll(
  panel: HTMLElement | null,
  snapshot: TabScrollMemory | null | undefined
): void {
  if (!(panel instanceof HTMLElement) || !snapshot) {
    return
  }

  const contentScrollRoot = resolveContentScrollRoot(panel)
  if (contentScrollRoot && contentScrollRoot !== panel) {
    restoreContentScrollRoot(contentScrollRoot, snapshot.contentScrollTop)
  }
}

export function restorePanelViewportScroll(
  panel: HTMLElement | null,
  viewport: HTMLElement | null,
  snapshot: TabScrollMemory | null | undefined
): void {
  if (!(panel instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
    return
  }

  if (!snapshot) {
    setPanelLayoutBridge(panel, 0)
    return
  }

  restoreViewportScroll(viewport, panel, snapshot.viewportScrollTop)
}

export function captureTabScrollMemory(
  elements: ResolvedTabScrollElements
): TabScrollMemory | null {
  const { panel, contentScrollRoot, viewport } = elements
  const panelRect = panel.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const visibleHeight = clamp(
    Math.min(panelRect.bottom, viewportRect.bottom) - Math.max(panelRect.top, viewportRect.top),
    0,
    viewport.clientHeight
  )

  if (visibleHeight <= 0) {
    return null
  }

  const topInset = Math.max(panelRect.top - viewportRect.top, 0)
  const innerScrollTop = clamp(
    Math.max(viewportRect.top - panelRect.top, 0),
    0,
    maxPanelScroll(panel, visibleHeight)
  )

  return {
    contentScrollTop:
      contentScrollRoot && contentScrollRoot !== panel ? contentScrollRoot.scrollTop : 0,
    innerScrollTop,
    topInset,
    visibleHeight,
    viewportScrollTop: viewport.scrollTop,
  }
}

export function freezeOutgoingTab(
  elements: ResolvedTabScrollElements,
  snapshot: TabScrollMemory
): FrozenTabState {
  const previousStyles = applyFrozenStyles(elements.panel, snapshot)

  if (elements.contentScrollRoot && elements.contentScrollRoot !== elements.panel) {
    restoreContentScrollRoot(elements.contentScrollRoot, snapshot.contentScrollTop)
  }

  elements.panel.scrollTop = snapshot.innerScrollTop
  if (snapshot.innerScrollTop > 0) {
    elements.viewport.scrollTop = clamp(
      elements.viewport.scrollTop - snapshot.innerScrollTop,
      0,
      maxViewportScroll(elements.viewport)
    )
  }

  return {
    contentScrollRoot:
      elements.contentScrollRoot && elements.contentScrollRoot !== elements.panel
        ? elements.contentScrollRoot
        : null,
    contentScrollTop: snapshot.contentScrollTop,
    finalViewportScrollTop: snapshot.viewportScrollTop,
    panel: elements.panel,
    previousStyles,
    viewport: elements.viewport,
  }
}

export function freezeIncomingTab(
  elements: ResolvedTabScrollElements,
  snapshot: TabScrollMemory
): FrozenTabState {
  const normalizedSnapshot: TabScrollMemory = {
    contentScrollTop:
      elements.contentScrollRoot && elements.contentScrollRoot !== elements.panel
        ? snapshot.contentScrollTop
        : 0,
    topInset: clamp(snapshot.topInset, 0, elements.viewport.clientHeight),
    visibleHeight: clamp(snapshot.visibleHeight, 1, elements.viewport.clientHeight),
    innerScrollTop: 0,
    viewportScrollTop: snapshot.viewportScrollTop,
  }

  normalizedSnapshot.innerScrollTop = clamp(
    snapshot.innerScrollTop,
    0,
    maxPanelScroll(elements.panel, normalizedSnapshot.visibleHeight)
  )

  const nextViewportScrollTop = clamp(
    panelDocumentTop(elements.panel, elements.viewport) - normalizedSnapshot.topInset,
    0,
    maxViewportScroll(elements.viewport)
  )

  const previousStyles = applyFrozenStyles(elements.panel, normalizedSnapshot)

  elements.viewport.scrollTop = nextViewportScrollTop
  if (elements.contentScrollRoot && elements.contentScrollRoot !== elements.panel) {
    restoreContentScrollRoot(elements.contentScrollRoot, normalizedSnapshot.contentScrollTop)
  }
  elements.panel.scrollTop = normalizedSnapshot.innerScrollTop

  return {
    contentScrollRoot:
      elements.contentScrollRoot && elements.contentScrollRoot !== elements.panel
        ? elements.contentScrollRoot
        : null,
    contentScrollTop: normalizedSnapshot.contentScrollTop,
    finalViewportScrollTop: snapshot.viewportScrollTop,
    panel: elements.panel,
    previousStyles,
    viewport: elements.viewport,
  }
}

export function finalizeFrozenIncomingTab(state: FrozenTabState): void {
  restorePanel(state.panel, state.previousStyles)
  restoreViewportScroll(state.viewport, state.panel, state.finalViewportScrollTop)
  state.panel.scrollTop = 0
  if (state.contentScrollRoot) {
    restoreContentScrollRoot(state.contentScrollRoot, state.contentScrollTop)
  }
}

export function cleanupFrozenTab(state: FrozenTabState): void {
  restorePanel(state.panel, state.previousStyles)
  state.panel.scrollTop = 0
}
