/**
 * Utilities for hash-anchor navigation inside nested scroll containers.
 */

export function findContentScrollContainer(element: HTMLElement): HTMLElement | null {
  return element.closest('.viewer-scroll') as HTMLElement
}

function findHeadingTargetInContainer(
  container: HTMLElement,
  headingId: string
): HTMLElement | null {
  const candidates = container.querySelectorAll<HTMLElement>('[id]')
  for (const candidate of candidates) {
    if (candidate.id === headingId) {
      return candidate
    }
  }
  return null
}

export function resolveHashTarget(
  anchorElement: HTMLElement,
  hash: string
): {
  headingId: string
  target: HTMLElement | null
  contentContainer: HTMLElement | null
} {
  const headingId = decodeURIComponent(hash.replace(/^#/, ''))
  const contentContainer = findContentScrollContainer(anchorElement)

  if (!contentContainer) {
    return { headingId, target: document.getElementById(headingId), contentContainer: null }
  }

  const scopedTarget = findHeadingTargetInContainer(contentContainer, headingId)
  if (scopedTarget) {
    return { headingId, target: scopedTarget, contentContainer }
  }

  return { headingId, target: document.getElementById(headingId), contentContainer }
}

export function scrollResolvedHashTarget(
  target: HTMLElement,
  contentContainer: HTMLElement | null
) {
  if (!contentContainer) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  const containerRect = contentContainer.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const top = contentContainer.scrollTop + (targetRect.top - containerRect.top) - 8

  contentContainer.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
}

export function navigateHashAnchor(anchorElement: HTMLAnchorElement, hash: string): boolean {
  const { headingId, target, contentContainer } = resolveHashTarget(anchorElement, hash)
  if (!target || !headingId) return false

  scrollResolvedHashTarget(target, contentContainer)

  if (window.location.hash !== `#${headingId}`) {
    window.history.replaceState(null, '', `#${headingId}`)
  }

  return true
}
