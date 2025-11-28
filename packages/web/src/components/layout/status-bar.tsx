import { Wifi, WifiOff, FolderOpen } from 'lucide-react'
import { useServerStatus } from '@/lib/use-server-status'

/** Status indicator - simplified for mobile, full for desktop */
export function StatusIndicator() {
  const status = useServerStatus()

  return (
    <div className="status-indicator flex items-center gap-1.5 text-xs">
      {status.connected ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-green-500" />
          <span className="status-text text-green-600">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-red-500" />
          <span className="status-text text-red-600">Offline</span>
        </>
      )}
    </div>
  )
}

/** Desktop status bar - full information */
export function DesktopStatusBar() {
  const status = useServerStatus()

  return (
    <div className="desktop-status h-8 border-t border-border bg-muted/30 px-4 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <StatusIndicator />
        {status.projectDir && (
          <div className="flex items-center gap-1.5" title={status.projectDir}>
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="max-w-[300px] truncate">{status.projectDir}</span>
          </div>
        )}
      </div>
      {status.connected && (
        <div className="flex items-center gap-1.5">
          {status.watcherEnabled ? (
            <span className="text-green-600">Watching for changes</span>
          ) : (
            <span className="text-yellow-600">File watcher disabled</span>
          )}
        </div>
      )}
    </div>
  )
}
