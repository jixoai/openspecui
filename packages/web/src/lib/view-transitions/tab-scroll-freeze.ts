import type { TabsHandle } from '@/components/tabs'

const DATA_VISIBLE_HEIGHT = 'tabVisibleHeight'
const DATA_TOP_INSET = 'tabTopInset'
const DATA_SCROLL_OFFSET = 'tabScrollOffset'
const TAB_SCROLL_ROOT_SELECTOR = '[data-tab-scroll-root="true"]'

export interface TabScrollMemory {
  innerScrollTop: number
  contentScrollTop: number
  topInset: number
  visibleHeight: number
}

export interface FrozenTabState {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function maxViewportScroll(viewport: HTMLElement): number {
  return Math.max(viewport.scrollHeight - viewport.clientHeight, 0)
}

function maxPanelScroll(panel: HTMLElement, visibleHeight: number): number {
  return Math.max(panel.scrollHeight - visibleHeight, 0)
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
  const markedRoot =
    panel.matches(TAB_SCROLL_ROOT_SELECTOR) ? panel : panel.querySelector<HTMLElement>(TAB_SCROLL_ROOT_SELECTOR)

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

export function resolveTabScrollElements(
  handle: TabsHandle | null,
  tabId: string,
  viewportSelector?: string
): ResolvedTabScrollElements | null {
  if (!viewportSelector) return null
  const panel = handle?.getPanel(tabId)
  if (!(panel instanceof HTMLElement)) {
    return null
  }

  let viewport: Element | null = null
  try {
    viewport = panel.closest(viewportSelector)
  } catch {
    return null
  }
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
    panel: elements.panel,
    previousStyles,
    viewport: elements.viewport,
  }
}

export function finalizeFrozenIncomingTab(state: FrozenTabState): void {
  const transferScrollTop = state.panel.scrollTop
  const contentScrollRoot =
    state.panel.matches(TAB_SCROLL_ROOT_SELECTOR)
      ? state.panel
      : state.panel.querySelector<HTMLElement>(TAB_SCROLL_ROOT_SELECTOR) ??
        findScrollableDescendant(state.panel)
  const contentScrollTop =
    contentScrollRoot && contentScrollRoot !== state.panel ? contentScrollRoot.scrollTop : 0
  restorePanel(state.panel, state.previousStyles)
  state.viewport.scrollTop = clamp(
    state.viewport.scrollTop + transferScrollTop,
    0,
    maxViewportScroll(state.viewport)
  )
  state.panel.scrollTop = 0
  if (contentScrollRoot && contentScrollRoot !== state.panel) {
    restoreContentScrollRoot(contentScrollRoot, contentScrollTop)
  }
}

export function cleanupFrozenTab(state: FrozenTabState): void {
  restorePanel(state.panel, state.previousStyles)
  state.panel.scrollTop = 0
}
