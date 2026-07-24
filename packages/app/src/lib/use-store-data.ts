/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Fetch Store Inventory/Inspector through the hosted REST boundary (observed-only).
 * 2. Keep Store truth and mutation lifecycle backend-owned.
 * 3. Resolve hosted credentials inside the per-locator backend client boundary.
 * 4. Expose an imperative pull so every terminal settlement starts one fresh projection request.
 * 5. Retain only browser-decoded hosted Store projections, never asserted reconstructed payloads.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Migration (2026-07-23): wired to the backend Store procedures via backend-client.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoreInspectorProjection, StoreInventoryProjection } from '../types/root-context'
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
  /** Start one fresh Store Inventory/Doctor pull. */
  refresh(): Promise<void>
}

export interface UseStoreDataOptions {
  /** Backend instance locator; undefined returns the empty non-loading state. */
  apiBaseUrl?: string | null
}

/**
 * Read Store Inventory/Inspector projections for one backend. The hook is observed-only: it never
 * mutates Stores, never scans the filesystem, and never claims completeness beyond what the backend
 * returned. Mutation lifecycle remains a separate backend-owned projection.
 */
export function useStoreData(options: UseStoreDataOptions = {}): StoreDataState {
  const { apiBaseUrl } = options
  const [inspector, setInspector] = useState<StoreInspectorProjection | undefined>(undefined)
  const [inventory, setInventory] = useState<StoreInventoryProjection | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const requestEpoch = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    if (!apiBaseUrl) return
    const epoch = ++requestEpoch.current
    setIsLoading(true)
    setError(null)
    try {
      const [inventoryEnvelope, inspectorEnvelope] = await Promise.all([
        fetchBackendStoreInventory({ apiBaseUrl }),
        fetchBackendStoreInspector({ apiBaseUrl }),
      ])
      if (epoch !== requestEpoch.current) return
      if (inventoryEnvelope.available) {
        setInventory(inventoryEnvelope)
      } else {
        setInventory(undefined)
      }
      if (inspectorEnvelope.available) {
        setInspector(inspectorEnvelope)
      } else {
        setInspector(undefined)
      }
      const firstError = inventoryEnvelope.error ?? inspectorEnvelope.error
      setError(firstError ? new Error(firstError.message) : null)
    } catch (caught) {
      if (epoch !== requestEpoch.current) return
      setError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      if (epoch === requestEpoch.current) setIsLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    if (!apiBaseUrl) {
      requestEpoch.current += 1
      setInspector(undefined)
      setInventory(undefined)
      setIsLoading(false)
      setError(null)
      return
    }
    void refresh()
    return () => {
      requestEpoch.current += 1
    }
  }, [apiBaseUrl, refresh])

  return {
    inspector,
    inventory,
    isLoading,
    error,
    refresh,
  }
}
