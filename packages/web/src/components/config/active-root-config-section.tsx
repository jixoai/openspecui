/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Project exact Active Root owner/file/revision and explicit replacement lifecycle directly in natural page flow.
 * 2. Own mode-local Structured and Raw drafts plus revision-aware mutation admission.
 * 3. Retain drafts through transport failure, Root replacement, and recoverable revision conflicts.
 * 4. Preserve a source-distinct read-only static projection without mutation authority.
 * 5. Keep external/shared Store impact, diagnostics, and Guide readiness in the direct visual plane.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Stale or transport-error Active Root data must remain read-only."
 * Original request (2026-08-01): preserve raw YAML writes beside official structured Active Root fields.
 * Owner correction (2026-08-03): remove the JS-constrained viewport and extra card shell; let Config page scrolling own height.
 */
import { Button } from '@/components/button'
import { useConfigGuideAnchor } from '@/components/config/config-guide'
import { InformationBadge } from '@/components/information-disclosure'
import { AsyncAction, ConfigFormSkeleton } from '@/components/realtime'
import { RootActionNotice } from '@/components/root-action-notice'
import { selectActiveRootGuideSignal } from '@/lib/config-guide-signals'
import { trpcClient } from '@/lib/trpc'
import {
  projectActiveRootConfigView,
  useActiveRootConfigViewSubscription,
  type ActiveRootConfigView,
} from '@/lib/use-planning-config'
import { useRootActionState } from '@/lib/use-root-action-state'
import type { ActiveRootMutation, ActiveRootRevision } from '@openspecui/core'
import { useMutation } from '@tanstack/react-query'
import { Braces, Edit2, FileCode2, Save, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActiveRootConflictNotice } from './active-root-conflict-notice'
import { ActiveRootRawEditor } from './active-root-raw-editor'
import {
  createActiveRootStructuredDraft,
  normalizeActiveRootStructuredDraft,
  type ActiveRootStructuredDraft,
} from './active-root-structured-draft'
import { ActiveRootStructuredEditor } from './active-root-structured-editor'

type ActiveRootEditorMode = 'structured' | 'raw'

const DEFAULT_CONFIG_TEMPLATE = 'schema: spec-driven\n'

function sameSource(
  left: ActiveRootConfigView | null,
  right: ActiveRootConfigView | null
): boolean {
  return (
    left?.owner?.path === right?.owner?.path &&
    left?.filePath === right?.filePath &&
    left?.revision === right?.revision
  )
}

function hasMutationLocator(config: ActiveRootConfigView | null): config is ActiveRootConfigView & {
  owner: NonNullable<ActiveRootConfigView['owner']>
  filePath: string
  revision: ActiveRootRevision
} {
  return (
    config !== null && config.owner !== null && config.filePath !== null && config.revision !== null
  )
}

function mutationLocator(
  config: ActiveRootConfigView & {
    owner: NonNullable<ActiveRootConfigView['owner']>
    filePath: string
    revision: ActiveRootRevision
  }
) {
  return {
    ownerPath: config.owner.path,
    filePath: config.filePath,
    revision: config.revision,
  }
}

