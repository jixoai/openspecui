<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Keep implementation reality synchronized with the plan.
2. Record the probe as the evidence that shaped the design, including what it disproved.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

## Implementation Log

### 2026-11-04 — Planning

- Intake, research plan, checkpoints, and the `reactive-file-system` delta written.
- Probe executed on macOS (`/tmp/watcher-probe/probe.mjs`, kept as evidence): create-while-subscribed
  is delivered and diffed; create-while-dead is **invisible to `getEventsSince` (`[]`)**; the same
  diff after re-subscribing reports it. Design consequence: the query API is a detector; re-arm plus
  re-read is the recovery primitive.
- Rejected before implementation, with reasons: per-directory polling (violates the fanout law and
  re-reads only what we choose); bind-time resync inside the watcher pool (unprovable from a macOS
  probe and it changes the pool's callback contract — two pool tests encode "acquire does not
  notify"); swapping to chokidar/watchman (out of scope; watchman is not installed on CI and adding a
  daemon is a distribution decision).

No production code yet.

### 2026-11-04 — Review round 1 folded (6/10 → revised plan)

Review round 1 returned six blockers and one architectural observation. All folded; the
architectural one changed the design rather than the wording:

- **Accepted (N11): the snapshot/diff tier and the coarse re-arm tier are removed.** The diff is blind
  exactly where it was supposed to help (macOS dead-watcher replay returns `[]`; Linux kernel drops
  never enter the library's tree), and it brought four extra surfaces — baseline lifecycle, ignore
  alignment for the query APIs, escalation storms, upstream query defects. Settlement is now a direct
  disk re-read at every layer, which is ground truth for _every_ loss class and deletes blockers
  B1/B2/B4 outright.
- **B3**: the trigger is now "any retained root lease", matching the spec's process-wide promise,
  with the guarantee restated against the cadence.
- **B5**: one `settleRootReads` plus a per-arm watermark replaces the S2/S3 double-work, and CP2's
  contradictory "exactly one per subscribe" is gone.
- **B6**: the red evidence is the behavioural stall (no second emission after `closeAllWatchers()`),
  which runs today, not a compile failure.
- **Fanout law**: the amendment is now explicit — one pooled interval per process, never per
  path/directory/root — and the existing test is changed to assert that contract instead of the
  root-before-spy ordering coincidence it currently depends on (N9).
- Overclaims O1/O2/O4 corrected in `intake.md` and the plan: the upstream race figures are cited
  separately, the re-read (not the re-arm) is named as the convergence primitive, and there is one
  stated convergence bound instead of an implied fast one.

### 2026-11-04/05 — Review round 2 folded (7/10 → plan v3)

Round 2 verified that three of round 1's blockers were genuinely eliminated (B1/B2 deleted with the
diff tier, B6 materialized as an executable red) and that the rest needed work. Its five blockers are
folded here:

- **R2-B2 (the dangerous one): one matching space.** Roots are realpath-tracked, cache keys are
  `resolve()`-built, and macOS `TMPDIR` sits under the `/var` → `/private/var` symlink — so a naive
  matcher covers **zero** reads on a developer machine while passing on a Linux runner. Round 2
  reproduced the divergence locally. Registration now records a normalized path once and matching is a
  pure ancestor string test with no per-pass filesystem calls.
- **R2-B1: single-flight replaces the watermark.** The watermark ("at most once per arm") silently
  disabled the very consumer-start case S2 exists for, because silent loss does not change the
  generation. Concurrent requests now coalesce; later requests at the same generation may run.
- **R2-B3: the fanout sentence is narrowed to the truth.** "Never per path/directory/root" was false —
  per-missing-path polls and per-watcher liveness probes exist. The recorded contract is one pooled
  settlement interval per process, with those two unchanged.
- **R2-B4: arm identity is explicit** — `(physical generation, logical root)` plus the refcount 0→1
  transition, since a second logical root on an initialized physical watcher changes no generation.
  Hook points named in `watcher-pool`; `subscribeRuntimeStatus` emits are explicitly not the hook.
- **R2-B5: the one-shot path stops tearing down the registry.** `clearCache(root)`'s substring deletion
  can orphan a live retained projection in the same process (reachable: one-shot and retained coexist in
  `AgentDeliveryProjectionService`). Replaced by settle-then-read, which also removes the substring
  hazard.

Overclaims corrected: the guarantee is scoped to registered reads under leased roots with a
cadence-shaped bound (O1/O2); the probe is one observed sequence, not a library law (O4); the fanout
sentence is narrowed (O5); O3 disappeared with the single-flight change. Non-blocking items folded: pass
commits serialize with our own writes, the matcher uses `containsPath` rather than `pathsOverlap`, the
cadence env is read at interval start, `closeAllWatchers()` must stop the interval, and the round-1
citation of "two pool tests" was dropped as imprecise.

