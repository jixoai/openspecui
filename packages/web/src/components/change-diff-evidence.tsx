/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Present the CLI-provided MODIFIED-delta `diff`/`warning` fields as Change Detail evidence.
 * 2. Color the unified diff body by line role (+/-/@@) without recomputing anything locally.
 * 3. Render the exact upstream warning text beside its diff so a near-miss never swallows evidence.
 * 4. Gate the fetch on the detected admitted CLI's `requirementDiff` capability (1.11 only) and on
 *    live mode: static snapshots and 1.10 sessions never issue the transport call.
 * 5. Degrade to the existing delta presentation when the fields are absent — no fabricated diff
 *    or warning may appear.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import { EvidenceDisclosure } from '@/components/information-disclosure'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
import {
  deriveOpenSpecCliCapabilities,
  parseOpenSpecCliVersion,
} from '@openspecui/core/openspec-compat'
import type { ChangeDiffEvidence, ChangeDiffEvidenceDelta } from '@openspecui/server'
import { AlertTriangle, FileDiff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

function diffLineRole(line: string): 'add' | 'remove' | 'hunk' | 'context' {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'remove'
  return 'context'
}

const DIFF_LINE_CLASS: Record<ReturnType<typeof diffLineRole>, string> = {
  hunk: 'text-sky-700 bg-sky-500/5 dark:text-sky-300',
  add: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300',
  remove: 'text-rose-700 bg-rose-500/10 dark:text-rose-300',
  context: 'text-muted-foreground',
}

/** One unified diff body rendered line-by-line; wrapped so no path forces horizontal overflow. */
function DiffBody({ diff }: { diff: string }) {
  const lines = diff.split('\n')
  return (
    <pre
      data-diff-body
      aria-label="Requirement diff"
      className="bg-muted/30 max-h-72 max-w-full overflow-y-auto rounded p-2 font-mono text-[11px] leading-relaxed"
    >
      {lines.map((line, index) => {
        const role = diffLineRole(line)
        return (
          <div
            key={index}
            data-diff-line={role}
            className={`whitespace-pre-wrap break-all ${DIFF_LINE_CLASS[role]}`}
          >
            {line === '' ? '\u00A0' : line}
          </div>
        )
      })}
    </pre>
  )
}

function DeltaWarning({ warning }: { warning: string }) {
  return (
    <div
      data-diff-warning
      role="note"
      className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 whitespace-pre-wrap break-words">{warning}</span>
    </div>
  )
}

/** Compact operation badge mirroring the delta vocabulary of the Change surfaces. */
function OperationBadge({ operation }: { operation: ChangeDiffEvidenceDelta['operation'] }) {
  const tone =
    operation === 'MODIFIED'
      ? 'border border-amber-200 bg-amber-100 text-amber-800'
      : operation === 'ADDED'
        ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
        : operation === 'REMOVED'
          ? 'border border-rose-200 bg-rose-100 text-rose-700'
          : 'border border-sky-200 bg-sky-100 text-sky-700'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{operation}</span>
  )
}

function DiffProvenance({
  provenance,
}: {
  provenance: Extract<ChangeDiffEvidence, { kind: 'executed' }>['provenance']
}) {
  return (
    <dl
      data-diff-provenance
      className="@[32rem]:grid-cols-[auto_minmax(0,1fr)] grid min-w-0 gap-x-3 gap-y-1"
    >
      <dt className="text-muted-foreground">Command</dt>
      <dd className="min-w-0 break-all font-mono">{provenance.command}</dd>
      <dt className="text-muted-foreground">Root</dt>
      <dd className="min-w-0 break-all font-mono">{provenance.root}</dd>
      <dt className="text-muted-foreground">Exit</dt>
      <dd>{provenance.exitCode ?? 'unknown'}</dd>
    </dl>
  )
}

