/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Project CLI-owned environment-global config, data-scope provenance, and raw evidence.
 * 2. Own the JSON draft and preserve unknown fields through the typed global-config write.
 * 3. Compose the focused Profile/Update lifecycle without a second reactive projection.
 * 4. State static unavailability without synthesizing runtime-environment facts.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Environment Global profile/drift must remain reactive and Update must use the Root action gate."
 */
import { Button } from '@/components/button'
import { ButtonGroup } from '@/components/button-group'
import { CodeEditor } from '@/components/code-editor'
import { EnvironmentGlobalProfileSection } from '@/components/config/environment-global-profile-section'
import { trpcClient } from '@/lib/trpc'
import { useEnvironmentGlobalConfigSubscription } from '@/lib/use-planning-config'
import type { CliJsonValue } from '@openspecui/core'
import { useMutation } from '@tanstack/react-query'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  isCliJsonObject,
  isRecordObject,
  normalizeWorkflowList,
} from './environment-global-config-utils'

type GlobalConfigTab = 'preview' | 'editor' | 'profile'

function JsonStructuredValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground font-mono text-xs">null</span>
  if (typeof value === 'string') {
    return <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{value}</code>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-xs">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground text-xs">[]</span>
    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={`json-array-${index}`} className="border-border/60 rounded-md border px-2 py-1">
            <div className="text-muted-foreground mb-1 font-mono text-[10px]">[{index}]</div>
            <JsonStructuredValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  if (isRecordObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return <span className="text-muted-foreground text-xs">{'{}'}</span>
    return (
      <div className="space-y-1.5">
        {entries.map(([key, item]) => (
          <div key={`json-object-${key}`} className="border-border/60 rounded-md border px-2 py-1">
            <div className="mb-1 font-mono text-[10px] font-semibold">{key}</div>
            <JsonStructuredValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  return <span className="font-mono text-xs">{String(value)}</span>
}

/** Render and mutate only the backend runtime's CLI-owned global OpenSpec config. */
export function EnvironmentGlobalConfigSection({ isStatic }: { isStatic: boolean }) {
  const [globalConfigTab, setGlobalConfigTab] = useState<GlobalConfigTab>('preview')
  const [globalConfigDraft, setGlobalConfigDraft] = useState('{}')
  const [globalConfigDraftDirty, setGlobalConfigDraftDirty] = useState(false)
  const [globalConfigError, setGlobalConfigError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const {
    data: environmentGlobalConfig,
    isLoading,
    error: subscriptionError,
    refresh,
  } = useEnvironmentGlobalConfigSubscription()
  const globalConfigData = environmentGlobalConfig?.config

  useEffect(() => {
    if (!isRecordObject(globalConfigData) || globalConfigDraftDirty) return
    setGlobalConfigDraft(JSON.stringify(globalConfigData, null, 2))
  }, [globalConfigData, globalConfigDraftDirty])

  const handleRefresh = useCallback(() => {
    if (isStatic) return
    setIsRefreshing(true)
    refresh()
    setIsRefreshing(false)
  }, [isStatic, refresh])

  const saveMutation = useMutation({
    mutationFn: (config: Record<string, CliJsonValue>) =>
      trpcClient.planningConfig.writeEnvironmentGlobal.mutate({ config }),
    onSuccess: () => {
      setGlobalConfigDraftDirty(false)
      setGlobalConfigError(null)
      refresh()
    },
    onError: (error) => {
      setGlobalConfigError(error instanceof Error ? error.message : String(error))
    },
  })

  const saveConfig = useCallback(
    (config: Record<string, CliJsonValue>) => saveMutation.mutateAsync(config),
    [saveMutation]
  )

  const handleSaveEditor = useCallback(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(globalConfigDraft)
    } catch (error) {
      setGlobalConfigError(error instanceof Error ? error.message : String(error))
      return
    }
    if (!isCliJsonObject(parsed)) {
      setGlobalConfigError('Global config must be a JSON object.')
      return
    }
    setGlobalConfigError(null)
    saveMutation.mutate(parsed, { onSuccess: () => setGlobalConfigTab('preview') })
  }, [globalConfigDraft, saveMutation])

  const evidenceError = useMemo(() => {
    if (!environmentGlobalConfig) return null
    const pathEvidence = environmentGlobalConfig.evidence.path
    if (!pathEvidence.success) {
      return (
        pathEvidence.stderr ||
        `openspec config path failed with exit status ${pathEvidence.exitCode ?? 'unknown'}.`
      )
    }
    const configEvidence = environmentGlobalConfig.evidence.config
    if (!configEvidence.success) {
      return (
        configEvidence.stderr ||
        `openspec config list failed with exit status ${configEvidence.exitCode ?? 'unknown'}.`
      )
    }
    return configEvidence.contractError
      ? `OpenSpec global config contract drift: ${configEvidence.contractError}`
      : null
  }, [environmentGlobalConfig])

  const globalConfigOtherFields = useMemo(() => {
    if (!isRecordObject(globalConfigData)) return {}
    return Object.fromEntries(
      Object.entries(globalConfigData).filter(
        ([key]) => !['profile', 'delivery', 'workflows', 'featureFlags', 'telemetry'].includes(key)
      )
    )
  }, [globalConfigData])

  if (isStatic) {
    return (
      <section className="border-border bg-card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Environment Global Config</h2>
        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Environment Global Config is unavailable in static export mode.
        </div>
      </section>
    )
  }

  const visibleError = subscriptionError?.message ?? globalConfigError ?? evidenceError
  const tabOptions = [
    { value: 'preview' as const, label: 'Preview', disabled: saveMutation.isPending },
    { value: 'editor' as const, label: 'Editor', disabled: saveMutation.isPending },
    { value: 'profile' as const, label: 'Profile', disabled: saveMutation.isPending },
  ]

  return (
    <section className="border-border bg-card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-4">
      <header className="flex flex-none flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Environment Global Config</h2>
          <div className="text-muted-foreground mt-1 break-all text-xs">
            <span className="mr-1">Path:</span>
            <code className="bg-muted rounded px-1">
              {environmentGlobalConfig?.file.path ?? 'Unavailable'}
            </code>
          </div>
          {environmentGlobalConfig ? (
            <div className="text-muted-foreground mt-1 break-all text-[11px]">
              OpenSpec data scope:{' '}
              <code className="bg-muted rounded px-1">
                {environmentGlobalConfig.owner.dataScope.path}
              </code>{' '}
              · {environmentGlobalConfig.owner.dataScope.source}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || saveMutation.isPending}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </header>

      <div className="text-muted-foreground flex-none text-xs">
        Reads from <code>openspec config list --json</code> and writes to the global config file.
      </div>

      <ButtonGroup<GlobalConfigTab>
        value={globalConfigTab}
        onChange={setGlobalConfigTab}
        options={tabOptions}
      />

      {visibleError ? (
        <div
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-xs"
        >
          {visibleError}
        </div>
      ) : null}

      {environmentGlobalConfig ? (
        <details className="border-border/70 rounded-md border px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium">CLI evidence</summary>
          <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-muted-foreground">config path exit</dt>
            <dd>{environmentGlobalConfig.evidence.path.exitCode ?? 'unknown'}</dd>
            <dt className="text-muted-foreground">config path stdout</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {environmentGlobalConfig.evidence.path.stdout || '(empty)'}
            </dd>
            <dt className="text-muted-foreground">config path stderr</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {environmentGlobalConfig.evidence.path.stderr || '(empty)'}
            </dd>
            <dt className="text-muted-foreground">config list exit</dt>
            <dd>{environmentGlobalConfig.evidence.config.exitCode ?? 'unknown'}</dd>
            <dt className="text-muted-foreground">config list stdout</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {environmentGlobalConfig.evidence.config.stdout || '(empty)'}
            </dd>
            <dt className="text-muted-foreground">config list stderr</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {environmentGlobalConfig.evidence.config.stderr || '(empty)'}
            </dd>
            <dt className="text-muted-foreground">drift stdout</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {environmentGlobalConfig.evidence.drift?.stdout || '(empty)'}
            </dd>
            <dt className="text-muted-foreground">drift stderr</dt>
            <dd className="whitespace-pre-wrap break-all font-mono">
              {environmentGlobalConfig.evidence.drift?.stderr || '(empty)'}
            </dd>
            <dt className="text-muted-foreground">contract</dt>
            <dd className="break-all">
              {environmentGlobalConfig.evidence.config.contractError ?? 'compatible'}
            </dd>
          </dl>
        </details>
      ) : null}

      {globalConfigTab === 'preview' ? (
        isLoading && !environmentGlobalConfig ? (
          <div className="route-loading animate-pulse">Loading Environment Global config...</div>
        ) : isRecordObject(globalConfigData) ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="border-border rounded-md border px-3 py-2 text-xs">
                <div className="text-muted-foreground">profile</div>
                <div className="mt-1 font-medium">
                  {typeof globalConfigData.profile === 'string' ? globalConfigData.profile : 'N/A'}
                </div>
              </div>
              <div className="border-border rounded-md border px-3 py-2 text-xs">
                <div className="text-muted-foreground">delivery</div>
                <div className="mt-1 font-medium">
                  {typeof globalConfigData.delivery === 'string'
                    ? globalConfigData.delivery
                    : 'N/A'}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">workflows</div>
              {normalizeWorkflowList(globalConfigData.workflows).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {normalizeWorkflowList(globalConfigData.workflows).map((workflow) => (
                    <span key={workflow} className="bg-muted rounded px-2 py-0.5 text-[10px]">
                      {workflow}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-xs">—</div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">featureFlags</div>
              <JsonStructuredValue value={globalConfigData.featureFlags ?? {}} />
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">telemetry</div>
              <JsonStructuredValue value={globalConfigData.telemetry ?? {}} />
            </div>
            {Object.keys(globalConfigOtherFields).length > 0 ? (
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">other fields</div>
                <JsonStructuredValue value={globalConfigOtherFields} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Global config unavailable.</div>
        )
      ) : globalConfigTab === 'editor' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <CodeEditor
            value={globalConfigDraft}
            onChange={(value) => {
              setGlobalConfigDraft(value)
              setGlobalConfigDraftDirty(true)
              setGlobalConfigError(null)
            }}
            onSaveShortcut={() => {
              if (globalConfigDraftDirty && !saveMutation.isPending) handleSaveEditor()
            }}
            readOnly={saveMutation.isPending}
            filename="openspec.global.config.json"
            language="json"
            className="min-h-0 flex-1"
            editorMinHeight="0px"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!isRecordObject(globalConfigData)) return
                setGlobalConfigDraft(JSON.stringify(globalConfigData, null, 2))
                setGlobalConfigDraftDirty(false)
                setGlobalConfigError(null)
              }}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Revert
            </button>
            <Button
              size="sm"
              disabled={
                saveMutation.isPending ||
                !globalConfigDraftDirty ||
                !isRecordObject(globalConfigData)
              }
              onClick={handleSaveEditor}
              activity={!globalConfigDraftDirty && isRecordObject(globalConfigData)}
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Saving...' : globalConfigDraftDirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        </div>
      ) : isRecordObject(globalConfigData) ? (
        <EnvironmentGlobalProfileSection
          config={globalConfigData}
          profileState={environmentGlobalConfig?.profileState ?? null}
          isSaving={saveMutation.isPending}
          projectionLocked={isLoading || subscriptionError !== null}
          saveConfig={saveConfig}
          onRefresh={refresh}
        />
      ) : (
        <div className="text-muted-foreground text-sm">Global config unavailable.</div>
      )}
    </section>
  )
}
