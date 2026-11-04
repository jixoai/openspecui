<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Turn the two investigations, the executed probe, and review round 1 into an implementable plan.
2. Converge on the smallest mechanism that is ground truth: settle by re-reading, not by trusting the
   library's loss-query (which the probe proved is blind exactly when the watcher is dead).
3. State the fanout law's fate explicitly instead of relying on a test-ordering coincidence.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
Owner decision (2026-11-04): "你自己决策吧，我觉得你掌握的信息应该比我多"
-->

# Research plan — settle silent watcher event loss

## Mechanism (what actually fails, and how it recovers)

A lost event is not permanently fatal by construction: every cached directory read re-lists the whole
directory, so _any_ later event in the same subtree silently repairs the earlier loss. The defect is
the **stall**: a change lands, no event arrives, and nothing else in that subtree moves — the
projection then shows stale truth indefinitely. `tool-init-state`'s discovery is directory-listing
membership only (`existingPaths`), so it is exactly this shape.

The recovery primitive is a **direct disk re-read**: our `refresh()` reads through Node's own `fs`
calls and never through the library's in-memory tree, so a re-read is ground truth. Re-arming the
subscription restores _future_ event flow; it is not what makes a re-read correct, and on macOS it
does not re-scan the tree at all (a new FSEvents stream starts from now). What the probe proved is
narrower and was previously overstated: the library's `getEventsSince` is **blind while the watcher is
dead** (`[]`), and only becomes useful again after a re-subscribe — i.e. it is a cross-process cache
invalidation tool, not an in-process loss detector.

## What was tried and rejected (with reasons, so they are not re-litigated)

