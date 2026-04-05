import { useEffect } from 'react'
import { ensureViewTransitionsReady } from './runtime'

export function ViewTransitionsBootstrap() {
  useEffect(() => {
    ensureViewTransitionsReady()
  }, [])

  return null
}
