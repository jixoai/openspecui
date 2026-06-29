import { isStaticMode } from '@/lib/static-mode'
import { useStoresSubscription } from '@/lib/use-subscription'

import type { StoreFeatureResult, StoreListEntry } from '@openspecui/core/store-types'

/**
 * 控制 Stores 入口的可见性（beta 功能容错范式的一部分）。
 *
 * 异常二（command-unavailable）：指令用法变了/指令缺失，直接隐藏入口。
 * 异常一（data-incompatible）：数据不兼容，不隐藏入口（面板内客观显示错误 + 版本信息）。
 *
 * 数据由 server 端轮询 registry 并推送（订阅），与 StoresList 共享同一订阅缓存。
 */
export function useStoresVisibility(): { visible: boolean } {
  const staticMode = isStaticMode()

  const { data } = useStoresSubscription()

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
