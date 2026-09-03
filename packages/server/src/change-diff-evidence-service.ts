/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Project the OpenSpec `show <change> --json --diff` MODIFIED-delta evidence for Change Detail.
 * 2. Gate every fetch behind the admitted CLI's `requirementDiff` capability so sessions without
 *    the capability never construct the argv at all.
 * 3. Project capability refusal, root loss, and command failure as typed unavailability — never as
 *    transport errors that would fail the whole Evidence tab.
 * 4. Retain per-delta spec/operation/diff/warning and CLI provenance exactly as the CLI delivered
 *    them; the diff is CLI-owned evidence and is never recomputed locally.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import type { CliExecutor, RootContext } from '@openspecui/core'
import { getRootContextCliSelector } from '@openspecui/core'
import {
  deriveOpenSpecCliCapabilities,
  parseOpenSpecCliVersion,
} from '@openspecui/core/openspec-compat'

/**
 * Payload types derived from the executor contract signature.
 *
 * The Core barrel does not yet re-export the show-diff contract types; deriving them from
 * `CliExecutor['contracts']['showChangeDiff']` keeps this projection tied to the real contract
 * (any Core change flows through) instead of duplicating a parallel shape.
 */
type ShowChangeDiffGated = Awaited<ReturnType<CliExecutor['contracts']['showChangeDiff']>>
type ShowChangeDiffCommandResult = Extract<ShowChangeDiffGated, { kind: 'executed' }>['result']
type ShowChangeDiffPayload = NonNullable<ShowChangeDiffCommandResult['data']>
/** Success branch of the show-diff sum type: the payload that carries the `deltas` array. */
type ShowDiffSuccessPayload = ShowChangeDiffPayload & { readonly deltas: readonly unknown[] }
type ShowDiffDelta = ShowDiffSuccessPayload['deltas'][number]

/** One CLI delta projected for Change Detail display. */
export interface ChangeDiffEvidenceDelta {
  spec: string
  operation: 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED'
  /** Unified diff body; null when the CLI attached none (non-MODIFIED delta or absent field). */
  diff: string | null
  /** Exact upstream warning text; null when the CLI attached none. */
  warning: string | null
}

/** CLI process provenance retained beside the projected deltas. */
export interface ChangeDiffEvidenceProvenance {
  /** Display form of the semantic argv the contract executor built for this fetch. */
  command: string
  /** Root path the CLI reported in the show payload. */
  root: string
  /** Root source label the CLI reported in the show payload. */
  rootSource: string
  exitCode: number | null
}

/** Typed Change Detail diff-evidence projection; every unavailable branch stays non-throwing. */
export type ChangeDiffEvidence =
  | { kind: 'unavailable'; reason: 'capability'; detectedVersion: string | null }
  | { kind: 'unavailable'; reason: 'root-unavailable' }
  | { kind: 'unavailable'; reason: 'command-failed'; detail: string; exitCode: number | null }
  | {
      kind: 'executed'
      deltas: ChangeDiffEvidenceDelta[]
      provenance: ChangeDiffEvidenceProvenance
    }

/** Minimal CLI executor surface the diff projection consumes (test-stubbable). */
export interface ChangeDiffEvidenceDeps {
  cliExecutor: {
    contracts: { showChangeDiff: CliExecutor['contracts']['showChangeDiff'] }
  }
}

function isShowDiffSuccess(data: ShowChangeDiffPayload): data is ShowDiffSuccessPayload {
  return Array.isArray((data as ShowDiffSuccessPayload).deltas)
}

function diagnosticDetail(data: ShowChangeDiffPayload | null): string | null {
  if (!data || isShowDiffSuccess(data)) return null
  const first = (data as { status?: Array<{ code: string; message: string }> }).status?.[0]
  if (!first) return null
  return `${first.code}: ${first.message}`
}

function projectDelta(delta: ShowDiffDelta): ChangeDiffEvidenceDelta {
  const record = delta as {
    spec: string
    operation: 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED'
    diff?: string
    warning?: string
  }
  return {
    spec: record.spec,
    operation: record.operation,
    diff: record.diff ?? null,
    warning: record.warning ?? null,
  }
}

/** Build the display argv mirroring `withRoot(['show', id, '--json', '--diff'], selector)`. */
function buildShowDiffCommand(changeId: string, store: string | undefined): string {
  const args = ['show', changeId, '--json', '--diff']
  if (store !== undefined) args.push('--store', store)
  return `openspec ${args.join(' ')}`
}

/**
 * Read the CLI MODIFIED-delta diff evidence for one change.
 *
 * The projection is separately fetched CLI evidence: the local delta parser keeps owning the
 * delta display and nothing here recomputes or backfills a diff. Sessions without the
 * `requirementDiff` capability (retired, bypassed, or unavailable CLI) and
 * sessions without a resolved planning root return a typed unavailable projection without
 * spawning any process.
 */
export async function readChangeDiffEvidence(
  deps: ChangeDiffEvidenceDeps,
  rootContext: RootContext,
  changeId: string
): Promise<ChangeDiffEvidence> {
  const cli = rootContext.cli
  const detectedVersion = cli.available ? (cli.version ?? null) : null
  const capabilities = deriveOpenSpecCliCapabilities(
    cli.available ? parseOpenSpecCliVersion(cli.version) : null
  )
  if (!capabilities.requirementDiff) {
    return { kind: 'unavailable', reason: 'capability', detectedVersion }
  }
  if (!rootContext.planningRoot) {
    return { kind: 'unavailable', reason: 'root-unavailable' }
  }

  const selector = getRootContextCliSelector(rootContext)
  const gated = await deps.cliExecutor.contracts.showChangeDiff(changeId, {
    capabilities: { requirementDiff: true },
    ...selector,
  })
  // The executor re-checks the same capability; a refusal there is still non-throwing evidence.
  if (gated.kind === 'unavailable') {
    return { kind: 'unavailable', reason: 'capability', detectedVersion }
  }

  const result = gated.result
  const data = result.data
  if (!data || !isShowDiffSuccess(data)) {
    // `??` and `||` cannot mix; the stderr fallback keeps an empty stderr from blanking the detail.
    const detail =
      diagnosticDetail(data) ??
      result.contractError ??
      (result.stderr.trim() || 'The show --diff command failed.')
    return { kind: 'unavailable', reason: 'command-failed', detail, exitCode: result.exitCode }
  }

  const root = (data as { root: { path: string; source: string } }).root
  return {
    kind: 'executed',
    deltas: data.deltas.map(projectDelta),
    provenance: {
      command: buildShowDiffCommand(changeId, selector.store),
      root: root.path,
      rootSource: root.source,
      exitCode: result.exitCode,
    },
  }
}
