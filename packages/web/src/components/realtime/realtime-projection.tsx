/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Headless composable Root that publishes only data-state/data-authority/data-cause (no layout).
 * 2. Convenience hooks for consumers that already hold a derived RealtimeProjectionState.
 *
 * Original request (2026-07-23): "一次性把现有的页面都统一整改……统一组件的封装和开发。"
 *
 * Compromise: the Root MUST NOT add a Card, border, page wrapper, route layout, or navigation. It is a
 * context + data-attribute provider only; routes keep their existing layout ownership.
 */
import { createContext, useContext, useMemo, type ElementType, type ReactNode } from 'react'

import type {
  RealtimeProjectionAuthority,
  RealtimeProjectionCause,
  RealtimeProjectionState,
  RealtimeProjectionTopology,
} from '@/lib/realtime'

export interface RealtimeProjectionContextValue<T = unknown> {
  topology: RealtimeProjectionTopology
  authority: RealtimeProjectionAuthority
  cause: RealtimeProjectionCause
  state: RealtimeProjectionState<T>
}

const RealtimeProjectionContext = createContext<RealtimeProjectionContextValue | null>(null)

export function useRealtimeProjection<T = unknown>(): RealtimeProjectionContextValue<T> {
  const value = useContext(RealtimeProjectionContext)
  if (value === null) {
    throw new Error(
      'useRealtimeProjection must be used inside <RealtimeProjection.Root>. Wrap the region whose lifecycle it projects.'
    )
  }
  return value as RealtimeProjectionContextValue<T>
}

export interface RealtimeProjectionRootProps<T> {
  state: RealtimeProjectionState<T>
  children: ReactNode
  /** Extra className for the wrapper element; it does NOT impose layout beyond the data attributes. */
  className?: string
  /** HTMLElement to render; defaults to a plain div. Consumers may pass a semantic element. */
  as?: ElementType
}

/**
 * The compositional root. Supplies the realtime context and renders data-state/data-authority/data-cause on a
 * minimal element. It intentionally adds no visual chrome; atoms read the context or the data attributes.
 */
export function RealtimeProjectionRoot<T>({
  state,
  children,
  className,
  as = 'div',
}: RealtimeProjectionRootProps<T>): ReactNode {
  const value = useMemo<RealtimeProjectionContextValue<T>>(
    () => ({
      topology: state.topology,
      authority: state.authority,
      cause: state.cause,
      state,
    }),
    [state]
  )
  const Wrapper: ElementType = as
  return (
    <RealtimeProjectionContext.Provider value={value as RealtimeProjectionContextValue}>
      <Wrapper
        data-state={state.topology}
        data-authority={state.authority}
        data-cause={state.cause}
        className={className}
      >
        {children}
      </Wrapper>
    </RealtimeProjectionContext.Provider>
  )
}
