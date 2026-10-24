<!--
Orthogonal intents (created 2026-10-24 Asia/Shanghai):
1. Implementation log for the 1.14.3 rotation.

Original request (2026-10-24): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.3 implementation log

## 2026-10-24 — Planning baseline (CP0)

- First run of `.agents/skills/upstream-rotation/` (merged in PR #307) as the orchestration guide.
- Two-step detection: v1.14.3 (this change) + v1.15.0 (separate OpenSpecUI 15 line decision,
  deliberately deferred; noted in the report's Decision section).
- Awaiting Round-A dual-channel review.

## 2026-10-24 — Round-A dual-channel + Round-B approval

- Codex (inline-material): 7/10, 3 P1s — all settled by orchestrator verification and folded.
- research: 7/10, 2 P1s — the report's P2 commit mis-attribution (containment module is 87a69a2b,
  not 276d0150; 276d0150 is template text across propose/ff-change/continue-change/explore) and a
  missed NEW guard (MAX_BRACE_EXPANSIONS=1024 expansion budget) that made "braces story closed" a
  fixture-deletion hazard. Folds: 127fc2fb (report rewrites, CP1 observation-order, audit grep +
  five sample-literal dispositions, owner-map verified-no-change rows, AGENTS.md history line,
  provenance intent lines, changeset fixed-group wording).
- Round-B: APPROVED, 9/10. CP1 authorized.

## 2026-10-24 — Slices 1+2 implemented (7b6c618e + 82e922f3) + Round-C approval (9/10)

- CP1 honest deviation: the observation round produced 7 reds, not the planned "all green" — all
  the same identity-guard failure (expectPinnedVersion expected 1.14.2 / received 1.14.3, i.e. the
  plan's own pending constant), zero contract failures; unapplied-content already green, brace/x-
  blocked behind the identity guard. Classified as planned-pending-step reds, rotation completed,
  rerun as final verdict: all three 1.14.2-era fixtures green. Lesson folded into the
  upstream-rotation skill (CP1 expectation = identity-guard reds only).
- Ten surfaces rotated; 16-file/58-test focused matrix green with zero assertion relaxations;
  1.13.2 boundary identities untouched; audit zeroed. Slice 2: README audit clean, changeset
  (four-package naming + fixed-group propagation note).
- Codex Round-C (inline-material): APPROVED 9/10 — no P0/P1; scope compliance confirmed; PR gated
  on full gates (as planned). Write-backs: CP1 lesson -> skill; 1024-budget fixture coverage ->
  noted for future (upstream tests cover it; no direct repo fixture this round); CP1 red-cause
  record -> this log.

## 2026-10-24 — Broad gates complete

- All five gates green (test:ci 1232+174; browser:ci clean; the timing-sensitive surface did not
  flake). format:check caught one prettier miss in the checkpoints edit — fixed before commit.

## 2026-10-24 — Vision walkthrough PASS + broad gates complete

- Vision ego-browser smoke: all scenarios PASS (see checkpoints). Environment note: the playwright
  browser cache had been wiped between sessions; npmmirror CDN 404s on the cft path, the official
  source worked (slow but steady).
- Broad gates all green (details in checkpoints).
