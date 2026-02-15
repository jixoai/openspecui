import { useSyncExternalStore } from 'react'
import { navController, type NavState } from './nav-controller'

/** Subscribe to the full navController state (layout + locations) */
export function useNavLayout(): NavState {
  return useSyncExternalStore(
    (cb) => navController.subscribe(cb),
    () => navController.getSnapshot()
  )
}
