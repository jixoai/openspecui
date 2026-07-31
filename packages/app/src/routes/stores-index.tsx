/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Bind the Stores index to selected-Environment Store projections and navigation.
 * 2. Pin New Store drafts to exact current authority and follow backend mutation settlement.
 * 3. Keep loading, retained refresh, and authority failures in the direct plane.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Owner-reported confusion (2026-07-31): opaque envUri and internal authority language must not lead the UI.
 * Spec: hosted-app-distribution > "Scan Stores in an Environment".
 */
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { NewStoreDialog, type NewStoreLifecycleState } from '../components/new-store-dialog'
import { StoresIndex } from '../components/stores-index'
import type { EnvironmentActionAuthority } from '../lib/environment-authority'
import { selectEnvironmentAuthorityIssue } from '../lib/environment-authority-presentation'
import { selectEnvironmentLabel } from '../lib/environment-presentation'
import { buildStoresEnvironmentsPath } from '../lib/store-route-identity'
import { useStoresRuntime } from '../lib/stores-runtime'

/** Production route owner for `/stores`. */
export function StoresIndexRoute() {
  const navigate = useNavigate()
  const runtime = useStoresRuntime()
  const [newStoreOpen, setNewStoreOpen] = useState(false)
  const [newStoreAuthority, setNewStoreAuthority] = useState<EnvironmentActionAuthority | null>(
    null
  )
  const [requestId, setRequestId] = useState<string | null>(null)
  const [requestPending, setRequestPending] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const mutation = requestId
    ? runtime.mutationRecords.find((record) => record.requestId === requestId)
    : undefined
  const lifecycle: NewStoreLifecycleState = requestPending
    ? 'pending'
    : mutation?.status === 'succeeded'
      ? 'succeeded'
      : mutation?.status === 'failed' || mutation?.status === 'indeterminate'
        ? 'failed'
        : mutation || requestId
          ? 'pending'
          : 'idle'
  const mutationError =
    mutation?.status === 'failed' || mutation?.status === 'indeterminate'
      ? (mutation.result.stderr ?? `Store mutation ${mutation.status}.`)
      : requestError

  useEffect(() => {
    if (mutation?.status !== 'succeeded') return
    setNewStoreOpen(false)
    setNewStoreAuthority(null)
    setRequestId(null)
  }, [mutation?.status])

  const observedEnvironmentOptions = runtime.environments.map((environment) => ({
    envUri: environment.envUri,
    label: selectEnvironmentLabel(environment),
  }))
  const environmentOptions =
    runtime.selectedEnvUri &&
    !observedEnvironmentOptions.some(({ envUri }) => envUri === runtime.selectedEnvUri)
      ? [
          {
            envUri: runtime.selectedEnvUri,
            label: 'Previously selected Environment (unavailable)',
          },
          ...observedEnvironmentOptions,
        ]
      : observedEnvironmentOptions
  const errors = [runtime.storeData.inventoryError, runtime.storeData.inspectorError]
    .flatMap((error) => (error ? [error.message] : []))
    .join(' ')
  const authorityIssue = selectEnvironmentAuthorityIssue(runtime.authority.kind)
  const selectedEnvironmentLabel = environmentOptions.find(
    (environment) => environment.envUri === runtime.selectedEnvUri
  )?.label
  const canCreateStore = runtime.pinMutationAuthority() !== null

  return (
    <>
      <StoresIndex
        rows={runtime.rows}
        envUri={runtime.selectedEnvUri ?? ''}
        environmentLabel={selectedEnvironmentLabel}
        environments={environmentOptions}
        authorityMessage={authorityIssue?.message ?? null}
        canCreateStore={canCreateStore}
        createStoreUnavailableReason={authorityIssue?.message ?? null}
        isLoading={runtime.storeData.isInventoryLoading}
        isUpdating={runtime.storeData.isInventoryUpdating || runtime.storeData.isInspectorUpdating}
        error={errors || null}
        onSelectEnvironment={runtime.selectEnvironment}
        onOpenDetail={(path) => void navigate({ to: path })}
        onOpenEnvironments={() => void navigate({ to: buildStoresEnvironmentsPath() })}
        onRefresh={() => void runtime.storeData.refresh()}
        onNewStore={() => {
          const authority = runtime.pinMutationAuthority()
          if (!authority) return
          setNewStoreAuthority(authority)
          setRequestId(null)
          setRequestError(null)
          setNewStoreOpen(true)
        }}
      />
      <NewStoreDialog
        open={newStoreOpen}
        onClose={() => {
          if (lifecycle === 'pending') return
          setNewStoreOpen(false)
          setNewStoreAuthority(null)
        }}
        hasAuthority={runtime.isMutationAuthorityCurrent(newStoreAuthority)}
        unavailableReason={authorityIssue?.message ?? null}
        lifecycle={lifecycle}
        error={mutationError}
        onSubmit={(input) => {
          if (!newStoreAuthority) return
          const nextRequestId = `new-store:${Date.now()}:${++requestSequence.current}`
          setRequestPending(true)
          setRequestError(null)
          void runtime
            .mutate(newStoreAuthority, {
              requestId: nextRequestId,
              kind: input.kind,
              path: input.path,
              ...(input.kind === 'setup'
                ? {
                    storeId: input.storeId,
                    initGit: input.initGit,
                    remote: input.remote,
                  }
                : { id: input.storeId, confirmIdentity: input.confirmIdentity }),
            })
            .then((admission) => {
              if (!admission) {
                setRequestError('The Environment authority changed before admission.')
                return
              }
              setRequestId(admission.requestId)
            })
            .catch((caught: unknown) => {
              setRequestError(caught instanceof Error ? caught.message : String(caught))
            })
            .finally(() => setRequestPending(false))
        }}
      />
    </>
  )
}
