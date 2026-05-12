import { useSyncExternalStore } from 'react'
import { terminalInvocationConfigStore } from './terminal-invocation-config'

export function useTerminalInvocationConfig() {
  return useSyncExternalStore(
    (listener) => terminalInvocationConfigStore.subscribe(listener),
    () => terminalInvocationConfigStore.getSnapshot(),
    () => terminalInvocationConfigStore.getSnapshot()
  )
}
