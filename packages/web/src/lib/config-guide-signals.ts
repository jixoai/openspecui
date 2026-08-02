/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Classify existing Project, Root, Agent, and Context owner facts into conservative Guide stage signals.
 * 2. Keep warning, stale, failed, blocked, required, and active-edit facts distinct from objective readiness.
 *
 * Original request (2026-08-02): the adaptive Config Guide must skip only objectively current ready stages.
 */
import type { ConfigGuideStageSignal } from './config-guide'

export interface ProjectBindingGuideFacts {
  available: boolean
  loading: boolean
  transportError: string | null
  mutationPending: boolean
  dirty: boolean
  convergencePending: boolean
  formError: string | null
  convergenceError: string | null
  failureDiagnostic: string | null
  warningDiagnostic: string | null
}

export function selectProjectBindingGuideSignal(
  facts: ProjectBindingGuideFacts
): ConfigGuideStageSignal {
  if (facts.transportError) {
    return {
      status: 'failed',
      title: 'Project Binding unavailable',
      detail: facts.transportError,
    }
  }
  if (facts.loading && !facts.available) {
    return {
      status: 'blocked',
      title: 'Loading Project Binding',
      detail: 'Wait for the launch-project binding projection.',
    }
  }
  if (!facts.available) {
    return {
      status: 'failed',
      title: 'Project Binding unavailable',
      detail: 'The launch-project binding projection did not return a current value.',
    }
  }
  if (facts.mutationPending || facts.dirty || facts.convergencePending) {
    return {
      status: 'active-edit',
      title: 'Finish Project Binding changes',
      detail: facts.convergencePending
        ? 'Wait for the Root Context projection to replace the saved binding preview.'
        : 'Save or discard the current Project Binding edits.',
    }
  }
  const failure = facts.formError ?? facts.convergenceError
  if (failure) {
    return {
      status: 'failed',
      title: 'Project Binding needs repair',
      detail: failure,
    }
  }
  if (facts.failureDiagnostic) {
    return {
      status: 'failed',
      title: 'Project Binding needs repair',
      detail: facts.failureDiagnostic,
    }
  }
  if (facts.warningDiagnostic) {
    return {
      status: 'warning',
      title: 'Review Project Binding diagnostics',
      detail: facts.warningDiagnostic,
    }
  }
  return {
    status: 'ready',
    title: 'Project Binding ready',
    detail: 'The current launch-project Store and Reference declarations are settled.',
  }
}

export interface ActiveRootGuideFacts {
  available: boolean
  loading: boolean
  transportError: string | null
  mutationPending: boolean
  editing: boolean
  dirty: boolean
  conflict: boolean
  authority: 'ready' | 'checking' | 'blocked'
  authorityTitle: string | null
  authorityMessage: string | null
  refreshing: boolean
  exists: boolean
  errorDiagnostic: string | null
  warningDiagnostic: string | null
}

export function selectActiveRootGuideSignal(facts: ActiveRootGuideFacts): ConfigGuideStageSignal {
  if (facts.transportError) {
    return { status: 'failed', title: 'Active Root unavailable', detail: facts.transportError }
  }
  if (facts.loading && !facts.available) {
    return {
      status: 'blocked',
      title: 'Loading Active Root',
      detail: 'Wait for the CLI-selected Active Root projection.',
    }
  }
  if (!facts.available) {
    return {
      status: 'failed',
      title: 'Active Root unavailable',
      detail: 'No Active Root configuration projection is available.',
    }
  }
  if (facts.mutationPending || facts.editing || facts.dirty || facts.conflict) {
    return {
      status: 'active-edit',
      title: 'Finish Active Root changes',
      detail: 'Save, resolve, or discard the current Structured or Raw YAML draft.',
    }
  }
  if (facts.authority === 'blocked') {
    return {
      status: 'failed',
      title: facts.authorityTitle ?? 'Active Root authority failed',
      detail: facts.authorityMessage ?? 'Repair Root Context authority before continuing.',
    }
  }
  if (facts.refreshing || facts.authority === 'checking') {
    return {
      status: 'stale',
      title: 'Active Root is refreshing',
      detail: facts.authorityMessage ?? 'Wait for current Root authority before continuing.',
    }
  }
  if (!facts.exists) {
    return {
      status: 'required',
      title: 'Create the Active Root config',
      detail: 'Create and save an official or custom YAML configuration for this Root.',
    }
  }
  if (facts.errorDiagnostic) {
    return {
      status: 'failed',
      title: 'Active Root config is invalid',
      detail: facts.errorDiagnostic,
    }
  }
  if (facts.warningDiagnostic) {
    return {
      status: 'warning',
      title: 'Review Active Root diagnostics',
      detail: facts.warningDiagnostic,
    }
  }
  return {
    status: 'ready',
    title: 'Active Root ready',
    detail: 'The CLI-selected Root has a current valid configuration.',
  }
}

