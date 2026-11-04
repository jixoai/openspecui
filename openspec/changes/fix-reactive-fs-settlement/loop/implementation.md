<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Keep implementation reality synchronized with the plan.
2. Record the probe as the evidence that shaped the design, including what it disproved.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

## Implementation Log

### 2026-11-04 — Planning

- Intake, research plan, checkpoints, and the `reactive-file-system` delta written.
- Probe executed on macOS (`/tmp/watcher-probe/probe.mjs`, kept as evidence): create-while-subscribed
  is delivered and diffed; create-while-dead is **invisible to `getEventsSince` (`[]`)**; the same
  diff after re-subscribing reports it. Design consequence: the query API is a detector; re-arm plus
  re-read is the recovery primitive.
- Rejected before implementation, with reasons: per-directory polling (violates the fanout law and
  re-reads only what we choose); bind-time resync inside the watcher pool (unprovable from a macOS
  probe and it changes the pool's callback contract — two pool tests encode "acquire does not
  notify"); swapping to chokidar/watchman (out of scope; watchman is not installed on CI and adding a
  daemon is a distribution decision).

No production code yet.

### 2026-11-04 — Review round 1 folded (6/10 → revised plan)

Review round 1 returned six blockers and one architectural observation. All folded; the
architectural one changed the design rather than the wording:

- **Accepted (N11): the snapshot/diff tier and the coarse re-arm tier are removed.** The diff is blind
  exactly where it was supposed to help (macOS dead-watcher replay returns `[]`; Linux kernel drops
  never enter the library's tree), and it brought four extra surfaces — baseline lifecycle, ignore
  alignment for the query APIs, escalation storms, upstream query defects. Settlement is now a direct
  disk re-read at every layer, which is ground truth for _every_ loss class and deletes blockers
  B1/B2/B4 outright.
- **B3**: the trigger is now "any retained root lease", matching the spec's process-wide promise,
  with the guarantee restated against the cadence.
- **B5**: one `settleRootReads` plus a per-arm watermark replaces the S2/S3 double-work, and CP2's
  contradictory "exactly one per subscribe" is gone.
- **B6**: the red evidence is the behavioural stall (no second emission after `closeAllWatchers()`),
  which runs today, not a compile failure.
- **Fanout law**: the amendment is now explicit — one pooled interval per process, never per
  path/directory/root — and the existing test is changed to assert that contract instead of the
  root-before-spy ordering coincidence it currently depends on (N9).
- Overclaims O1/O2/O4 corrected in `intake.md` and the plan: the upstream race figures are cited
  separately, the re-read (not the re-arm) is named as the convergence primitive, and there is one
  stated convergence bound instead of an implied fast one.

### 2026-11-04/05 — Review round 2 folded (7/10 → plan v3)

Round 2 verified that three of round 1's blockers were genuinely eliminated (B1/B2 deleted with the
diff tier, B6 materialized as an executable red) and that the rest needed work. Its five blockers are
folded here:

- **R2-B2 (the dangerous one): one matching space.** Roots are realpath-tracked, cache keys are
  `resolve()`-built, and macOS `TMPDIR` sits under the `/var` → `/private/var` symlink — so a naive
  matcher covers **zero** reads on a developer machine while passing on a Linux runner. Round 2
  reproduced the divergence locally. Registration now records a normalized path once and matching is a
  pure ancestor string test with no per-pass filesystem calls.
- **R2-B1: single-flight replaces the watermark.** The watermark ("at most once per arm") silently
  disabled the very consumer-start case S2 exists for, because silent loss does not change the
  generation. Concurrent requests now coalesce; later requests at the same generation may run.
- **R2-B3: the fanout sentence is narrowed to the truth.** "Never per path/directory/root" was false —
  per-missing-path polls and per-watcher liveness probes exist. The recorded contract is one pooled
  settlement interval per process, with those two unchanged.
- **R2-B4: arm identity is explicit** — `(physical generation, logical root)` plus the refcount 0→1
  transition, since a second logical root on an initialized physical watcher changes no generation.
  Hook points named in `watcher-pool`; `subscribeRuntimeStatus` emits are explicitly not the hook.
- **R2-B5: the one-shot path stops tearing down the registry.** `clearCache(root)`'s substring deletion
  can orphan a live retained projection in the same process (reachable: one-shot and retained coexist in
  `AgentDeliveryProjectionService`). Replaced by settle-then-read, which also removes the substring
  hazard.

Overclaims corrected: the guarantee is scoped to registered reads under leased roots with a
cadence-shaped bound (O1/O2); the probe is one observed sequence, not a library law (O4); the fanout
sentence is narrowed (O5); O3 disappeared with the single-flight change. Non-blocking items folded: pass
commits serialize with our own writes, the matcher uses `containsPath` rather than `pathsOverlap`, the
cadence env is read at interval start, `closeAllWatchers()` must stop the interval, and the round-1
citation of "two pool tests" was dropped as imprecise.
