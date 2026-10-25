<!--
Orthogonal intents (created 2026-10-25 Asia/Shanghai):
1. Acceptance checkpoints for the OpenSpecUI 15 line.

Original request (2026-10-25): "开工"
-->

# OpenSpecUI 15 checkpoints

## CP0 — Planning baseline

- [x] Worktree + submodule pin `v1.15.0` (`8e0288df`); report + intake written.
- [x] Round-A dual-channel: Codex inline-material 7/10 (3 P1s folded c0fa0963) + research 5/10
      (2 P0s — the missing agent-registry/generator-staleness production line and ADDED-only spec
      deltas — plus 5 P1s, folded 32063495; the two channels' findings were complementary).
- [x] Round-B: initially NOT approved (report owner map lagged the registry/staleness fold);
      fixed in 1640b57f → APPROVED 9/10. Implementation authorized (five slices: compat/scope +
      mirrors; registry series; fixture rotation + boundary; cross-package alignment + guards +
      docs + major changeset).

## CP1 — Window + scope contract

- [ ] Compat constants rotated; scope enum gains 'standalone'; compat tests green; red recorded.

## CP2 — Fixture rotation + boundary

- [ ] alias 115 added / 114 → boundary role / 113 removed / 112+111 kept; helper + 13 renames;
      CP1 observation order; boundary rewritten per decision 4; matrix green (zero relaxations).

## CP3 — Guards/docs/changeset

- [x] Pin guards rotated (prepare script, upstream-contract-regression, cold-start, w2
      playwright — the w2 script was again the near-miss, caught by content grep);
      tool-subscription-router derives its npm spec from `OPENSPEC_CLI_TARGET_SERIES`;
      admitted-session samples rotated across core/server/web with boundary/history literals
      classified; settings copy rotated (comment-only); CLAUDE/AGENTS/README faces + 1.14.0
      archive copies per laws; major changeset (x4). Focused gates + core/server/web
      typechecks green; reference rebuilt at `8e0288df` via the prepare script.

## CP4 — Review/walkthrough/delivery

- [ ] Codex Round-C; vision smoke walkthrough; broad gates; PR merged (mergedAt verified);
      archived; released (Owner confirmation; major dist-tag check); resources cleaned.
