/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Bind the Stores index to selected-Environment Store projections and navigation.
 * 2. Pin New Store drafts to exact current authority and follow backend mutation settlement.
 * 3. Keep loading, retained refresh, and authority failures in the direct plane.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution > "Scan Stores in an Environment".
 */
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { NewStoreDialog, type NewStoreLifecycleState } from '../components/new-store-dialog'
import { StoresIndex } from '../components/stores-index'
import type { EnvironmentActionAuthority } from '../lib/environment-authority'
import { buildStoresEnvironmentsPath } from '../lib/store-route-identity'
import { useStoresRuntime } from '../lib/stores-runtime'

function authorityMessage(
  kind: ReturnType<typeof useStoresRuntime>['authority']['kind']
): string | null {
  switch (kind) {
    case 'no-environment':
      return 'Open a compatible Workspace to observe its runtime Environment.'
    case 'requires-selection':
      return 'Select an Environment before inspecting Stores.'
    case 'pending':
      return 'The selected Environment is refreshing.'
    case 'offline':
      return 'Every observed source for this Environment is offline.'
    case 'authentication-required':
      return 'The selected Environment requires authentication.'
    case 'incompatible':
      return 'No observed source supports the Store protocol.'
    case 'conflict':
      return 'Current sources disagree on Store evidence for this Environment.'
    case 'no-current-authority':
      return 'The selected Environment has no current access source.'
    case 'authority':
      return null
  }
}

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
    label:
      environment.projects.length === 1 && environment.projects[0]?.label
        ? `${environment.projects[0].label} Environment`
        : environment.envUri,
  }))
  const environmentOptions =
    runtime.selectedEnvUri &&
    !observedEnvironmentOptions.some(({ envUri }) => envUri === runtime.selectedEnvUri)
      ? [
          { envUri: runtime.selectedEnvUri, label: `${runtime.selectedEnvUri} (unavailable)` },
          ...observedEnvironmentOptions,
        ]
      : observedEnvironmentOptions
  const errors = [runtime.storeData.inventoryError, runtime.storeData.inspectorError]
    .flatMap((error) => (error ? [error.message] : []))
    .join(' ')

  return (
    <>
      <StoresIndex
        rows={runtime.rows}
        envUri={runtime.selectedEnvUri ?? ''}
        environmentLabel={runtime.selectedEnvUri ?? undefined}
        environments={environmentOptions}
        authorityMessage={authorityMessage(runtime.authority.kind)}
        isLoading={runtime.storeData.isInventoryLoading}
        isUpdating={runtime.storeData.isInventoryUpdating || runtime.storeData.isInspectorUpdating}
        error={errors || null}
        onSelectEnvironment={runtime.selectEnvironment}
        onOpenDetail={(path) => void navigate({ to: path })}
        onOpenEnvironments={() => void navigate({ to: buildStoresEnvironmentsPath() })}
        onRefresh={() => void runtime.storeData.refresh()}
        onNewStore={() => {
          setNewStoreAuthority(runtime.pinMutationAuthority())
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
              ...(input.kind === 'setup' ? { storeId: input.storeId } : { id: input.storeId }),
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
