/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Define one public Root Context for launch-project and CLI-selected planning-root facts.
 * 2. Compose CLI availability, Doctor, Context, Reference, and data-scope evidence without rewriting it.
 * 3. Represent loading, refresh, stale-data, and failed-attempt states as one type-safe contract.
 * 4. Keep root-dependent readiness tied to CLI-owned health and diagnostics.
 * 5. Preserve opaque generation provenance for stale workflow and terminal guards.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 */
import type {
  CliCommandResult,
  CliContext,
  CliDiagnostic,
  CliDoctor,
  CliDoctorReferenceEntry,
  CliRootSelector,
  OpenSpecCliContractExecutor,
} from './cli-contracts/index.js'
import type { CliExecutor } from './cli-executor.js'
import {
  resolveOpenSpecDataScope,
  type OpenSpecDataScope,
  type ResolveOpenSpecDataScopeOptions,
} from './open-spec-data-scope.js'

/** OpenSpec CLI availability and runner provenance observed by Root Context resolution. */
export interface RootContextCliAvailability {
  available: boolean
  version?: string
  error?: string
  effectiveCommand?: string
  tried?: string[]
}

/** Minimal typed CLI surface required to resolve Root Context. */
export interface RootContextCli {
  checkAvailability(timeout?: number): Promise<RootContextCliAvailability>
  contracts: Pick<OpenSpecCliContractExecutor, 'doctorRoot' | 'context'>
}

/** Raw public evidence for one Root Context CLI command. */
export interface RootContextCommandEvidence {
  success: boolean
  /** Raw CLI JSON document, preserved byte-for-byte as process stdout. */
  stdout: string
  stderr: string
  exitCode: number | null
  diagnostics: CliDiagnostic[]
  contractError?: string
}

/** Complete launch-project, planning-root, Context, Reference, and data-scope projection. */
export interface RootContext {
  launchProject: {
    /** Absolute launch-project path used as the CLI working directory. */
    path: string
  }
  /** CLI Doctor root projection. Null means root selection did not resolve. */
  planningRoot: NonNullable<CliDoctor['root']> | null
  /** Effective Store identity when Doctor reports one. */
  storeId: string | null
  /** Opaque Server-owned planning-root generation, when resolved through a manager lease. */
  generation?: string
  cli: RootContextCliAvailability
  /** Direct one-level Reference index from CLI Doctor. */
  references: CliDoctorReferenceEntry[]
  /** Direct Context members from `openspec context --json`. */
  contextMembers: CliContext['members']
  /** Read-only effective OpenSpec user-data root diagnostic. */
  dataScope: OpenSpecDataScope
  diagnostics: {
    root: CliDiagnostic[]
    doctor: CliDiagnostic[]
    context: CliDiagnostic[]
  }
  evidence: {
    doctor: RootContextCommandEvidence | null
    context: RootContextCommandEvidence | null
  }
  observedAt: number
}

/** Stable error categories emitted by Root Context resolution. */
export type RootContextErrorCode =
  | 'cli-unavailable'
  | 'doctor-command-failed'
  | 'doctor-contract-drift'
  | 'root-unresolved'
  | 'root-unhealthy'
  | 'context-command-failed'
  | 'context-contract-drift'
  | 'context-root-mismatch'
  | 'references-unresolved'
  | 'resolver-failed'

/** Root Context resolution failure with objective category and message. */
export interface RootContextError {
  code: RootContextErrorCode
  message: string
}

/** Full subscription lifecycle for Root Context, including stale-data failure. */
export type RootContextState =
  | {
      state: 'loading'
      data: null
      attempt: null
      error: null
      observedAt: number
    }
  | {
      state: 'ready'
      data: RootContext
      attempt: null
      error: null
      observedAt: number
    }
  | {
      state: 'refreshing'
      data: RootContext
      attempt: null
      error: null
      observedAt: number
    }
  | {
      state: 'error'
      /** Last successful snapshot retained by a subscription, if one exists. */
      data: RootContext | null
      /** Current failed attempt with complete CLI evidence. */
      attempt: RootContext
      error: RootContextError
      observedAt: number
    }

