/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Subscribe Settings to launch-local tool detection and physically scoped artifact state.
 * 2. Rebind tool artifact observation when the environment-owned delivery contract changes.
 *
 * Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配。"
 * Independent review correction (2026-07-20): Environment-global Codex commands must not be labeled launch-owned.
 */
import { trpcClient } from '@/lib/trpc'
import type { SubscriptionState } from '@/lib/use-subscription'
import type { AIToolOption, ToolInitDelivery, ToolInitState } from '@openspecui/core'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Unsubscribable {
  unsubscribe(): void
}

interface IdentityBoundSubscriptionState<T> {
  identity: string
  value: SubscriptionState<T>
}

const PENDING_SUBSCRIPTION_STATE = {
  data: undefined,
  isLoading: true,
  error: null,
} satisfies SubscriptionState<never>

function useGenerationBoundSubscription<T>(
  identity: string,
  subscribe: (callbacks: {
    onData: (data: T) => void
    onError: (error: Error) => void
  }) => Unsubscribable
): SubscriptionState<T> {
  const generationRef = useRef(0)
  const [state, setState] = useState<IdentityBoundSubscriptionState<T>>({
    identity,
    value: PENDING_SUBSCRIPTION_STATE,
  })

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    setState({ identity, value: PENDING_SUBSCRIPTION_STATE })
    const isCurrent = () => generationRef.current === generation
    const subscription = subscribe({
      onData: (data) => {
        if (!isCurrent()) return
        setState({ identity, value: { data, isLoading: false, error: null } })
      },
      onError: (error) => {
        if (!isCurrent()) return
        setState((previous) => ({
          identity,
          value: {
            data: previous.identity === identity ? previous.value.data : undefined,
            isLoading: false,
            error,
          },
        }))
      },
    })

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
      subscription.unsubscribe()
    }
  }, [identity, subscribe])

  return state.identity === identity ? state.value : PENDING_SUBSCRIPTION_STATE
}

/** Subscribe to AI tool roots detected beneath the launch project. */
export function useDetectedProjectToolsSubscription(): SubscriptionState<AIToolOption[]> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: AIToolOption[]) => void; onError: (error: Error) => void }) =>
      trpcClient.cli.subscribeDetectedProjectTools.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useGenerationBoundSubscription('detected-project-tools', subscribe)
}

/** Subscribe to launch-local skills and physically scoped commands for one delivery contract. */
export function useToolInitStatesSubscription(input: {
  delivery: ToolInitDelivery
  workflows: string[]
}): SubscriptionState<ToolInitState[]> {
  const identity = JSON.stringify({ delivery: input.delivery, workflows: input.workflows })
  const inputRef = useRef<{
    identity: string
    input: { delivery: ToolInitDelivery; workflows: string[] }
  } | null>(null)
  let identityBoundInput = inputRef.current
  if (identityBoundInput?.identity !== identity) {
    identityBoundInput = {
      identity,
      input: { delivery: input.delivery, workflows: [...input.workflows] },
    }
    inputRef.current = identityBoundInput
  }
  const subscriptionInput = identityBoundInput.input
  const subscribe = useCallback(
    (callbacks: { onData: (data: ToolInitState[]) => void; onError: (error: Error) => void }) =>
      trpcClient.cli.subscribeToolInitStates.subscribe(subscriptionInput, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    [subscriptionInput]
  )

  return useGenerationBoundSubscription(identity, subscribe)
}
