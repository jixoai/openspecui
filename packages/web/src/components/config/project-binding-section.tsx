/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Edit only launch-project Store and Reference declarations.
 * 2. Preserve Root Context preview and declaration diagnostics without treating them as registry truth.
 * 3. Bind mutation controls and execution to loading/error/dirty lifecycle states.
 * 4. Keep failures and convergence direct while disclosing successful preview/write evidence on demand.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Project Binding must show direct Reference Store, root, and Doctor diagnostics."
 * Derived requirement (2026-07-19): "A binding mutation must not relabel its returned preview as current Root Context."
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下）。"
 * Original request (2026-07-28): successful Config evidence should not outrank editable OPSX declarations.
 * Owner correction (2026-07-29): Store editing needs a freeform registry-backed Combobox and the binding cards must be reorganized around user tasks.
 */
import { EvidenceDisclosure, InformationBadge } from '@/components/information-disclosure'
import { AsyncAction, ConfigFormSkeleton } from '@/components/realtime'
import { trpcClient } from '@/lib/trpc'
import { useProjectBindingSubscription } from '@/lib/use-planning-config'
import { useStoreListProjection } from '@/lib/use-store-list-projection'
import type { PlanningConfigReference, ProjectBindingConfig } from '@openspecui/core'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Info, Link2, Plus, Save, Trash2 } from 'lucide-react'
import { Tooltip } from '../tooltip'
import { ProjectStoreCombobox } from './project-store-combobox'
import { useProjectBindingSettlement } from './use-project-binding-settlement'

function currentRootPreview(config: ProjectBindingConfig) {
  return config.rootPreview.state === 'ready'
    ? { context: config.rootPreview.data, error: null }
    : { context: config.rootPreview.attempt, error: config.rootPreview.error }
}

function BindingHelp({ label, content }: { label: string; content: string }) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        aria-label={label}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-primary inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Tooltip>
  )
}

