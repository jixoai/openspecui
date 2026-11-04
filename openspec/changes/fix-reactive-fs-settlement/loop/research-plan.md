<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Turn the two investigations and the executed probe into an implementable, falsifiable plan.
2. Keep the mature mechanism (the library's own snapshot/diff) but state honestly where it is a
   detector and where it is not ground truth.
3. Preserve the existing fanout law's letter rather than relaxing it.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

# Research plan — settle silent watcher event loss

## Mechanism (what actually fails, and how it recovers)

A lost event is not permanently fatal by construction: every cached directory read re-lists the whole
directory, so _any_ later event in the same subtree silently repairs the earlier loss. The defect is
the **stall**: a change lands, no event arrives, and nothing else in that subtree moves — the
projection then shows stale truth indefinitely. `tool-init-state`'s discovery is directory-listing
membership only (`existingPaths`), so it is exactly this shape.

Recovery primitive, proven by the probe: **re-arm the subscription (which re-crawls), then re-read**.
Our `refresh()` re-reads with Node's own `fs` calls, never the library's in-memory tree, so once the
watch is re-armed the re-read is authoritative.

## Design

### S1 — Probe record (done, macOS)

`writeSnapshot` → subscribe → mutate → `unsubscribe` → mutate → `getEventsSince` = `[]` →
re-subscribe → `getEventsSince` = `create:b.txt`. Two consequences: the query API SHALL be treated as
a **detector**, never as ground truth; and a settle-after-(re)arm step SHALL exist because it is the
only demonstrated recovery.

Linux counterpart runs in CI (`S5.3`): podman's VM is broken on the development machine
(`gvproxy` socket), and the Linux backend is the one whose query path may share the in-memory tree.
Windows shares that same in-memory-tree query implementation, so the CI result covers both.

### S2 — Settlement after every (re)arm

`watcher-pool` gains `settleRootReads(rootPath)`: run `prepareRefresh` + commit for every cached read
whose path is under that root (the existing `refreshCache` is the registry). Invoked when a physical
root's `record.ready` resolves and after `ProjectWatcher` completes a reinitialize. Cost is bounded
by the cached reads under that root; `ReactiveState`'s equality guard means a settled root emits
nothing. No timers involved.

### S3 — Fresh read when a retained projection starts

`AgentDeliveryProjectionService`'s retained path currently subscribes without a fresh read (the
one-shot path calls `clearCache` first). The retained path SHALL settle its observation roots once at
creation, so a projection that starts while the tree is already stale does not inherit the staleness.
Cost: once per subscribe.

### S4 — Pooled reconciliation with escalation (the net for silent loss)

One process-level interval in `watcher-pool`, `unref()`'d, started when the first retained-observation
lease begins and stopped when the last one ends:

- cadence: 45s default, ±10s jitter, skipped entirely when no retained lease exists or the root has no
  cached reads;
- per physical root: `writeSnapshot` establishes a baseline on first pass; later passes call
  `getEventsSince(root, snapshot)` and **inject the returned events into the existing dispatch path**
  (same `create|update|delete` shape native events use), so nothing downstream learns a new concept;
- the baseline is rewritten at most once per pass, after injection;
- **escalation**: a rejected query (macOS reports dropped FSEvents) or a batch larger than a
  configured ceiling SHALL NOT be trusted as data — it escalates to re-arm that root's subscription
  plus `S2`;
- the snapshot file lives outside the watched root (temp dir, per-root name) and is removed on root
  release.

Why the timer belongs here rather than in `reactive-fs`: one interval per process, not per root,
directory, or path, and it exists only for the lifetime of a retained subscription. That keeps the
existing fanout assertion (`tool-init-state`: zero `setInterval` during a one-shot projection) true
**as written**, instead of relaxing it.

### S5 — Proof

1. **Retained-projection recovery (the CI-shaped red test).** Retained projection → close the native
   watchers (existing idiom for "events are gone") → create the file → drive one reconciliation pass →
   the projection SHALL emit the file. Fails today: there is no net at all.
2. **Settle-after-rearm.** With a cached read holding a stale value, force `reinitialize` through the
   existing error path → the cached read SHALL surface disk truth without any new event.
3. **Linux/Windows CI.** The S5.1 test runs on the Linux gate; an escalation test stubs a rejected
   query and asserts the re-arm + settle path runs, which is platform-independent.
4. **Fanout and cost guards.** The existing zero-timer assertion stays green; a pass with no cached
   reads performs no `readdir`/`readFile` (spy assertion).

## Slices

1. S1 is recorded; no code.
2. S2 + S3 with their red tests.
3. S4 with its red test, escalation test, cost guard.
4. Docs (this change, AGENTS decision line) + changeset (`@openspecui/core`, `@openspecui/server`).
5. Full gates, review, PR, archive, release per the repository workflow.

## Risks and how they are contained

- **Upstream query defects** (parcel-bundler/watcher#51 snapshot write ordering, #52 directory-rename
  paths, #211/#118 Windows): the query is only ever a detector; a rejection or an implausible batch
  escalates instead of being applied. Snapshot write ordering is absorbed because the baseline is
  only advanced after a successful pass.
- **Cost on large trees (Linux)**: interval + ignore rules + skip-when-idle; measured in the cost
  guard test with an instrumented `readdir`.
- **Timer lifecycle leaks**: owned by the retained-lease registry, `unref()`'d, and asserted by a
  disposal test.
- **Emitting twice for one change**: `ReactiveState` equality + existing debounces; asserted.

## Falsifiers for the "no production behavior change" style claims

This change _does_ change behavior, so the falsifiers are about the _shape_ of the claim:

- If a retained projection converges without any reconciliation pass after `closeAllWatchers()`, S4 is
  not doing the work and the test is passing for the wrong reason.
- If the zero-timer fanout assertion only stays green because the timer is lazily created too late to
  be observed, the cost model claim is false; the test must observe the timer's actual start/stop.
