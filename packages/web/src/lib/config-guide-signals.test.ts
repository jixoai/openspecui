/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Prove every Config owner maps current, retained, mutation, diagnostic, and missing facts conservatively.
 * 2. Prove only usable current owner facts become ready Guide stages.
 *
 * Original request (2026-08-02): Guide progression must be derived from objective replacement projections.
 */
import { describe, expect, it } from 'vitest'
import {
  selectActiveRootGuideSignal,
  selectAgentDeliveryGuideSignal,
  selectProjectBindingGuideSignal,
  selectResolvedContextGuideSignal,
} from './config-guide-signals'

describe('Config Guide owner signals', () => {
  it('keeps Project Binding edits and diagnostics non-ready', () => {
    const base = {
      available: true,
      loading: false,
      transportError: null,
      mutationPending: false,
      dirty: false,
      convergencePending: false,
      formError: null,
      convergenceError: null,
      failureDiagnostic: null,
      warningDiagnostic: null,
    }
    expect(selectProjectBindingGuideSignal(base).status).toBe('ready')
    expect(selectProjectBindingGuideSignal({ ...base, dirty: true }).status).toBe('active-edit')
    expect(
      selectProjectBindingGuideSignal({
        ...base,
        warningDiagnostic: 'Reference warning',
      }).status
    ).toBe('warning')
    expect(
      selectProjectBindingGuideSignal({
        ...base,
        failureDiagnostic: 'Project config is invalid',
      }).status
    ).toBe('failed')
  })

  it('requires an existing current Active Root config', () => {
    const base = {
      available: true,
      loading: false,
      transportError: null,
      mutationPending: false,
      editing: false,
      dirty: false,
      conflict: false,
      authority: 'ready' as const,
      authorityTitle: null,
      authorityMessage: null,
      refreshing: false,
      exists: true,
      errorDiagnostic: null,
      warningDiagnostic: null,
    }
    expect(selectActiveRootGuideSignal(base).status).toBe('ready')
    expect(selectActiveRootGuideSignal({ ...base, exists: false }).status).toBe('required')
    expect(selectActiveRootGuideSignal({ ...base, refreshing: true }).status).toBe('stale')
  })

  it('keeps Agent edits, replacement refresh, and repair work visible', () => {
    const base = {
      available: true,
      loading: false,
      transportError: null,
      activeEdit: false,
      conflict: false,
      policyError: null,
      refreshing: false,
      repairRequired: false,
    }
    expect(selectAgentDeliveryGuideSignal(base).status).toBe('ready')
    expect(selectAgentDeliveryGuideSignal({ ...base, activeEdit: true }).status).toBe('active-edit')
    expect(selectAgentDeliveryGuideSignal({ ...base, repairRequired: true }).status).toBe('warning')
  })

  it('completes only from current Context with a usable selected Root', () => {
    const base = {
      available: true,
      loading: false,
      transportError: null,
      authorityFailed: false,
      refreshing: false,
      authorityCurrent: true,
      hasPlanningRoot: true,
      cliAvailable: true,
      cliError: null,
      errorDiagnostic: null,
      warningDiagnostic: null,
    }
    expect(selectResolvedContextGuideSignal(base).status).toBe('ready')
    expect(selectResolvedContextGuideSignal({ ...base, hasPlanningRoot: false }).status).toBe(
      'required'
    )
    expect(selectResolvedContextGuideSignal({ ...base, authorityCurrent: false }).status).toBe(
      'stale'
    )
    expect(selectResolvedContextGuideSignal({ ...base, cliAvailable: false }).status).toBe('failed')
  })
})
