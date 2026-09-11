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

- [ ] Slice 1 constants rotated; `openspec-compat.test.ts` green; boundary red recorded (1.12.x → unsupported).
- [ ] Slice 2 Apply Instructions schema extended; contract tests green with the executed 1.13 payloads.
- [ ] `pnpm --filter @openspecui/core typecheck` green.

## CP2 — Projection and Web surface (implementation)

- [ ] Slice 3 projection preserves `missingPrerequisites`/`warnings`; Change Detail renders warnings on the
      direct plane; focused component test green; red recorded.

## CP3 — Registry, staleness, fixtures (implementation)

- [ ] Slice 4 registry series `'1.13'`, pinned generator `1.13.0`; staleness rotation red recorded; focused
      registry/state tests green.
- [ ] Slice 5 pin guard `EXPECTED_COMMIT` rotated; `upstream-contract-regression` commit pin rotated;
      `openspec-cli-113` alias installed with lockfile-diff + installed-shim evidence.
- [ ] **Complete v13 positive fixture matrix green** (workflow, default-store, nested-spec, show-diff,
      validation-full, validation-findings, batch-status, agent-delivery, apply-readiness) on the real 1.13.0
      executable with `--version` provenance; v12 boundary negatives retained; retired v12 positive suites
      deleted with their counterparts; mutation red (bins-map → 112 alias) recorded.

## CP4 — Cross-package alignment (implementation)

- [ ] Slice 6 named focused test files green across web/server/cli/scripts; red recorded.

## CP5 — Release preparation (delivery)

- [ ] Slice 7 Changeset (major), README law updates, AGENTS.md architecture decision.
- [ ] Full local gates (`format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`) or the justified
      scoped subset recorded in PR notes.
- [ ] PR opened from the branch; CI green; Codex final review disposition recorded.
- [ ] Owner acceptance: final end-to-end browser walkthrough (Owner-only).
- [ ] Archive change, merge, release — Owner decision.
- [ ] GitHub issues surveyed and handled with objective links after delivery.
