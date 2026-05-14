import { NotificationEntryButton } from '@/components/notifications/notification-entry-button'
import { PathMarquee } from '@/components/path-marquee'
import { Tooltip } from '@/components/tooltip'
import { loadSnapshot } from '@/lib/static-data-provider'
import { isStaticMode } from '@/lib/static-mode'
import { useManualReconnect, useServerStatus } from '@/lib/use-server-status'
import { Camera, FolderOpen, Github, Link2, RefreshCw, Unlink2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Status indicator - simplified for mobile, full for desktop */
export function StatusIndicator({ compact = false }: { compact?: boolean }) {
  if (isStaticMode()) {
    return (
      <div
        className="status-indicator flex items-center gap-1.5 text-xs"
        title="Live features disabled (no file watching, task toggling, or AI integration)"
      >
        <Camera className="h-3.5 w-3.5 text-blue-500" />
        {!compact && <span className="status-text text-blue-600">Static</span>}
      </div>
    )
  }

  const status = useServerStatus()
  const reconnect = useManualReconnect()

  if (status.connected) {
    const watcherText = status.watcherEnabled ? 'Watching for changes' : 'File watcher disabled'
    return (
      <div className="status-indicator flex items-center gap-1.5 text-xs">
        <Link2 className="h-3.5 w-3.5 text-green-500" />
        {!compact && (
          <Tooltip content={watcherText}>
            <span className="status-text cursor-default text-green-600">Live</span>
          </Tooltip>
        )}
      </div>
    )
  }

  // 断开连接时显示重连提示
  return (
    <div className="status-indicator flex items-center gap-1.5 text-xs">
      <Unlink2 className="h-3.5 w-3.5 text-red-500" />
      {!compact && <span className="status-text text-red-600">Offline</span>}
      {status.reconnectCountdown !== null && (
        <button
          onClick={reconnect}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 transition-colors"
          title="Click to reconnect now"
        >
          <span className="text-xs">({status.reconnectCountdown}s)</span>
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

/** Desktop status bar - full information */
export function DesktopStatusBar() {
  const staticMode = isStaticMode()
  const [generatedAt, setGeneratedAt] = useState('Unknown')
  const [snapshotRepositoryUrl, setSnapshotRepositoryUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!staticMode) return
    void loadSnapshot()
      .then((snapshot) => {
        if (snapshot?.meta?.timestamp) {
          setGeneratedAt(new Date(snapshot.meta.timestamp).toLocaleString())
        } else {
          setGeneratedAt('Unknown')
        }
        setSnapshotRepositoryUrl(snapshot?.git?.repositoryUrl ?? null)
      })
      .catch(() => {
        setGeneratedAt('Unknown')
        setSnapshotRepositoryUrl(null)
      })
  }, [staticMode])

  if (staticMode) {
    return (
      <div className="desktop-status border-border bg-muted/30 text-muted-foreground flex h-8 items-center justify-between gap-4 border-t px-2 text-xs">
        <div className="flex min-w-0 items-center gap-4">
          <StatusIndicator />
          <span className="truncate">Generated: {generatedAt}</span>
          {snapshotRepositoryUrl && (
            <div className="flex min-w-0 items-center gap-1.5">
              <Github className="h-3.5 w-3.5 shrink-0" />
              <PathMarquee
                children={snapshotRepositoryUrl}
                maxWidth={280}
                duration={12}
                className="text-xs"
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const status = useServerStatus()

  return (
    <div className="desktop-status border-border bg-muted/30 text-muted-foreground flex h-8 items-center justify-between gap-4 border-t px-2 text-xs">
      <div className="flex items-center gap-4">
        <StatusIndicator />
        {status.projectDir && (
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <PathMarquee
              children={status.projectDir}
              maxWidth={300}
              duration={12}
              className="text-xs"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NotificationEntryButton className="h-6 w-6" iconClassName="h-3.5 w-3.5" />
      </div>
    </div>
  )
}
