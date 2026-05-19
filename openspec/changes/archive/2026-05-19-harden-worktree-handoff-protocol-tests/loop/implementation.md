## Implementation State

- Loop artifacts and delta specs are created for a platform-law change.
- BDD tests were added first and observed failing before production code changes.
- Focused BDD tests now pass for core health payloads, CLI worktree compatibility, Web notification fallback, and hosted app reachability.
- A shared runtime compatibility contract now exists in core and is consumed by server health, hosted app reachability, and worktree handoff readiness.
- Verification has passed for focused tests, affected package typechecks, lint, formatting, OpenSpec strict validation, `git diff --check`, and the lightweight worktree handoff HTTP fixture smoke.
- A second BDD loop was added after main-checkout testing showed the bug still existed in active child runtimes: source-mode parents now start child worktree servers through the workspace dev command instead of stale `packages/cli/dist/cli.mjs`.

## Decisions Taken

- Treat the reported `notifications.subscribe` crash as evidence of cross-worktree runtime protocol drift, not as a notification-only defect.
- Use a dedicated worktree branch `fix/worktree-handoff-bdd-gate` to keep this change isolated from unrelated local edits in the main checkout.
- Extend the runtime compatibility contract through core/server/cli tests rather than implementing a Git page local guard.
- Create a reusable worktree handoff test harness so future runtime feature work can model compatible and incompatible sibling servers cheaply.
- Add atom-level notification config defaults only as defensive rendering behavior; the platform fix remains capability-gated handoff readiness.
- Keep embedded URL support errors distinct in the hosted app by splitting core validation into runtime-metadata compatibility and full hosted health compatibility.
- Use the core package root export from CLI code instead of a core subpath that is not part of the package export contract.
- Preserve the old direct `dist/cli.mjs` startup only when the parent runtime is already the built runtime; this keeps packaged/npm behavior and deleted-worktree recovery stable while preventing source-mode drift.

## Divergence Notes

- The hosted app also consumed a local health shape validator. It was refactored in this loop to avoid a second protocol truth.
- The test harness uses lightweight HTTP health fixtures for most BDD cases. A full browser/process handoff remains an acceptance-level gate rather than the default for every protocol fixture.
- Full local CI and browser/process handoff acceptance are not yet run in this turn; the current evidence is focused and protocol-boundary targeted.
- Existing listening processes do not automatically pick up source changes. Stale processes on `3102`/`3103` can continue to return old health payloads until restarted, even after tests and source code are fixed.

## Loopback Triggers

- If runtime capabilities cannot be represented without duplicating truth between server and web, return to research-plan and redesign the contract.
- If BDD tests require full browser/process orchestration for every scenario, return to research-plan and split unit harness coverage from one acceptance-level browser scenario.
- If compatibility validation would block legitimate same-version local development, return to research-plan and define an explicit dev-mode override instead of weakening the law silently.
