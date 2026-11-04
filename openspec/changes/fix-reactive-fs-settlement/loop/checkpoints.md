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
      on the same directory — asserted by **coverage counts** (1 covered / 0 uncovered), not by waiting
      for a timeout, so a mismatch fails as itself.
- [ ] Mutation: `realpathSync` call count during a pass is 0.
- [ ] Boundary recorded: a formerly missing segment appearing as a symlink leaves the normalized field
      stale (uncovered); the no-ancestor fallback is documented too.

## CP2 — Arm and attach settlement (S1)

- [ ] Trigger 1: new record (0→1) settles after `record.ready`.
- [ ] Trigger 2: `ReactiveObservationEnvironment.acquireRoot` on its **memoized** branch settles — the
      real "first attach after boot" path. The pool-level "acquiring an already-initialized record"
      trigger is **deleted**, because round 4 showed the environment memoizes every later acquisition and
      the pool therefore never sees them (a named-but-dead trigger is worse than an unnamed one).
- [ ] Trigger 3: an explicit `ProjectWatcher` reinitialized callback (not the status emit, which also
      emits `initialized=false` mid-flight) settles every logical root of that physical watcher.
- [ ] Trigger 4: the settled seam is inside `ensurePhysicalObservation`'s awaited chain (after the root
      loop, before the first projection read); `subscribe` itself is synchronous, so "awaited inside
      subscribe" is not implementable and must not be written that way. Declared as the **single**
      consumer hook, with the reason recorded; V1 proves the ordering and the second-subscribe memo.
- [ ] One coordinator per process shared by every pass producer (arm, attach, pooled, `settlePaths`);
      at most one pass in flight per root; the settle/coordinator module lives outside both `reactive-fs`
      and `watcher-pool` (no import cycle).
- [ ] Trailing semantics asserted with the **observable quantities** round 5 named: exact read-phase
      entries (2 for one trailing half, 3 for the second), the committed value after the awaited settle
      resolves equals the post-write value, the cadence sits above the assertion window (so a pooled pass
      cannot rescue a fake), and the third half uses **two ordered gates**. Both fakes (join-and-discard;
      exactly-one-trailing) must be shown failing against these assertions (V2).
- [ ] `settlePaths` awaits the pass that serves it, including a trailing one.
- [ ] Red test: a deterministically stale cached read surfaces disk truth after a forced reinitialize,
      with no new event (the forced-reinitialize seam named: stubbed drop-events error + fake timers, or
      an explicit entry).
- [ ] Consumer start at an unchanged generation converges with the cadence set far above the assertion
      window; the assertion boundary is the **assembly** (environment/service), not the pool.

## CP3 — Pooled periodic settlement (S3)

- [ ] One pooled interval per process; started with the first lease, stopped with the last, absent while
      no lease exists, and also stopped by `closeAllWatchers()` (that path bypasses release).
- [ ] N ≥ 2 **distinct physical watchers** (asserted through the delay multiset, not
      `getWatcherRuntimeStatus().roots.length`, which lists logical roots only): exactly one active
      settlement timer via the exported diagnostic; the `setInterval` delay multiset after the spy equals
      `N × PATH_LIVENESS_INTERVAL_MS + 1 × cadence` — so jitter MUST land in per-tick scheduling rather
      than in the interval delay (the two assertions would otherwise contradict each other); the mutation
      check breaks the net's own creation path (a constant-returning accessor must not pass).
- [ ] Skip-when-idle: no leases → no timer; pass over a root with no registered reads → zero
      `readdir`/`readFile`/`stat`.
- [ ] Passes never overlap; cadence read at interval start/schedule, never at module load, and
      overridable via `OPENSPECUI_SETTLEMENT_INTERVAL_MS` so no test waits on 45 s.
- [ ] Version guard: a **per-registration commit version** bumped by all four publisher classes
      (write-settlement core, `updateReactiveFileCache`, event/poll refresh commits, other passes); a pass
      verifies and commits in one synchronous block, re-reads once on change, then skips that
      registration. Asserted with a gated `prepareRefresh` **and** a publisher from `updateReactiveFileCache`.
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
- [ ] The touched `AGENTS.md` laws are reconciled explicitly — **four**, not three: one-shot "retire" →
      "settle before reading" (with its neighbouring empty-installation sentence updated to the narrowed
      fanout contract); the polling-as-fallback sentence applies to the net; the "inert while healthy"
      sentence keeps its **Store-fallback half intact** and gains a separate sentence for the net's fixed
      cadence (never health-gated, because silent loss is invisible in the health signal); and the
      reactive-observation ownership law gains the note that attach settlement therefore lives at the
      environment and the one named hook, not in the pool.
- [ ] `tool-init-state.test.ts` asserts the contract (spy first, via the exported diagnostic) instead of
      the root-before-spy ordering coincidence, and the assertion is shown to fail when a per-path timer
      is introduced (mutation check).
- [ ] Pass cost recorded as a number (registered reads × cadence) in the delivery record.

## CP6 — Delivery

- [ ] Spec delta states the requirement, the scoped guarantee (covered reads), the cadence-shaped bound
      excluding consumer recompute latency, and the join/trailing semantics; no claim the design cannot
      honour.
- [ ] AGENTS decision lines (laws above); changeset for `@openspecui/core` and `@openspecui/server`.
- [ ] Review round 6 folded; blockers closed with evidence; scores recorded (rounds 1-5: 6, 7, 6.5, 7.0, 8.0).
- [ ] Full local gates, PR green, archive, release, residue audit per the repository workflow.
