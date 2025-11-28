import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        callback()
      }
    }
  })

  observer.observe(document.documentElement, { attributes: true })

  return () => observer.disconnect()
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark')
}

function getServerSnapshot() {
  return false
}

/** Hook to detect dark mode from document.documentElement.classList */
export function useDarkMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
