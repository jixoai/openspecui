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

- [x] Every registration records a **separate** normalized field once; the settlement matcher is a pure
      string ancestor test with no filesystem call per pass. (`reactive-fs.ts` `normalizedPath` +
      `containsPath`; `settlement-coverage.test.ts` "performs zero filesystem reads for a root with no
      registered reads".)
- [x] `registration.path` is **not** moved: write settlement keeps its `resolve()` + bidirectional
      `pathsOverlap` semantics untouched (round 3, B1), asserted by the existing write-settlement tests
      plus a macOS symlinked-prefix case. (`physical-reactive-file-writer.test.ts`, `reactive-fs.test.ts`;
      the split-space case is `settlement-coverage.test.ts` "covers a read registered under a
      lexical/realpath split when settled by its realpath root".)
- [x] Path-space test: a read registered under a symlinked prefix (macOS `TMPDIR`) is covered by a lease
      on the same directory — asserted by **coverage counts** (1 covered / 0 uncovered), not by waiting
      for a timeout, so a mismatch fails as itself. (`settlement-coverage.test.ts` covers 1 / 0 across
      its two path-space cases.)
- [x] Mutation: `realpathSync` call count during a pass is 0. (`settlement-coverage.test.ts` "resolves
      registration paths once and never during a settlement pass".)
- [x] Boundary recorded: a formerly missing segment appearing as a symlink leaves the normalized field
      stale (uncovered); the no-ancestor fallback is documented too. (research plan S0 general form;
      fallback documented in `path-realpath.ts`.)

## CP2 — Arm and attach settlement (S1)

- [x] Trigger 1: new record (0→1) settles after `record.ready`. (`settlement-triggers.test.ts` "settles a
      newly armed root when its pool record goes 0 -> 1".)
- [x] Trigger 2: `ReactiveObservationEnvironment.acquireRoot` on its **memoized** branch settles — the
      real "first attach after boot" path. The pool-level "acquiring an already-initialized record"
      trigger is **deleted**, because round 4 showed the environment memoizes every later acquisition and
      the pool therefore never sees them (a named-but-dead trigger is worse than an unnamed one).
      (`settlement-triggers.test.ts` "settles a root the environment already holds on its memoized attach
      branch".)
- [x] Trigger 3: an explicit `ProjectWatcher` reinitialized callback (not the status emit, which also
      emits `initialized=false` mid-flight) settles every logical root of that physical watcher.
      (`settlement-triggers.test.ts` "settles every logical root of a physical watcher after a completed
      rebuild".)
- [x] Trigger 4: the settled seam is inside `ensurePhysicalObservation`'s awaited chain (after the root
      loop, before the first projection read); `subscribe` itself is synchronous, so "awaited inside
      subscribe" is not implementable and must not be written that way. Declared as the **single**
      consumer hook, with the reason recorded; V1 proves the ordering and the second-subscribe memo.
      (seam JSDoc in `agent-delivery-projection-service.ts`; V1(i)/(ii) in
      `agent-delivery-projection-service.settlement.test.ts`.)
- [x] One coordinator per process for the trigger-driven pass producers (arm, attach, pooled): at most
      one pass in flight per root; the settle/coordinator module lives outside both `reactive-fs` and
      `watcher-pool` (no import cycle). Ruling (S4, recorded as a deliberate deviation): `settlePaths` is
      **not** routed through the coordinator — it is an independent awaited pass by design and may
      overlap a coordinator pass, with the per-registration version guard, not the coordinator, keeping
      either from publishing an older value. (`settlement-coordinator.test.ts`; `settlement-paths.test.ts`
      runs with no lease and no timer; implementation.md "Deliberate deviation from the plan text".)
- [x] Trailing semantics asserted with the **observable quantities** round 5 named: exact read-phase
      entries (2 for one trailing half, 3 for the second), the committed value after the awaited settle
      resolves equals the post-write value, the cadence sits above the assertion window (so a pooled pass
      cannot rescue a fake), and the third half uses **two ordered gates**. Both fakes (join-and-discard;
      exactly-one-trailing) must be shown failing against these assertions (V2).
      (`settlement-coordinator.test.ts` `[1, 2]` / `[1, 2, 3]` exact entries and post-await values; V2
      fake evidence recorded in implementation.md S1.)
- [x] `settlePaths` is an independent awaited pass by design (it reads directly rather than joining an
      in-flight pass, so a one-shot call can never resolve on a read that predates it); the version guard
      is what keeps concurrent passes from publishing older data. (`settlement-paths.test.ts`;
      implementation.md S4 ruling.)
- [x] Red test: a deterministically stale cached read surfaces disk truth after a forced reinitialize,
      with no new event (the forced-reinitialize seam named: stubbed drop-events error + fake timers, or
      an explicit entry). (`settlement-triggers.test.ts` rebuild test: `subscribe` transport stubbed so
      no event can arrive, explicit `reinitializeWatcher(...)` entry, cached "before" read becomes
      "after".)
- [x] Consumer start at an unchanged generation converges with the cadence set far above the assertion
      window; the assertion boundary is the **assembly** (environment/service), not the pool.
      (`agent-delivery-projection-service.settlement.test.ts` V1 runs at the default 20 s cadence, never
      retuned, and converges at the service seam.)

## CP3 — Pooled periodic settlement (S3)

- [x] One pooled interval per process; started with the first lease, stopped with the last, absent while
      no lease exists, and also stopped by `closeAllWatchers()` (that path bypasses release).
      (`settlement-pool.test.ts` "starts with the first lease, stops with the last, and is stopped by
      full teardown".)
- [x] N ≥ 2 **distinct physical watchers** (asserted through the delay multiset, not
      `getWatcherRuntimeStatus().roots.length`, which lists logical roots only): exactly one active
      settlement timer via the exported diagnostic; the `setInterval` delay multiset after the spy equals
      `N × PATH_LIVENESS_INTERVAL_MS + 1 × cadence` — so jitter MUST land in per-tick scheduling rather
      than in the interval delay (the two assertions would otherwise contradict each other); the mutation
      check breaks the net's own creation path (a constant-returning accessor must not pass).
      (`settlement-pool.test.ts` `[3000, 3000, 7777]` + `activeTimers === 1`; mutation evidence in
      implementation.md S3.)
- [x] Skip-when-idle: no leases → no timer; pass over a root with no registered reads → zero
      `readdir`/`readFile`/`stat`. (`settlement-pool.test.ts` "performs zero readdir/readFile/stat for a
      pooled pass over a root with no registered reads"; `settlement-coordinator.test.ts` "owns no timer
      and retains no per-root state once a burst went idle" + its zero-read test.)
- [x] Trigger-driven passes never overlap (the coordinator serializes them per root); the cadence is read
      at interval start/schedule, never at module load, and is overridable via
      `OPENSPECUI_SETTLEMENT_INTERVAL_MS` so no test waits on the default. Ruling (S4): `settlePaths` is an
      independent pass by design and **may overlap** a coordinator pass — the per-registration version
      guard, not the coordinator, keeps concurrent passes from publishing an older value.
      (`settlement-pool.test.ts` cadence-seam test; `settlement-paths.test.ts`; implementation.md S4.)
- [x] Version guard: a **per-registration commit version** bumped by all four publisher classes
      (write-settlement core, `updateReactiveFileCache`, event/poll refresh commits, other passes); a pass
      verifies and commits in one synchronous block, re-reads once on change, then skips that
      registration. Asserted with a gated `prepareRefresh` **and** a publisher from
      `updateReactiveFileCache`. (`settlement-version-guard.test.ts`, including the added `force-commit`
      mode pins; per-class mutation evidence in implementation.md S3.)
- [ ] Convergence after the net, driven by one pass, asserted on macOS **and** the Linux gate. — macOS
      half green (`silent-event-loss.test.ts`); the Linux/CI half has not been run in this worktree.

## CP4 — One-shot freshness without orphaning (S4)

- [x] `settlePaths(roots)` is a pool- and lease-independent primitive, awaited before the one-shot reads,
      using the S0 matcher on both sides; the one-shot path no longer deletes cache entries by substring
      prefix. (`settlement-paths.test.ts`; `tool-init-state.ts` `getToolInitStates` awaits
      `settlePaths(collectToolInitCacheRoots(...))` and no longer calls `clearCache`.)
- [x] Equivalence red test: the existing two-read `tool-init-state.test.ts` fixture (no lease) stays
      green, and its second read observes an externally written change. ("refreshes stale cached file
      existence after init artifacts are created later", passing in the focused suite.)
- [x] Test: a live retained projection survives a one-shot read of the same root and remains observable
      to later settlements. (`settlement-paths.test.ts` "keeps a retained projection observable across a
      one-shot read of the same root".)
- [x] Residual declared in the change, not hidden: the three no-argument `clearCache()` call sites in the
      local-model stores keep the same orphan channel for their own subsystem and are follow-up scope.
      (research plan B7; implementation.md S4 "clearCache itself is untouched for the three local-model
      stores, as scoped".)
- [x] Registration lifecycle stated: append-only for the process lifetime except the existing error
      releases; `clearCache` is no longer on the agent one-shot path. (research plan S4 registration
      lifecycle; implementation.md S4.)

## CP5 — Laws and costs

- [x] The narrowed fanout sentence recorded in code comments, this change, and `AGENTS.md`: one pooled
      settlement interval per process; per-missing-path polls and per-watcher liveness probes unchanged.
      (`AGENTS.md` parent-inventory rebind law + the 2026-11-05 architecture decision; `watcher-pool.ts`
      intent 7; spec-delta scenario "Settlement cost stays pooled and bounded".)
- [x] The touched `AGENTS.md` laws are reconciled explicitly — **four**, not three: one-shot "retire" →
      "settle before reading" (with its neighbouring empty-installation sentence updated to the narrowed
      fanout contract); the polling-as-fallback sentence applies to the net; the "inert while healthy"
      sentence keeps its **Store-fallback half intact** and gains a separate sentence for the net's fixed
      cadence (never health-gated, because silent loss is invisible in the health signal); and the
      reactive-observation ownership law gains the note that attach settlement therefore lives at the
      environment and the one named hook, not in the pool. (commit `ceaca495`, AGENTS.md diff.)
- [x] `tool-init-state.test.ts` asserts the contract (spy first, via the exported diagnostic) instead of
      the root-before-spy ordering coincidence, and the assertion is shown to fail when a per-path timer
      is introduced (mutation check). (Fix round BLK-2, 2026-11-05: spy installed before `acquireRoot`,
      exactly one pooled cadence + liveness-only remainders, mutation probe red / revert green.)
- [ ] Pass cost recorded as a number (registered reads × cadence) in the delivery record. — follow-up:
      not measured in this worktree.

## CP6 — Delivery

- [ ] Spec delta states the requirement, the scoped guarantee (covered reads), the cadence-shaped bound
      excluding consumer recompute latency, and the join/trailing semantics; no claim the design cannot
      honour.
- [ ] AGENTS decision lines (laws above); changeset for `@openspecui/core` and `@openspecui/server`.
- [x] Review round 6 (diff review, 7.5/10) folded; its two merge blockers closed in `6c6fba08`
      (`force-commit` freshness mode with bounded attempts; the CP5 timer-contract assertion with its
      mutation). Scores: plan rounds 6 → 7 → 6.5 → 7.0 → 8.0, diff round 7.5.
- [x] Full local gates, PR green (`#326`, merged `18b08c04`; Windows gate 18m21s, Fast Gate 10m57s),
      archive (`#327`, `c219b4ba`), release 16.1.0 (`#328`, `2b230fd8`).
- [x] The 45 s cadence was falsified by the first PR run and shortened to 20 s (`e616305b`): the failing
      stage waits 40 s, so a 45 s period could never reach a consumer-visible window.
- [x] Release facts: main head `2b230fd8`; `@openspecui/{core,search,server,web}@16.1.0` peeled to it;
      GitHub Release `openspecui 16.1.0` (Latest); npm resolves 16.1.0 and `latest` moved for all four;
      the version commit left `references/openspec` at `27c05157`.
- [ ] Residue audit report lives with the session report (worktree, branches, `/tmp`, processes). The
      local `.git/config` hooksPath was removed for the release commit and restored immediately after.
