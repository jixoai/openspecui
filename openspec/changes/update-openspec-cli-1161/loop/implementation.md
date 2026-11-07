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
  `## Add Requirements` is an `ERROR`, so **plain** validation already exits 1 with the item invalid
  (`--strict` fails too); the same block under `## Notes` stays a `WARNING` with the item valid and a
  zero exit; `archive --json --yes` (the production transport) answers `archive: null` plus an `error`
  status coded `archive_validation_failed` whose `fix` points at `validate`, and the change stays
  active; the retained 1.15.0 binary reports the same orphan as a `WARNING` with a valid item, so the
  boundary proves a severity change rather than missing detection.
- `official-cli-v16-parser-acceptance-fixtures.test.ts` — the parser change this line actually made is
  **section**-heading closing runs: `## Requirements ##` is read as the requirements section and
  `## ADDED Requirements ##` as a delta section that applies on archive (measured: `specsUpdated: true`,
  `totals.added: 1`, and the requirement present in the main spec after archive). The orphan scan also
  started masking HTML comments, so a commented-out draft is no longer reported. Both halves carry a
  1.15.0 negative control: the boundary rejects `## Requirements ##` for having no Requirements section
  and reports no delta sections for `## ADDED Requirements ##`, and it _does_ report the commented
  draft. Requirement-name normalization (`### Requirement: Foo ###` → `Foo`) is asserted as
  carried-forward evidence — upstream only extracted `stripClosingSequence` there; it did not change.

Both fixtures first failed for instructive reasons while being written, and the reasons are the proof
they are not vacuous: a delta containing _only_ a prose section has no delta at all (so validation fails
for an unrelated reason), which is why each fixture carries a real `## ADDED Requirements` section beside
the near-miss block. Full core suite after S1/S2: **96 files / 908 tests green**.

### 2026-11-07 — S3 independent review, folded

One adversarial review round ran against the real worktree and the real upstream diff. Everything it
found was fixed in the change rather than deferred:

- **Two false spec claims.** The delta said a near-miss header keeps plain validation valid (measured:
  exit 1) and that the archive refusal names the requirement and section (measured: the typed envelope
  carries only `archive_validation_failed` + a `fix` pointer). Both statements and their scenarios now
  match measured behavior, and the fixtures assert those exact facts.
- **A living spec left false.** `projection-contract-truth` still stated the 1.16.0 generator baseline
  with no delta; a third delta file now rotates that requirement (3/3 scenarios verbatim).
- **Over-rotation in the two pin-truth files.** `upstream-contract-regression` and
  `prepare-openspec-reference` had their historical sentence rotated to "v1.16.1 (`27c05157`)" — the
  1.16.0 commit. Both now keep the historical sentence and add a new dated one for `0fa4a970`.
- **My own gate change.** An earlier edit had rotated `OPENSPEC_CLI_MIN_VERSION` and friends to 1.16.1.
  The window is unchanged (`>=1.16.0 <1.17.0`), so that would reject 1.16.0 itself; reverted in
  `26528288`. No past patch rotation ever touched that file.
- **Weaker-than-claimed evidence.** The boundary check asserted only "no ERROR", which also passes when
  nothing is detected; it now asserts the WARNING. The archive fixture ran the human path while asserting
  product behavior; it now runs `--json` and asserts the typed envelope. A missed commit constant in
  `root-context-cold-start.integration.test.ts` surfaced from the full suite and is rotated.
- **Report accuracy**: the `--all` figure is 21/0 (not 20/0); the fixture-file count is 16 pre-existing
  (not 14); `check-openspec-reference.mjs` is a series-level guard that admits any `v1.16.*`, so it never
  rejected post-tag checkouts and needed no gate change; "OpenSpecUI re-implements none of the parsing"
  was too absolute — the local mirror exists and is documented below.
