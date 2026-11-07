<!--
Orthogonal intents (created 2026-11-07 Asia/Shanghai):
1. One falsifiable checkpoint per slice.
2. Every "rotated" claim tied to a mechanical grep, not to prose.
3. Falsifiers name the deliberate keeps, so "zero hits" cannot be satisfied by deleting history.

Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按标准工作流跟进上线。"
-->

# Checkpoints — update-openspec-cli-1161

## CP1 — Identity

- [x] Alias, fixture helper, generator baseline, contract-regression commit, web playwright expectation,
      both server literals and the cold-start commit constant all say `1.16.1` / `0fa4a970`;
      `openspec-cli-116 --version` prints `1.16.1`.
- [x] `rg -n '1\.16\.0' packages/*/src scripts packages/web/scripts` returns 63 hits in 26 files, and
      every hit is a deliberate keep of one of these kinds: - window/floor facts — `openspec-compat.ts` minimums and the `>=1.16.0 <1.17.0` ranges; - in-window parse samples and prerelease/next-series examples in `openspec-compat.test.ts`; - historical provenance sentences (2026-11-04 and earlier) and the v1.16.0 hash inside the pin-guard
      history; - captured decode payload versions in web/server fixtures — executable evidence, not admission facts; - the retained 1.15.0 boundary fixture's own samples.
      No hit states the current pin. The four present-tense comments that did (batch fixture line, findings
      fixture line, Status-warnings fake, generator-version assertion) were rotated to 1.16.1, and the
      pin-guard test title names v1.16.1.
- [x] Worktree gitlink at `0fa4a970…`; `git submodule status` has no `+`.
- [x] `OPENSPEC_CLI_MIN_VERSION` / `TARGET_MIN` / `RECOMMENDED_MIN` still `1.16.0` (reverted in
      `26528288`): raising them is a gate change, not a patch rotation.

## CP2 — Verdict proofs

- [x] Unrecognized delta-section header → `ERROR` on 1.16.1; **plain** validation exits 1 with the item
      invalid, and `--strict` fails too.
- [x] Prose section → `WARNING` on 1.16.1 with a zero exit and a valid item.
- [x] `archive --json --yes` refuses with `archive: null` plus an `error` status coded
      `archive_validation_failed` whose `fix` points at `validate`, and the change stays active.
- [x] Retained 1.15.0 alias reports the same orphan as a `WARNING` and keeps the item valid — no ERROR,
      and no silence either.
- [x] `## Requirements ##` / `## ADDED Requirements ##` accepted on 1.16.1 (delta applies on archive:
      `specsUpdated: true`, `totals.added: 1`, requirement present in the main spec), and rejected on
      1.15.0 (no Requirements section / no delta sections).
- [x] HTML-commented requirement not reported on 1.16.1, uncommented twin still reported, and the
      commented draft **is** reported on 1.15.0.

## CP3 — Truth surfaces

- [x] Spec deltas cover three capabilities: pinned-fixture requirement states 1.16.1, two proof
      requirements, the config-center inventory baseline, and the generator-baseline requirement in
      `projection-contract-truth`; every MODIFIED block carries its living scenarios verbatim.
- [x] `AGENTS.md` live pin + 2026-11-07 decision line; `references/openspec-1.16.1-report.md` in place.
- [x] Changeset: `@openspecui/core` patch + `openspecui` patch.

## CP4 — Delivery

- [x] Focused matrix green: the two new fixtures (7 tests, including every 1.15.0 negative control).
- [ ] Full gates; review round folded; PR green; `mergedAt` verified; archive PR merged.
- [ ] Release 16.1.1 with the four independent facts and the gitlink verified unchanged.
