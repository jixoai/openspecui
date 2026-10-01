<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Define acceptance checkpoints and their evidence for OpenSpecUI 14.
2. Keep every checkpoint falsifiable against a named command or artifact.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 checkpoints

## CP0 — Planning

- [x] Worktree + submodule pin `94ca9c1e` + evidence report + change artifacts.
- [ ] Codex change review: no blocking findings (≥8/10 target).
- [ ] CP0 committed.

## CP1 — Window and contracts (Slices 1-2)

- [ ] Compat window rotated; boundary red recorded (stable 1.13.x → unsupported); mirrors + tests green.
- [ ] Apply-task source locations, status warnings (through the kernel `projectWorkflowStatus` rebuild on
      single AND batch paths — decode passthrough is stripped there today), the new list `archived` member,
      show spec names, and the version envelope typed through contract + projection chains; kernel-rebuild
      red recorded verbatim-end-to-end; focused suites green; core typecheck.

## CP2 — Registry (Slice 3)

- [ ] +10 registry entries, kilo root, IBM Bob label, series `'1.14'`, generator `1.14.0`; staleness red
      recorded; registry/state/server suites green.

## CP3 — Web + fixtures (Slices 4-5)

- [ ] Status warnings direct-plane summary row; web focused tests green.
- [ ] Pin guards rotated; `openspec-cli-114` alias with lockfile+shim evidence; full v14 positive matrix —
      11 migrated suites + `v14-version-report` + `v14-change-list-inventory` (13 files) — green with
      `--version` provenance; 1.13.2 boundary suite proves the just-retired line rejected (v12 boundary/alias
      retired with proof); store edit-roots both branches asserted executably; mutation red recorded.

## CP4 — Alignment (Slice 6)

- [ ] Four owner groups red/green recorded.

## CP5 — Delivery

- [ ] Changeset major; README law (repo en/zh + CLI package); CLAUDE.md pointer; AGENTS.md decision.
- [ ] Full gates (format/lint/typecheck/browser + explicit per-package tests); pre-existing flakes disclosed.
- [ ] PR opened; CI green; Codex final review disposition recorded.
- [ ] Owner acceptance walkthrough (Owner-only).
- [ ] Archive/release — Owner decision.
- [ ] GitHub issues handled with objective links.
