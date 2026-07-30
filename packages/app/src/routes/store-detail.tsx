/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Decode composite Store route identity and converge selected Environment on reload.
 * 2. Bind one Detail-only content lifecycle and observed Usage/product projection.
 * 3. Pin unregister/remove authority and settle only from the backend mutation ledger.
 * 4. Keep invalid, unavailable, and retained-error route states directly repairable.
 *
 * Original request (2026-07-30): "StoreDetailPage应该如何设计呢？"
 * Spec: hosted-app-distribution > "Open Store Detail".
 */
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { StoreDetail } from '../components/store-detail'
import { StoreCleanupDialog, type StoreCleanupKind } from '../components/store-remove-dialog'
import type { EnvironmentActionAuthority } from '../lib/environment-authority'
import { selectStoreDetailProjection } from '../lib/store-detail-projection'
import { projectStoreDetailInput, selectStoreDoctor } from '../lib/store-product-projection'
import { buildStoresIndexPath, parseStoreDetailRouteIdentity } from '../lib/store-route-identity'
import { useStoresRuntime } from '../lib/stores-runtime'
import { useStoreContentData } from '../lib/use-store-content-data'

function RouteMessage({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="space-y-3 p-4 md:p-6">
      <p className="border-border bg-muted/30 rounded-md border px-3 py-2 text-sm">{message}</p>
      <button
        type="button"
        onClick={onBack}
        className="hover:bg-muted rounded-md px-3 py-1.5 text-sm"
      >
        Back to Stores
      </button>
    </div>
  )
}

/** Production route owner for one composite `/stores/:envUri/:storeId` identity. */
export function StoreDetailRoute() {
  const params = useParams({ strict: false })
  const navigate = useNavigate()
  const runtime = useStoresRuntime()
  const identity = parseStoreDetailRouteIdentity(params.encodedEnvUri, params.storeId)
  const [cleanupDraft, setCleanupDraft] = useState<{
    kind: StoreCleanupKind
    authority: EnvironmentActionAuthority
  } | null>(null)
  const selectedIdentity = Boolean(identity && runtime.selectedEnvUri === identity.envUri)
  const source = selectedIdentity ? runtime.readSource : null
  const content = useStoreContentData({
    apiBaseUrl: source?.apiBaseUrl ?? null,
    envUri: identity?.envUri ?? '',
    storeId: identity?.storeId ?? '',
    supported: source ? runtime.contentSupported : true,
  })

  const routeEnvUri = identity?.envUri ?? null
  const selectedEnvUri = runtime.selectedEnvUri
  const selectEnvironment = runtime.selectEnvironment
  useEffect(() => {
    if (routeEnvUri && selectedEnvUri !== routeEnvUri) {
      selectEnvironment(routeEnvUri)
    }
  }, [routeEnvUri, selectEnvironment, selectedEnvUri])

  const goBack = () => void navigate({ to: buildStoresIndexPath() })
  if (!identity) return <RouteMessage message="This Store route is invalid." onBack={goBack} />
  if (!selectedIdentity) {
    return <RouteMessage message="Selecting the Store's Environment..." onBack={goBack} />
  }
  const doctor = selectStoreDoctor(runtime.storeData.inspector, identity.storeId)
  const inventoryStore = runtime.storeData.inventory?.stores.find(
    (store) => store.id === identity.storeId
  )
  if (
    !doctor &&
    !inventoryStore &&
    !runtime.storeData.isInspectorLoading &&
    !runtime.storeData.isInventoryLoading
  ) {
    return (
      <RouteMessage
        message={`Store ${identity.storeId} is not currently observed in this Environment.`}
        onBack={goBack}
      />
    )
  }
  const projection = selectStoreDetailProjection(
    projectStoreDetailInput({
      ...identity,
      inventory: runtime.storeData.inventory,
      inspector: runtime.storeData.inspector,
      projectContexts: runtime.projectContexts,
      mutations: runtime.mutationRecords,
      specs: content.specs,
      changes: content.changes,
      hasAuthority: runtime.pinMutationAuthority() !== null,
    })
  )
  const dialogStore: StoreDoctorStore = doctor ?? {
    id: identity.storeId,
    root: inventoryStore?.root,
  }

  return (
    <>
      <StoreDetail
        projection={projection}
        onBack={goBack}
        onUnregister={() => {
          const authority = runtime.pinMutationAuthority()
          if (authority) setCleanupDraft({ kind: 'unregister', authority })
        }}
        onRemove={() => {
          const authority = runtime.pinMutationAuthority()
          if (authority) setCleanupDraft({ kind: 'remove', authority })
        }}
      />
      {cleanupDraft ? (
        <StoreCleanupDialog
          kind={cleanupDraft.kind}
          store={dialogStore}
          envUri={identity.envUri}
          authority={cleanupDraft.authority}
          authorityCurrent={runtime.isMutationAuthorityCurrent(cleanupDraft.authority)}
          mutationRecords={runtime.mutationRecords}
          cleanupStore={(authority, requestId, storeId) =>
            runtime.mutate(
              authority,
              cleanupDraft.kind === 'remove'
                ? { requestId, kind: 'remove', storeId, confirmDelete: true }
                : { requestId, kind: 'unregister', storeId }
            )
          }
          onCleaned={goBack}
          onClose={() => setCleanupDraft(null)}
        />
      ) : null}
    </>
  )
}