### 2026-11-05 — Review round 3 folded (6.5/10 → plan v4)

Round 3 verified that two of round 2's folds were solid (fanout narrowing, arm identity) and that the
rest were directionally right but textually incomplete in eight places. All eight are folded; none
changed the design.

- **B1**: the normalized field is a _separate_ field. Moving `registration.path` would have repeated the
  same class of bug on the write path, whose matcher is `resolve()`-space and deliberately bidirectional
  (a directory deletion must reach reads under it). The net owns the lease→read matcher; the write path
  keeps its own.
- **B2**: single-flight gains a trailing obligation — requests arriving after a pass starts reading are
  served by one trailing pass instead of being discarded, so a consumer can no longer be left holding a
  value read before its request.
- **B3**: `settlePaths(roots)` is defined as pool- and lease-independent, awaited before the one-shot
  reads, with the existing two-read `tool-init-state` fixture named as its equivalence test.
- **B4**: trigger 2 is named — acquiring an already-initialized root record (refcount ≥ 1) — and the
  residual (attachments that skip root acquisition) is delegated to the cadence net.
- **B5**: the write-ordering claim assumed a serialization that does not exist; an epoch guard replaces
  it (stale commit re-reads once, then skips), tested with a gated `prepareRefresh`.
- **B6**: "root lease" is defined (pool `watcherRoots` refcount > 0) — the committed red test uses the
  pool-level API, so an environment-level definition would have contradicted it.
- **B7**: the orphan class has three more call sites (the local-model stores' no-argument
  `clearCache()`); declared out of scope with their consequence stated rather than silently widened.
- **B8**: `AGENTS.md`'s three touched laws are named and reconciled in CP6.

The CP5 assertion was also unsatisfiable as written (the per-watcher liveness interval exists by
design), so it now asserts through an exported diagnostic with N ≥ 2 leases.

### 2026-11-05 — Review round 4 folded (7.0/10 → plan v5)

Round 4 verified five of round 3's folds as landed (including the one that mattered most — the write
path is genuinely out of the new matching space) and found three blockers:

- **BLK-1: the named attach trigger was dead code.** `ReactiveObservationEnvironment` is the only
  production caller of `acquireWatcherRoot`, and it memoizes per normalized root, so the boot-armed
  launch root plus a later retained subscription never reaches the pool. The dead trigger is deleted and
  the real paths are named: the environment's memoized-acquire branch, plus **one** declared consumer
  hook in `AgentDeliveryProjectionService.subscribe` (awaited). S5.5's assertion boundary moves to the
  assembly — a pool-level test would have passed while production never triggered, which is precisely
  how the dead trigger survived round 3's review.
- **BLK-2: the trailing rule lacked its third timing.** Requests arriving during the trailing pass's own
  read phase are now defined (they derive one more pass), both halves are asserted, and the cost wording
  no longer promises a constant two-pass ceiling.
- **BLK-3: the epoch guard under-enumerated publishers.** "Write-settlement entry points" missed
  `updateReactiveFileCache` (used by config/global-settings/planning-config), event/poll refresh commits,
  and other passes. It is now a per-registration commit version bumped by all four, verified and
  committed in one synchronous block, re-read once, then skipped per registration.

Also folded: the stale-normalization boundary is stated in its general form (any later prefix symlink
change, not only a missing segment becoming one) with the pool's actual failure mode corrected;
`settlePaths`' roots are named as the existing `cacheRoots` set and one-way containment is stated as
deliberate next to the write path's bidirectional overlap; CP5's discrimination requires ≥ 2 **distinct
physical watchers**; the `setInterval` assertion became a delay multiset; the forced-reinitialize seam is
named; and the "cannot be orphaned" claim is scoped to the one-shot path.

### 2026-11-05 — Review round 5 folded (8.0/10 → plan v6, implementable) and S0 landed

