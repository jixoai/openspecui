import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const REACT_STORY_HOST_TAG = 'openspecui-react-story-host'

interface ReactStoryHostElement extends HTMLElement {
  __storyElement?: ReactElement
  __storyRoot?: Root
}

if (!customElements.get(REACT_STORY_HOST_TAG)) {
  customElements.define(
    REACT_STORY_HOST_TAG,
    class ReactStoryHost extends HTMLElement {
      connectedCallback() {
        const host = this as ReactStoryHostElement
        if (!host.__storyElement) {
          return
        }

        host.__storyRoot ??= createRoot(host)
        host.__storyRoot.render(host.__storyElement)
      }

      disconnectedCallback() {
        const host = this as ReactStoryHostElement
        host.__storyRoot?.unmount()
        host.__storyRoot = undefined
      }
    }
  )
}

/**
 * Bridge React components into web-components Storybook renderer.
 */
export function renderReactStory(element: ReactElement): HTMLElement {
  const container = document.createElement(REACT_STORY_HOST_TAG) as ReactStoryHostElement
  container.__storyElement = element
  return container
}