/** Terminal ready/error result of one Root Context resolution attempt. */
export type RootContextResolvedState = Extract<RootContextState, { state: 'ready' | 'error' }>

/** Derive the only CLI selector that preserves an already resolved Root Context. */
export function getRootContextCliSelector(rootContext: RootContext): CliRootSelector {
  const planningRoot = rootContext.planningRoot
  if (!planningRoot) {
    throw new Error('Cannot derive a CLI selector without a resolved planning root.')
  }
  if (planningRoot.source !== 'store') return {}
  if (!rootContext.storeId) {
    throw new Error('OpenSpec reported an explicit Store root without a Store id.')
  }
  return { store: rootContext.storeId }
}

/** Inputs required to resolve one Root Context attempt. */
export interface ResolveRootContextOptions extends ResolveOpenSpecDataScopeOptions {
  launchProjectDir: string
  cliExecutor: RootContextCli
  now?: () => number
}

type DoctorEvidence = CliCommandResult<CliDoctor> | null
type ContextEvidence = CliCommandResult<CliContext> | null

function commandMessage(evidence: CliCommandResult<unknown>, fallback: string): string {
  return (
    evidence.contractError ||
    evidence.stderr.trim() ||
    evidence.diagnostics.map((diagnostic) => diagnostic.message).join('\n') ||
    fallback
  )
}

function publicCommandEvidence<T>(
  evidence: CliCommandResult<T> | null
): RootContextCommandEvidence | null {
  if (!evidence) return null
  return {
    success: evidence.success,
    stdout: evidence.stdout,
    stderr: evidence.stderr,
    exitCode: evidence.exitCode,
    diagnostics: evidence.diagnostics,
    ...(evidence.contractError ? { contractError: evidence.contractError } : {}),
  }
}

function createRootContext(
  options: ResolveRootContextOptions,
  cli: RootContextCliAvailability,
  doctor: DoctorEvidence,
  context: ContextEvidence,
  observedAt: number
): RootContext {
  const doctorData = doctor?.data ?? null
  const contextData = context?.data ?? null
  const planningRoot = doctorData?.root ?? null

  return {
    launchProject: { path: options.launchProjectDir },
    planningRoot,
    storeId: planningRoot?.store_id ?? doctorData?.store?.id ?? null,
    cli,
    references: doctorData?.references ?? [],
    contextMembers: contextData?.members ?? [],
    dataScope: resolveOpenSpecDataScope(options),
    diagnostics: {
      root: planningRoot?.status ?? [],
      doctor: doctorData?.status ?? doctor?.diagnostics ?? [],
      context: contextData?.status ?? context?.diagnostics ?? [],
    },
    evidence: {
      doctor: publicCommandEvidence(doctor),
      context: publicCommandEvidence(context),
    },
    observedAt,
  }
}

function errorState(
  attempt: RootContext,
  code: RootContextErrorCode,
  message: string
): RootContextResolvedState {
  return {
    state: 'error',
    data: null,
    attempt,
    error: { code, message },
    observedAt: attempt.observedAt,
  }
}

function rootsMatch(
  doctor: NonNullable<CliDoctor['root']>,
  context: NonNullable<CliContext['root']>
) {
  return (
    doctor.path === context.path &&
    doctor.source === context.source &&
    (doctor.store_id === undefined ||
      context.store_id === undefined ||
      doctor.store_id === context.store_id)
  )
}

