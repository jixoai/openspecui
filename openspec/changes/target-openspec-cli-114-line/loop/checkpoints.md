<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Define acceptance checkpoints and their evidence for OpenSpecUI 14.
2. Keep every checkpoint falsifiable against a named command or artifact.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 checkpoints

## CP0 — Planning

- [x] Worktree + submodule pin `94ca9c1e` + evidence report + change artifacts.
- [x] Codex change review: five rounds 6.2 → 7.4 → 7.8 → 8.1 → **9.1/10 GO** (blockers B1-B7, B1-B4, C1-C2,
      and the lost-write catch all folded; reports /tmp/v14-change-review-round-{a..e}.md).
- [x] CP0 committed (7e218935 + review-fold commits through bc633fb9).

## CP1 — Window and contracts (Slices 1-2)

- [x] Compat window rotated; boundary red recorded (stable 1.13.x → unsupported); mirrors + tests green.
- [x] Apply-task source locations, status warnings (through the kernel `projectWorkflowStatus` rebuild on
      single AND batch paths — decode passthrough is stripped there today), the new list `archived` member,
      show spec names, and the version envelope typed through contract + projection chains; kernel-rebuild
      red recorded verbatim-end-to-end; focused suites green; core typecheck.

## CP2 — Registry (Slice 3)

- [x] +10 registry entries, kilo root, IBM Bob label, series `'1.14'`, generator `1.14.0`; staleness red
      recorded; registry/state/server suites green. Integrator widened
      `SHARED_AGENTS_SKILLS_OWNER_CANDIDATES` to the five upstream 1.14 writers
      (codex/zed/agents/amp/gsd; antigravity stays commands-only) — see implementation.md Batch A.

## CP3 — Web + fixtures (Slices 4-5)

- [x] Status warnings direct-plane summary row; web focused tests green.
- [x] Pin guards rotated; `openspec-cli-114` alias with lockfile+shim evidence; full v14 positive matrix —
      11 migrated suites + `v14-version-report` + `v14-change-list-inventory` (13 files) — green with
      `--version` provenance; the 1.13.2 boundary suite proves the just-retired line rejected (identity +
      unsupported classification + 1.14-only members absent; v12 boundary suite and v12 helper retired with
      proof while the `openspec-cli-112` alias stays for its two historical consumers); store edit-roots
      both branches asserted executably; mutation red recorded.

## CP4 — Alignment (Slice 6)

- [x] Four owner groups red/green recorded (constant-follow noted where applicable; production untouched).

## CP5 — Delivery

- [x] Changeset major; README law (repo en/zh + CLI package); CLAUDE.md pointer; AGENTS.md decision.
- [x] Full gates (format/lint/typecheck/browser + explicit per-package tests); pre-existing flakes disclosed
      (xterm storybook Pixi flake isolated-rerun clean, full browser gate green on re-run).
- [x] PR opened (#297); CI green; Codex final review disposition recorded — Round-F 7.8 REVISE →
      F-B1/F-B2/F-B3 fixed with mutation red evidence → Round-G 9.2/10 APPROVE (all three closed).
- [ ] Owner acceptance walkthrough (Owner-only).
- [ ] Archive/release — Owner decision.
- [ ] GitHub issues handled with objective links.
