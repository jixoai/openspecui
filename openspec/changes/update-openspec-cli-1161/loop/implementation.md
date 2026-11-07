<!--
Orthogonal intents (created 2026-11-07 Asia/Shanghai):
1. Keep implementation reality synchronized with the plan.
2. Record the evidence that was corrected mid-flight, not just the final numbers.

Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

## Implementation Log

### 2026-11-07 — S1 identity rotation

Alias `openspec-cli-116` → `1.16.1`; `PINNED_OPENSPEC_V16_VERSIONS = ['1.16.1']`;
`PINNED_AGENT_GENERATOR_VERSION = '1.16.1'`; 16 positive fixture files, the server cold-start samples,
the web playwright expectation, `upstream-contract-regression`'s `EXPECTED_COMMIT`
(`0fa4a9705c20ef1c571fe3ded74435733e4b73a1`), `prepare-openspec-reference`'s pin and the reference
comment all rotate together. `references/openspec` gitlink records `0fa4a970`.

**A live correction, kept in the record**: the first "our repository stays clean under 1.16.1" check was
invalid. `prepare-openspec-reference.mjs` resets the submodule to its own `EXPECTED_COMMIT`, so the build
that check ran was still 1.16.0. Rotating that constant first, re-checking out `v1.16.1` and rebuilding
produced a binary whose `--version` is 1.16.1, and the re-run is the one that counts: `validate --specs`
20 passed / 0 failed, `validate --all` 21 passed / 0 failed.

Rotation was applied by classified rule rather than blanket replace, because the files mix two kinds of
`1.16.0`:

- **rotate** — pinned identity, generator baseline, fixture frontmatter (`generatedBy: 1.16.0`), and
  admitted-version samples used as data;
- **keep** — window strings (`>=1.16.0 <1.17.0`), prerelease examples (`1.16.0-beta.1`), and comments
  that record history.

Three failures surfaced and were each a real classification signal, not noise: the boundary fixture
still asked the helper for a version key that no longer existed, the schemas-root fixture fed an
undefined argv for the same reason, and `tool-init-state`'s OpenCode equivalence test asserted
`generatedByVersion: '1.16.0'` as _current_ — which is exactly what the baseline rotation changes.

### 2026-11-07 — S2 verdict proofs

Two new executable fixtures:

- `official-cli-v16-unrecognized-delta-section-fixtures.test.ts` — a requirement under
  `## Add Requirements` is an `ERROR` and `--strict` fails; the same block under `## Notes` stays a
  `WARNING` with the item valid; `archive` refuses the near-miss shape (naming requirement and section)
  and leaves the change active; and the retained 1.15.0 binary reports no `ERROR` of that class.
- `official-cli-v16-parser-acceptance-fixtures.test.ts` — `## Requirements ##` and
  `### Requirement: Foo ###` are accepted with the name normalized to `Foo`; an HTML-commented
  requirement is not reported while its uncommented twin still is.

Both fixtures first failed for instructive reasons while being written, and the reasons are the proof
they are not vacuous: a delta containing _only_ a prose section has no delta at all (so validation fails
for an unrelated reason), which is why each fixture carries a real `## ADDED Requirements` section beside
the near-miss block. Full core suite after S1/S2: **96 files / 908 tests green**.
