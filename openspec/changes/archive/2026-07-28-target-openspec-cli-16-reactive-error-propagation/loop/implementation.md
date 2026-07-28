<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Record implementation and review evidence for reactive error propagation.
2. Preserve causal red/green evidence across server and browser transports.
3. Keep uncertainty visible instead of inventing readiness conclusions.
4. Close the child ledger from later accepted production evidence without relabeling provenance.

Original request (2026-07-28): "把残留的工作先完成"
-->

# Implementation Log

Status: reconciled complete on 2026-07-28. W3 did not originate a standalone implementation commit; later
accepted CLI 1.6 delivery and realtime-experience work implemented its contract at the same production owners.
This record does not relabel those fixes as historical W3 work.

## Implemented production boundaries

- `07c6e496` moved Root Context onto explicit subscription authority. Cached Root data stays displayable during
  reconnect/rebind, while `useRootActionState` remains locked until a current replacement arrives.
- `5c0ee93e` made the real Context route prioritize terminal transport errors over unresolved Loading.
- `ca1db284` preserved retained content as `refresh-error` rather than returning to initial Loading.
- `067783a3` made pending PTY workflow input reject on a matching Server rejection or connection close.
- `5a4d2d06` completed the lifecycle-only Root Push plus typed HTTP Pull contract and retained authority tests.

HTTP query and mutation failures already reject their typed Promises. Active Root and Project Binding owners retain
their local drafts and expose those errors; no W3-specific fallback or success synthesis was added.

## Current fixed-point evidence

Focused green on `main` commit `3fcfd3f`:

```text
pnpm --filter @openspecui/web exec vitest run \
  src/lib/use-context-subscription.test.tsx \
  src/lib/use-root-action-state.test.ts \
  src/lib/use-subscription.reconnect.test.tsx \
  src/routes/context.test.tsx \
  src/components/config/active-root-config-section.test.tsx \
  src/lib/terminal-controller.test.ts
  6 files / 79 tests passed

pnpm --filter @openspecui/server exec vitest run \
  src/root-context-cold-start.integration.test.ts
  1 file / 1 test passed
```

The Server fixture crosses a real tRPC WebSocket lifecycle Push and typed HTTP Root Projection Pull. The Web hook
fixture invokes the production `useContextSubscription -> useAuthoritativeSubscription -> useRootActionState`
owner, not a hand-authored UI handler.

## Mutation-resistance evidence

This is a current-fixed-point mutation proof, not a retroactive historical red claim. In a detached worktree at
`3fcfd3f`, bypassing the exact `useAuthoritativeSubscription.onError` state commit and rerunning
`use-context-subscription.test.tsx` produced:

```text
1 failed / 2 passed
expected status blocked
received status checking
packages/web/src/lib/use-context-subscription.test.tsx:202
```

The first temporary attempt failed before collection because the detached fixture lacked the Core package's
dependency link; it is excluded from evidence. After restoring that fixture dependency, the same command reached
all three tests and failed only the named transport-error authority assertion.

## Acceptance and archive boundary

The owner's later CLI 1.6 and `refine-live-projection-experience` walkthroughs accepted direct error presentation,
disconnect/reconnect behavior, retained display continuity, and the final replacement implementation. Agent-run
evidence remains focused Vitest plus the basic Server transport fixture; no new browser acceptance is claimed here.

No production code change, changeset, release, or migration is required to close W3. Archive this child with
`--skip-specs`: it was split from the parent as an implementation/evidence package and has no independent delta
spec directory.