Round 5 declared the plan **implementable** and verified all four triggers reachable at the code level.
One new blocker is folded: the spec's opening sentence promised convergence for any lost event while
"registered" was undefined — a class of consumers whose private state is written only by native watcher
callbacks (`tool-config`'s `tools:` state is the named instance) is outside the net by construction. The
requirement now defines _registered read_ and names that boundary, rather than implying coverage. Two
wording fixes folded (the convergence scenario binds the _read_ to the bound and excludes consumer
latency; the memoized-staleness bound was underestimated and missed the service-level memo), and the
non-blocking items became CP text: trailing tests must assert exact read-phase entries and the post-await
committed value with the cadence above the window; the jitter and exact-delay-multiset assertions can no
longer contradict each other; physical-watcher discrimination comes from the multiset; CP5 keeps the
Store-fallback half of the "inert" sentence intact.

Plan v6 also carries three named pre-implementation validations (V1 attach seam, V2 coordinator
discrimination against two fakes, V3 `settlePaths` path space).

**S0 landed** (`reactive-fs.ts` + `settlement-coverage.test.ts`): each cache registration records a
`normalizedPath` once, resolved via `resolveRealPathThroughExistingAncestor`; `settleRegisteredReadsUnder`
matches by pure ancestor containment and re-reads through the existing refresh closures, returning the
count. Mutation checks: switching the matcher to `registration.path` turns the path-space tests red, and
adding an `await stat(root)` turns the zero-filesystem-call test red. The committed red test still fails
for its intended reason, and its subscribe stub now returns the library's handle shape so teardown stops
erroring on our own fixture.

### 2026-11-05 — S1 landed (coordinator + four triggers), with V1/V2 evidence

`settlement-coordinator.ts` implements the per-root coordinator (at most one pass in flight; requests
arriving before the read phase join it; requests after it derive exactly one trailing pass; a request
during the trailing pass's read phase derives one more; waiters resolve after the pass that serves them
commits). It holds no timer, takes no lease, never rejects, and exposes a read-phase gate so
interleavings are constructed rather than slept into.

V2 evidence (fakes run once, then reverted): join-and-discard turns the trailing test red
(`expected [ 'pass-1', 'trailing-resolved' ] to deeply equal [ 'pass-1', 'pass-2', … ]`) and the
trailing-of-trailing test red (`settlement pass 2 never began`); exactly-one-trailing turns only the
third half red (`expected [ 1, 2 ] to deeply equal [ 1, 2, 3 ]`), which is the intended discrimination.
Trigger mutations (unwiring 1/2/3) each turn the trigger tests red; making the service hook
fire-and-forget turns V1 red (`expected 1 to be +0`).

V1 evidence (`agent-delivery-projection-service.settlement.test.ts`): with the settle gated at its read
phase, the projection's first read has not happened (zero CLI-availability calls, zero `readdir` under
the project dir); after release, the first frame already carries the freshly written skill, and the
`readdir` call order proves the settle re-read precedes the projection read. A second `subscribe`
produces no additional settle and no additional root acquisition, while still delivering a first frame.

**Deviation corrected during integration**: the first implementation imported
`settleRegisteredReadsUnder` directly into the coordinator, closing
`reactive-fs → watcher-pool → coordinator → reactive-fs`. It argued (and verified) that no
half-initialized namespace could be observed, but the plan forbids the cycle outright, so the pass body
is now **injected** (`registerSettlementRunner`, called once by `reactive-fs`): the coordinator imports
nothing, and the graph is acyclic again. Re-ran the full affected set afterwards: 69 core tests + 13
server tests green, core typecheck green.

`silent-event-loss.test.ts` is still red by design — it needs the pooled cadence from S3, and none of
S1's triggers can fire in its timeline (no consumer, no further events, no timer).

### 2026-11-05 — S3 landed: the pooled cadence and the version guard; the red is green

`watcher-pool` now owns the single process-level settlement interval: it exists only while at least one
root lease does (started at 0→1, stopped at 1→0 and explicitly by `closeAllWatchers()`, which bypasses
release), both timers are `unref()`'d, the `setInterval` delay is exactly the cadence while the jitter
lands in per-tick scheduling, and the cadence is read from `OPENSPECUI_SETTLEMENT_INTERVAL_MS` at start.
A tick requests settlement per leased root in order and **skips roots with a pass in flight**, so a tick
never derives a pointless trailing pass. `getSettlementDiagnostics().activeTimers` reports the real 0/1.

The version guard landed as a per-registration `commitVersion` bumped by all four publisher classes
(write-settlement core; `updateReactiveFileCache`; event/poll refresh commits for all four kinds; other
passes). A pass records the version, reads, and commits in one synchronous block; a changed version
re-reads once and only skips if the re-read window itself saw a new publication.

**The committed red is now green**: `silent-event-loss.test.ts` converges in 318 ms (it previously timed
out at 3 s), with no semantic change to the test — the directory listing whose events never arrive is
re-read by the cadence. Mutation evidence: removing the timer-count update turns the pool assertions red
(`expected +0 to be 1`); putting jitter into the `setInterval` delay breaks the delay multiset
(`[3000, 3000, 7942]` vs `[…, 7777]`); removing the in-flight skip derives an extra pass (`expected 2 to
be 1`); deleting the class-② bump reddens all four guard assertions at once, while deleting a kind's
closure bump reddens only the write-settlement case.

