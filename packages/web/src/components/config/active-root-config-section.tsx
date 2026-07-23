/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Project the CLI-selected Planning-root config with exact owner and file-presence evidence.
 * 2. Own Active Root draft, mutation, loading, error, and pending-lock state.
 * 3. Preserve a read-only static snapshot without inventing live owner provenance.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-17): "An existing empty Active Root file remains editable."
 * Original request (2026-07-18): "Stale or transport-error Active Root data must remain read-only."
 */
import { Button } from '@/components/button'
import { CodeEditor } from '@/components/code-editor'
import { RealtimeSkeletonInventory } from '@/components/realtime'
import { RootActionNotice } from '@/components/root-action-notice'
import { useViewportConstrainedHeight } from '@/components/scroll-spy'
import { trpcClient } from '@/lib/trpc'
import { useActiveRootConfigViewSubscription } from '@/lib/use-planning-config'
import { useRootActionState } from '@/lib/use-root-action-state'
import { useMutation } from '@tanstack/react-query'
import { Edit2, Save, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_CONFIG_TEMPLATE = `schema: spec-driven\n\ncontext: |\n  \n\nrules:\n  proposal:\n    - \n`

/** Render and mutate only the current CLI-selected Planning-root config. */
export function ActiveRootConfigSection({ isStatic }: { isStatic: boolean }) {
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null)
  const viewportHeight = useViewportConstrainedHeight({
    target: viewportNode,
    enabled: viewportNode !== null,
  })
  const {
    data: config,
    isLoading,
    error: subscriptionError,
  } = useActiveRootConfigViewSubscription()
  const rootAction = useRootActionState()
  const actionLocked = rootAction.disabled || subscriptionError !== null || isLoading
  const rootActionRef = useRef(rootAction)
  rootActionRef.current = rootAction
  const subscriptionErrorRef = useRef(subscriptionError)
  subscriptionErrorRef.current = subscriptionError
  const isLoadingRef = useRef(isLoading)
  isLoadingRef.current = isLoading
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (isEditing || !config) return
    setDraft(config.content ?? '')
    setDirty(false)
  }, [config, isEditing])

  const saveMutation = useMutation({
    mutationFn: () => {
      const currentRootAction = rootActionRef.current
      const currentSubscriptionError = subscriptionErrorRef.current
      if (currentRootAction.disabled || currentSubscriptionError !== null || isLoadingRef.current) {
        throw new Error(
          currentRootAction.message ?? currentSubscriptionError?.message ?? 'Active Root is stale.'
        )
      }
      return trpcClient.planningConfig.writeActiveRoot.mutate({ content: draft })
    },
    onSuccess: () => {
      setIsEditing(false)
      setDirty(false)
    },
  })

  const handleEdit = useCallback(() => {
    if (!config || actionLocked) return
    setDraft(config.exists ? (config.content ?? '') : DEFAULT_CONFIG_TEMPLATE)
    setDirty(!config.exists)
    setIsEditing(true)
  }, [actionLocked, config])

  const handleCancel = useCallback(() => {
    if (!config) return
    setDraft(config.content ?? '')
    setDirty(false)
    setIsEditing(false)
  }, [config])

  if (isLoading && !config) {
    return (
      <div className="space-y-4" aria-busy="true">
        <RealtimeSkeletonInventory count={4} />
      </div>
    )
  }

  if (!config) {
    return (
      <div role="alert" className="text-destructive rounded-md border p-4 text-sm">
        {subscriptionError?.message ?? 'Active Root Config is unavailable.'}
      </div>
    )
  }

  const visibleError = subscriptionError?.message ?? saveMutation.error?.message

  return (
    <div
      ref={setViewportNode}
      className="flex min-h-0 flex-col"
      style={viewportHeight != null ? { height: `${viewportHeight}px` } : undefined}
    >
      <section className="border-border bg-card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Active Root Config</h2>
            {config.owner ? (
              <p className="text-muted-foreground mt-1 break-all text-xs">
                Planning root: {config.owner.path} · {config.owner.source}
                {config.owner.storeId ? ` · Store ${config.owner.storeId}` : ''}
                {config.owner.externalToLaunchProject ? ' · external' : ''}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">Static Active Root snapshot</p>
            )}
            {config.owner?.externalToLaunchProject && config.owner.storeId ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Edits write the Store-backed planning root and are observed by other projects
                resolving Store {config.owner.storeId}.
              </p>
            ) : null}
            {config.filePath ? (
              <p className="text-muted-foreground mt-1 break-all text-[11px]">
                File: {config.filePath}
              </p>
            ) : null}
          </div>

          {!isStatic && !actionLocked && config.exists && !isEditing ? (
            <button
              type="button"
              onClick={handleEdit}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : null}

          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
                className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || actionLocked || !dirty}
                activity={!dirty}
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? 'Saving...' : dirty ? 'Save' : 'Saved'}
              </Button>
            </div>
          ) : null}
        </header>

        {visibleError ? (
          <div role="alert" className="text-destructive rounded-md border p-4 text-sm">
            {visibleError}
          </div>
        ) : null}

        {!isStatic && rootAction.disabled ? <RootActionNotice state={rootAction} /> : null}

        {config.exists || isEditing ? (
          <CodeEditor
            value={draft}
            onChange={(value) => {
              setDraft(value)
              setDirty(true)
            }}
            onSaveShortcut={() => {
              if (isEditing && dirty && !saveMutation.isPending && !actionLocked) {
                saveMutation.mutate()
              }
            }}
            readOnly={!isEditing || saveMutation.isPending || actionLocked}
            filename="config.yaml"
            className="min-h-0 flex-1"
            editorMinHeight="0px"
          />
        ) : (
          <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
            <p className="mb-3">No config file exists in the active Planning root.</p>
            {!isStatic && !actionLocked ? (
              <button
                type="button"
                onClick={handleEdit}
                className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium"
              >
                Create Active Root config
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