/** CLI MODIFIED-delta diff evidence for the Change Evidence tab (live 1.11 sessions only). */
export function ChangeDiffEvidence({ changeId }: { changeId: string }) {
  const rootAction = useRootActionState()
  const cli = rootAction.context?.cli
  // `show --diff` exists only on OpenSpec 1.11. A detected-but-below-1.11 session (admitted 1.10
  // or a bypassed retired CLI) must never issue the call, and the server re-checks the same
  // capability before any argv is constructed.
  const capabilities = deriveOpenSpecCliCapabilities(
    cli?.available ? parseOpenSpecCliVersion(cli.version) : null
  )
  const diffCapable = capabilities.requirementDiff
  const staticMode = isStaticMode()

  const [evidence, setEvidence] = useState<ChangeDiffEvidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    // Static publication carries no requirement-diff payload (projection-contract-truth law),
    // and a below-1.11 session never declares the capability: both leave the transport untouched.
    if (staticMode || !diffCapable) return
    let cancelled = false
    setPending(true)
    setError(null)
    setEvidence(null)
    trpcClient.change.diffEvidence
      .query({ id: changeId })
      .then((result) => {
        if (!cancelled) setEvidence(result)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })
    return () => {
      cancelled = true
    }
  }, [changeId, diffCapable, staticMode])

  if (staticMode) {
    return (
      <EvidenceDisclosure title="Requirement diffs" summary="Unavailable in static snapshot">
        <p className="text-muted-foreground">
          Requirement diffs are live CLI evidence from `show --diff` and are not captured in this
          static snapshot. The delta content shown on this page remains the captured local
          presentation.
        </p>
      </EvidenceDisclosure>
    )
  }

  if (!diffCapable) {
    // Only a detected-but-below-1.11 CLI names its line. While CLI evidence is still pending
    // (or the runner is unavailable) the disclosure stays neutral instead of claiming the
    // session was classified.
    if (cli?.available !== true) {
      return (
        <EvidenceDisclosure title="Requirement diffs" summary="CLI diff evidence">
          <p className="text-muted-foreground">
            Requirement diff evidence from `show --diff` appears here on admitted OpenSpec CLI 1.11
            sessions once the CLI is detected.
          </p>
        </EvidenceDisclosure>
      )
    }
    const detected = cli.version ? ` (detected ${cli.version.trim()})` : ''
    return (
      <EvidenceDisclosure title="Requirement diffs" summary="Unavailable on this CLI line">
        <p className="text-muted-foreground">
          Requirement diffs require an admitted OpenSpec CLI 1.11 session{detected}. This
          session&apos;s CLI does not declare the `show --diff` capability, so the delta
          presentation keeps using the captured local content.
        </p>
      </EvidenceDisclosure>
    )
  }

  if (pending && !evidence && !error) {
    return (
      <EvidenceDisclosure title="Requirement diffs" summary="Loading CLI diff evidence">
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Fetching `show --diff` evidence from the official CLI…
        </p>
      </EvidenceDisclosure>
    )
  }

  if (error) {
    return (
      <EvidenceDisclosure title="Requirement diffs" summary="Transport failure">
        <div className="text-destructive flex items-start gap-2 break-words" role="alert">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-all">{error}</span>
        </div>
      </EvidenceDisclosure>
    )
  }

  if (!evidence) {
    return (
      <EvidenceDisclosure title="Requirement diffs" summary="CLI diff evidence">
        <p className="text-muted-foreground">
          Requirement diff evidence from `show --diff` appears here on 1.11 sessions.
        </p>
      </EvidenceDisclosure>
    )
  }

  if (evidence.kind !== 'executed') {
    const detail =
      evidence.reason === 'command-failed'
        ? evidence.detail
        : evidence.reason === 'capability'
          ? 'The detected OpenSpec CLI does not declare the 1.11 requirement-diff capability.'
          : 'The planning root is unavailable, so requirement-diff evidence cannot be fetched.'
    return (
      <EvidenceDisclosure title="Requirement diffs" summary="CLI evidence unavailable">
        <div className="space-y-1">
          <p className="text-muted-foreground">
            Requirement diffs are unavailable for this session. The delta presentation keeps using
            the captured local content.
          </p>
          <p className="break-words" data-diff-unavailable-detail>
            {detail}
          </p>
        </div>
      </EvidenceDisclosure>
    )
  }

  const modifiedDeltas = evidence.deltas.filter(
    (delta) => delta.operation === 'MODIFIED' && (delta.diff !== null || delta.warning !== null)
  )
  const modifiedCount = evidence.deltas.filter((delta) => delta.operation === 'MODIFIED').length

  if (modifiedDeltas.length === 0) {
    return (
      <EvidenceDisclosure
        title="Requirement diffs"
        summary={`${modifiedCount} MODIFIED · CLI provided no diff fields`}
      >
        <p className="text-muted-foreground">
          The CLI reported {modifiedCount} MODIFIED {modifiedCount === 1 ? 'delta' : 'deltas'} with
          no requirement-diff fields. No diff is fabricated locally.
        </p>
        <DiffProvenance provenance={evidence.provenance} />
      </EvidenceDisclosure>
    )
  }

  return (
    <EvidenceDisclosure
      title="Requirement diffs"
      summary={`${modifiedCount} MODIFIED · CLI show --diff`}
      defaultOpen
    >
      <div className="min-w-0 space-y-3">
        <p className="text-muted-foreground flex items-center gap-1.5">
          <FileDiff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          CLI-owned `show --diff` evidence; never recomputed locally.
        </p>
        {evidence.deltas.map((delta, index) => {
          if (delta.operation !== 'MODIFIED') return null
          if (delta.diff === null && delta.warning === null) return null
          return (
            <div
              key={`${delta.spec}:${index}`}
              data-diff-delta={delta.spec}
              className="border-border/60 space-y-2 rounded border p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 break-all font-mono text-[11px]">{delta.spec}</span>
                <OperationBadge operation={delta.operation} />
              </div>
              {delta.warning !== null ? <DeltaWarning warning={delta.warning} /> : null}
              {delta.diff !== null ? <DiffBody diff={delta.diff} /> : null}
            </div>
          )
        })}
        <DiffProvenance provenance={evidence.provenance} />
      </div>
    </EvidenceDisclosure>
  )
}
