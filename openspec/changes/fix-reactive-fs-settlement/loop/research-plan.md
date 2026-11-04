<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Fold review round 2 (7/10): define the matching space, replace the delete-the-registry teardown,
   make arm identity explicit, and narrow every claim that outran the evidence.
2. Keep the mechanism minimal: settle by re-reading from disk; the library's loss-query is not used.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
Owner decision (2026-11-04): "你自己决策吧，我觉得你掌握的信息应该比我多"
-->

# Research plan — settle silent watcher event loss

## Mechanism

A lost event is not fatal by construction: every cached directory read re-lists the whole directory,
so any later event in the subtree repairs the loss. The defect is the **stall** — a change lands, no
event arrives, nothing else in that subtree moves, and the projection shows stale truth indefinitely.
`tool-init-state`'s discovery is directory-listing membership only (`existingPaths`), so it is exactly
this shape.

The recovery primitive is a **direct disk re-read**: `refresh()` reads through Node's own `fs` calls,
never through the library's in-memory tree. Re-arming restores future event flow; on macOS it does not
re-scan the tree at all (a new FSEvents stream starts from _now_). The probe
(`/tmp/watcher-probe/probe.mjs`, one macOS/FSEvents sequence, kept as evidence): a diff taken while the
watcher was dead returned `[]`, and the same diff after re-subscribing reported the change. The precise
cause is not established — the snapshot may simply have been written after the loss, and macOS replay
throws rather than returning `[]` when it fails (`binding.cc:114-120`) — so this is recorded as **one
observed sequence, not a general law**. The design does not depend on it: a re-read is ground truth
regardless of what any query returns.

## What was tried and rejected (with reasons)

| Candidate                                                              | Rejected because                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-directory fallback polling (first attempt, never shipped)          | Violates the fanout contract; observes the paths we choose rather than the reads projections depend on                                                                                      |
| Bind-time resync inside the watcher pool as the whole fix              | Changes the pool's callback contract, and does not help a steady-state stall                                                                                                                |
| `writeSnapshot` / `getEventsSince` diff tier + coarse re-arm (plan v1) | Blind in the two cases that matter (macOS replay while dead; Linux kernel drop never enters the tree), plus baseline lifecycle, ignore alignment, escalation storms, upstream query defects |
| Child-process query                                                    | A process per pass for a few hundred cached reads                                                                                                                                           |
| Swap to chokidar polling / add Watchman                                | Distribution change; Watchman is absent on CI and on this machine                                                                                                                           |

## Design

### S0 — One matching space, chosen at registration

Roots are tracked by real path (`path-realpath.ts`, `getRealPath`), while cache keys are built from
`resolve()`. On macOS `TMPDIR` lives under `/var`, a symlink to `/private/var`, so a matcher written
against the wrong space silently matches **zero** reads — the exact shape that passes on a Linux CI
runner and fails on a developer machine. Round 2 reproduced that divergence locally.

Rule: every cache registration records its normalized path **once, at registration**, using
`resolveRealPathThroughExistingAncestor` (the helper the watcher pool already uses). Matching is then a
pure string `containsPath(root, entry)` — ancestor direction only, never `pathsOverlap` — and performs
no filesystem call per pass. S1/S2/S3 share this one matcher.

### S1 — Settlement after every (re)arm

Arm identity is `(physical watcher generation, logical root)` **plus** the logical root's
referenceCount 0→1 transition — a second logical root acquiring an already-initialized physical watcher
produces no generation change and must still settle. Hook points are named in `watcher-pool`:
`acquireWatcherRoot` (refcount 0→1, after `record.ready`) and the reinitialize-completion path (which
settles every logical root bound to that physical watcher). `subscribeRuntimeStatus` emits are _not_ the
hook: a reinitialize emits `initialized=false` mid-flight. Arm settlement is fire-and-forget and is not
awaited by `acquireWatcherRoot`.

Concurrency is handled by **single-flight per root**, not by an at-most-once-per-generation watermark:
concurrent triggers coalesce into one pass, but a later request at the same generation is allowed to run
(it re-reads; equality keeps it free of emissions). Round 2 caught that the watermark version silently
disabled S2 — the very case it existed for.

### S2 — Settlement when a retained observation starts

A long-lived consumer attaching to an already-armed root gets no arm event, so it settles its own
observation roots once at start. This is the server-boot case, and it stays correct under single-flight
because it is not gated on generation.

### S3 — Pooled periodic settlement (the net)

One process-level interval, `unref()`'d, jittered, active while at least one observation root lease
exists and skipped entirely otherwise. Each pass walks the registered reads under leased roots, re-reads
them (`prepareRefresh` + commit), and never overlaps its predecessor. Default cadence 45 s, read from
`OPENSPECUI_SETTLEMENT_INTERVAL_MS` **when the interval is started or scheduled**, never at module load.
`closeAllWatchers()` must stop it — that path clears the registry without going through release.

