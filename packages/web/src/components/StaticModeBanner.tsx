import { useEffect, useState } from 'react'
import { loadSnapshot } from '../lib/static-data-provider'
import { isStaticMode } from '../lib/static-mode'

export function StaticModeBanner() {
  const [timestamp, setTimestamp] = useState<string>('Loading...')

  useEffect(() => {
    if (isStaticMode()) {
      // Load snapshot to get timestamp
      loadSnapshot()
        .then((snapshot) => {
          console.log('[StaticModeBanner] Snapshot loaded:', snapshot)
          console.log('[StaticModeBanner] Meta:', snapshot?.meta)
          console.log('[StaticModeBanner] Timestamp:', snapshot?.meta?.timestamp)
          if (snapshot?.meta?.timestamp) {
            setTimestamp(new Date(snapshot.meta.timestamp).toLocaleString())
          } else {
            setTimestamp('Unknown')
          }
        })
        .catch((error) => {
          console.error('[StaticModeBanner] Error loading snapshot:', error)
          setTimestamp('Unknown')
        })
    }
  }, [])

  if (!isStaticMode()) {
    return null
  }

  return (
    <div className="static-mode-banner border-border bg-primary/5 border-b-2 px-6 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold">📸 Static Snapshot</span>
          <span className="text-muted-foreground">Generated: {timestamp}</span>
        </div>
        <div className="text-muted-foreground">
          Live features disabled (no file watching, task toggling, or AI integration)
        </div>
      </div>
    </div>
  )
}