function classifyRootContext(
  attempt: RootContext,
  doctor: DoctorEvidence,
  context: ContextEvidence
): RootContextResolvedState {
  const { cli, planningRoot, references } = attempt

  if (!cli.available) {
    return errorState(attempt, 'cli-unavailable', cli.error ?? 'OpenSpec CLI is unavailable.')
  }

  if (!doctor) {
    return errorState(
      attempt,
      'resolver-failed',
      'OpenSpec Doctor did not return command evidence.'
    )
  }
  if (doctor.contractError) {
    return errorState(
      attempt,
      'doctor-contract-drift',
      commandMessage(doctor, 'OpenSpec Doctor returned an incompatible payload.')
    )
  }
  if (!doctor.success) {
    return errorState(
      attempt,
      'doctor-command-failed',
      commandMessage(doctor, 'OpenSpec Doctor failed.')
    )
  }
  if (!planningRoot) {
    return errorState(
      attempt,
      'root-unresolved',
      'OpenSpec Doctor did not resolve a planning root.'
    )
  }
  if (!planningRoot.healthy) {
    return errorState(
      attempt,
      'root-unhealthy',
      planningRoot.status.map((diagnostic) => diagnostic.message).join('\n') ||
        'OpenSpec Doctor reported an unhealthy planning root.'
    )
  }

  if (!context) {
    return errorState(
      attempt,
      'resolver-failed',
      'OpenSpec Context did not return command evidence.'
    )
  }
  if (context.contractError) {
    return errorState(
      attempt,
      'context-contract-drift',
      commandMessage(context, 'OpenSpec Context returned an incompatible payload.')
    )
  }
  if (!context.success) {
    return errorState(
      attempt,
      'context-command-failed',
      commandMessage(context, 'OpenSpec Context failed.')
    )
  }
  if (!context.data?.root || !rootsMatch(planningRoot, context.data.root)) {
    return errorState(
      attempt,
      'context-root-mismatch',
      'OpenSpec Doctor and Context did not report the same planning root.'
    )
  }

  const failedReference = references
    .flatMap((reference) => reference.status)
    .find((diagnostic) => diagnostic.severity === 'error')
  if (failedReference) {
    return errorState(attempt, 'references-unresolved', failedReference.message)
  }

  return {
    state: 'ready',
    data: attempt,
    attempt: null,
    error: null,
    observedAt: attempt.observedAt,
  }
}

function unavailableCli(error: unknown): RootContextCliAvailability {
  return {
    available: false,
    error: error instanceof Error ? error.message : String(error),
  }
}

/** Resolve one current Root Context attempt from official CLI projections and process scope. */
export async function resolveRootContext(
  options: ResolveRootContextOptions
): Promise<RootContextResolvedState> {
  const observedAt = options.now?.() ?? Date.now()
  let cli: RootContextCliAvailability

  try {
    cli = await options.cliExecutor.checkAvailability()
  } catch (error) {
    cli = unavailableCli(error)
  }

  if (!cli.available) {
    const attempt = createRootContext(options, cli, null, null, observedAt)
    return classifyRootContext(attempt, null, null)
  }

  const selector: CliRootSelector = {}
  const [doctorSettled, contextSettled] = await Promise.allSettled([
    options.cliExecutor.contracts.doctorRoot(selector),
    options.cliExecutor.contracts.context(selector),
  ])
  const doctor = doctorSettled.status === 'fulfilled' ? doctorSettled.value : null
  const context = contextSettled.status === 'fulfilled' ? contextSettled.value : null
  const attempt = createRootContext(options, cli, doctor, context, observedAt)

  if (doctorSettled.status === 'rejected' || contextSettled.status === 'rejected') {
    let failure: unknown
    if (doctorSettled.status === 'rejected') {
      failure = doctorSettled.reason
    } else if (contextSettled.status === 'rejected') {
      failure = contextSettled.reason
    }
    return errorState(
      attempt,
      'resolver-failed',
      failure instanceof Error ? failure.message : String(failure)
    )
  }

  return classifyRootContext(attempt, doctor, context)
}

/** Concrete CliExecutor surface that satisfies Root Context resolution. */
export type RootContextCliExecutor = Pick<CliExecutor, 'checkAvailability'> & {
  contracts: Pick<OpenSpecCliContractExecutor, 'doctorRoot' | 'context'>
}
