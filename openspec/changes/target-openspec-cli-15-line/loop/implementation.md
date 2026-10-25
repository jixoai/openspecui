<!--
Orthogonal intents (created 2026-10-25 Asia/Shanghai):
1. Implementation log for the OpenSpecUI 15 line.

Original request (2026-10-25): "开工"
-->

# OpenSpecUI 15 implementation log

## 2026-10-25 — Planning baseline (CP0)

- Deep investigation completed by the research channel (14-item sweep, real-binary verification);
  key conclusions: one hard contract break (install.scope 'standalone'), command surface grows
  (update --dry-run/--json, install), zero changes to list/show/validate/status/instructions
  codecs, agent-contract.md unchanged, no upstream spec deltas.
- Report + intake written; awaiting Round-A dual-channel review.

## 2026-10-25 — Round-A/B review cycle

- Round-A dual-channel: Codex 7/10 (baseline/focused-review-order/scope-unit-regression P1s) +
  research 5/10 (2 P0s: the agent-registry/generator-staleness production line missing from
  owner map/slices/spec deltas; ADDED-only spec deltas that would contradict live specs after
  archive; 5 P1s incl. missed compat constants, the 14th helper consumer, mirror scripts,
  README-zh/archive copies). All folded: c0fa0963 + 32063495.
- Round-B: report owner map lagged the registry fold → fixed 1640b57f → APPROVED 9/10.

## 2026-10-25 — Slice 4 (cross-package alignment + guards + docs + changeset)

- CP1 observation recorded before edits: upstream-contract-regression red (pin `c794978f` vs
  submodule `8e0288df`); change-diff-evidence-service 6 red (1.14.0 sample no longer admitted);
  cli-validate-findings-router 4 red (samples + `>=1.14.0 <1.15.0` range literal). Extra
  observation: opsx-kernel-status-warnings + planning-cli-projection-service were green only
  because their fakes' 1.14.0 sessions silently fell back to the serial transport (the
  "helpful green" trap) — fake session versions rotated to 1.15.0 so the batch transport is
  genuinely exercised again.
- Admitted-session samples rotated to 1.15.0 across 14 test files (core 4, server 5, web 5);
  the kernel capability-transport fixture pair follows the d0af507a precedent (admitted 1.15.0 /
  retired 1.14.0); capability expectations restored (capabilities114→115, first below-window
  refusal 113→114); cli-health-gate boundary reworked semantically (admitted 1.15.x, retired
  1.13/1.14 window, prerelease 1.15.0-rc.1, next-series block 1.16.0+). One escaped literal
  (`1.14.1` in the diff-evidence Store-selector test) caught by the post-rotation rerun.
- Pin guards → `8e0288df` / 1.15.0: prepare script, upstream-contract-regression,
  root-context-cold-start, and the w2 playwright guard (content grep found it — file name
  carries no version). tool-subscription-router:684 now derives `@${OPENSPEC_CLI_TARGET_SERIES}`.
- Full literal audit: every remaining `1.14.x`/`c794978f` hit classified as boundary-retained
  (v14 helper + boundary suite, retired-line rejection assertions, refused-session samples) or
  historical provenance (executed-payload captures, rotation history, feature-line naming).
- Docs: CLAUDE.md pointer → 1.15.0 report; AGENTS.md pin line + 2026-10-25 decision paragraph;
  README.md/README-zh.md re-faced for v15 with byte-exact archives README-1.14.0.md /
  README-zh-1.14.0.md (c6a0b783 precedent); packages/cli/README.md re-scoped to v15;
  settings.tsx comment-only rotation. "Clean-build law" resolved to the existing AGENTS.md
  Static/SSG guardrail (unchanged; anchored in the decision paragraph) — no new law drafted.
- Changeset: major x4 (fixed-group propagation per config). Gates: official-cli-v15 matrix +
  pin regression 54 green; boundary + rotated core suites 185 green; server rotated suites 187
  green; web rotated suites 75 green; core/server/web typechecks green; prettier clean on the
  explicit file set (one Slice-3 residue formatting fix folded into the set, noted).
- Round-C correction (2026-10-25, Codex P1-2 upheld): the standalone update guidance
  "`openspec install` / `openspec update`" was wrong — upstream `src/core/version-check.ts`
  `standaloneUpgradeCommand()` returns `openspec install` (reinstalls the standalone binary in
  place), while `openspec update` remains the project instruction-file updater whose self-upgrade
  offers are package-manager commands. Corrected README.md, README-zh.md, the changeset, and the
  AGENTS.md decision paragraph (the research-plan line keeps its original wording as planning
  history; this record is the correction of authority).
