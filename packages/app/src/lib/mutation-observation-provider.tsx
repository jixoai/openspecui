/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Install one App-level mutation observation owner above all routes.
 * 2. Synchronize retained credential-free tabs into locator-scoped transports.
 * 3. Expose the framework-neutral owner and immutable projection snapshot to React consumers.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  createMutationObservationOwner,
  type MutationObservationOwner,
  type MutationObservationSnapshot,
} from './mutation-observation'
import { createTRPCMutationObservationTransportFactory } from './mutation-observation-transport'
import { useConnections } from './use-connections'

const MutationObservationContext = createContext<MutationObservationOwner | null>(null)

/** Own one locator-scoped lifecycle transport set for the mounted App route tree. */
export function MutationObservationProvider({ children }: { children: ReactNode }) {
  const connections = useConnections()
  const [owner] = useState(() =>
    createMutationObservationOwner(createTRPCMutationObservationTransportFactory())
  )

  useEffect(() => {
    owner.setTabs(connections.tabs)
  }, [connections.tabs, owner])

  useEffect(() => () => owner.dispose(), [owner])

  return (
    <MutationObservationContext.Provider value={owner}>
      {children}
    </MutationObservationContext.Provider>
  )
}

/** Read the shared framework-neutral mutation observation owner. */
export function useMutationObservationOwner(): MutationObservationOwner {
  const owner = useContext(MutationObservationContext)
  if (!owner) throw new Error('MutationObservationProvider is required.')
  return owner
}

/** Subscribe to every retained locator's lifecycle projection. */
export function useMutationObservations(): MutationObservationSnapshot {
  const owner = useMutationObservationOwner()
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot)
}
