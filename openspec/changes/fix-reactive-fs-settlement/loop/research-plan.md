<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Fold review round 3 (6.5/10): B1-B8 are all textual, and the design does not change.
2. Name every trigger point, primitive, and bound so an implementer cannot pick a different one.
3. Keep the repository's laws reconciled rather than contradicted.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
Owner decision (2026-11-04): "你自己决策吧，我觉得你掌握的信息应该比我多"
-->

# Research plan — settle silent watcher event loss

## Mechanism

A lost event is not fatal by construction: every cached directory read re-lists the whole directory, so
any later event in the subtree repairs the loss. The defect is the **stall** — a change lands, no event
arrives, nothing else in that subtree moves, and the projection shows stale truth indefinitely.
`tool-init-state`'s discovery is directory-listing membership only, so it is exactly this shape.

The recovery primitive is a **direct disk re-read**: `refresh()` reads through Node's own `fs` calls,
never through the library's in-memory tree. The probe (`/tmp/watcher-probe/probe.mjs`) is recorded as
**one observed macOS sequence**: a diff taken while the watcher was dead returned `[]`, and the same diff
after re-subscribing reported the change. It is not a general law — the baseline may simply have been
written after the loss, and nothing in the evidence distinguishes "a new stream starts from now" from
"the tree was re-scanned", so **no platform claim is made from it**. The design does not depend on any of
this: a re-read is ground truth regardless of what a query returns.

## What was tried and rejected (with reasons)

| Candidate                                                              | Rejected because                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Per-directory fallback polling (first attempt, never shipped)          | Violates the fanout contract; observes the paths we choose rather than the reads projections depend on        |
| Bind-time resync inside the watcher pool as the whole fix              | Changes the pool's callback contract, and does not help a steady-state stall                                  |
| `writeSnapshot` / `getEventsSince` diff tier + coarse re-arm (plan v1) | Blind where it mattered, plus baseline lifecycle, ignore alignment, escalation storms, upstream query defects |
| Child-process query                                                    | A process per pass for a few hundred cached reads                                                             |
| Swap to chokidar polling / add Watchman                                | Distribution change; Watchman is absent on CI and on this machine                                             |

## Design

### Terms (fixed here so no implementer picks differently)

- **Root lease** — `watcher-pool`'s `watcherRoots` record reference count > 0. A lease starts at 0→1 and
  ends at 1→0; `closeAllWatchers()` also ends all of them by clearing the registry without release.
- **Registered read** — a `refreshCache` entry (`kind` ∈ `file | directory | exists | stat`), i.e. a read
  some projection performed through `reactive-fs` and can re-run.
- **Settlement pass** — re-running `prepareRefresh` + commit for a set of registered reads. A pass never
  reads through the library's tree.
- **Covered read** — a registered read whose normalized path lies under a leased root's normalized path.

### S0 — One matching space for the settlement net (and only for it)

Roots are realpath-tracked; registration keys are `resolve()`-built. On macOS `TMPDIR` sits under
`/var → /private/var`, so a matcher in the wrong space covers **zero** reads on a developer machine while
passing on a Linux runner (round 2 reproduced it).

Rule: each registration records, once, a **separate** normalized field
(`resolveRealPathThroughExistingAncestor`, the helper the pool already uses). The settlement matcher is a
pure ancestor string test (`containsPath(leaseRoot, entryNormalized)`) with no filesystem call per pass.
This is deliberately narrow:

- `registration.path` is **not** moved into the normalized space. Write settlement
  (`settleReactivePathMutation*`) keeps matching `resolve()` against `registration.path` with its
  existing **bidirectional** `pathsOverlap` semantics — a directory deletion must still reach reads under
  it — so this change introduces no second-space bug on the write path (round 3, B1).
