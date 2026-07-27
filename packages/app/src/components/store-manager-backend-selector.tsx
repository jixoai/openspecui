/**
 * Orthogonal intents (created 2026-07-26 Asia/Shanghai):
 * 1. Expose and update the one global hosted-tab selection used by environment-scoped Store views.
 *
 * Original request (2026-07-26): "我不知道如何做到‘保持 A 在线、选中 B’。"
 */
import { activateHostedTab } from '../lib/shell-state'
import {
  getConnectionsSnapshot,
  useConnections,
  useConnectionsActions,
} from '../lib/use-connections'

/** Select the exact hosted backend whose current observation owns Store reads and mutations. */
export function StoreManagerBackendSelector() {
  const connections = useConnections()
  const actions = useConnectionsActions()

  return (
    <label className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
      <span className="shrink-0 font-medium">Backend</span>
      <select
        aria-label="Store Manager backend"
        value={connections.activeTabId ?? ''}
        disabled={connections.tabs.length === 0}
        onChange={(event) => {
          const current = getConnectionsSnapshot()
          actions.setState(activateHostedTab(current, event.currentTarget.value))
        }}
        className="border-border bg-background text-foreground min-w-0 max-w-72 rounded-md border px-2 py-1.5 font-mono text-xs"
      >
        {connections.tabs.length === 0 ? <option value="">No backend connected</option> : null}
        {connections.tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.apiBaseUrl}
          </option>
        ))}
      </select>
    </label>
  )
}
