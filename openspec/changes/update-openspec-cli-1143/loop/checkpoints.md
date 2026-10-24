<!--
Orthogonal intents (created 2026-10-24 Asia/Shanghai):
1. Acceptance checkpoints for the 1.14.3 rotation.

Original request (2026-10-24): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.3 checkpoints

## CP0 — Planning baseline

- [x] Worktree + submodule pin `v1.14.3` (`c794978f`); report + change artifacts.
- [x] Round-A Codex (inline-material, 7/10): three P1s — all settled by orchestrator verification:
      (1) baseline wording clarified (e4894a4b = branch point, 690728ce = planning baseline on it);
      (2) v13-boundary literals semantics pinned down — the three admitted-line `1.14.2` literals
      rotate, the `1.13.2` identity assertions stay verbatim; (3) brace guard ALIVE in 1.14.3
      outputs.ts (5 references) — the 1.14.2 depth fixtures keep their semantics.
- [x] Round-A research channel (7/10): two P1s (P2 commit mis-attribution; missed 1024
      expansion-budget guard) + eight non-blockers, all folded in 127fc2fb.
- [x] Round-B APPROVED 2026-10-24 (9/10): item-by-item verification table all in place, no new
      P0/P1. CP1 authorized.

## CP1 — Pin rotation

- [ ] Ten surfaces + grep audit; red recorded; matrix green (zero relaxations); typechecks.

## CP2 — Evidence/docs/changeset

- [ ] README audit; changeset; release-period incidents logged.

## CP3 — Review/walkthrough/delivery

- [x] Codex Round-C implementation review APPROVED (9/10, inline-material): no P0/P1, Round-B
      scope-compliance confirmed; write-backs folded (CP1 lesson into the upstream-rotation skill;
      1024-budget evidence coverage noted for future fixture work; CP1 red-cause record kept in
      the implementation log).
- [x] Vision smoke walkthrough PASS (all scenarios): the 1.14.x unknown-key warning projects
      verbatim (501-char programmatic exact match), Evidence/raw payload intact, board/config/
      dashboard regression clean, 0 console errors with self-tested CDP hooks, black-image defense
      on 8 screenshots, processes reaped. Two P3 observations recorded (dashboard archive-dir link
      listing; "Exit unknown" honest presentation) — both pre-existing behaviors, not rotation
      regressions.
- [x] Broad gates ALL GREEN 2026-10-24: format:check PASS, lint:ci PASS (0 errors), typecheck
      PASS, test:ci PASS (1232 + 174), test:browser:ci PASS (10 + 18 + 12). tool-subscription-router
      did not flake this round. (Playwright chromium binaries had vanished from the local cache —
      environment, not code; reinstalled from the official source after the npmmirror CDN 404'd on
      the cft path.)
- [ ] PR merged (mergedAt verified); archived; released (pending Owner confirmation); resources
      cleaned.
