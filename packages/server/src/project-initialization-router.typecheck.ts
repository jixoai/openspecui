/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Typecheck the public Init stream and cancellation request boundary.
 * 2. Prove browser callers cannot add path, Root, Store, tools, profile, or force fields.
 * 3. Keep stream events and cancellation settlement aligned with Core contracts.
 *
 * Original request (2026-08-01): `openspec init --tools=none` must be a fixed Server-owned command.
 * Review correction (2026-08-02): public Router evidence must be covered by an explicit test-typecheck lane.
 */
import type { CliStreamEvent, CliStreamSettlement } from '@openspecui/core'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from './router.js'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Expect<Value extends true> = Value

type Inputs = inferRouterInputs<AppRouter>
type Outputs = inferRouterOutputs<AppRouter>

export type InitStreamInputIsRequestOnly = Expect<
  Equal<Inputs['init']['initStream'], { requestId: string }>
>
export type InitCancelInputIsRequestOnly = Expect<
  Equal<Inputs['init']['cancel'], { requestId: string }>
>
export type InitStreamOutputIsCliEvent = Expect<
  Equal<Outputs['init']['initStream'], CliStreamEvent>
>
export type InitCancelOutputIsSettlement = Expect<
  Equal<Outputs['init']['cancel'], CliStreamSettlement>
>
