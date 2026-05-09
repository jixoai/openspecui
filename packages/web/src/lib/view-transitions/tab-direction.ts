import type { VTDirection } from './route-semantics'

export function resolveTabCarouselDirection<TTab extends { id: string }>(
  tabs: readonly TTab[],
  currentTabId: string,
  nextTabId: string
): VTDirection | null {
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTabId)
  const nextIndex = tabs.findIndex((tab) => tab.id === nextTabId)

  if (currentIndex < 0 || nextIndex < 0 || currentIndex === nextIndex) {
    return null
  }

  return nextIndex > currentIndex ? 'forward' : 'backward'
}
