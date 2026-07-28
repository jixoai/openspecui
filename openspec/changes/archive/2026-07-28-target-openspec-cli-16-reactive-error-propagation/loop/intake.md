<!--
Orthogonal intents (created 2026-07-19 Asia/Shanghai):
1. Expose real transport/API failures in reactive project surfaces.
2. Avoid artificial UI locks and stale-data success claims.
3. Keep HTTP, tRPC subscription, and PTY transport boundaries explicit.
4. Prove failure propagation at the public browser/server boundary.

Source decision (2026-07-19): move W3 out of target-openspec-cli-16-line after the owner rejected
artificial locking and approved direct error exposure.
-->

# Reactive Error Propagation

This independent Change owns Root Context/Active Root reactive readiness and browser error propagation.
When a read/write operation depends on a disconnected transport, the actual transport/API failure must
reach the caller. The UI must not quietly present stale data as current success and must not add a fake
lock whose only purpose is to hide the error.

## Non-goals

- No W1 Git scope/token changes.
- No Project Binding settlement changes; W2 owns write-then-converge.
- No non-WebSocket fallback unless a public-boundary contract proves the existing transport cannot expose
  the required failure.

## Acceptance boundary

- A checked server/browser test reproduces a disconnected subscription or dependent API operation and
  observes the typed transport error at the real owner.
- Cached data, if retained for visual context, is explicitly non-authoritative and never silently unlocks
  a mutation.
- No error is replaced by an invented success, retry, or fallback result.