- Boundary, stated in its general form: the normalized field is resolved **once**; any later change to
  the symlink structure of its prefix — a missing segment appearing as a symlink, an existing segment
  being replaced by one, a dangling link being repointed — leaves it stale, and that read is then
  uncovered by the net. Today such a read is equally unreachable for events (the pool binds a stale
  string path and the library reports paths under the real one, so nothing matches), so the net is not a
  regression; it is recorded as a boundary, not hidden.
  `resolveRealPathThroughExistingAncestor`'s no-ancestor fallback returns the unresolved absolute path,
  which is likewise recorded.

The loss net does not own the write path, and the write path does not own the net.

### S1 — Settlement after every (re)arm, and at the points a consumer actually attaches

Triggers, named — and chosen against the real assembly, not against the pool's API surface. Round 4
showed the pool-level "acquiring an already-initialized record" signal is **unreachable in production**:
`ReactiveObservationEnvironment` is the only production caller of `acquireWatcherRoot`, and it calls the
pool once per normalized root and memoizes the rest, so the boot-armed launch root followed by a later
retained subscription produces no pool call at all. A named-but-dead trigger is worse than an unnamed
one, so it is removed rather than documented:

1. **New record (0→1)**: settle after `record.ready` resolves.
2. **A root's record already exists in the environment**
   (`ReactiveObservationEnvironment.acquireRoot` on its memoized branch): settle that root. This is the
   real "first attach after boot" path.
3. **Reinitialize completion**: `ProjectWatcher` gains an explicit reinitialized callback (not the status
   emit, which also emits `initialized=false` mid-flight); the pool settles every logical root bound to
   that physical watcher.
4. **The one named consumer hook**: `AgentDeliveryProjectionService.subscribe` settles its own observation
   roots once, awaited, before its first read. This is declared as the single exception to "consumers do
   not patch themselves" — later subscriptions inside the process are memoized past both the pool and the
   environment, so no generic signal exists, and inventing one per consumer is the pattern this change
   exists to end.

Arm/attach settlement is fire-and-forget except for (4), which its consumer awaits.

Concurrency: **one coordinator per process governs the trigger-driven passes** (arm, attach, pooled).
Invariants, written so a join-and-discard implementation cannot pass:

- at most one pass is in flight per root;
- a request arriving **before the pass begins reading** joins it and is satisfied by it;
- a request arriving **after the read phase has begun** marks the root dirty and is served by a trailing
  pass; a request arriving during _that_ pass's read phase derives one more pass, and so on;
- `settlePaths` is deliberately **outside** this coordinator: it reads directly, because joining an
  in-flight pass could satisfy a one-shot call with a read that predates it. The duplicate concurrent
  read is bounded, and the per-registration version guard keeps either pass from publishing older data.

Cost wording corrected accordingly: a burst confined to one read phase costs at most two passes; requests
separated by read phases each cost one. There is no unbounded derivative chain, because each request
derives at most one pass and passes are serialized.

### S3 — Pooled periodic settlement (the net)

One process-level interval, `unref()`'d, jittered, **inactive when no lease exists** (no lease → no
timer), stopped at 1→0 and by `closeAllWatchers()`. Each pass settles the covered reads under leased
roots and never overlaps its predecessor. Default cadence 45 s, read from
`OPENSPECUI_SETTLEMENT_INTERVAL_MS` when the interval starts or is scheduled — never at module load.

Ordering, pass-side against every publisher (round 3 B5, round 4 BLK-3, round 5 residual):
`reactive-fs` has no serialization primitive, and a pass whose _read_ predates a publication and whose
_commit_ lands after it would publish the older value. "Publishers" is enumerated, not implied — a single
"write-settlement entry points bump it" rule would miss three of the four:

1. `settleReactivePathMutationInternal` (the write-settlement core);
2. `updateReactiveFileCache` (direct cache publication, used by `config.ts`, `global-settings.ts`,
   `planning-config-service.ts`);
3. event-driven and missing-path-poll `refresh` commits;
4. other passes' commits.

Guard: **a per-registration commit version**, bumped by every commit path above. A pass records each
registration's version before reading it and, before committing that registration, re-checks the version
in the same synchronous block: unchanged → commit; changed → re-read once and re-check; still changed →
skip that registration. Per-registration (not one global flag) so an unrelated write cannot drag unrelated
reads to the next cadence, and skipping is safe because the publisher already wrote the newer value.

