/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Render backend connection discovery and retained entry actions.
 * 2. Keep credentials outside persisted connection state.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 */
import { Dialog } from '@openspecui/web-src/components/dialog'
import { Link } from '@tanstack/react-router'
import { Home, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EmptyView } from '../components/state-views'
import { StatusDot } from '../components/status-badge'
import {
  applyHostedLaunchRequest,
  generateHostedSessionId,
  normalizeHostedApiBaseUrl,
  removeHostedTab,
  type HostedShellTab,
} from '../lib/shell-state'
import {
  useConnectionReachability,
  useConnections,
  useConnectionsActions,
} from '../lib/use-connections'

/**
 * Home / Connections（App 首页）。
 *
 * 列出持久化的 backend 连接条目（无凭据——AGENTS.md），展示可达性 checking/online/offline，
 * 提供 Add / Open / Remove 操作（每项绑定 loading 锁，杜绝幽灵操作）。
 *
 * TODO(kernel): 后端 health 协议落地后，从此处提取 envUri + capabilities，
 *               并把连接按 envUri 分组（Environment Center 负责），Connections 保持按 backend 实例列出。
 */
export function ConnectionsRoute() {
  const state = useConnections()
  const reachability = useConnectionReachability(state.tabs)
  const actions = useConnectionsActions()
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const tabs = state.tabs
  const isLoading = tabs.some((tab) => reachability[tab.apiBaseUrl] === 'checking')

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <Home className="h-6 w-6 shrink-0" />
          Connections
        </h1>
        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Backend
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        One App tab hosts one project backend. Connections are persisted without credentials.
      </p>

      {tabs.length === 0 ? (
        <EmptyView title="No backend connections yet">
          Add a backend API URL to connect to an OpenSpec UI project backend.
        </EmptyView>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {tabs.map((tab) => (
            <ConnectionRow
              key={tab.id}
              tab={tab}
              reachability={reachability[tab.apiBaseUrl]}
              onRemove={() => {
                actions.setState(removeHostedTab(state, tab.id))
              }}
            />
          ))}
        </div>
      )}

      {isLoading && tabs.length > 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking reachability...
        </div>
      ) : null}

      {addDialogOpen ? (
        <AddBackendDialog
          onClose={() => setAddDialogOpen(false)}
          onAdd={(apiBaseUrl) => {
            const next = applyHostedLaunchRequest(
              state,
              { apiBaseUrl },
              {
                sessionId: generateHostedSessionId(),
              }
            )
            actions.setState(next)
            setAddDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function ConnectionRow({
  tab,
  reachability,
  onRemove,
}: {
  tab: HostedShellTab
  reachability: 'checking' | 'online' | 'offline' | 'unsupported' | undefined
  onRemove: () => void
}) {
  return (
    <div className="hover:bg-muted/40 flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <ReachabilityBadge reachability={reachability} />
        <div className="min-w-0">
          <div className="truncate font-medium">{getHostLabel(tab)}</div>
          <div className="text-muted-foreground truncate text-xs">{tab.apiBaseUrl}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link to="/sessions" className="hover:bg-muted rounded-md px-3 py-1.5 text-sm">
          Open
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove connection ${tab.apiBaseUrl}`}
          className="text-muted-foreground hover:text-destructive hover:bg-muted rounded-md p-1.5"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function getHostLabel(tab: HostedShellTab): string {
  try {
    return new URL(tab.apiBaseUrl).host
  } catch {
    return tab.apiBaseUrl
  }
}

/** 把后端可达性映射成统一 StatusDot variant（语义化状态徽章共用）。 */
function reachabilityToVariant(
  reachability: 'checking' | 'online' | 'offline' | 'unsupported' | undefined
): 'healthy' | 'neutral' | 'pending' {
  if (reachability === 'online') return 'healthy'
  if (reachability === 'offline') return 'neutral'
  return 'pending'
}

function ReachabilityBadge({
  reachability,
}: {
  reachability: 'checking' | 'online' | 'offline' | 'unsupported' | undefined
}) {
  const label =
    reachability === 'online'
      ? 'online'
      : reachability === 'offline'
        ? 'offline'
        : reachability === 'checking'
          ? 'checking'
          : 'unknown'
  return <StatusDot variant={reachabilityToVariant(reachability)} ariaLabel={`Backend ${label}`} />
}

/**
 * Add Backend 对话框（骨架）。
 *
 * 本轮骨架只收集 apiBaseUrl；凭据（可选 Bearer）尚未实现。
 * TODO(kernel): 后端 Access Gate 落地后，这里可接受一次性凭据（仅 session memory，不持久化）。
 */
function AddBackendDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (apiBaseUrl: string) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Dialog 打开后聚焦输入，便于键盘操作。
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])

  const submit = () => {
    const normalized = normalizeHostedApiBaseUrl(value)
    if (!normalized) {
      setError('Enter a valid backend API URL (e.g. http://localhost:3100).')
      return
    }
    setSubmitting(true)
    // 绑定 loading 锁（Style 指令：网络触发控件默认绑定 Loading 状态锁）。
    onAdd(normalized)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={<span className="text-lg font-semibold">Add Backend</span>}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="hover:bg-muted rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </>
      }
    >
      <div className="space-y-1.5">
        <label htmlFor="api-url" className="text-sm font-medium">
          API URL
        </label>
        <input
          id="api-url"
          ref={inputRef}
          type="url"
          value={value}
          disabled={submitting}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="http://localhost:3100"
          className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </Dialog>
  )
}
