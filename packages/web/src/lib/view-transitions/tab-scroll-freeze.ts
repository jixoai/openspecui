import type { TabsHandle } from '@/components/tabs'

const DATA_VISIBLE_HEIGHT = 'tabVisibleHeight'
const DATA_TOP_INSET = 'tabTopInset'
const DATA_SCROLL_OFFSET = 'tabScrollOffset'

export interface TabScrollMemory {
  innerScrollTop: number
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

  return { panel, viewport }
}

export function captureTabScrollMemory(
  elements: ResolvedTabScrollElements
): TabScrollMemory | null {
  const { panel, viewport } = elements
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
  elements.panel.scrollTop = normalizedSnapshot.innerScrollTop

  return {
    panel: elements.panel,
    previousStyles,
    viewport: elements.viewport,
  }
}

export function finalizeFrozenIncomingTab(state: FrozenTabState): void {
  const transferScrollTop = state.panel.scrollTop
  restorePanel(state.panel, state.previousStyles)
  state.viewport.scrollTop = clamp(
    state.viewport.scrollTop + transferScrollTop,
    0,
    maxViewportScroll(state.viewport)
  )
  state.panel.scrollTop = 0
}

export function cleanupFrozenTab(state: FrozenTabState): void {
  restorePanel(state.panel, state.previousStyles)
  state.panel.scrollTop = 0
}
