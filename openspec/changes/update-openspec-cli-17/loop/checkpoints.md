<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. One falsifiable checkpoint per slice.
2. Every "rotated" claim tied to a mechanical sweep, with the deliberate keeps enumerated.

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

# Checkpoints — update-openspec-cli-17

## CP1 — Window and identity

- [x] `OPENSPECUI_TARGET_MAJOR = 17`; series `['1.17']`; min/target/recommended `1.17.0`; next `1.18.0`;
      ranges `>=1.17.0 <1.18.0`; tag pattern `v1.17.*`.
- [x] Alias `openspec-cli-117` = 1.17.0; `PINNED_OPENSPEC_V17_VERSIONS = ['1.17.0']`; both
      `EXPECTED_COMMIT` constants = `579fcac5…`; gitlink = `579fcac5…`; `--version` prints 1.17.0.
- [x] `classifyOpenSpecCliVersion('1.17.0')` is `current`; `'1.16.1'` is `unsupported`.

## CP2 — Agent delivery

- [x] Registry series `'1.17'`, `'1.16'` in the provenance union, `parseOpenSpecCliSeries('1.17.0')`
      returns `'1.17'`, `'1.16.1'` returns null.
- [x] Generator baseline `'1.17.0'`; staleness treats 1.17.0 artifacts as current and 1.16.x as stale
      with historical evidence.

## CP3 — Fixtures and boundary

- [x] 18 renamed `official-cli-v17-*` files green; the v16 boundary suite proves identity and the
      1.17-only behaviors absent; the reconcile fixture proves keep-and-list on 1.17.0 and deletion on
      1.16.1.
- [x] `rg '1\.16\.1' packages/*/src` returns only the enumerated boundary/provenance keeps.

## CP4 — Truth surfaces and delivery

- [x] Four living-spec deltas validate strict; READMEs and AGENTS state 1.17; changeset is major.
- [ ] Full gates green; PR merged with `mergedAt`; archive applied; release 17.0.0 with four facts and
      the gitlink unchanged.
