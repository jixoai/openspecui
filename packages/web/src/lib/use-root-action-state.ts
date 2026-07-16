/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Derive one readiness gate for root-dependent Web actions.
 * 2. Preserve CLI-owned failed-attempt evidence without inferring new conclusions.
 * 3. Keep static mode explicit and independent from live Root Context resolution.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import type { RootContext, RootContextCommandEvidence, RootContextState } from '@openspecui/core'
import { isStaticMode } from './static-mode'
import { useContextSubscription } from './use-context-subscription'

export type RootActionState =
  | {
      status: 'ready'
      disabled: false
      context: RootContext | null
      observedAt: number
      title: null
      message: null
      evidence: []
    }
  | {
      status: 'checking'
      disabled: true
      context: RootContext | null
      observedAt: number
      title: string
      message: string
      evidence: string[]
    }
  | {
      status: 'blocked'
      disabled: true
      context: RootContext | null
      observedAt: number
      title: string
      message: string
      evidence: string[]
    }

interface SelectRootActionStateInput {
  projection: RootContextState | undefined
  isLoading: boolean
  transportError: Error | null
  staticMode: boolean
}

function appendCommandEvidence(
  lines: Set<string>,
  label: 'Doctor' | 'Context',
  evidence: RootContextCommandEvidence | null
): void {
  if (!evidence) return
  lines.add(`${label} exit: ${evidence.exitCode ?? 'unavailable'}`)
  if (evidence.contractError) lines.add(`${label} contract: ${evidence.contractError}`)
  if (evidence.stderr.trim()) lines.add(`${label} stderr: ${evidence.stderr.trim()}`)
  for (const diagnostic of evidence.diagnostics) {
    lines.add(`${label} ${diagnostic.code}: ${diagnostic.message}`)
  }
}

function collectFailureEvidence(state: Extract<RootContextState, { state: 'error' }>): string[] {
  const lines = new Set<string>()
  const attempt = state.attempt
  if (attempt.planningRoot) {
    lines.add(
      `Attempted root: ${attempt.planningRoot.path} (${attempt.planningRoot.source}${attempt.storeId ? `, Store ${attempt.storeId}` : ''})`
    )
  }
  for (const [source, diagnostics] of Object.entries(attempt.diagnostics)) {
    for (const diagnostic of diagnostics) {
      lines.add(`${source} ${diagnostic.code}: ${diagnostic.message}`)
    }
  }
  appendCommandEvidence(lines, 'Doctor', attempt.evidence.doctor)
  appendCommandEvidence(lines, 'Context', attempt.evidence.context)
  return [...lines]
}

/** Derive action readiness without treating stale Root Context as current success. */
export function selectRootActionState(input: SelectRootActionStateInput): RootActionState {
  if (input.staticMode) {
    return {
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 0,
      title: null,
      message: null,
      evidence: [],
    }
  }

  if (input.transportError) {
    return {
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 0,
      title: 'Root Context transport failed',
      message: input.transportError.message,
      evidence: [],
    }
  }

  const projection = input.projection
  if (!projection || projection.state === 'loading' || input.isLoading) {
    return {
      status: 'checking',
      disabled: true,
      context: null,
      observedAt: projection?.observedAt ?? 0,
      title: 'Resolving planning root',
      message: 'Root-dependent actions remain locked until OpenSpec resolves the planning root.',
      evidence: [],
    }
  }

  if (projection.state === 'refreshing') {
    return {
      status: 'checking',
      disabled: true,
      context: projection.data,
      observedAt: projection.observedAt,
      title: 'Refreshing planning root',
      message: 'Root-dependent actions remain locked while OpenSpec refreshes root selection.',
      evidence: [],
    }
  }

  if (projection.state === 'error') {
    return {
      status: 'blocked',
      disabled: true,
      context: projection.data,
      observedAt: projection.observedAt,
      title: `Planning root unavailable (${projection.error.code})`,
      message: projection.error.message,
      evidence: collectFailureEvidence(projection),
    }
  }

  return {
    status: 'ready',
    disabled: false,
    context: projection.data,
    observedAt: projection.observedAt,
    title: null,
    message: null,
    evidence: [],
  }
}

export function useRootActionState(): RootActionState {
  const subscription = useContextSubscription()
  return selectRootActionState({
    projection: subscription.data,
    isLoading: subscription.isLoading,
    transportError: subscription.error,
    staticMode: isStaticMode(),
  })
}
