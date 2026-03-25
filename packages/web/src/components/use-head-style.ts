import { useInsertionEffect } from 'react'

export function useHeadStyle(styleId: string, cssText: string): void {
  useInsertionEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const existing = [
      ...document.head.querySelectorAll<HTMLStyleElement>('style[data-head-style]'),
    ].find((node) => node.dataset.headStyle === styleId)

    if (existing) {
      const currentCount = Number(existing.dataset.refCount ?? '1')
      existing.dataset.refCount = String(currentCount + 1)
      if (existing.textContent !== cssText) {
        existing.textContent = cssText
      }

      return () => {
        const nextCount = Number(existing.dataset.refCount ?? '1') - 1
        if (nextCount <= 0) {
          existing.remove()
          return
        }
        existing.dataset.refCount = String(nextCount)
      }
    }

    const style = document.createElement('style')
    style.setAttribute('data-head-style', styleId)
    style.dataset.refCount = '1'
    style.textContent = cssText
    document.head.appendChild(style)

    return () => {
      const nextCount = Number(style.dataset.refCount ?? '1') - 1
      if (nextCount > 0) {
        style.dataset.refCount = String(nextCount)
        return
      }
      style.remove()
    }
  }, [cssText, styleId])
}
