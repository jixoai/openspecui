import { Badge } from '@/components/badge'
import { isStaticMode } from '@/lib/static-mode'
import { trpc } from '@/lib/trpc'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, LoaderCircle, RefreshCw, Store } from 'lucide-react'

import type { StoreFeatureResult, StoreListEntry } from '@openspecui/core/store-types'

/**
 * Stores 面板（只读，Beta）。
 *
 * 实现 beta 功能容错范式（spec: openspec-cli-integration › Beta Feature Fault Tolerance）：
 * 前端永不崩溃，按后端返回的 error.kind 差异化处理——
 *  - 异常一（data-incompatible）：客观显示错误 + 版本来源信息（cliVersion，版本信息非常重要）。
 *  - 异常二（command-unavailable）：入口本身在 nav 层隐藏（见 useStoresVisibility），
 *    即使渲染到这里也给出最简提示而非崩溃。
 *
 * 数据来自 `openspec store list --json`（后端宽松解析 + 两类异常归类），仅 live 模式可见。
 */
export function StoresList() {
  const staticMode = isStaticMode()

  const { data, isLoading, isFetching, refetch } = useQuery({
    ...trpc.stores.list.queryOptions(),
    enabled: !staticMode,
    staleTime: 30_000,
  })

  if (staticMode) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Stores are only available in live mode.
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <Store className="h-6 w-6 shrink-0" />
          Stores
          <Badge tone="subtle" size="xs">
            Beta
          </Badge>
        </h1>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs disabled:opacity-50"
          title="Refresh stores"
        >
          {isFetching ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      <StoresBody data={data} loading={isLoading && !data} />
    </div>
  )
}

function StoresBody({
  data,
  loading,
}: {
  data: StoreFeatureResult<StoreListEntry[]> | undefined
  loading: boolean
}) {
  if (loading) {
    return <div className="route-loading animate-pulse">Loading stores...</div>
  }

  // 异常一：数据不兼容 → 客观显示错误 + 版本来源信息。
  if (data?.error?.kind === 'data-incompatible') {
    return (
      <div className="text-muted-foreground space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Stores data is incompatible
        </div>
        <p>{data.error.message}</p>
        <VersionSource cliVersion={data.error.cliVersion ?? data.cliVersion} />
      </div>
    )
  }

  // 异常二兜底（入口正常会在 nav 层隐藏；若仍渲染到这里，给最简提示，不崩溃）。
  if (data?.error?.kind === 'command-unavailable') {
    return (
      <div className="text-muted-foreground border-border rounded-lg border p-4 text-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Stores are unavailable with this OpenSpec CLI.
        </div>
        <VersionSource cliVersion={data.error.cliVersion ?? data.cliVersion} />
      </div>
    )
  }

  const stores = data?.stores ?? []

  return (
    <>
      <p className="text-muted-foreground text-sm">
        Machine-registered OpenSpec stores.{' '}
        <span className="text-xs">
          (Beta — auto-refreshes every 5s; the registry lives outside the project directory.)
        </span>
      </p>
      <div className="border-border divide-border divide-y rounded-lg border">
        {stores.map((store) => (
          <StoresRow key={`${store.id}:${store.root}`} store={store} />
        ))}
        {stores.length === 0 && (
          <div className="text-muted-foreground p-4 text-center">
            No stores registered. Use{' '}
            <code className="bg-muted rounded px-1">openspec store setup/register</code> in a
            terminal.
          </div>
        )}
      </div>
    </>
  )
}

function StoresRow({ store }: { store: StoreListEntry }) {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <Store className="text-muted-foreground h-5 w-5 shrink-0" />
        <div>
          <div className="font-medium">{store.id}</div>
          <div className="text-muted-foreground truncate text-sm">{store.root}</div>
        </div>
      </div>
    </div>
  )
}

/** 版本来源信息展示——版本信息非常重要（manager directive）。 */
function VersionSource({ cliVersion }: { cliVersion?: string }) {
  if (!cliVersion) return null
  return (
    <p className="text-xs opacity-80">
      OpenSpec CLI version: <code className="bg-muted rounded px-1">{cliVersion}</code>
    </p>
  )
}