Ordering against our own writes: a pass's commit joins the same serialization as
`settleReactivePathMutation`, so a pass whose read predates a write cannot publish the older value after
the writer settled.

### S4 — One-shot freshness without tearing down the registry

`getToolInitStates` (one-shot) currently calls `invalidateToolInitCaches` → `clearCache(root)`, which
deletes cache entries with a **substring** match (`key.includes(path)`) and — because
`AgentDeliveryProjectionService` exposes the one-shot and retained paths in the same process — can strip
a live retained projection of its refreshers, leaving it permanently frozen and invisible to any
settlement (round 2's reachable counterexample to a process-wide promise).

This change replaces that teardown with settle-then-read: the one-shot path settles the roots it is
about to read and then reads, which is equally fresh, keeps every registration intact, and removes the
substring hazard because nothing deletes by prefix any more.

### S5 — Proof

1. **The stall, already red** (`packages/core/src/reactive-fs/silent-event-loss.test.ts`, committed):
   real root, stubbed `subscribe`, second file written, expect convergence. Fails today with
   "the directory listing was never re-read".
2. **Convergence after the net**: the same fixture, one driven settlement pass → emits with the file.
   Must be run on macOS **and** the Linux gate; the macOS run is what catches path-space mistakes.
3. **Path space**: a read registered under a symlinked prefix (macOS `TMPDIR` is exactly this) is
   matched by a lease acquired on the same directory — asserted directly, so a `resolve()`/realpath
   mismatch fails as itself rather than as a mysterious timeout.
4. **Arm identity**: a second logical root sharing an initialized physical watcher still settles; a
   reinitialize settles every logical root of that watcher; concurrent triggers coalesce (single-flight).
5. **Consumer start at an unchanged generation** converges without waiting for the cadence.
6. **Pooled lifecycle and cost**: spy installed _before_ the first lease → exactly one pooled interval
   and zero per-path polls; a pass over a root with no registered reads does zero
   `readdir`/`readFile`/`stat`; `closeAllWatchers()` stops the interval (its own assertion); disposal
   cannot hold the process open.
7. **One-shot does not orphan a retained projection**: retained subscription live → one-shot read of the
   same root → retained projection still converges on the next pass.
8. **Ordering**: a pass racing one of our own writes does not publish the pre-write value.

## Bounds stated, not implied

Convergence bound = cadence + jitter + pass duration, for reads that are **registered and under a leased
root**. Reads with no lease (a consumer that never leased, e.g. a bare cached read in a process with no
observation environment) are outside the guarantee and are listed as such. There is no fast bound: the
net is the cadence; arm/start settlements only shorten the first exposure.

## Fanout contract (narrowed to what is true)

One pooled settlement interval per process — never per read, directory, or root. The pre-existing
per-missing-path polls and per-watcher liveness probes are unaffected and stay as they are; the law is
written to say exactly that, because the broad phrasing would have put a false sentence into `AGENTS.md`.

## Slices

1. S0 matcher + normalization, with the path-space test.
2. S1 + S2 arm/start settlement with arm-identity and single-flight tests.
3. S3 pooled pass with lifecycle, cost, `closeAllWatchers`, and ordering tests.
4. S4 one-shot teardown replacement with the orphan test.
5. Docs, changeset, review round 3, PR, archive, release.

## Risks

- **Cost**: proportional to registered reads under leased roots × cadence; measured and recorded, and a
  pass does no work when nothing is registered.
- **A pass publishing a stale read**: serialized against our own writes (S3) and covered by S5.8.
- **Long-lived test files** (`reactive-fs.test.ts` leases in `beforeAll`): a real pass may fire mid-file
  once cadence elapses; verify the full core suite after implementation for ordering sensitivity.
- **Platform truth**: Linux/Windows behaviour is CI-verified; the local container runtime is unavailable
  (podman VM fails; owner's Docker/remote contexts untouched).

## Review record

- Round 1 (2026-11-04): **6/10**, six blockers. Disposition: the diff tier was removed rather than
  repaired (N11), which deleted B1/B2/B4 at the root; B3/B5/B6 folded with the design change.
- Round 2 (2026-11-04): **7/10** (+1). Five blockers, all folded in this revision — path space defined
  (R2-B2, reproduced locally), watermark replaced by single-flight (R2-B1), fanout contract narrowed to
  the truth (R2-B3), arm identity made explicit including the refcount transition (R2-B4), and the
  one-shot teardown replaced so a retained projection cannot be orphaned (R2-B5). Overclaims O1–O5
  corrected: the guarantee is scoped to registered reads under leases with a cadence-shaped bound, and
  the probe is recorded as one observed sequence rather than a general law about the library.
