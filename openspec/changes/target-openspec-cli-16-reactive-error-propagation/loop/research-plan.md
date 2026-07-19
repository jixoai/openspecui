<!--
Orthogonal intents (created 2026-07-19 Asia/Shanghai):
1. Trace Root Context and browser subscription authority.
2. Distinguish HTTP query/mutation failures from tRPC WebSocket failures.
3. Define observable error propagation before changing readiness gates.
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