Two rulings recorded: (1) the retry reading is "skip only if a new publication lands during the re-read
window" — the conservative alternative would make the retry unable to ever commit, which is why the test
pins the chosen one; (2) the re-read path assumes every publisher writes the disk before publishing,
which holds for all current call sites and is stated as the residual.

One pre-existing environment failure remains outside this change: `upstream-contract-regression.test.ts`
expects the `references/openspec` submodule checkout, which the worktree lacked at the time of the run.

### 2026-11-05 — S4 landed: `settlePaths` and the one-shot switch

`settlePaths(paths)` normalizes each input root once (`resolveRealPathThroughExistingAncestor`), dedupes,
and settles them through the S0 primitive, returning the committed count. It depends on neither the pool
nor any lease, is awaited, and never removes a registration. `getToolInitStates` now settles its roots
and then reads — `invalidateToolInitCaches` became `collectToolInitCacheRoots` (collection only), and its
former `clearCache` scan is gone from the one-shot path. `clearCache` itself is untouched for the three
local-model stores, as scoped.

V3 evidence, run before the switch: with macOS `TMPDIR` under `/var`, the raw (un-normalized) root covers
**0** registrations and the normalized one covers **2**. Making `settlePaths` skip normalization turns the
existing two-read fixture red (`expected 'uninitialized' to be 'initialized'`), and restoring the old
`clearCache` scan makes the orphan test time out at 10 s on `projection.next()` — the retained projection
frozen, which is the defect that motivated the switch.

**Deliberate deviation from the plan text, recorded:** `settlePaths` calls the primitive directly rather
than routing through the coordinator. Joining an in-flight pass would let a one-shot call resolve on a read
that predates it, which contradicts the freshness contract it exists to provide; a direct read is always
fresh, the duplicate concurrent read is bounded, and the per-registration version guard already prevents
either pass from publishing an older value. The invariant is therefore restated: the coordinator governs
trigger-driven passes (arm/attach/cadence), while `settlePaths` is an independent awaited pass by design.

Full core suite after the switch: 94 files / 899 tests green, one skipped, no ordering sensitivity; the
`upstream-contract-regression` file passes now that the worktree has its reference checkout.

### 2026-11-05 — Diff review round 6 (7.5/10) folded: two merge-blocking items

Round 6 reviewed the diff (not the plan) and cleared the mechanisms: `silent-event-loss` is green because
the pooled cadence re-reads it (alternative triggers were eliminated one by one), all four triggers are
wired in the production assembly, the publisher enumeration is complete, the coordinator has no lost
waiter or premature resolve, and the timer lifecycle is correct. Two items blocked merge:

- **BLK-1 — the one-shot freshness claim was false on the skip branch.** The guard's comment said a
  skipped registration was "safe by construction, because the publisher that moved it already wrote the
  newer value", which only holds for publishers that write the disk before publishing; an event/poll
  refresh can commit a read that _started_ earlier. Fix: `settleRegisteredReadsUnder` now takes a
  `conflictMode`. Trigger-driven passes keep `'skip'`. `settlePaths` uses `'force-commit'`: bounded
  attempts (three), and if conflicts persist, one final read is committed unconditionally — that read
  started after every observed conflict, so it is the freshest value attainable without a lock. Tests
  construct both the single-conflict and the second-conflict-in-the-re-read-window cases through the
  commit gate and assert the exact read counts (3 attempts; 4 reads when the budget is spent).
- **BLK-2 — the CP5 contract assertion was never delivered.** `tool-init-state.test.ts` still relied on
  the root-before-spy ordering coincidence. The spy now precedes `acquireRoot`, the assertion requires
  exactly one cadence delay (1234 in the test) with every other delay being the liveness 3000, and
  `missingPathPolls` counts only delays that are neither. Mutation: adding a single per-path poll through
  the production `ensureMissingPathPoll` path reddens it (`expected 1 to be +0`); reverting restores green.

Also folded from the review: the coordinator no longer treats "no runner" as an error — `reactive-fs`
registers the runner at module scope, so an absent runner means that module was never loaded and there are
no registrations to settle; every root-observing test that does not read through `reactive-fs` was logging
a spurious per-pass failure. And CP2/CP3's "shared by every producer" wording was corrected to the ruling:
the coordinator governs trigger-driven passes while `settlePaths` is independent and may overlap it.

Recorded as follow-ups (not this change): an explicit `unref` assertion, protection around
`emitWatcherRuntimeStatus` listeners, cadence read failures not committing a null, a measured cost figure,
reclaim policy for one-shot registrations, and trimming the test-only exports from the public surface.
