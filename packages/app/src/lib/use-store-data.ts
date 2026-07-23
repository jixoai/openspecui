/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Fetch Store Inventory/Inspector through the hosted REST boundary (observed-only).
 * 2. Keep Store truth and mutation lifecycle backend-owned.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Migration (2026-07-23): wired to the backend Store procedures via backend-client.
 */
import type { StoreDoctorResult, StoreListResult } from '@openspecui/core/store-types'
import { useEffect, useState } from 'react'
import type { StoreInspectorProjection, StoreInventoryProjection } from '../types/root-context'
import type { StoreMutation } from '../types/store-mutation'
import { fetchBackendStoreInspector, fetchBackendStoreInventory } from './backend-client'

export interface StoreDataState {
  /** Store Inspector projection (doctor). */
  inspector: StoreInspectorProjection | undefined
  /** Store Inventory projection (list). */
  inventory: StoreInventoryProjection | undefined
  /** Whether a fetch is in progress. */
  isLoading: boolean
  /** Most recent error. */
  error: Error | null
  /** In-flight mutations (accepted/running). Backend-owned; surfaced by future mutation wiring. */
  activeMutations: StoreMutation[]
  /** Recently completed mutations (succeeded/failed/indeterminate). */
  recentMutations: StoreMutation[]
}

export interface UseStoreDataOptions {
  /** Backend instance locator; undefined returns the empty non-loading state. */
  apiBaseUrl?: string | null
  /** Optional Bearer credential for an Access-Gated backend (session memory only). */
  credential?: string | null
  /** Change this value to force a re-fetch (e.g. after a mutation settles). */
  refreshNonce?: number
}

/**
 * Read Store Inventory/Inspector projections for one backend. The hook is observed-only: it never
 * mutates Stores, never scans the filesystem, and never claims completeness beyond what the backend
 * returned. Mutations remain backend-owned and surface through `activeMutations`/`recentMutations`.
 */
export function useStoreData(options: UseStoreDataOptions = {}): StoreDataState {
  const { apiBaseUrl, credential, refreshNonce } = options
  const [inspector, setInspector] = useState<StoreDoctorResult | undefined>(undefined)
  const [inventory, setInventory] = useState<StoreListResult | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!apiBaseUrl) {
      setInspector(undefined)
      setInventory(undefined)
      setIsLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    Promise.all([
      fetchBackendStoreInventory({ apiBaseUrl, credential }),
      fetchBackendStoreInspector({ apiBaseUrl, credential }),
    ])
      .then(([inventoryEnvelope, inspectorEnvelope]) => {
        if (cancelled) return
        if (inventoryEnvelope.available) {
          setInventory({
            stores: inventoryEnvelope.stores,
            evidence: inventoryEnvelope.evidence ?? null,
          } as StoreListResult)
        } else {
          setInventory(undefined)
        }
        if (inspectorEnvelope.available) {
          setInspector({
            stores: inspectorEnvelope.stores,
            evidence: inspectorEnvelope.evidence ?? null,
          } as StoreDoctorResult)
        } else {
          setInspector(undefined)
        }
        const firstError = inventoryEnvelope.error ?? inspectorEnvelope.error
        setError(firstError ? new Error(firstError.message) : null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, credential, refreshNonce])

  return {
    inspector: inspector as StoreInspectorProjection | undefined,
    inventory: inventory as StoreInventoryProjection | undefined,
    isLoading,
    error,
    activeMutations: [],
    recentMutations: [],
  }
}
