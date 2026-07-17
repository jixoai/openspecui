/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Edit only launch-project Store and Reference declarations.
 * 2. Preserve Root Context preview and declaration diagnostics without treating them as registry truth.
 * 3. Bind mutation controls and execution to loading/error/dirty lifecycle states.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Project Binding must show direct Reference Store, root, and Doctor diagnostics."
 */
import { Button } from '@/components/button'
import { trpcClient } from '@/lib/trpc'
import { useProjectBindingSubscription } from '@/lib/use-planning-config'
import type { PlanningConfigReference, ProjectBindingConfig } from '@openspecui/core'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Link2, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ReferenceDraft extends PlanningConfigReference {
  key: number
}

let nextReferenceKey = 1

function createReferenceDraft(reference: PlanningConfigReference): ReferenceDraft {
  return { ...reference, key: nextReferenceKey++ }
}

function currentRootPreview(config: ProjectBindingConfig) {
  return config.rootPreview.state === 'ready'
    ? { context: config.rootPreview.data, error: null }
    : { context: config.rootPreview.attempt, error: config.rootPreview.error }
}

/** Render and mutate launch-project Store/Reference binding independently of active-root config. */
export function ProjectBindingSection({ isStatic }: { isStatic: boolean }) {
  const { data: config, isLoading, error: subscriptionError } = useProjectBindingSubscription()
  const [storeId, setStoreId] = useState('')
  const [references, setReferences] = useState<ReferenceDraft[]>([])
  const [dirty, setDirty] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const bindingLocked = isLoading || subscriptionError !== null

  useEffect(() => {
    if (!config || dirty) return
    setStoreId(config.binding.store.state === 'declared' ? config.binding.store.id : '')
    setReferences(config.binding.references.entries.map(createReferenceDraft))
    setFormError(null)
  }, [config, dirty])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (bindingLocked) {
        throw new Error(subscriptionError?.message ?? 'Project Binding is stale.')
      }
      const normalizedReferences: PlanningConfigReference[] = []
      for (const reference of references) {
        const id = reference.id.trim()
        const remote = reference.remote?.trim()
        if (!id) throw new Error('Every Reference needs a Store id.')
        normalizedReferences.push(remote ? { id, remote } : { id })
      }
      return trpcClient.planningConfig.updateProjectBinding.mutate({
        store: storeId.trim() || null,
        references: normalizedReferences.length > 0 ? normalizedReferences : null,
      })
    },
    onSuccess: (nextConfig) => {
      setStoreId(nextConfig.binding.store.state === 'declared' ? nextConfig.binding.store.id : '')
      setReferences(nextConfig.binding.references.entries.map(createReferenceDraft))
      setDirty(false)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : String(error))
    },
  })

  const updateReference = (key: number, update: Partial<PlanningConfigReference>) => {
    setReferences((current) =>
      current.map((reference) => (reference.key === key ? { ...reference, ...update } : reference))
    )
    setDirty(true)
    setFormError(null)
  }

  if (isStatic) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        Project Binding is not included in this static export.
      </div>
    )
  }

  if (isLoading && !config) {
    return <div className="route-loading animate-pulse">Loading Project Binding…</div>
  }

  if (!config) {
    return (
      <div role="alert" className="text-destructive rounded-md border p-4 text-sm">
        {subscriptionError?.message ?? 'Project Binding is unavailable.'}
      </div>
    )
  }

  const preview = currentRootPreview(config)
  const visibleError = subscriptionError?.message ?? formError ?? saveMutation.error?.message

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Project Binding</h2>
          <p className="text-muted-foreground mt-1 break-all text-xs">
            Launch project: {config.owner.path}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending || bindingLocked}
          activity={!dirty && saveMutation.isSuccess}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saveMutation.isPending ? 'Saving…' : dirty ? 'Save binding' : 'Saved'}
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)]">
        <div className="space-y-1.5">
          <label htmlFor="project-binding-store" className="block text-xs font-medium">
            Store
          </label>
          <input
            id="project-binding-store"
            value={storeId}
            disabled={saveMutation.isPending || bindingLocked}
            onChange={(event) => {
              setStoreId(event.target.value)
              setDirty(true)
              setFormError(null)
            }}
            placeholder="No declared Store"
            className="border-border bg-background focus-visible:ring-primary h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-1"
          />
          <p className="text-muted-foreground text-[11px]">
            Empty keeps root selection on the launch project's nearest OpenSpec root.
          </p>
        </div>

        <section className="space-y-2" aria-labelledby="project-binding-references">
          <div className="flex items-center justify-between gap-2">
            <h3 id="project-binding-references" className="text-xs font-medium">
              References
            </h3>
            <button
              type="button"
              disabled={saveMutation.isPending || bindingLocked}
              onClick={() => {
                setReferences((current) => [
                  ...current,
                  createReferenceDraft({ id: '', remote: undefined }),
                ])
                setDirty(true)
              }}
              className="border-border hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {references.length > 0 ? (
            <div className="space-y-2">
              {references.map((reference) => (
                <div
                  key={reference.key}
                  className="grid gap-2 sm:grid-cols-[minmax(8rem,0.75fr)_minmax(12rem,1.25fr)_2.5rem]"
                >
                  <input
                    value={reference.id}
                    disabled={saveMutation.isPending || bindingLocked}
                    onChange={(event) => updateReference(reference.key, { id: event.target.value })}
                    aria-label="Reference Store id"
                    placeholder="Store id"
                    className="border-border bg-background focus-visible:ring-primary h-10 min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:ring-1"
                  />
                  <input
                    value={reference.remote ?? ''}
                    disabled={saveMutation.isPending || bindingLocked}
                    onChange={(event) =>
                      updateReference(reference.key, {
                        remote: event.target.value || undefined,
                      })
                    }
                    aria-label={`Remote for ${reference.id || 'Reference'}`}
                    placeholder="Optional remote"
                    className="border-border bg-background focus-visible:ring-primary h-10 min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:ring-1"
                  />
                  <button
                    type="button"
                    disabled={saveMutation.isPending || bindingLocked}
                    onClick={() => {
                      setReferences((current) =>
                        current.filter((item) => item.key !== reference.key)
                      )
                      setDirty(true)
                    }}
                    aria-label={`Remove Reference ${reference.id || 'row'}`}
                    title="Remove Reference"
                    className="border-border text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-10 w-10 items-center justify-center rounded-md border"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-10 items-center gap-2 rounded-md border border-dashed px-3 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              No read-only References declared.
            </div>
          )}
        </section>
      </div>

      <section className="border-border/70 bg-muted/20 space-y-2 rounded-md border px-3 py-2 text-xs">
        <h3 className="font-medium">Root Context preview</h3>
        <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Planning root</dt>
          <dd className="break-all font-mono">
            {preview.context.planningRoot?.path ?? 'Not resolved'}
          </dd>
          <dt className="text-muted-foreground">Source</dt>
          <dd>{preview.context.planningRoot?.source ?? 'unknown'}</dd>
          <dt className="text-muted-foreground">Store</dt>
          <dd>{preview.context.storeId ?? 'none'}</dd>
        </dl>
        {preview.error ? (
          <div className="text-destructive flex items-start gap-2" role="alert">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{preview.error.message}</span>
          </div>
        ) : null}
      </section>

      <section className="border-border/70 bg-muted/20 space-y-2 rounded-md border px-3 py-2 text-xs">
        <h3 className="font-medium">Observed References</h3>
        {preview.context.references.length > 0 ? (
          <div className="space-y-2">
            {preview.context.references.map((reference) => (
              <div
                key={reference.store_id}
                className="border-border/60 rounded-md border px-2 py-1.5"
              >
                <div className="font-medium">Store: {reference.store_id}</div>
                {reference.root ? <div>Root: {reference.root}</div> : null}
                {reference.status.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {reference.status.map((diagnostic) => (
                      <div key={`${diagnostic.code}:${diagnostic.message}`}>
                        {diagnostic.severity} · {diagnostic.code} · {diagnostic.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground mt-1">
                    No direct Doctor diagnostics observed.
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">No Referenced Stores currently observed.</div>
        )}
      </section>

      {config.binding.diagnostics.length > 0 ? (
        <div className="space-y-1" role="alert">
          {config.binding.diagnostics.map((diagnostic) => (
            <div
              key={`${diagnostic.code}:${diagnostic.message}`}
              className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-xs"
            >
              {diagnostic.message}
            </div>
          ))}
        </div>
      ) : null}

      {visibleError ? (
        <div
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-xs"
        >
          {visibleError}
        </div>
      ) : null}
    </div>
  )
}
