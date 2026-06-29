import { isStaticMode } from '@/lib/static-mode'
import { trpc } from '@/lib/trpc'
import { useQuery } from '@tanstack/react-query'

import type { StoreFeatureResult, StoreListEntry } from '@openspecui/core/store-types'

/**
 * 控制 Stores 入口的可见性（beta 功能容错范式的一部分）。
 *
 * 异常二（command-unavailable）：指令用法变了/指令缺失，直接隐藏入口。
 * 异常一（data-incompatible）：数据不兼容，不隐藏入口（面板内客观显示错误 + 版本信息）。
 *
 * 与 StoresList 共享同一份 TanStack Query 缓存（同 queryKey），避免重复请求。
 */
export function useStoresVisibility(): { visible: boolean } {
  const staticMode = isStaticMode()

  const { data } = useQuery({
    ...trpc.stores.list.queryOptions(),
    enabled: !staticMode,
    staleTime: 30_000,
  })

  if (staticMode) {
    return { visible: false }
  }

  // 数据还没回来时，先显示入口（乐观），避免 beta 入口闪烁消失。
  if (data === undefined) {
    return { visible: true }
  }

  const result = data as StoreFeatureResult<StoreListEntry[]>
  const hidden = result.available === false && result.error?.kind === 'command-unavailable'
  return { visible: !hidden }
}