Residual, stated: the guard is **pass-side only**. A publisher's own read→commit window can still be
interleaved by a newer pass commit and briefly publish the older value; it self-heals on the next pass and
is not part of the claim.

### S3b — Once-only attachment and the event-driven consumers

Two existences are outside the net by construction, and the spec says so instead of implying otherwise:

- a subscription memoized past the pool, the environment, **and** the owning service converges through
  the cadence, not immediately (the service memoizes its physical observation, so a second subscriber
  produces no trigger at all);
- a consumer whose private state is written **only** by native watcher callbacks (`tool-config`'s
  `tools:` state is the named instance) is not repaired by re-reading its underlying registered reads —
  the pass refreshes those reads, but nothing re-runs that consumer's own event handler. Its one
  consumer is currently unwired, so this is a documented boundary rather than a live defect; wiring it
  later must not assume the net covers it.

### S4 — One-shot freshness without tearing down the registry

`getToolInitStates` currently calls `invalidateToolInitCaches` → `clearCache(root)`, whose substring
deletion can strip a live retained projection of its refreshers in the same process (reachable: one-shot
and retained coexist in `AgentDeliveryProjectionService`).

Replacement, with the properties round 3 demanded (B3):

- a new primitive `settlePaths(paths)` — pure `prepareRefresh` + commit over the registrations under the
  given roots, **independent of the pool and of leases** (the server's first one-shot can run before any
  lease exists), **awaited** before the one-shot reads, and using the S0 normalized matcher on both sides;
- it does **not** discard registrations, so nothing is orphaned;
- equivalence red test: the existing `tool-init-state.test.ts` fixture that reads twice (no lease) must
  stay green, and its second read must observe an externally written change.

Residual declared, not hidden (B7): three production call sites use the no-argument `clearCache()` —
`local-model-fetch-cache-store.ts`, `local-model-asset-store.ts`, `local-model-profile-manifest-store.ts`
— whose process-wide deletion is the same orphan channel for an unrelated subsystem. They are **out of
scope** for this change (their replacement semantics belong with the model caches) and are listed as a
follow-up; this change neither widens nor fixes them.

Registration lifecycle, stated (round 3, Q1.2): registrations are append-only for the process lifetime
unless released by the existing error paths; `clearCache` remains the only bulk release and is no longer
on the agent one-shot path.

### S5 — Proof

1. **The stall, already red** (`silent-event-loss.test.ts`): real root, stubbed `subscribe`, second file
   written, expect convergence. Fails today with "the directory listing was never re-read".
2. **Convergence after the net**: the same fixture, one driven pass → emits. Run on macOS **and** the
   Linux gate.
3. **Path space**: (a) a read registered under a symlinked prefix is covered by a lease on the same
   directory; (b) **mutation**: `realpathSync` call count during a pass is 0 (kills the
   "recompute-per-pass" fake); (c) the one-shot equivalence test above.
4. **Arm identity**: a second logical root on an initialized physical watcher settles; a reinitialize
   settles every logical root of that watcher.
5. **Consumer start at an unchanged generation** converges with the cadence set far above the assertion
   window and the write made after the arm settle completed (watermark implementations fail here). The
   assertion boundary is the **assembly**: the environment's memoized-acquire branch and the named
   service hook — a pool-level test would pass while production never triggers, which is exactly how
   round 4 found the previous trigger to be dead code.
6. **Single-flight trailing**: with a gated `prepareRefresh` holding a pass inside its read phase, a
   request arriving there converges on a trailing pass; a join-and-discard implementation times out;
   a request arriving during the **trailing** pass's read phase derives one more pass (both halves
   asserted, so neither "clear dirty and stop" nor an unbounded `while (dirty)` loop can pass).
