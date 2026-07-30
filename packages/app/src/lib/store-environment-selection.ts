/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Runtime-parse and persist one credential-free selected Environment identity.
 * 2. Reject malformed or future-version browser storage without migration glue.
 * 3. Synchronize selection changes across same-origin App windows.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery > "Credential-Scoped Reachability and Explicit Environment Selection".
 */
import { useCallback, useEffect, useState } from 'react'
import {
  createEmptyEnvironmentSelection,
  selectEnvironment,
  type EnvironmentSelectionState,
} from './environment-authority'

const STORE_ENVIRONMENT_SELECTION_KEY = 'openspecui-app:store-environment-selection'
const STORE_ENVIRONMENT_SELECTION_VERSION = 1

interface PersistedStoreEnvironmentSelection {
  readonly version: typeof STORE_ENVIRONMENT_SELECTION_VERSION
  readonly selectedEnvUri: string | null
}

function isPersistedSelection(value: unknown): value is PersistedStoreEnvironmentSelection {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.version === STORE_ENVIRONMENT_SELECTION_VERSION &&
    (record.selectedEnvUri === null || typeof record.selectedEnvUri === 'string')
  )
}

/** Load a versioned, credential-free selected Environment from browser storage. */
export function loadStoreEnvironmentSelection(
  storage: Pick<Storage, 'getItem'>
): EnvironmentSelectionState {
  const raw = storage.getItem(STORE_ENVIRONMENT_SELECTION_KEY)
  if (!raw) return createEmptyEnvironmentSelection()
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPersistedSelection(parsed)
      ? { selectedEnvUri: parsed.selectedEnvUri }
      : createEmptyEnvironmentSelection()
  } catch {
    return createEmptyEnvironmentSelection()
  }
}

/** Persist only the opaque Environment identity; transport and action authority remain runtime-only. */
export function saveStoreEnvironmentSelection(
  storage: Pick<Storage, 'setItem'>,
  selection: EnvironmentSelectionState
): void {
  const persisted: PersistedStoreEnvironmentSelection = {
    version: STORE_ENVIRONMENT_SELECTION_VERSION,
    selectedEnvUri: selection.selectedEnvUri,
  }
  storage.setItem(STORE_ENVIRONMENT_SELECTION_KEY, JSON.stringify(persisted))
}

/** Own the mounted App's selected Environment and converge same-origin windows through storage events. */
export function useStoreEnvironmentSelection(): readonly [
  EnvironmentSelectionState,
  (envUri: string) => void,
] {
  const [selection, setSelection] = useState<EnvironmentSelectionState>(() =>
    typeof localStorage === 'undefined'
      ? createEmptyEnvironmentSelection()
      : loadStoreEnvironmentSelection(localStorage)
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_ENVIRONMENT_SELECTION_KEY || typeof localStorage === 'undefined')
        return
      setSelection(loadStoreEnvironmentSelection(localStorage))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const choose = useCallback((envUri: string) => {
    setSelection((current) => {
      const next = selectEnvironment(current, envUri)
      if (typeof localStorage !== 'undefined') saveStoreEnvironmentSelection(localStorage, next)
      return next
    })
  }, [])

  return [selection, choose]
}
