/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Provide one IntersectionObserver reveal action shared by the home narrative sections.
 * 2. Keep content visible when reduced motion is requested or no observer exists.
 *
 * Original request (2026-08-19): "可以用是Scroll-Animation 来实现相关的 features 展示，但是注意动效要克制"
 */
export interface RevealOptions {
  /** Transition delay in milliseconds; used to stagger sibling entrances. */
  delay?: number
  /** Rise distance in pixels for the default variant. */
  rise?: number
  /** Draw the element as a horizontal rule (scaleX) instead of rising. */
  rule?: boolean
}

export function reveal(node: HTMLElement, options: RevealOptions = {}): { destroy: () => void } {
  if (options.rule) {
    node.setAttribute('data-reveal', 'rule')
  } else {
    node.setAttribute('data-reveal', '')
  }
  if (options.delay !== undefined) {
    node.style.setProperty('--reveal-delay', `${options.delay}ms`)
  }
  if (options.rise !== undefined) {
    node.style.setProperty('--reveal-rise', `${options.rise}px`)
  }

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
    node.classList.add('is-revealed')
    return { destroy: () => undefined }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          node.classList.add('is-revealed')
          observer.unobserve(node)
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  )
  observer.observe(node)
  return { destroy: () => observer.disconnect() }
}