/** Render and mutate only the current CLI-selected Planning-root config. */
export function ActiveRootConfigSection({ isStatic }: { isStatic: boolean }) {
  const {
    data: config,
    isLoading,
    isUpdating,
    error: subscriptionError,
  } = useActiveRootConfigViewSubscription()
  const rootAction = useRootActionState()
  const [mode, setMode] = useState<ActiveRootEditorMode>('structured')
  const [isEditing, setIsEditing] = useState(false)
  const [baseline, setBaseline] = useState<ActiveRootConfigView | null>(null)
  const [structuredDraft, setStructuredDraft] = useState<ActiveRootStructuredDraft>(() =>
    createActiveRootStructuredDraft({ schema: null, context: null, rules: null, operations: null })
  )
  const [rawDraft, setRawDraft] = useState('')
  const [structuredDirty, setStructuredDirty] = useState(false)
  const [rawDirty, setRawDirty] = useState(false)
  const [conflict, setConflict] = useState<ActiveRootConfigView | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const pendingAppliedRevision = useRef<ActiveRootRevision | null>(null)

  const rootActionRef = useRef(rootAction)
  rootActionRef.current = rootAction
  const subscriptionErrorRef = useRef(subscriptionError)
  subscriptionErrorRef.current = subscriptionError
  const loadingRef = useRef(isLoading)
  loadingRef.current = isLoading
  const updatingRef = useRef(isUpdating)
  updatingRef.current = isUpdating
  const dirtyRef = useRef({ structured: structuredDirty, raw: rawDirty })
  dirtyRef.current = { structured: structuredDirty, raw: rawDirty }

  const resetDrafts = useCallback((source: ActiveRootConfigView) => {
    setStructuredDraft(createActiveRootStructuredDraft(source.official))
    setRawDraft(source.exists ? (source.content ?? '') : DEFAULT_CONFIG_TEMPLATE)
    setStructuredDirty(false)
    setRawDirty(false)
  }, [])

  useEffect(() => {
    if (!config) return
    const pendingRevision = pendingAppliedRevision.current
    if (pendingRevision && config.revision !== pendingRevision) return
    if (pendingRevision === config.revision) pendingAppliedRevision.current = null

    if (!isEditing) {
      if (sameSource(baseline, config)) return
      setBaseline(config)
      resetDrafts(config)
      setConflict(null)
      setDraftError(null)
      return
    }
    if (!baseline) {
      setBaseline(config)
      resetDrafts(config)
      return
    }
    if (!sameSource(baseline, config)) setConflict(config)
  }, [baseline, config, isEditing, resetDrafts])

  const saveMutation = useMutation({
    mutationFn: (mutation: ActiveRootMutation) => {
      const currentRootAction = rootActionRef.current
      const currentSubscriptionError = subscriptionErrorRef.current
      if (
        currentRootAction.disabled ||
        currentSubscriptionError !== null ||
        loadingRef.current ||
        updatingRef.current
      ) {
        throw new Error(
          currentRootAction.message ?? currentSubscriptionError?.message ?? 'Active Root is stale.'
        )
      }
      return trpcClient.planningConfig.writeActiveRoot.mutate(mutation)
    },
    onSuccess: (result, mutation) => {
      if (result.state === 'conflict') {
        setConflict(projectActiveRootConfigView(result.latest))
        setDraftError('The physical Active Root changed before this save could commit.')
        return
      }
      if (result.state === 'invalid') {
        setDraftError(result.diagnostics.map(({ message }) => message).join('\n'))
        return
      }

      const applied = projectActiveRootConfigView(result.config)
      pendingAppliedRevision.current = applied.revision
      setBaseline(applied)
      setConflict(null)
      setDraftError(null)
      if (mutation.mode === 'structured') {
        setStructuredDraft(createActiveRootStructuredDraft(applied.official))
        setStructuredDirty(false)
      } else {
        setRawDraft(applied.content ?? '')
        setRawDirty(false)
      }

      const otherModeDirty =
        mutation.mode === 'structured' ? dirtyRef.current.raw : dirtyRef.current.structured
      if (otherModeDirty) {
        setConflict(applied)
        setDraftError('The other mode retains an unsaved draft based on the previous revision.')
        return
      }
      resetDrafts(applied)
      setIsEditing(false)
    },
  })

  const transportLocked =
    rootAction.disabled || subscriptionError !== null || isLoading || isUpdating
  const sourceChanged =
    isEditing && baseline !== null && config !== undefined && !sameSource(baseline, config)
  const actionLocked = transportLocked || sourceChanged || conflict !== null
  const currentDirty = mode === 'structured' ? structuredDirty : rawDirty
  const guideSignal = selectActiveRootGuideSignal({
    available: config !== null && config !== undefined,
    loading: isLoading,
    transportError: subscriptionError?.message ?? null,
    mutationPending: saveMutation.isPending,
    editing: isEditing,
    dirty: currentDirty,
    conflict: conflict !== null,
    authority: rootAction.status,
    authorityTitle: rootAction.title,
    authorityMessage: rootAction.message,
    refreshing: isUpdating,
    exists: config?.exists ?? false,
    errorDiagnostic:
      config?.diagnostics.find((diagnostic) => diagnostic.severity === 'error')?.message ?? null,
    warningDiagnostic:
      config?.diagnostics.find((diagnostic) => diagnostic.severity === 'warning')?.message ?? null,
  })
  const guideAnchor = useConfigGuideAnchor('active-root', guideSignal)

  const startEditing = useCallback(() => {
    if (!config || transportLocked || isStatic) return
    setBaseline(config)
    resetDrafts(config)
    if (!config.exists) {
      if (mode === 'structured') setStructuredDirty(true)
      else setRawDirty(true)
    }
    setConflict(null)
    setDraftError(null)
    saveMutation.reset()
    setIsEditing(true)
  }, [config, isStatic, mode, resetDrafts, saveMutation, transportLocked])

  const cancelEditing = useCallback(() => {
    if (config) {
      setBaseline(config)
      resetDrafts(config)
    }
    setConflict(null)
    setDraftError(null)
    saveMutation.reset()
    setIsEditing(false)
  }, [config, resetDrafts, saveMutation])

  const saveAgainst = useCallback(
    (target: ActiveRootConfigView | null) => {
      if (!hasMutationLocator(target)) {
        setDraftError('Active Root owner, file, or revision evidence is unavailable.')
        return
      }
      setDraftError(null)
      if (mode === 'raw') {
        saveMutation.mutate({
          mode: 'raw',
          ...mutationLocator(target),
          content: rawDraft,
        })
        return
      }
      const normalized = normalizeActiveRootStructuredDraft(structuredDraft)
      if (!normalized.valid) {
        setDraftError(normalized.errors.join('\n'))
        return
      }
      saveMutation.mutate({
        mode: 'structured',
        ...mutationLocator(target),
        update: normalized.update,
      })
    },
    [mode, rawDraft, saveMutation, structuredDraft]
  )

  if (isLoading && !config) {
    return (
      <div {...guideAnchor} className="space-y-4" aria-busy="true">
        <ConfigFormSkeleton fields={4} />
      </div>
    )
  }

  if (!config) {
    return (
      <div {...guideAnchor} role="alert" className="text-destructive rounded-md border p-4 text-sm">
        {subscriptionError?.message ?? 'Active Root Config is unavailable.'}
      </div>
    )
  }

  const visibleError = subscriptionError?.message ?? saveMutation.error?.message ?? draftError

  return (
    <section
      {...guideAnchor}
      data-testid="active-root-config-surface"
      className="@container min-w-0 space-y-4"
      aria-busy={isLoading || isUpdating || saveMutation.isPending}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Active Root Config</h2>
          {config.owner ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground break-all">
                Planning root: {config.owner.path}
              </span>
              <InformationBadge
                ariaLabel={`Active Root source ${config.owner.source}`}
                tooltip={`The CLI selected this root from source ${config.owner.source}.`}
              >
                {config.owner.source}
              </InformationBadge>
              {config.owner.storeId ? (
                <InformationBadge
                  ariaLabel={`Active Root Store ${config.owner.storeId}`}
                  tooltip={`Writes target Store ${config.owner.storeId}.`}
                >
                  Store {config.owner.storeId}
                </InformationBadge>
              ) : null}
              {config.filePath ? (
                <InformationBadge
                  ariaLabel="Active Root config file path"
                  tooltip={config.filePath}
                >
                  Config file
                </InformationBadge>
              ) : null}
              {config.revision ? (
                <InformationBadge ariaLabel="Active Root config revision" tooltip={config.revision}>
                  Revision {config.revision.slice(7, 15)}
                </InformationBadge>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">Static Active Root snapshot</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {(config.exists || isEditing) && (
            <div
              role="tablist"
              aria-label="Active Root editor mode"
              className="bg-muted flex rounded-md p-0.5"
            >
              {(['structured', 'raw'] as const).map((candidateMode) => (
                <button
                  key={candidateMode}
                  type="button"
                  role="tab"
                  aria-selected={mode === candidateMode}
                  disabled={saveMutation.isPending}
                  onClick={() => setMode(candidateMode)}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                    mode === candidateMode
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  }`}
                >
                  {candidateMode === 'structured' ? (
                    <Braces className="h-3.5 w-3.5" />
                  ) : (
                    <FileCode2 className="h-3.5 w-3.5" />
                  )}
                  {candidateMode === 'structured' ? 'Structured' : 'Raw YAML'}
                </button>
              ))}
            </div>
          )}

          {!isStatic && !transportLocked && config.exists && !isEditing ? (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}

          {isEditing ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={cancelEditing}
                disabled={saveMutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <AsyncAction
                size="sm"
                pending={saveMutation.isPending}
                settled={!currentDirty}
                onClick={() => saveAgainst(baseline)}
                disabled={saveMutation.isPending || actionLocked || !currentDirty}
              >
                <Save className="h-3.5 w-3.5" />
                Save {mode === 'structured' ? 'Structured' : 'Raw YAML'}
              </AsyncAction>
            </>
          ) : null}
        </div>
      </header>

      {config.owner?.externalToLaunchProject && config.owner.storeId ? (
        <div
          role="note"
          aria-label="Shared Store write impact"
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
        >
          This Active Root belongs to shared Store <strong>{config.owner.storeId}</strong>. Saves
          affect every project currently resolving this Store.
        </div>
      ) : null}

      {config.diagnostics.length > 0 ? (
        <div
          role={config.diagnostics.some(({ severity }) => severity === 'error') ? 'alert' : 'note'}
          className="border-border space-y-1 rounded-md border p-3 text-xs"
        >
          {config.diagnostics.map((diagnostic) => (
            <p key={`${diagnostic.code}:${diagnostic.path}`}>
              <strong>{diagnostic.path}</strong>: {diagnostic.message}
            </p>
          ))}
        </div>
      ) : null}

      {visibleError ? (
        <div
          role="alert"
          className="text-destructive whitespace-pre-wrap rounded-md border p-3 text-sm"
        >
          {visibleError}
        </div>
      ) : null}

      {!isStatic && rootAction.disabled ? <RootActionNotice state={rootAction} /> : null}

      {conflict ? (
        <ActiveRootConflictNotice
          latest={conflict}
          mode={mode}
          pending={saveMutation.isPending}
          retryDisabled={transportLocked || !currentDirty}
          onReload={() => {
            pendingAppliedRevision.current = null
            setBaseline(conflict)
            resetDrafts(conflict)
            setConflict(null)
            setDraftError(null)
            saveMutation.reset()
          }}
          onRetry={() => saveAgainst(conflict)}
        />
      ) : null}

      {config.exists || isEditing ? (
        <div
          role="tabpanel"
          aria-label={
            mode === 'structured' ? 'Structured Active Root editor' : 'Raw YAML Active Root editor'
          }
          className="min-w-0"
        >
          {mode === 'structured' ? (
            <ActiveRootStructuredEditor
              draft={structuredDraft}
              readOnly={!isEditing || saveMutation.isPending || actionLocked}
              onChange={(draft) => {
                setStructuredDraft(draft)
                setStructuredDirty(true)
                setDraftError(null)
                saveMutation.reset()
              }}
            />
          ) : (
            <ActiveRootRawEditor
              value={rawDraft}
              readOnly={!isEditing || saveMutation.isPending || actionLocked}
              onChange={(value) => {
                setRawDraft(value)
                setRawDirty(true)
                setDraftError(null)
                saveMutation.reset()
              }}
              onSaveShortcut={() => {
                if (isEditing && rawDirty && !saveMutation.isPending && !actionLocked) {
                  saveAgainst(baseline)
                }
              }}
            />
          )}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          <p className="mb-3">No config file exists in the active Planning root.</p>
          {!isStatic && !transportLocked ? (
            <Button size="sm" onClick={startEditing}>
              Create Active Root config
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}
