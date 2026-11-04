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

- [ ] Every registration records a **separate** normalized field once; the settlement matcher is a pure
      string ancestor test with no filesystem call per pass.
- [ ] `registration.path` is **not** moved: write settlement keeps its `resolve()` + bidirectional
      `pathsOverlap` semantics untouched (round 3, B1), asserted by the existing write-settlement tests
      plus a macOS symlinked-prefix case.
- [ ] Path-space test: a read registered under a symlinked prefix (macOS `TMPDIR`) is covered by a lease
      on the same directory — fails as itself, not as a timeout, if `resolve()` and realpath diverge.
- [ ] Mutation: `realpathSync` call count during a pass is 0.
- [ ] Boundary recorded: a formerly missing segment appearing as a symlink leaves the normalized field
      stale (uncovered); the no-ancestor fallback is documented too.

## CP2 — Arm and start settlement (S1/S2)

- [ ] Trigger 1: new record (0→1) settles after `record.ready`.
- [ ] Trigger 2: acquiring an existing, initialized record (refcount ≥ 1) settles — the named attach
      signal; attachments that skip root acquisition are covered only by the cadence net.
- [ ] Trigger 3: an explicit `ProjectWatcher` reinitialized callback (not the status emit, which also
      emits `initialized=false` mid-flight) settles every logical root of that physical watcher.
- [ ] Arm settlement is fire-and-forget (`acquireWatcherRoot` does not await it), stated in code.
- [ ] Single-flight **with a trailing obligation**: requests before the read phase join; a request during
      or after it marks the root dirty and is served by exactly one trailing pass. A join-and-discard
      implementation fails the gated test.
- [ ] Red test: a deterministically stale cached read surfaces disk truth after a forced reinitialize,
      with no new event.
- [ ] Consumer start at an unchanged generation converges with the cadence set far above the assertion
      window and the write made after the arm settle completed (watermark implementations fail here).

## CP3 — Pooled periodic settlement (S3)

- [ ] One pooled interval per process; started with the first lease, stopped with the last, absent while
      no lease exists, and also stopped by `closeAllWatchers()` (that path bypasses release).
- [ ] N ≥ 2 leases: exactly one pooled settlement timer, asserted through an exported diagnostic count
      (never by counting all `setInterval` — the per-watcher liveness probe exists by design), and zero
      per-path polls.
- [ ] Skip-when-idle: no leases → no timer; pass over a root with no registered reads → zero
      `readdir`/`readFile`/`stat`.
- [ ] Passes never overlap; cadence read at interval start/schedule, never at module load, and
      overridable via `OPENSPECUI_SETTLEMENT_INTERVAL_MS` so no test waits on 45 s.
- [ ] Epoch guard: a pass whose read predates one of our own writes and whose commit would land after it
      re-reads once, then skips; driven by a gated `prepareRefresh`, not a sleep.
- [ ] Convergence after the net, driven by one pass, asserted on macOS **and** the Linux gate.

## CP4 — One-shot freshness without orphaning (S4)

- [ ] `settlePaths(roots)` is a pool- and lease-independent primitive, awaited before the one-shot reads,
      using the S0 matcher on both sides; the one-shot path no longer deletes cache entries by substring
      prefix.
- [ ] Equivalence red test: the existing two-read `tool-init-state.test.ts` fixture (no lease) stays
      green, and its second read observes an externally written change.
- [ ] Test: a live retained projection survives a one-shot read of the same root and remains observable
      to later settlements.
- [ ] Residual declared in the change, not hidden: the three no-argument `clearCache()` call sites in the
      local-model stores keep the same orphan channel for their own subsystem and are follow-up scope.
- [ ] Registration lifecycle stated: append-only for the process lifetime except the existing error
      releases; `clearCache` is no longer on the agent one-shot path.

## CP5 — Laws and costs

- [ ] The narrowed fanout sentence recorded in code comments, this change, and `AGENTS.md`: one pooled
      settlement interval per process; per-missing-path polls and per-watcher liveness probes unchanged.
- [ ] The three touched `AGENTS.md` laws are reconciled explicitly (one-shot "retire" → "settle before
      reading"; polling-as-fallback sentence applies to the net; "inert while healthy" refined with the
      reason health cannot see silent loss).
- [ ] `tool-init-state.test.ts` asserts the contract (spy first, via the exported diagnostic) instead of
      the root-before-spy ordering coincidence, and the assertion is shown to fail when a per-path timer
      is introduced (mutation check).
- [ ] Pass cost recorded as a number (registered reads × cadence) in the delivery record.

## CP6 — Delivery

- [ ] Spec delta states the requirement, the scoped guarantee (covered reads), the cadence-shaped bound
      excluding consumer recompute latency, and the join/trailing semantics; no claim the design cannot
      honour.
- [ ] AGENTS decision lines (laws above); changeset for `@openspecui/core` and `@openspecui/server`.
- [ ] Review round 4 folded; blockers closed with evidence; scores recorded.
- [ ] Full local gates, PR green, archive, release, residue audit per the repository workflow.
