<!--
Orthogonal intents (created 2026-10-16 Asia/Shanghai):
1. Define the acceptance checkpoints for the 1.14.2 patch rotation.

Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.2 checkpoints

## CP0 — Planning baseline
- [x] Worktree + branch + submodule pin `v1.14.2` (`f80d860f`).
- [x] Evidence report + change artifacts written.
- [x] Round-A research-channel review (8/10): two missed pin surfaces found and verified —
      folded into Slice 1 owners (`official-cli-v13-boundary-fixtures.test.ts`,
      `opsx-kernel-schemas-root.fixtures.test.ts`); focused glob widened; AGENTS.md:568 SHA and
      verbatim-evidence strings folded into Slice 2; report corrected (21 commits, #2083
      attribution, scan-complexity wording).
- [x] Codex Round-A (inline-material mode, 7.5/10): all four P1s and the report corrections
      independently converge with the research channel's findings and were already folded in
      5b7299f0; residual P3 (fixture evidence-value order) and the timing-flake PR note folded.
      Codex explicitly declared it executed nothing (materials-only) and treated
      orchestrator-verified facts as trusted inputs.
- [x] Codex Round-B APPROVED 2026-10-16 (9.2/10, up from 7.5): every Round-A fix verified in
      place (item-by-item table), no new P0/P1; honest material-trust boundary declared (it
      executes nothing; the ten-live-surfaces audit is trusted input — if implementation finds a
      new active literal, code wins over the "ten" assumption). CP1 implementation authorized.

## CP1 — Pin rotation
- [ ] Alias + lockfile + PINNED_V14_VERSIONS/bins + EXPECTED_COMMIT + live pin guards + CLAUDE.md.
- [ ] Red recorded (identity assertion vs stale 1.14.1).
- [ ] v14 fixture matrix green against 1.14.2 (zero relaxations).

## CP2 — Fixture evidence + docs + changeset
- [ ] x- extension-key fixture case (no warning) + X-Foo (warns).
- [ ] AGENTS.md pin line + 2026-10-16 architecture decision; README audited.
- [ ] Changeset for the 14.x patch.

## CP3 — Review, walkthrough, delivery
- [x] Codex Round-C implementation review APPROVED (9.4/10, inline-material mode): no P0/P1;
      Round-B scope-compliance table item-by-item with no overreach; P2 notes folded into the PR
      description (lockfile churn explanation, timing-flake triage rule).
- [ ] Vision ego-browser walkthrough (preparation evidence).
- [x] Broad gates: format:check PASS, lint:ci PASS (0 errors), typecheck PASS — 2026-10-16;
      test:ci / test:browser:ci pending after the vision walkthrough completes; PR merged; change archived; resources released.
- [ ] Owner final walkthrough boundary unchanged.
