/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Render a dense wide-screen projection of Store list facts.
 * 2. Keep Inventory secondary to Inspector and Context navigation.
 * 3. Read only from the exact selected current backend.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Original request (2026-07-26): "界面上仍然可以读到缓存，但它也能知道这个缓存现在正在被更新中。"
 */
import type { StoreListEntry } from '@openspecui/core/store-types'
import { RefreshCw } from 'lucide-react'
import { EmptyView, ErrorView, LoadingView } from '../components/state-views'
import { StatusBadge } from '../components/status-badge'
import { StoreManagerShell } from '../components/store-manager-shell'
import { useActiveBackend } from '../lib/use-active-backend'
import { useStoreData } from '../lib/use-store-data'

/**
 * Store Inventory（A 视图，宽屏扫描）：registry-first 密集表格。
 *
 * 投影来源：`openspec store list --json`（stores.inspect 能力）。
 * 列：Store/checkout、Health、Identity、Git remote、Context impact、Operations。
 *
 * 关键约束（AGENTS.md）：
 *  - Inventory 提供密集的宽屏 registry 扫描，但不成为唯一的导航模型。
 *  - 诊断客观保留上游事实；不推断为所有权/完整性结论。
 *
 * TODO(kernel): list 投影的精确列由 v1.6 source 审计后对齐；当前用 store-types.ts 的 StoreListEntry
 *               (id + root) 渲染骨架，doctor 细节待 Inspector 视图承载。
 */
export function StoreInventoryRoute() {
  const { active } = useActiveBackend()
  const { inventory, isInventoryLoading, isInventoryUpdating, inventoryError } = useStoreData({
    apiBaseUrl: active?.apiBaseUrl,
  })
  const stores = inventory?.stores ?? []

  let body
  if (isInventoryLoading && !inventory) {
    body = <LoadingView label="Loading store registry..." />
  } else if (inventoryError && !inventory) {
    body = <ErrorView message={inventoryError.message} />
  } else if (stores.length === 0) {
    body = (
      <EmptyView title="Registry is empty">
        {/* TODO(kernel): stores.inspect 能力落地后，registry 投影来自 `openspec store list --json`。 */}
        Registered Stores will be listed here once the backend reports them.
      </EmptyView>
    )
  } else {
    body = renderInventoryBody(stores)
  }

  return (
    <StoreManagerShell>
      {isInventoryUpdating && inventory ? (
        <span
          role="status"
          aria-label="Refreshing store registry"
          className="text-muted-foreground inline-flex self-start"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        </span>
      ) : null}
      {inventoryError && inventory ? <ErrorView message={inventoryError.message} /> : null}
      {body}
    </StoreManagerShell>
  )
}

function renderInventoryBody(stores: StoreListEntry[]) {
  return (
    <div className="space-y-4">
      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        <span>
          <strong className="text-foreground">{stores.length}</strong> registered
        </span>
        {/* TODO(kernel): "need attention" 计数依赖 doctor 诊断（Inspector 投影）；
            store list 不带诊断，骨架阶段诚实表达为未知，不伪造 0。 */}
        <span>need attention: unknown (see Inspector)</span>
      </div>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="border-border border-b p-2 text-left font-medium">Store / checkout</th>
              <th className="border-border border-b p-2 text-left font-medium">Identity</th>
              <th className="border-border border-b p-2 text-left font-medium">Git remote</th>
              <th className="border-border border-b p-2 text-left font-medium">Operations</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={`${store.id}:${store.root}`} className="hover:bg-muted/40">
                <td className="border-border border-b p-2">
                  <div className="font-medium">{store.id}</div>
                  <div className="text-muted-foreground truncate text-xs" title={store.root}>
                    {store.root}
                  </div>
                </td>
                <td className="border-border border-b p-2">
                  {/* store list 不带 doctor 诊断；诚实表达健康未知，不用空诊断伪造 healthy。
                      真实健康来自 Inspector 的 doctor 投影。 */}
                  <StatusBadge variant="neutral" label="unknown" />
                </td>
                <td className="border-border text-muted-foreground border-b p-2 text-xs">
                  {/* TODO(kernel): remote 来自 doctor；list 阶段不可得。 */}—
                </td>
                <td className="border-border text-muted-foreground border-b p-2 text-xs">
                  {/* TODO(kernel): 操作入口由 stores.mutate 能力提供；Inspector 为主交互视图。 */}
                  Use Inspector
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
