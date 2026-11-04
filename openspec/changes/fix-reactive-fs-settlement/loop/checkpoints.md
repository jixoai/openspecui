<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. One falsifiable checkpoint per slice, each tied to a named command or artifact.
2. Keep the "fails today for the intended reason" record explicit for every red test.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

# Checkpoints — fix-reactive-fs-settlement

## CP0 — Evidence baseline

- [ ] Two investigations recorded in the change (stack inventory; mature-pattern survey), each with
      file:line or URL evidence.
- [ ] Probe result recorded, including the negative one (`getEventsSince` returns `[]` while the
      watcher is dead on macOS) and the two reading corrections it forced.
- [ ] Linux/Windows half explicitly deferred to CI with the reason (podman VM broken; owner's Docker
      and remote contexts untouched); the Windows gate's `windows_required` gating stated.

## CP1 — Settle after (re)arm

- [ ] `settleRootReads(rootPath)` re-reads every cached read under the root, asserted by spying on the
      underlying `readdir`/`readFile`/`stat`.
- [ ] Red test: a deterministically stale cached read (read → close watchers → mutate → attach)
      surfaces disk truth after a forced reinitialize, with no new event.
- [ ] Watermark: a root skips a settle it already satisfied for the current arm generation
      (at-most-once per arm), tested by counting refreshes across arm + subscription-start.

## CP2 — Retained-observation start

- [ ] A long-lived consumer attaching to an already-armed root converges without waiting for a cadence
      pass (the server-boot root case).
- [ ] Cost: the start settle runs once, not once per consumer (spy count).

## CP3 — Pooled periodic settlement

- [ ] One process-level interval; started with the first root lease, stopped with the last;
      `unref()` proven (a live lease does not hold the process open), asserted by a disposal test.
- [ ] Exactly one interval with N roots and M cached reads (no per-root/per-path timers).
- [ ] Passes are serialized; concurrent triggers never overlap.
- [ ] Skip-when-idle: no leases → no timer; no cached reads under leased roots → no filesystem calls.
- [ ] **Red first**: the stall is characterized today — retained projection → `closeAllWatchers()` →
      create → wait past the missing-path poll and both debounces → **no second emission**; then the
      same setup with one driven pass converges. Both halves recorded.
- [ ] Cadence overridable for tests; no test waits on the 45 s default.

## CP4 — Laws and costs preserved

- [ ] The fanout contract is amended **explicitly** in code comments, this change, and `AGENTS.md`:
      one pooled interval per process, never per path/directory/root; the one-shot projection path
      holds no lease and therefore creates none.
- [ ] `tool-init-state.test.ts` asserts the contract rather than the root-before-spy ordering
      coincidence (review N9), and the assertion is shown to fail if a per-path timer is introduced
      (mutation check).
- [ ] A pass's filesystem work is proportional to the cached reads under leased roots, measured and
      recorded as a number in the delivery record.

## CP5 — Delivery

- [ ] Spec delta for `reactive-file-system` states the settlement requirement, its scenarios, and the
      single convergence bound (settlement cadence for every loss class); no claim of a fast bound the
      design cannot honour.
- [ ] AGENTS decision line; changeset for `@openspecui/core` and `@openspecui/server`.
- [ ] Review round 2 folded; all blockers closed with evidence, scores recorded.
- [ ] Full local gates, PR green (Linux gate carries the S5.1/S5.2 halves), archive, release, residue
      audit per the repository workflow.
