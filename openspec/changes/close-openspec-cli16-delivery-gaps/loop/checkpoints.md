<!--
Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
1. Track independently verifiable delivery-gap corrections from focused proof through protected delivery.
2. Separate external loading-regression recovery, automated preparation evidence, and manager walkthroughs.
3. Preserve honest migration of the incomplete old Change rather than archival by assertion.
4. Prevent full-gate churn before a named production boundary is accepted.
5. Split clean-CI-only failures into independently reviewable correction packages.

Original request (2026-07-23): "走查任务直接到新的change中做。你目前的工作就是：review + interview + replan(write new openspec change)"
Original request (2026-07-21): "focused review 未通过，不跑全量门禁。"
-->

## Checkpoint State

Planning is complete and focused implementation is active. Checkmarks prove only their named package and
review boundary; they are not proof that broad gates, owner walkthrough, merge, archive, or release passed.

The worker must update `loop/implementation.md` after every accepted package with the actual changed owner,
pre-fix red result, green result, mutation-resistance result, commands, output summary, and divergence.
Focused reviewer acceptance is a hard predecessor of the next package and every broad gate.

## 1. Review and Planning

- [x] 1.1 Independently reviewed `24c313c...HEAD`; recorded confirmed product/security/type/static/reactive defects and current gate truth in `research-plan.md`.
- [x] 1.2 Split remediation into P1 Hosted identity/Gate, P2 App connection/Context, P3 Store lifecycle, P4 contract/static/reactive repair, and P5 delivery/acceptance.
- [x] 1.3 Recorded that existing owner decisions resolve ordinary design questions; loopback conditions are explicit in `implementation.md`.
- [x] 1.4 Created the manager-owned final walkthrough ledger in Section 5; agent automation is preparation only.
- [x] 1.5 Added `hosted-environment-delivery` and `projection-contract-truth` delta specifications; strict OpenSpec validation passed after the artifacts were complete.
- [ ] 1.6 If a loopback trigger occurs, return to intake/research-plan and obtain the specific manager decision before more implementation.

## 2. P1 Hosted Identity and Access Gate

- [x] 2.1 Add/inject one stable Server host identity provider, compute one opaque `envUri` from host identity plus effective data home, and prove project/port/process do not affect equality while either equality input does.
- [x] 2.2 Pass the issued `EnvUri` through Server context into Store mutation ownership; remove all router/path-derived `envUri` construction.
- [x] 2.3 Write a checked real tRPC WS red fixture showing missing and invalid connection credentials can access the router before the fix; do not use only `checkWebSocketConnectionParams` unit calls.
- [x] 2.4 Authenticate `info.connectionParams` in tRPC context before any guarded procedure/subscription; preserve unguarded pass-through and non-browser Authorization-header behavior.
- [x] 2.5 Prove valid, missing, invalid, and reconnecting WS/HTTP/PTY credentials at production boundaries; remove the context gate and show the same protected WS case fails.
- [x] 2.6 Bind a consumed launch credential to the parsed launch API locator before URL stripping; no locator means no arbitrary tab assignment.
- [x] 2.7 Extend App-native reachability and HTTP clients with `authentication-required` and exact locator-scoped credentials; this evidence does not claim that an embedded Project Web can load or authenticate its own transports.
- [x] 2.8 Deliver the exact generated/manual Access Gate credential from CLI launch into both Direct Web and App launch fragments, and from the App's locator owner into only the matching Project Web iframe bootstrap.
- [x] 2.9 Separate the loadable static Project Web shell from protected backend data surfaces so gated navigation can start without granting API, file, tRPC, WebSocket, PTY, or notification access.
- [x] 2.10 Make Project Web consume and strip its credential before rendering, then supply it from one in-memory owner to tRPC HTTP, tRPC WS connection params, PTY auth-first, and every raw protected fetch/resource path without persistence or cross-locator leakage.
- [x] 2.11 Prove the real CLI start-command browser-target owner and a production worktree worker reach guarded Project Web/health, then one protected HTTP RPC, subscription, and PTY operation; missing/invalid credentials stay rejected, and removing each real owner/supplier makes its named fixture fail.
- [x] 2.12 Obtain focused reviewer acceptance for the complete P1 browser delivery chain before P2/P3/P4 or broad gates.

## 3. P2 App Connection and Context Projection

