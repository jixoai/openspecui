/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Project one launch project's CLI-selected planning root and direct References.
 * 2. Preserve CLI diagnostics and stale/update states without inventing health conclusions.
 * 3. Present the inherited Store registry/data scope as read-only environment evidence.
 * 4. Expose the complete Root Context and command evidence through on-demand disclosure.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 */
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import type { RootContext, RootContextCommandEvidence } from '@openspecui/core'
import { AlertCircle, FileText, Network, RefreshCw } from 'lucide-react'

/** Render project Root, observed References, registry diagnostics, and raw CLI evidence. */
export function ContextView() {
  const { data: projection, isLoading, error: transportError } = useContextSubscription()
  const context = selectRootContextSnapshot(projection)
  const loading = (isLoading || projection?.state === 'loading') && context === null
  const projectionError = projection?.state === 'error' ? projection.error : null

  return (
    <div className="space-y-6 p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
          <Network className="h-6 w-6 shrink-0" aria-hidden />
          Context
        </h1>
        {projection?.state === 'refreshing' ? (
          <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Updating
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        The active planning root, its observed References, and read-only registry diagnostics for
        this project backend.
      </p>

      {loading ? <div className="route-loading animate-pulse">Loading context...</div> : null}

      {transportError || projectionError ? (
        <div
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Root Context is not ready.</p>
            <p>{transportError?.message ?? projectionError?.message}</p>
            {projection?.state === 'error' && projection.data ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Showing the last successful observation while retaining the failed CLI attempt.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && context ? <ContextBody context={context} /> : null}
    </div>
  )
}

function ContextBody({ context }: { context: RootContext }) {
  const planningRoot = context.planningRoot
  const diagnostics = [
    ...context.diagnostics.root,
    ...context.diagnostics.doctor,
    ...context.diagnostics.context,
  ]

  return (
    <div className="space-y-4">
      <section className="border-border grid gap-4 rounded-lg border p-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h2 className="text-sm font-semibold">Active planning root</h2>
          <p className="text-muted-foreground break-all text-sm">
            {planningRoot?.path ?? 'No planning root resolved.'}
          </p>
          {planningRoot ? (
            <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt>root source</dt>
              <dd>{planningRoot.source}</dd>
              {context.storeId ? (
                <>
                  <dt>store</dt>
                  <dd>{context.storeId}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="text-sm font-semibold">Launch project</h2>
          <p className="text-muted-foreground break-all text-sm">{context.launchProject.path}</p>
          <p className="text-muted-foreground text-xs">
            CLI {context.cli.version ?? 'version unavailable'}
          </p>
        </div>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" aria-hidden />
          Observed References
        </h2>
        {context.references.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reference currently observed.</p>
        ) : (
          <ul className="divide-border divide-y">
            {context.references.map((reference) => (
              <li key={reference.store_id} className="space-y-1 py-2 first:pt-0 last:pb-0">
                <p className="font-mono text-sm">{reference.store_id}</p>
                {reference.status.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No CLI diagnostic reported.</p>
                ) : (
                  reference.status.map((diagnostic) => (
                    <p key={`${diagnostic.code}:${diagnostic.message}`} className="text-xs">
                      <span className="font-medium">{diagnostic.code}</span>: {diagnostic.message}
                    </p>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-border space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Registry and data scope</h2>
        <p className="text-muted-foreground break-all text-sm">{context.dataScope.path}</p>
        <p className="text-muted-foreground text-xs">
          source: {context.dataScope.source}
          {context.dataScope.environmentVariable
            ? ` (${context.dataScope.environmentVariable})`
            : ''}
        </p>
        <p className="text-muted-foreground text-sm">
          Registry is read-only at this scope. The project backend does not own a project-local
          registry.
        </p>
      </section>

      <RootContextEvidence context={context} />

      {diagnostics.length > 0 ? (
        <section className="border-border space-y-2 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">CLI diagnostics</h2>
          <ul className="space-y-2">
            {diagnostics.map((diagnostic) => (
              <li key={`${diagnostic.code}:${diagnostic.message}`} className="text-sm">
                <span className="font-medium">{diagnostic.code}</span>: {diagnostic.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function RootContextEvidence({ context }: { context: RootContext }) {
  return (
    <details className="border-border rounded-lg border p-4">
      <summary className="cursor-pointer text-sm font-semibold">Full Root Context evidence</summary>
      <div className="mt-4 space-y-5">
        <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          <dt>observed at</dt>
          <dd>{new Date(context.observedAt).toISOString()}</dd>
          <dt>CLI available</dt>
          <dd>{String(context.cli.available)}</dd>
          <dt>CLI version</dt>
          <dd>{context.cli.version ?? 'unavailable'}</dd>
          <dt>effective command</dt>
          <dd className="break-all">{context.cli.effectiveCommand ?? 'unavailable'}</dd>
          {context.cli.error ? (
            <>
              <dt>CLI error</dt>
              <dd className="text-destructive break-words">{context.cli.error}</dd>
            </>
          ) : null}
        </dl>

        <EvidenceJson label="Context members" value={context.contextMembers} />
        <CommandEvidence label="Doctor command" evidence={context.evidence.doctor} />
        <CommandEvidence label="Context command" evidence={context.evidence.context} />
      </div>
    </details>
  )
}

function EvidenceJson({ label, value }: { label: string; value: unknown }) {
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold">{label}</h3>
      <pre className="bg-muted scrollbar-thin scrollbar-track-transparent max-h-64 overflow-auto whitespace-pre-wrap rounded-md p-3 text-xs">
        {content}
      </pre>
    </div>
  )
}

function CommandEvidence({
  label,
  evidence,
}: {
  label: string
  evidence: RootContextCommandEvidence | null
}) {
  if (!evidence) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-semibold">{label}</h3>
        <p className="text-muted-foreground text-xs">No command evidence observed.</p>
      </div>
    )
  }

  return (
    <details className="border-border border-t pt-3">
      <summary className="cursor-pointer text-xs font-semibold">{label}</summary>
      <dl className="text-muted-foreground mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt>process success</dt>
        <dd>{String(evidence.success)}</dd>
        <dt>exit status</dt>
        <dd>{evidence.exitCode ?? 'unknown'}</dd>
        {evidence.contractError ? (
          <>
            <dt>contract drift</dt>
            <dd className="text-destructive break-words">{evidence.contractError}</dd>
          </>
        ) : null}
      </dl>
      {evidence.stderr ? <EvidenceJson label="stderr" value={evidence.stderr} /> : null}
      <EvidenceJson label="diagnostics" value={evidence.diagnostics} />
      <EvidenceJson label="stdout" value={evidence.stdout} />
    </details>
  )
}
