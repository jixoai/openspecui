<!--
Orthogonal intents (created 2026-11-07 Asia/Shanghai):
1. One falsifiable checkpoint per slice.
2. Every "rotated" claim tied to a mechanical grep, not to prose.

Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按标准工作流跟进上线。"
-->

# Checkpoints — update-openspec-cli-1161

## CP1 — Identity

- [ ] Alias, fixture helper, generator baseline, contract-regression commit, web playwright expectation
      and the two server literals all say `1.16.1`; `openspec-cli-116 --version` prints `1.16.1`.
- [ ] `rg '1\.16\.0' packages/*/src scripts packages/web/scripts` returns zero (comments recording
      history are allowed only where they name a past pin deliberately, and are listed in the report).
- [ ] Worktree gitlink at `0fa4a970…`; `git submodule status` has no `+`.

## CP2 — Verdict proofs

- [ ] Unrecognized delta-section header → `ERROR` on 1.16.1; `--strict` fails.
- [ ] Prose section → `WARNING` on 1.16.1; plain validation valid.
- [ ] `archive` refuses the unrecognized-header shape, naming requirement and section.
- [ ] Retained 1.15.0 alias does **not** produce the ERROR for the same shape (absence proven).
- [ ] Closing-`#` headings accepted; HTML-commented requirement not reported; uncommented twin reported.

## CP3 — Truth surfaces

- [ ] Spec delta: pinned-fixture requirement states 1.16.1; two new proof requirements present.
- [ ] `AGENTS.md` live pin + 2026-11-07 decision line; `references/openspec-1.16.1-report.md` in place.
- [ ] Changeset: `@openspecui/core` patch + `openspecui` patch.

## CP4 — Delivery

- [ ] Focused matrix green (all `official-cli-v16-*` + boundary + the two new fixtures).
- [ ] Full gates; review round folded; PR green; `mergedAt` verified; archive PR merged.
- [ ] Release 16.1.1 with the four independent facts and the gitlink verified unchanged.