7. **Pooled lifecycle and cost**: with **N ≥ 2 distinct physical watchers** (assert
   `getWatcherRuntimeStatus().roots.length === 2` first, since two logical roots can share one physical
   watcher and a per-physical-watcher fake would still read 1): exactly one active settlement timer via
   the exported diagnostic; the `setInterval` delay multiset after the spy matches
   `N × PATH_LIVENESS_INTERVAL_MS + 1 × cadence`; a pass over a root with no registered reads does zero
   `readdir`/`readFile`/`stat`; `closeAllWatchers()` stops the timer. The mutation check targets the
   net's own creation path, not the accessor.
8. **One-shot and ordering**: a retained projection survives a one-shot read of the same root and still
   converges; a pass racing a publisher does not publish the pre-write value — with the interleaving
   driven through a gated `prepareRefresh` **and** one publisher from list item 2
   (`updateReactiveFileCache`), not only the write-settlement core.

## Bounds stated, not implied

Convergence bound = cadence + jitter + pass duration, for **covered reads**; consumer recompute/emit
latency after a settle is not included. No fast bound exists — the net is the cadence; arm/attach
settlements only shorten the first exposure, and a subscription that is memoized past both the pool and
the environment may see a first frame up to one cadence stale. Reads with no lease, and reads whose
normalized field went stale, are outside the guarantee and listed as such.

## Laws reconciled (not left to the implementer)

`AGENTS.md` states things this change touches, and CP6 names them explicitly — including the
reactive-observation ownership law whose memoization is precisely why the pool cannot see a later attach:

- "Explicit one-shot reads must retire the parent cache too" → becomes "settle their inputs before
  reading" (retirement was the mechanism, freshness was the point), and its neighbouring sentence about
  keeping empty-installation polls at zero is updated to the narrowed fanout contract.
- "Periodic polling must not be the normal discovery or freshness mechanism… only as a bounded, explicit
  degraded fallback" → the net adds exactly one thing: one pooled re-read pass per cadence. It adds no
  per-path polls and no health-gated work, and it is deliberately **not** gated on health because silent
  loss is invisible in the health signal.
- "must remain inert while observation is healthy" → rewritten without self-contradiction: the net's work
  never grows with health state; it runs its fixed cadence regardless, for the reason above.
- The reactive observation ownership law (environment memoizes repeated logical acquisition) gains the
  note that attach settlement therefore lives at the environment and the one named consumer hook, not in
  the pool.

The narrowed fanout sentence recorded: one pooled settlement interval per process; per-missing-path polls
and per-watcher liveness probes unchanged.

## Slices

Pre-implementation validations (named after round 5's finding that a "planned" trigger had no real
wiring; each is 10–30 minutes and each must be reported with its evidence):

- **V1 — attach seam spike**: after the root loop in `ensurePhysicalObservation`, insert an awaited
  settle and prove by ordering that the first projection read happens after it resolves; also prove the
  second `subscribe` is memoized (the declared residual).
- **V2 — coordinator discrimination**: implement the two fakes (join-and-discard; exactly-one-trailing)
  once, show both fail the planned assertions, then show the correct implementation passes; confirm the
  third half needs **two ordered gates** and that the cadence sits above the assertion window.
- **V3 — `settlePaths(cacheRoots)` path space**: on macOS `TMPDIR`, show the un-normalized variant covers
  **0** and the normalized variant covers ≥ 1, and that CP4's equivalence red catches the un-normalized
  build.

Slices:

1. S0 normalized field + matcher (in flight), with S5.3.
2. S1 triggers (pool 0→1, environment memoized acquire, reinitialized callback, the service hook at
   `ensurePhysicalObservation`) + the per-process coordinator with trailing semantics, with S5.4/S5.5/
   S5.6 and V1/V2. The settle/coordinator module lives outside both `reactive-fs` and `watcher-pool`
   (importing reactive-fs from watcher-pool would close a cycle).
3. S3 pooled pass + per-registration version guard, with S5.7/S5.8. Trigger 1's settle must not be folded
   into `record.ready` (it would lengthen lease acquisition and risk an unhandled rejection); it is
   fire-and-forget with a rejection guard, which is also what spec scenario 1 asserts.
