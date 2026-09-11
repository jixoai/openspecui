<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Define the acceptance checkpoints and their evidence for OpenSpecUI 13.
2. Keep every checkpoint falsifiable against a named command or artifact.
3. Record the Owner-only acceptance boundary.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpecUI 13 checkpoints

## CP0 — Planning baseline (planning)

- [x] Worktree `openspecui-113`, branch `target-openspec-cli-113-line` off `origin/main`.
- [x] `references/openspec` submodule pinned `v1.13.0` @ `9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`.
- [x] `references/openspec-1.13.0-report.md` written with executed CLI evidence.
- [x] Change artifacts (specs deltas + loop docs) written.
- [x] Codex change review: Round-B 8.7/10 APPROVE WITH NON-BLOCKING NOTES (Round-A 5.8 REVISE folded).
- [ ] CP0 committed.

## CP1 — Window and contract (implementation)

- [x] Slice 1 constants rotated; `openspec-compat.test.ts` green (10/10); boundary red recorded (5 failing
      assertions, 1.12.x → unsupported); diagnose mirror test green with boundary assertions.
- [x] Slice 2 Apply Instructions schema extended through input/projection schemas; contract tests green
      (48/48 across 3 files); red recorded (warnings dropped by projection schema).
- [x] `pnpm --filter @openspecui/core exec tsc --noEmit` green.

## CP2 — Projection and Web surface (implementation)

- [x] Slice 3 projection preserves `missingPrerequisites`/`warnings` (structural pass-through; server
      service/router zero production change); Change Detail renders warnings on the direct plane
      (`change-view.tsx` + `apply-progress-notice.tsx` owners locked); focused tests green (web 29, server
      12 + router case); red recorded (three TestingLibrary failures).

## CP3 — Registry, staleness, fixtures (implementation)

- [x] Slice 4 registry series `'1.13'` (provenance union retains `'1.12'`), pinned generator `1.13.0`;
      staleness rotation red recorded (2 assertions); focused registry/state tests green (78/78, 8/8, 9/9,
      tool-subscription agent assertions green).
- [x] Slice 5 pin guard `EXPECTED_COMMIT` rotated; `upstream-contract-regression` commit pin rotated (7/7);
      `openspec-cli-113` alias installed with lockfile-diff (+23 lines) + installed-shim evidence (1.13.0).
- [x] **Complete v13 positive fixture matrix green** — 9 suites, joint gate 13 files / 76 tests, every file
      `--version`-provenance-asserted; v12 boundary suite retained (1.12.0 below-admitted, 2/2); retired v12
      positive suites deleted with retirement proof; mutation red (bins-map → 112) recorded.

## CP4 — Cross-package alignment (implementation)

- [x] Slice 6 four owner-class groups green (web compat 134/134 combined, server router 107/107 +
      change-diff 9/9 + findings 4/4 + cold-start 1/1 + tool-subscription 5/5, web evidence 47/47,
      cli/scripts constant-following); red recorded per group. Integrator rotated the
      `w2-project-binding-playwright.ts` pin escalation.

## CP5 — Release preparation (delivery)

- [ ] Slice 7 Changeset (major), README law updates, AGENTS.md architecture decision.
- [ ] Full local gates (`format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`) or the justified
      scoped subset recorded in PR notes.
- [ ] PR opened from the branch; CI green; Codex final review disposition recorded.
- [ ] Owner acceptance: final end-to-end browser walkthrough (Owner-only).
- [ ] Archive change, merge, release — Owner decision.
- [ ] GitHub issues surveyed and handled with objective links after delivery.