- [x] 3.1 Atomically bind selected environment authority to the full selected tab identity (`tabId`, locator, session, creation identity) and its current observation generation; no passive-effect window or duplicate/replaced tab may combine a prior observation with a new tab identity.
- [x] 3.2 Keep App-native per-locator credentials isolated across health and hosted HTTP clients; Project Web transport delivery is owned and accepted separately by 2.8--2.12.
- [x] 3.3 Collect health and Root Context from every retained, protocol-compatible connection while preserving source-labelled loading, typed Root error diagnostics, stale evidence, credential state, and the original generation/envUri/observedAt that produced any retained Root/Reference evidence.
- [x] 3.4 Make Environment Center and Context Matrix group only observed backend-issued `envUri`, Store, Root, and exact Reference provenance; retain the explicit non-machine-wide-completeness boundary and grouped connected-project evidence.
- [x] 3.5 Prove a selected B action cannot dispatch using A, a hybrid old-observation/new-tab authority, or a retired same-locator B generation. Real Register/Remove owner fixtures must turn red when the exact identity/generation guard is removed, without disabled-DOM bypasses or production test instrumentation.
- [x] 3.6 Obtain focused reviewer acceptance for P2 before P3/P4 or broad gates.

## 4. P3 Observable Store Mutation Ledger

- [x] 4.1 Refactor Server mutation admission to return/rejoin `accepted` before CLI terminal settlement, with request-id deduplication and no Cancel/automatic retry.
- [x] 4.2 Add a typed Server-owned lifecycle subscription/rejoin projection that emits known records then accepted/running/terminal changes without becoming Store inventory truth.
- [x] 4.3 Prove a delayed real router operation delivers `accepted` then `running` before terminal, exactly once; deleting stream publication or making start await terminal makes the test fail.
- [x] 4.4 Keep `indeterminate` only for post-admission lost terminal truth. Prove authentication/validation/HTTP rejection does not create a record or close a destructive UI as though it ran.
- [x] 4.5 Connect App Store Inspector/remove/setup/register/unregister controls to the lifecycle projection and invalidation-driven fresh Store/Context pulls; retain terminal evidence and disconnect/rejoin state.
- [x] 4.6 Add checked component-level Vitest/basic Playwright preparation evidence for all five lifecycle states without fake buttons or manually invoked downstream callbacks.
- [x] 4.7 Obtain focused reviewer acceptance for P3 before P4 or broad gates.

## 5. P4 Typed, Static, Reactive, and Evidence Repair

- [x] 5.1 Publish/use browser-safe Zod hosted envelope schemas and one typed decoder; malformed health/Store/Root/mutation payloads become contract errors, never asserted public contracts.
- [x] 5.2 Remove fabricated static CLI result evidence and share source-aware mapping so static provenance explicitly carries no backend execution evidence. Reopened 2026-07-25 corrections are complete: whole-Catalog static policy is explicit, route Store ids cannot become snapshot provenance, and every new provenance branch uses exhaustive `ts-pattern` evidence.
- [x] 5.3 Move Dashboard Git refresh stamp reads/writes through the shared physical/reactive path; prove a committed refresh settles observation before a dependent projection reads it, and removing settlement fails.
- [x] 5.4 Replace `as any`/suppression-based public-boundary tests with checked fixtures and add accurate timestamped headers to every changed TS/TSX source and test file in the reviewed range.
- [x] 5.5 Run focused static-provider/SSG, App, Core, and Server tests for P4; obtain focused reviewer acceptance before broad gates.

## 6. P5 External Regression, Gates, and Manager Walkthrough

