import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Bridge React components into web-components Storybook renderer.
 */
export function renderReactStory(element: ReactElement): HTMLElement {
  const container = document.createElement('div')
  const root = createRoot(container)
  root.render(element)
  return container
}
