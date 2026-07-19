/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Own launch-binding draft generation independently from Root Context convergence.
 * 2. Correlate one completed launch write with its matching ready subscription projection.
 * 3. Retire stale pending evidence before newer edits or subscription failures can settle it.
 * 4. Keep launch-owned repair controls available outside the actual mutation request.
 *
 * Original request (2026-07-19): "Stale/error Project Binding must preserve a generation-safe repair path."
 */
import type {
  PlanningConfigReference,
  ProjectBindingConfig,
  ProjectBindingUpdateResult,
} from '@openspecui/core'
import { useEffect, useReducer } from 'react'

/** One editable Reference row with stable React identity. */
export interface ProjectBindingReferenceDraft extends PlanningConfigReference {
  key: number
}

type ConvergingUpdateResult = Extract<
  ProjectBindingUpdateResult,
  { transition: { state: 'converging' } }
>

interface PendingConvergence {
  generation: number
  result: ConvergingUpdateResult
}

interface SettlementState {
  storeId: string
  references: ProjectBindingReferenceDraft[]
  dirty: boolean
  generation: number
  formError: string | null
  mutationEvidence: ProjectBindingUpdateResult | null
  pending: PendingConvergence | null
  convergenceError: string | null
}

type SettlementAction =
  | {
      type: 'projection-observed'
      config: ProjectBindingConfig | null | undefined
      subscriptionError: Error | null
    }
  | { type: 'store-edited'; value: string }
  | { type: 'reference-edited'; key: number; update: Partial<PlanningConfigReference> }
  | { type: 'reference-added' }
  | { type: 'reference-removed'; key: number }
  | { type: 'mutation-succeeded'; result: ProjectBindingUpdateResult }
  | { type: 'mutation-failed'; error: string }

let nextReferenceKey = 1

function createReferenceDraft(reference: PlanningConfigReference): ProjectBindingReferenceDraft {
  return { ...reference, key: nextReferenceKey++ }
}

function bindingDrafts(binding: ProjectBindingConfig['binding']) {
  return {
    storeId: binding.store.state === 'declared' ? binding.store.id : '',
    references: binding.references.entries.map(createReferenceDraft),
  }
}

function sameBinding(
  left: ProjectBindingConfig['binding'],
  right: ProjectBindingConfig['binding']
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameRootIdentity(
  current: ProjectBindingConfig['rootPreview'],
  expected: ConvergingUpdateResult['rootPreview']
): boolean {
  if (current.state !== 'ready') return false
  const currentRoot = current.data.planningRoot
  const expectedRoot = expected.data.planningRoot
  return (
    (currentRoot?.path ?? null) === (expectedRoot?.path ?? null) &&
    (currentRoot?.source ?? null) === (expectedRoot?.source ?? null) &&
    (currentRoot?.store_id ?? null) === (expectedRoot?.store_id ?? null) &&
    current.data.storeId === expected.data.storeId &&
    current.data.dataScope.path === expected.data.dataScope.path &&
    current.data.dataScope.source === expected.data.dataScope.source &&
    current.data.dataScope.environmentVariable === expected.data.dataScope.environmentVariable
  )
}

function isPreviewErrorResult(
  result: ProjectBindingUpdateResult
): result is Extract<ProjectBindingUpdateResult, { transition: { state: 'preview-error' } }> {
  return result.transition.state === 'preview-error'
}

function editedState(state: SettlementState): SettlementState {
  return {
    ...state,
    dirty: true,
    generation: state.generation + 1,
    formError: null,
    mutationEvidence: null,
    pending: null,
    convergenceError: null,
  }
}

function settlementReducer(state: SettlementState, action: SettlementAction): SettlementState {
  if (action.type === 'projection-observed') {
    const config = action.config
    if (state.pending) {
      if (action.subscriptionError) {
        return {
          ...state,
          formError: action.subscriptionError.message,
          pending: null,
          convergenceError: action.subscriptionError.message,
        }
      }
      if (config?.rootPreview.state === 'error') {
        return {
          ...state,
          formError: config.rootPreview.error.message,
          pending: null,
          convergenceError: config.rootPreview.error.message,
        }
      }
      if (
        config &&
        state.pending.generation === state.generation &&
        sameBinding(config.binding, state.pending.result.launchWrite.binding) &&
        sameRootIdentity(config.rootPreview, state.pending.result.rootPreview)
      ) {
        return {
          ...state,
          ...bindingDrafts(config.binding),
          dirty: false,
          formError: null,
          pending: null,
          convergenceError: null,
        }
      }
      return state
    }
    if (!config || state.dirty) return state
    return {
      ...state,
      ...bindingDrafts(config.binding),
      formError: action.subscriptionError ? state.formError : null,
    }
  }

  if (action.type === 'store-edited') {
    return { ...editedState(state), storeId: action.value }
  }
  if (action.type === 'reference-edited') {
    return {
      ...editedState(state),
      references: state.references.map((reference) =>
        reference.key === action.key ? { ...reference, ...action.update } : reference
      ),
    }
  }
  if (action.type === 'reference-added') {
    return {
      ...editedState(state),
      references: [...state.references, createReferenceDraft({ id: '', remote: undefined })],
    }
  }
  if (action.type === 'reference-removed') {
    return {
      ...editedState(state),
      references: state.references.filter((reference) => reference.key !== action.key),
    }
  }
  if (action.type === 'mutation-failed') {
    return { ...state, formError: action.error }
  }
  if (isPreviewErrorResult(action.result)) {
    return {
      ...state,
      mutationEvidence: action.result,
      pending: null,
      convergenceError: null,
      formError: action.result.transition.error.message,
    }
  }
  return {
    ...state,
    mutationEvidence: action.result,
    pending: { generation: state.generation, result: action.result },
    convergenceError: null,
    formError: null,
  }
}

const initialState: SettlementState = {
  storeId: '',
  references: [],
  dirty: false,
  generation: 0,
  formError: null,
  mutationEvidence: null,
  pending: null,
  convergenceError: null,
}

/** Own the Project Binding draft and settle only the matching saved generation. */
export function useProjectBindingSettlement(input: {
  config: ProjectBindingConfig | null | undefined
  subscriptionError: Error | null
}) {
  const [state, dispatch] = useReducer(settlementReducer, initialState)

  useEffect(() => {
    dispatch({
      type: 'projection-observed',
      config: input.config,
      subscriptionError: input.subscriptionError,
    })
  }, [input.config, input.subscriptionError, state.pending])

  return {
    ...state,
    pendingConvergence: state.pending?.result ?? null,
    editStore(value: string) {
      dispatch({ type: 'store-edited', value })
    },
    editReference(key: number, update: Partial<PlanningConfigReference>) {
      dispatch({ type: 'reference-edited', key, update })
    },
    addReference() {
      dispatch({ type: 'reference-added' })
    },
    removeReference(key: number) {
      dispatch({ type: 'reference-removed', key })
    },
    mutationSucceeded(result: ProjectBindingUpdateResult) {
      dispatch({ type: 'mutation-succeeded', result })
    },
    mutationFailed(error: unknown) {
      dispatch({
        type: 'mutation-failed',
        error: error instanceof Error ? error.message : String(error),
      })
    },
  }
}