- [x] 6.1 Revalidated the alleged `refine-live-projection-experience` Server-emission failure against the current owner. It is stale rather than an open repair: Root Snapshot 3/3, real Git Router 7/7, and the Git checked lane pass; the evidence and current `95bc2b9` cache/invalidation path are recorded in that Change.
- [x] 6.2 Confirmed `refine-live-projection-experience` P1-A candidate `d1740335` through independent focused tests, static contract review, mutation evidence, and fresh isolated Dashboard benchmarks. No external source fix was copied into this Change.
- [ ] 6.3 Reconcile the corrected local candidate only after accepted 6.3d: format, lint, all 15 workspace typechecks, complete unit tests, component browser lanes, diff check, and strict Change validation must pass without generated Web output assumptions or widened timeouts.
- [x] 6.3a Made the real gated CLI product-chain fixture self-contained in a clean checkout through per-invocation `webAssetsDir`; one resolved directory owns the public shell and preview assets, explicit empty input cannot fall back, and removing the physical handoff makes the same real `startServer` fixture fail with missing-assets evidence.
- [x] 6.3b Corrected the repeated clean-CI Tool `commands/update` observation failure through retained directory inventories: fanout fell from `720/401/720` states/subscriptions/polls to `60/60/0`, expected/unexpected/legacy and physical-scope semantics remain covered, bypassing the inventory dependency makes the named stream fixture fail, and the real Codex observation root survives deletion/recreation without timeout or generic-kernel changes.
- [x] 6.3c Made the real Spec Router handoff fixture await its asynchronous `onResolved` lifecycle before asserting each emitted path. Production route/document/cache/transition/location evidence remains unchanged, and removing the actual event subscription makes the owned fixture fail at the named path assertion.
- [x] 6.3d Carried the parent CLI runtime's already resolved `webAssetsDir` through `WorktreeInstanceManager`, checked worker data, and a consumed private process environment value. The accepted worker/process branch fixtures are joined by a typechecked real `startServer -> tRPC Git switchWorktree -> child Server` fixture that serves the parent-owned marker and verifies sibling health. Replacing the exact upstream `startServer -> Manager` argument with an invalid root fails that named fixture at worker-data admission; no public CLI option, target-worktree asset discovery, generated-output fallback, or hand-authored Manager injection satisfies the proof.
- [x] 6.4 Removed existing generated Web outputs with the environment-compatible idempotent cleanup, then the focused static-provider tests and clean `pnpm --filter @openspecui/web build:ssg` completed with zero exit.
- [x] 6.5 Audited the current publishable surface against the existing 6.x, Hosted, static References, Config, loading, and Summary-v2 changesets; every changed published package/behavior is covered and no duplicate changeset is required. App remains private.
- [ ] 6.6 PR #207 head `5dfff29` passed Changeset Gate and CI Scope, then Fast Gate run `30168547796` rejected two real worktree child fixtures because the already resolved parent `webAssetsDir` was not handed to process/worker children. Browser shards were skipped behind Fast Gate. Accept 6.3d, replay 6.3 once, update the PR, and require fresh checks.

### Manager-only final walkthrough ledger

- [ ] 6.7 Gated auto-launch: fragment credential binds to its launch backend, reaches health/RPC/WS, and is removed from visible URL/persisted tabs.
- [ ] 6.8 Gate rejection: missing/invalid credential is visibly authentication-required, not offline/current/success; WS reconnect behaves equivalently.
- [ ] 6.9 Multi-environment App: selected B remains operation target while A is online; same host/data home projects group by one opaque `envUri`, while a distinct environment does not.
- [ ] 6.10 Store lifecycle: observe accepted/running/terminal, then disconnect/rejoin; a rejected destructive request does not claim indeterminate completion.
- [ ] 6.11 Context Matrix: multiple connected projects show observed Root/Reference relationships only, with no completeness claim.
- [ ] 6.12 Static and responsive App: referenced static output has no invented live evidence; desktop/mobile layouts are readable and non-overlapping.

## 7. Old Change Reconciliation and Delivery

- [x] 7.1 Map all 25 unresolved `target-openspec-cli-16-line` items, including independently reopened 8.12/9.4/9.5, to exact P1--P5 evidence or retain them openly unresolved.
- [x] 7.2 Write `target-openspec-cli-16-line/loop/supersession.md` and link it from the old implementation record. Every transferred or abandoned item remains unchecked unless linked proof actually completes it.
- [x] 7.3 Strictly validate this successor and recheck the old artifact/task status, then after manager confirmation archive `target-openspec-cli-16-line` with `-y --skip-specs`. The old loop Change has no deltas, so standalone strict change validation predictably rejects it while archive's own delta validation has nothing to inspect; the `109/131` pre-review baseline, corrected `106/131` state, and incomplete-task warning remain part of the record.
- [ ] 7.4 Verify and archive this corrective Change only after its own code, focused/full gates, manager walkthrough, protected merge, and reconciliation are complete. Ask about release only after merge; follow changeversion/release automation only if explicitly approved.
