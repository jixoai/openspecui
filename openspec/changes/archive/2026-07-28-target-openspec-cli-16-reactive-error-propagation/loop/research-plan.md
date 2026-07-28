<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Trace Root Context and browser subscription authority.
2. Distinguish HTTP query/mutation failures from tRPC WebSocket failures.
3. Define observable error propagation before changing readiness gates.
4. Reconcile later delivery work without manufacturing historical W3 evidence.

Original request (2026-07-28): "把残留的工作先完成"
-->

## Current boundary

```text
Server rootContext.subscribe
  -> loading -> refreshing(previous) -> ready/stale-error -> transport error

Web useContextSubscription
  -> generic subscription cache -> onData/onError
  -> Root Action readiness gate and Dashboard cached projection
```

The prior observation showed HTTP `200`, an updated `rootPreview`, and a browser WebSocket `Offline`.
That was not causal proof of a missing server emission. This Change must reproduce the selected failure
with a real typed subscription/API boundary before changing production code.

## Required research

1. Identify which browser operations depend on tRPC WebSocket versus HTTP.
2. Capture connection open/close/error, server emission, client `onData`, and client `onError` evidence.
3. Define whether cached read-only display remains visible while explicitly non-authoritative.
4. Ensure error propagation does not become a hidden UI lock or fabricated fallback.

## Current-state closure audit (2026-07-28)

Later accepted Changes implemented the W3 contract before this child ledger was updated. The audit therefore
verifies the current production owners and preserves the original evidence provenance rather than claiming that
W3 itself produced those historical fixes.

```text
Root lifecycle Push (tRPC WebSocket)
  -> rootContext.subscribeProjection
  -> useContextSubscription.onConnectionStateChange/onError
  -> useAuthoritativeSubscription
  -> cached Root remains readable; authority becomes waiting/failed

Root projection Pull and mutations (tRPC HTTP)
  -> rootContext.readProjection / planningConfig.* mutation
  -> rejected Promise or decoded projection error
  -> local route/form error; no fabricated success

Planning terminal operation (PTY WebSocket)
  -> TerminalController.writeWorkflowToSession
  -> matching Server acknowledgement OR explicit rejection/connection-close error
```

| Transport      | Production owner                                                                            | Objective failure behavior                                                                        | Checked evidence                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| tRPC HTTP      | `packages/web/src/lib/trpc.ts`, `use-context-subscription.ts`, route mutation owners        | Pull/mutation rejection reaches the caller; forms retain drafts and show the error                | `use-context-subscription.test.tsx`, `active-root-config-section.test.tsx`                             |
| tRPC WebSocket | `rootContext.subscribeProjection`, `useContextSubscription`, `useAuthoritativeSubscription` | Connecting/pending revokes current authority; terminal error is preserved and blocks root actions | `root-context-cold-start.integration.test.ts`, `use-context-subscription.test.tsx`, `context.test.tsx` |
| PTY WebSocket  | `TerminalController` plus the Server PTY acknowledgement owner                              | A pending workflow write rejects on Server rejection or socket close                              | `terminal-controller.test.ts`, Server PTY contract tests                                               |

No fallback transport or UI-only lock is required. Retained data is a display fact only; `current` authority is
restored exclusively by an accepted replacement projection.