export interface AgentDeliveryGuideFacts {
  available: boolean
  loading: boolean
  transportError: string | null
  activeEdit: boolean
  conflict: boolean
  policyError: string | null
  refreshing: boolean
  repairRequired: boolean
}

export function selectAgentDeliveryGuideSignal(
  facts: AgentDeliveryGuideFacts
): ConfigGuideStageSignal {
  if (facts.transportError) {
    return { status: 'failed', title: 'Agent Delivery unavailable', detail: facts.transportError }
  }
  if (facts.loading && !facts.available) {
    return {
      status: 'blocked',
      title: 'Loading Agent Delivery',
      detail: 'Wait for the current Agent registry and artifact inventory.',
    }
  }
  if (!facts.available) {
    return {
      status: 'failed',
      title: 'Agent Delivery unavailable',
      detail: 'The Agent delivery projection did not return current data.',
    }
  }
  if (facts.activeEdit || facts.conflict) {
    return {
      status: 'active-edit',
      title: 'Finish Agent Delivery changes',
      detail: facts.conflict
        ? 'Resolve the changed upstream policy before continuing.'
        : 'Save the policy or finish the active Agent delivery command.',
    }
  }
  if (facts.policyError) {
    return {
      status: 'failed',
      title: 'Agent Delivery change failed',
      detail: facts.policyError,
    }
  }
  if (facts.refreshing) {
    return {
      status: 'stale',
      title: 'Agent Delivery is refreshing',
      detail: 'Wait for replacement registry and artifact inventory data.',
    }
  }
  if (facts.repairRequired) {
    return {
      status: 'warning',
      title: 'Agent Delivery needs attention',
      detail: 'Review partial, stale, cleanup, or migration work before continuing.',
    }
  }
  return {
    status: 'ready',
    title: 'Agent Delivery ready',
    detail: 'The current policy and Agent artifact inventory are settled.',
  }
}

export interface ResolvedContextGuideFacts {
  available: boolean
  loading: boolean
  transportError: string | null
  authorityFailed: boolean
  refreshing: boolean
  authorityCurrent: boolean
  hasPlanningRoot: boolean
  cliAvailable: boolean
  cliError: string | null
  errorDiagnostic: string | null
  warningDiagnostic: string | null
}

export function selectResolvedContextGuideSignal(
  facts: ResolvedContextGuideFacts
): ConfigGuideStageSignal {
  if (facts.transportError || facts.authorityFailed) {
    return {
      status: 'failed',
      title: 'Resolved Context unavailable',
      detail: facts.transportError ?? 'Current Root authority failed.',
    }
  }
  if (facts.loading) {
    return {
      status: 'blocked',
      title: 'Resolving Context',
      detail: 'Wait for the current CLI-selected Root Context.',
    }
  }
  if (facts.refreshing || !facts.authorityCurrent) {
    return {
      status: 'stale',
      title: 'Resolved Context is refreshing',
      detail: 'Retained Context is visible, but current Root authority has not settled.',
    }
  }
  if (!facts.available || !facts.hasPlanningRoot) {
    return {
      status: 'required',
      title: 'Select a usable Root',
      detail: 'Project Binding or Environment Global must resolve a current Planning Root.',
    }
  }
  if (!facts.cliAvailable || facts.cliError) {
    return {
      status: 'failed',
      title: 'Selected Root is not usable',
      detail: facts.cliError ?? 'OpenSpec CLI is unavailable for the selected Root.',
    }
  }
  if (facts.errorDiagnostic) {
    return {
      status: 'failed',
      title: 'Resolved Context has errors',
      detail: facts.errorDiagnostic,
    }
  }
  if (facts.warningDiagnostic) {
    return {
      status: 'warning',
      title: 'Review Resolved Context warnings',
      detail: facts.warningDiagnostic,
    }
  }
  return {
    status: 'ready',
    title: 'Resolved Context ready',
    detail: 'Root authority is current and the selected Planning Root is usable.',
  }
}