/** Render and mutate launch-project Store/Reference binding independently of active-root config. */
export function ProjectBindingSection({ isStatic }: { isStatic: boolean }) {
  const { data: config, isLoading, error: subscriptionError } = useProjectBindingSubscription()
  const storeProjection = useStoreListProjection(
    !isStatic && config !== null && config !== undefined
  )
  const settlement = useProjectBindingSettlement({ config, subscriptionError })
  const {
    convergenceError,
    dirty,
    formError,
    mutationEvidence,
    pendingConvergence,
    references,
    storeId,
  } = settlement

  const saveMutation = useMutation({
    mutationFn: async () => {
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
    onSuccess: settlement.mutationSucceeded,
    onError: settlement.mutationFailed,
  })

  if (isStatic) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        Project Binding is not included in this static export.
      </div>
    )
  }

  if (isLoading && !config) {
    return (
      <div className="space-y-4" aria-busy="true">
        <ConfigFormSkeleton fields={4} />
      </div>
    )
  }

  if (!config) {
    return (
      <div role="alert" className="text-destructive rounded-md border p-4 text-sm">
        {subscriptionError?.message ?? 'Project Binding is unavailable.'}
      </div>
    )
  }

  const preview = currentRootPreview(config)
  const visibleError = subscriptionError?.message ?? formError
  const referenceDiagnostics = preview.context.references.flatMap((reference) => reference.status)
  const referenceErrors = preview.context.references.flatMap((reference) =>
    reference.status
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => ({ storeId: reference.store_id, diagnostic }))
  )
  const mutationTransitionError =
    mutationEvidence?.transition.state === 'preview-error'
      ? mutationEvidence.transition.error.message
      : convergenceError
  const showMutationTransitionError =
    mutationTransitionError !== null &&
    mutationTransitionError !== visibleError &&
    mutationTransitionError !== preview.error?.message
  const storeSuggestions = storeProjection.data?.stores ?? []
  const storeSuggestionsUnavailable =
    storeProjection.error !== null || storeProjection.data?.available === false

  return (
    <div className="@container min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Project Binding</h2>
          <p className="text-muted-foreground mt-1 break-all text-xs">
            Launch project: {config.owner.path}
          </p>
        </div>
        <AsyncAction
          size="sm"
          pending={saveMutation.isPending}
          settled={!dirty}
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          <Save className="h-3.5 w-3.5" />
          Save binding
        </AsyncAction>
      </header>

      <div className="space-y-5">
        <section className="space-y-2" aria-labelledby="project-binding-store-label">
          <div className="flex items-center gap-1.5">
            <label
              id="project-binding-store-label"
              htmlFor="project-binding-store"
              className="text-xs font-medium"
            >
              Planning Store
            </label>
            <BindingHelp
              label="About Planning Store"
              content="Select a registered Store suggestion or enter an exact Store id. An empty value keeps the launch project's nearest OpenSpec root."
            />
          </div>
          <ProjectStoreCombobox
            id="project-binding-store"
            value={storeId}
            stores={storeSuggestions}
            disabled={saveMutation.isPending}
            onChange={settlement.editStore}
          />
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {storeSuggestions.length > 0 ? (
              <span>{storeSuggestions.length} registered suggestions available</span>
            ) : null}
            {storeSuggestionsUnavailable ? (
              <span
                role="status"
                title={storeProjection.error?.message ?? storeProjection.data?.error?.message}
              >
                Suggestions unavailable; exact ids remain editable.
              </span>
            ) : null}
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="project-binding-references">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 id="project-binding-references" className="text-xs font-medium">
                Read-only References
              </h3>
              <BindingHelp
                label="About References"
                content="References add Specs from registered Stores to this project's OpenSpec context without changing the writable Planning root."
              />
            </div>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={settlement.addReference}
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
                  className="@[36rem]:grid-cols-[minmax(8rem,0.75fr)_minmax(12rem,1.25fr)_2.5rem] grid min-w-0 gap-2"
                >
                  <input
                    value={reference.id}
                    disabled={saveMutation.isPending}
                    onChange={(event) =>
                      settlement.editReference(reference.key, { id: event.target.value })
                    }
                    aria-label="Reference Store id"
                    placeholder="Store id"
                    className="border-border bg-background focus-visible:ring-primary h-10 min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:ring-1"
                  />
                  <input
                    value={reference.remote ?? ''}
                    disabled={saveMutation.isPending}
                    onChange={(event) =>
                      settlement.editReference(reference.key, {
                        remote: event.target.value || undefined,
                      })
                    }
                    aria-label={`Remote for ${reference.id || 'Reference'}`}
                    placeholder="Optional remote"
                    className="border-border bg-background focus-visible:ring-primary h-10 min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:ring-1"
                  />
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => settlement.removeReference(reference.key)}
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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Current preview</span>
        <InformationBadge
          ariaLabel={`Root preview source ${preview.context.planningRoot?.source ?? 'unknown'}`}
          tooltip={`Planning root: ${preview.context.planningRoot?.path ?? 'Not resolved'}`}
        >
          {preview.context.planningRoot?.source ?? 'unknown'}
        </InformationBadge>
        {preview.context.storeId ? (
          <InformationBadge
            ariaLabel={`Root preview Store ${preview.context.storeId}`}
            tooltip={`The current Root Context preview selected Store ${preview.context.storeId}.`}
          >
            Store {preview.context.storeId}
          </InformationBadge>
        ) : null}
        <InformationBadge
          ariaLabel={`${preview.context.references.length} observed References, ${referenceErrors.length} errors, ${referenceDiagnostics.length} diagnostics`}
          tooltip={`${preview.context.references.length} observed References · ${referenceErrors.length} errors · ${referenceDiagnostics.length} diagnostics`}
          tone={referenceErrors.length > 0 ? 'custom' : 'muted'}
          className={
            referenceErrors.length > 0
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : undefined
          }
        >
          References {preview.context.references.length}
        </InformationBadge>
      </div>

      {preview.error ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{preview.error.message}</span>
        </div>
      ) : null}

      {referenceErrors.length > 0 ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {referenceErrors
              .map(({ storeId, diagnostic }) => `${storeId}: ${diagnostic.message}`)
              .join(' ')}
          </span>
        </div>
      ) : null}

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

      {pendingConvergence ? (
        <div className="text-muted-foreground text-xs" role="status">
          Binding saved; waiting for the Root Context subscription to converge.
        </div>
      ) : null}

      {showMutationTransitionError ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{mutationTransitionError}</span>
        </div>
      ) : null}

      <EvidenceDisclosure
        title="Root preview and binding evidence"
        summary={`${preview.context.references.length} References${mutationEvidence ? ' · latest write' : ''}`}
      >
        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="font-medium">Root Context preview</h3>
            <dl className="@[32rem]:grid-cols-[auto_minmax(0,1fr)] grid min-w-0 gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Planning root</dt>
              <dd className="break-all font-mono">
                {preview.context.planningRoot?.path ?? 'Not resolved'}
              </dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{preview.context.planningRoot?.source ?? 'unknown'}</dd>
              <dt className="text-muted-foreground">Store</dt>
              <dd>{preview.context.storeId ?? 'none'}</dd>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Observed References</h3>
            {preview.context.references.length > 0 ? (
              <div className="space-y-2">
                {preview.context.references.map((reference) => (
                  <div key={reference.store_id}>
                    <div className="font-medium">Store: {reference.store_id}</div>
                    {reference.root ? <div>Root: {reference.root}</div> : null}
                    {reference.status.length > 0 ? (
                      <div className="text-muted-foreground mt-1 space-y-0.5">
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

          {mutationEvidence ? (
            <section className="space-y-2">
              <h3 className="font-medium">Latest binding write</h3>
              <div>
                Launch write complete: {mutationEvidence.launchWrite.file.path ?? 'config file'}
              </div>
              <div>
                Root preview from this mutation:{' '}
                {mutationEvidence.rootPreview.state === 'ready'
                  ? (mutationEvidence.rootPreview.data.planningRoot?.path ?? 'Not resolved')
                  : (mutationEvidence.rootPreview.attempt.planningRoot?.path ?? 'Not resolved')}
              </div>
              <div>
                Transition: {mutationEvidence.transition.state}
                {mutationEvidence.transition.state === 'preview-error'
                  ? ` · ${mutationEvidence.transition.error.message}`
                  : pendingConvergence
                    ? ' · waiting for Root Context subscription'
                    : convergenceError
                      ? ` · Root Context subscription error: ${convergenceError}`
                      : ' · Root Context subscription matched the launch write'}
              </div>
            </section>
          ) : null}
        </div>
      </EvidenceDisclosure>
    </div>
  )
}