| Candidate                                                                          | Rejected because                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-directory fallback polling (first attempt, never shipped)                      | Violates the fanout law; observes only the paths we choose rather than the reads projections actually depend on                                                                                                                           |
| Bind-time resync inside the watcher pool as the whole fix                          | Changes the pool's callback contract (two pool tests encode "acquire does not notify") and does not help a steady-state stall                                                                                                             |
| `writeSnapshot` / `getEventsSince` diff tier + coarse re-arm (this plan's round 1) | Review round 1: blind in the two cases that matter (macOS dead-watcher replay; Linux kernel drop never enters the tree), and it drags in baseline lifecycle, ignore alignment, escalation storms and upstream query defects (B1/B2/B4/O4) |
| Child-process query (report suggestion)                                            | Spawns a process per pass; strictly worse than re-reading a few hundred cached values                                                                                                                                                     |
| Swap to chokidar polling, add Watchman                                             | Out of scope: distribution change, Watchman absent on CI and on this machine                                                                                                                                                              |

## Design

### S1 — Probe record (done, macOS; kept as evidence)

`/tmp/watcher-probe/probe.mjs`: create-while-subscribed is delivered and diffed; create-while-dead is
invisible to `getEventsSince` (`[]`); the same diff after re-subscribing reports it. Linux/Windows
counterparts are covered by the CI tests in `S5`, since the local container runtime is unavailable
(podman VM fails to start; the owner's Docker and remote contexts were left untouched).

### S2 — Settlement after every (re)arm

`settleRootReads(rootPath)` runs `prepareRefresh` + commit for every cached read whose path is under
that root (the existing `refreshCache` is the registry). Invoked when a root's subscription is
established or re-established. `ReactiveState`'s equality guard means a settled root emits nothing.
Watermark rule: a root records the generation of its last settled arm and skips a settle it has
already satisfied, so a subscription-start settle and an arm settle cannot double-work.

### S3 — Settlement when a retained observation starts

A long-lived consumer that attaches to an already-armed root gets no arm event, so it settles its own
observation roots once at start (same helper, same watermark). This is the case a server-boot root
leaves open, and it is why S3 cannot be dropped in favour of S2.

### S4 — Pooled periodic settlement (the net for silent loss)

One process-level interval, `unref()`'d, jittered, active while at least one retained root lease
exists and skipped entirely otherwise. Each pass walks the cached reads under the leased roots,
re-reads them from disk (`prepareRefresh` + commit), and is serialized against itself (a pass never
overlaps its predecessor). Default cadence 45 s, overridable for tests.

This is the ground-truth tier: it converges _every_ loss class, including the silent ones the library
cannot see, and it is what makes the change's promise true on Linux rather than aspirationally true on
macOS. Cost is bounded by the cached-read inventory under leased roots — the same inventory the
one-shot path already reads — and a pass with no cached reads performs no filesystem access.

**Fanout law (stated, not dodged).** `tool-init-state.test.ts` asserts zero `setInterval` during a
one-shot projection. That assertion currently holds because the test's root lease is acquired before
the spy is installed (review N9) — a coincidence, not a contract. The amended contract this change
delivers and documents: **one pooled interval per process, never per path, directory, or root**; the
one-shot projection path creates none because it holds no retained lease at all. The test is updated
to assert the contract directly (per-path poll counters stay zero; at most one pooled interval exists
while a lease is held) instead of relying on ordering.

### S5 — Proof

1. **The stall, characterized first (runs today).** Retained projection → `closeAllWatchers()` → create
   a file → wait past the missing-path poll and debounces → assert **no second emission**. This is a
   real red today: it documents the defect rather than a missing symbol.
2. **Convergence after the net.** Same setup, then drive one settlement pass → the projection emits
   with the file present.
3. **Settle after (re)arm.** Seed a deterministically stale cached read (read → close watchers →
   mutate → attach), force the existing error-path reinitialize, and assert the read surfaces disk
   truth with no new event, at most once per arm (watermark test).
4. **Pooled lifecycle and cost.** With N roots and M cached reads, exactly one interval exists; a
   disposal test proves it stops with the last lease and cannot hold the process open (`unref`);
   a pass over a root with no cached reads performs zero `readdir`/`readFile`/`stat` (spy);
   concurrent pass triggers never overlap.
5. **Linux/Windows.** `S5.1`/`S5.2` run on the Linux gate; `S5.3` is platform-independent. Whether the
   Windows gate executes them is stated explicitly in the checkpoints (it runs `test:ci` behind
   `windows_required`).

## Slices

1. S1 recorded; no code.
2. S2 + S3 with their red tests and the watermark rule.
3. S4 with the stall/convergence pair, the pooled-lifecycle and cost tests, and the fanout-contract
   test update.
4. Docs (this change, AGENTS decision line) + changeset (`@openspecui/core`, `@openspecui/server`).
5. Gates, review round 2, PR, archive, release per the repository workflow.

## Risks

- **Cost being invisible until it is not**: a pass re-reads cached inventory; measured by the cost
  guard and stated as a number (cached reads × cadence) in the delivery record.
- **A settle pass racing a projection rebuild**: passes are serialized and share `ReactiveState`, so a
  concurrent projection simply sees the newer value.
- **Interval lifecycle leaks**: owned by the lease registry, `unref()`'d, asserted by a disposal test.
- **Timing-shaped tests**: the convergence test drives a pass explicitly rather than sleeping; no test
  waits on the 45 s cadence.

## Review record

- Round 1 (independent research subagent, 2026-11-04): **6/10**. Six blockers — baseline lifecycle
  unclosed (escalation storm), snapshot/query ignore not aligned, "retained lease" undefined while the
  spec promised process-wide settlement, re-arm had no entry point/serialization/awaitable signal,
  S2/S3 + CP2 self-contradiction, and the red test being a compile failure rather than behavior.
  Disposition: all six are folded here, and the round's sharpest observation (N11) was accepted — the
  diff tier was removed rather than repaired, which also removes B1/B2/B4 at the root.
  Three overclaims (O1 CI-class equivalence, O2 "only demonstrated recovery", O4 single convergence
  bound) are corrected in this revision and in `intake.md`.