4. S4 `settlePaths` + one-shot switch (normalizing each root on the caller side, since S0's primitive
   takes normalized input), with S5.3(c), V3 and the orphan test.
5. Docs (the four touched `AGENTS.md` laws, preserving the Store-fallback half of the "inert" sentence),
   changeset, review round 6, PR, archive, release.

## Risks

- **Cost**: covered reads × cadence, measured and recorded; zero when nothing is registered.
- **Epoch guard adds a re-read path**: bounded to one retry, asserted.
- **Long-lived test files** may see a real pass mid-file; verify the full core suite after implementation
  for ordering sensitivity.
- **Platform truth**: Linux/Windows behaviour is CI-verified; the local container runtime is unavailable
  (podman VM fails; owner's Docker/remote contexts untouched).

## Review record

- Round 1: **6/10** — diff tier removed rather than repaired; B1/B2/B4 deleted at the root.
- Round 2: **7/10** — path space defined, watermark → single-flight, arm identity explicit, one-shot
  teardown replaced, fanout sentence narrowed.
- Round 3: **6.5/10** — verified R2-B3/R2-B4 as solid and R2-B1/R2-B5 directionally right, then showed
  the folds were textual-only in eight places: the normalized field must not move the write path (B1);
  single-flight needs a trailing obligation (B2); S4 needs an unconditional awaited primitive and a named
  equivalence test (B3); S2 needed a named trigger (B4); the write-ordering claim assumed a serialization
  that does not exist (B5); "lease" was undefined and contradicted the committed red test (B6); the orphan
  class has three more call sites, now declared out of scope (B7); and `AGENTS.md`'s three conflicting
  laws are reconciled explicitly (B8). The CP5 "exactly one timer" assertion was also unsatisfiable by
  construction and now uses an exported diagnostic with N ≥ 2 leases.
- Round 4: **7.0/10** (+0.5). Verified B1/B3/B6/B7/B8 as landed and found three blockers, all folded:
  BLK-1 the named attach trigger was **unreachable in production** (the environment memoizes repeated
  acquisition, so the pool never sees the later attach) — the dead trigger is deleted and the real paths
  are named (environment's memoized branch plus one declared consumer hook), with S5.5 moved to the
  assembly boundary; BLK-2 the trailing rule needed its third timing, so the coordinator's invariants are
  now written and both halves of the trailing case are asserted; BLK-3 the epoch guard under-enumerated
  publishers and had two readings of "re-read once" — it is now a per-registration commit version bumped
  by all four publisher classes, verified and committed in one synchronous block. Overclaims corrected:
  "cannot be orphaned" is scoped to the one-shot path, and the "inert while healthy" replacement text no
  longer contradicts itself.
- Round 5: **8.0/10** (+1.0), **"可实施 / implementable"**. The three previous blockers were verified
  closed at the code level (all four triggers reachable, trailing invariants implementable with both
  assertions able to kill the two fakes, publisher enumeration complete and coverable by one change).
  One new blocker, folded: "registered" was undefined while the spec's opening sentence promised
  convergence for _any_ lost event — a class of event-driven consumers (private event-state caches,
  invalidation-triggered CLI re-pulls) is outside the net by construction, and that is now stated with
  the named instance instead of implied. Two wording fixes folded (the convergence scenario now binds the
  _read_ to the bound and excludes consumer latency; the memoized-staleness bound is corrected to the full
  bound and extended to the service memo). Non-blocking items folded: CP2 gains the observable quantities
  a trailing test must assert (exact read-phase entries, post-await committed value, cadence above the
  window, two ordered gates); CP3's jitter and exact-delay-multiset assertions can no longer contradict
  each other and physical-watcher discrimination comes from the multiset rather than logical roots; CP5
  preserves the Store-fallback half of the "inert" sentence; and the plan now carries three named
  pre-implementation validations (attach seam, coordinator discrimination, one-shot path space).
