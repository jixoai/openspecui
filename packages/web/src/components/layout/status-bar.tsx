import { Wifi, WifiOff, FolderOpen, RefreshCw } from 'lucide-react'
import { useServerStatus, useManualReconnect } from '@/lib/use-server-status'
import { PathMarquee } from '@/components/path-marquee'

/** Status indicator - simplified for mobile, full for desktop */
export function StatusIndicator() {
  const status = useServerStatus()
  const reconnect = useManualReconnect()

  if (status.connected) {
    return (
      <div className="status-indicator flex items-center gap-1.5 text-xs">
        <Wifi className="w-3.5 h-3.5 text-green-500" />
        <span className="status-text text-green-600">Live</span>
      </div>
    )
  }

  // 断开连接时显示重连提示
  return (
    <div className="status-indicator flex items-center gap-1.5 text-xs">
      <WifiOff className="w-3.5 h-3.5 text-red-500" />
      <span className="status-text text-red-600">Offline</span>
      {status.reconnectCountdown !== null && (
        <button
          onClick={reconnect}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Click to reconnect now"
        >
          <span className="text-xs">({status.reconnectCountdown}s)</span>
          <RefreshCw className="w-3 h-3" />
        </button>
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
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <PathMarquee
              path={status.projectDir}
              maxWidth={300}
              duration={12}
              className="text-xs"
            />
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
