<!--
Orthogonal intents (created 2026-07-19 Asia/Shanghai):
1. Define the Project Binding write-then-converge contract.
2. Preserve launch-file ownership while exposing typed Planning-root preview evidence.
3. Keep root subscription convergence asynchronous and observable.
4. Prove the public mutation boundary without adding sleeps or generic barriers.

Source decision (2026-07-19): move W2 out of target-openspec-cli-16-line after the owner approved
write-then-converge semantics.
-->

# Project Binding Settlement

This independent Change owns `planningConfig.updateProjectBinding` settlement. The launch project's
`store:` and `references:` declarations are written first. The mutation then returns typed launch-write,
`rootPreview`, and transition evidence; Planning-root subscriptions converge asynchronously. The mutation
must not wait for an unbounded watcher transition and must not claim that the preview is already the live
Root Context.

## Non-goals

- No W1 Git scope/token changes.
- No W3 WebSocket fallback, artificial UI lock, or generic generation barrier.
- No project-local Store registry, XDG overlay, or filesystem-owned root inference.

## Acceptance boundary

- A checked public Router/server test proves the response contract and the exact write-then-converge
  ordering.
- A mutation-resistance test fails when the typed preview/transition evidence is removed or the mutation
  is changed back to an unbounded full-transition wait.
- Config preserves dirty declarations on failure and renders the returned preview without relabeling it
  as the current Root Context.
- Focused unit/typecheck evidence and one bounded direct Project Web flow are recorded before review.
