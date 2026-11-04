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
- Assumption stated: if a currently-missing path segment later appears **as a symlink**, the normalized
  field goes stale and that read is silently uncovered by the net. Today that read is equally unreachable
  for events (`findWatcherRoot` fails the same way), so the net is not a regression; it is recorded as a
  boundary, not hidden. `resolveRealPathThroughExistingAncestor`'s no-ancestor fallback returns the
  unresolved absolute path, which is likewise recorded.

The loss net does not own the write path, and the write path does not own the net.

### S1 — Settlement after every (re)arm

Triggers, named:

1. `acquireWatcherRoot` when the record is new (0→1): settle after `record.ready` resolves.
2. `acquireWatcherRoot` when the record already exists and is initialized (refcount ≥ 1): settle too —
   this is the only observable "a consumer attached to an already-armed root" signal, and it is what S2
   leans on.
3. Reinitialize completion: `ProjectWatcher` gains an explicit reinitialized callback invoked on a
   successful (re)init; the pool uses it to settle every logical root bound to that physical watcher. The
   status emit is **not** the hook — it also emits `initialized=false` mid-flight.

Arm settlement is fire-and-forget: `acquireWatcherRoot` does not await it.

Concurrency: **single-flight with a trailing obligation**. Concurrent requests that arrive _before the
pass starts reading_ join it. A request that arrives while the pass is reading (or after it) marks the
root dirty and is served by one trailing pass; a waiter may await that pass. Cost ceiling: a burst costs
at most two passes. Round 3's B2: the previous wording allowed "join and discard", which would leave a
consumer holding a value read before its request.

### S2 — Settlement when a long-lived consumer attaches

Covered by S1.2 for attachments that go through a root acquisition; attachments that do not (a memoized
second subscriber inside the process) are covered by the cadence net. Stated because the alternative —
inventing an attach hook in every consumer — is how the "each consumer patches itself" pattern starts.

### S3 — Pooled periodic settlement (the net)

One process-level interval, `unref()`'d, jittered, **inactive when no lease exists** (no lease → no
timer), stopped at 1→0 and by `closeAllWatchers()`. Each pass settles the covered reads under leased
roots and never overlaps its predecessor. Default cadence 45 s, read from
`OPENSPECUI_SETTLEMENT_INTERVAL_MS` when the interval starts or is scheduled — never at module load.

Ordering against our own writes (round 3, B5): `reactive-fs` has no serialization primitive today, and
"the projection will just see the newer value" is false for a pass whose _read_ predates a write and
whose _commit_ lands after the writer settled. This change adds an **epoch guard**: a pass records an
epoch before reading and verifies it before committing; a stale commit is re-read once, then skipped. The
write-settlement entry points bump the epoch. S5.8 drives this with a gated `prepareRefresh` rather than a
sleep.

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
   window, and the write happens after the arm settle has completed — so a watermark-style implementation
   fails and a cadence accident cannot mask it.
6. **Single-flight trailing**: with a gated `prepareRefresh` holding a pass inside its read phase, a
   request arriving there converges on a trailing pass; a join-and-discard implementation times out.
7. **Pooled lifecycle and cost**: with N ≥ 2 leases: exactly one pooled settlement timer (asserted through
   an exported diagnostic count, not by counting every `setInterval`, since the per-watcher liveness
   interval exists by design) and zero per-path polls; a pass over a root with no registered reads does
   zero `readdir`/`readFile`/`stat`; `closeAllWatchers()` stops the timer.
8. **One-shot and ordering**: a retained projection survives a one-shot read of the same root and still
   converges; a pass racing our own write does not publish the pre-write value (gated interleaving).

## Bounds stated, not implied

Convergence bound = cadence + jitter + pass duration, for **covered reads**; consumer recompute/emit
latency after a settle is not included. No fast bound exists — the net is the cadence; arm/start
settlements only shorten the first exposure. Reads with no lease, and reads whose normalized path went
stale through a later symlink, are outside the guarantee and listed as such.

## Laws reconciled (not left to the implementer)

`AGENTS.md` currently states three things this change touches, and CP6 names them explicitly:

- "Explicit one-shot reads must retire the parent cache too" → becomes "settle their inputs before
  reading" (retirement was the mechanism, freshness was the point).
- "Periodic polling must not be the normal discovery or freshness mechanism… only as a bounded, explicit
  degraded fallback" → the net is exactly a bounded, explicit loss fallback, and the decision line says
  why it cannot be gated on watcher health: silent loss is _invisible_ in the health signal.
- "must remain inert while observation is healthy" → refined to "no discovery or freshness work is added
  while events flow; the settlement net runs on its cadence regardless of health, because health cannot
  see silent loss".

The narrowed fanout sentence recorded: one pooled settlement interval per process; per-missing-path polls
and per-watcher liveness probes unchanged.

## Slices

1. S0 normalized field + matcher, with S5.3.
2. S1/S2 triggers + single-flight with trailing, with S5.4/S5.5/S5.6.
3. S3 pooled pass + epoch guard, with S5.7/S5.8.
4. S4 `settlePaths` + one-shot switch, with S5.3(c) and the orphan test.
5. Docs (AGENTS laws), changeset, review round 4, PR, archive, release.

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
