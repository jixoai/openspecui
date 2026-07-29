/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Consume the typed Store-list CLI projection for presentation suggestions.
 * 2. Preserve retained data and explicit lifecycle errors during registry revalidation.
 * 3. Keep Store suggestions read-only and separate from Project Binding mutation authority.
 *
 * Original request (2026-07-29): "Project Binding 的 Store 表单使用 Combobox，并允许注册表建议。"
 */
import {
  HostedCliProjectionNoticeSchema,
  HostedStoreListProjectionStateSchema,
  type HostedStoreListEnvelope,
} from '@openspecui/core/hosted-contract'
import { useMemo } from 'react'
import { trpcClient } from './trpc'
import {
  useCliProjectionLifecycle,
  type CliProjectionLifecycleSource,
  type CliProjectionSubscriptionState,
} from './use-cli-projection'

/** Read-only registry projection used to populate Store id suggestions. */
export function useStoreListProjection(
  enabled = true
): CliProjectionSubscriptionState<HostedStoreListEnvelope> {
  const source = useMemo<CliProjectionLifecycleSource<HostedStoreListEnvelope>>(
    () => ({
      read: () => trpcClient.stores.readListProjection.query(),
      refresh: () => trpcClient.stores.refreshProjection.mutate({ kind: 'list' }),
      parseState: (raw) => HostedStoreListProjectionStateSchema.parse(raw),
      subscribe(callbacks) {
        return trpcClient.stores.subscribeProjection.subscribe(
          { kind: 'list' },
          {
            onData(raw) {
              const notice = HostedCliProjectionNoticeSchema.safeParse(raw)
              if (!notice.success) {
                callbacks.onError(new Error(`Malformed Store list notice: ${notice.error.message}`))
                return
              }
              callbacks.onNotice()
            },
            onError: callbacks.onError,
            onConnectionStateChange(connection) {
              if (connection.error) {
                callbacks.onError(connection.error)
              } else if (connection.state === 'connecting' || connection.state === 'pending') {
                callbacks.onConnectionState(connection.state)
              }
            },
            onStopped: callbacks.onStopped,
            onComplete: callbacks.onComplete,
          }
        )
      },
    }),
    []
  )

  return useCliProjectionLifecycle({
    source,
    sourceKey: 'stores.list',
    selectData: (data) => data,
    staticLoader: async (): Promise<HostedStoreListEnvelope> => ({
      available: false,
      stores: [],
    }),
    cacheKey: 'stores.list.projection',
    enabled,
  })
}
