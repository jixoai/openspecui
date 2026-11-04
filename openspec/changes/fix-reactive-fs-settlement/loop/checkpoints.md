<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. One falsifiable checkpoint per slice, each tied to a named command or artifact.
2. Keep the "fails today for the intended reason" record explicit for every red test.
3. Every acceptance item that round 2 showed was self-contradictory is replaced by one that can only
   pass when the behaviour exists.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

# Checkpoints — fix-reactive-fs-settlement

## CP0 — Evidence baseline

- [x] Two investigations recorded in the change (stack inventory; mature-pattern survey), each with
      file:line or URL evidence.
- [x] Probe recorded as one observed macOS sequence, with the correction that macOS replay throws rather
      than returning `[]`; no general law is claimed from it.
- [x] Linux/Windows half explicitly deferred to CI with the reason (podman VM broken; owner's Docker and
      remote contexts untouched); the Windows gate's `windows_required` gating stated.
- [x] The stall is already an executable red (`silent-event-loss.test.ts`, fails with
      "the directory listing was never re-read").

## CP1 — One matching space (S0)

- [ ] Every registration records a normalized path once, at registration; matching is a pure string
      ancestor test with no filesystem call per pass.
- [ ] Path-space test: a read registered under a symlinked prefix (macOS `TMPDIR`) is matched by a lease
      on the same directory — fails as itself, not as a timeout, if `resolve()` and realpath diverge.

## CP2 — Arm and start settlement (S1/S2)

- [ ] Arm identity covers the logical root's referenceCount 0→1 transition as well as generation change:
      a second logical root on an initialized physical watcher still settles.
- [ ] Reinitialize completion settles every logical root of that physical watcher.
- [ ] Single-flight per root: concurrent triggers coalesce; a later trigger at the same generation is
      **allowed** to run (the watermark version was rejected for disabling this case).
- [ ] Red test: a deterministically stale cached read surfaces disk truth after a forced reinitialize,
      with no new event.
- [ ] Consumer start at an unchanged generation converges without waiting for a cadence pass.

## CP3 — Pooled periodic settlement (S3)

- [ ] One pooled interval per process; started with the first lease, stopped with the last, and also
      stopped by `closeAllWatchers()` (its own assertion — that path bypasses release).
- [ ] With N roots and M registered reads: exactly one interval, zero per-path polls (spy installed
      **before** the first lease).
- [ ] Skip-when-idle: no leases → no timer; pass over a root with no registered reads → zero
      `readdir`/`readFile`/`stat`.
- [ ] Passes never overlap; cadence read at interval start/schedule, never at module load, and
      overridable via `OPENSPECUI_SETTLEMENT_INTERVAL_MS` so no test waits on 45 s.
- [ ] Ordering: a pass racing one of our own writes does not publish the pre-write value (serialized
      with `settleReactivePathMutation`).
- [ ] Convergence after the net, driven by one pass, asserted on macOS **and** the Linux gate.

## CP4 — One-shot freshness without orphaning (S4)

- [ ] The one-shot path settles then reads; it no longer deletes cache entries by substring prefix.
- [ ] Test: a live retained projection survives a one-shot read of the same root and still converges.
- [ ] The substring hazard is gone by construction (no prefix deletion remains).

## CP5 — Laws and costs

- [ ] The fanout sentence recorded in code comments, this change, and `AGENTS.md` is the narrow true one:
      one pooled settlement interval per process; per-missing-path polls and per-watcher liveness probes
      unchanged.
- [ ] `tool-init-state.test.ts` asserts the contract (spy first) instead of the root-before-spy ordering
      coincidence, and the assertion is shown to fail when a per-path timer is introduced (mutation check).
- [ ] Pass cost recorded as a number (registered reads × cadence) in the delivery record.

## CP6 — Delivery

- [ ] Spec delta states the requirement, the scoped guarantee (registered reads under leased roots), the
      cadence-shaped bound, and the single-flight semantics; no claim the design cannot honour.
- [ ] AGENTS decision line; changeset for `@openspecui/core` and `@openspecui/server`.
- [ ] Review round 3 folded; blockers closed with evidence; scores recorded.
- [ ] Full local gates, PR green, archive, release, residue audit per the repository workflow.
