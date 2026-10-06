<!--
Orthogonal intents (created 2026-10-06 Asia/Shanghai):
1. Convert the verified 1.14.1 patch delta into ordered implementation slices with owners and evidence.
2. Keep every slice red/green case executable against a named fixed point.
3. Record the serial pin-rotation barrier and the consumer-literal sweep.

Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
-->

# OpenSpec CLI 1.14.1 patch research plan

Evidence source: `references/openspec-1.14.1-report.md` (pinned `v1.14.1` @ `87c3595`). Upstream
references below are verbatim from `references/openspec` at the pin: `src/core/archive.ts`
(`ba0f508`), `src/core/templates/workflows/apply-change.ts` + `src/commands/workflow/instructions.ts`
(`7056a58`, `7358306`), `src/core/validation/validator.ts` (`760584b`), and the lazy-load shuffle
(`bfa670e`, `src/commands/*.ts`).

## Research Findings

- The patch adds no command, flag, or capability (`src/index.ts` byte-identical, verified empty
  diff); zero commits touch `src/core/command-generation`, skill generation, or legacy cleanup, so
  the Agent registry and its `'1.14'` series snapshot are untouched. The admission window,
  `deriveOpenSpecCliCapabilities`, and series-aware staleness already cover 1.14.1. Zero window
  work.
- The only JSON-surface change is a new diagnostic **code value** (`archive_retirement_cleanup_failed`,
  P1). `CliDiagnosticSchema` types `code` as an open `z.string()` with `.passthrough()`, so the
  value decodes and renders verbatim today; forcing a retirement-cleanup failure requires
  filesystem fault injection (upstream proves it via a test-only `fs.rm` denial), so the fact is
  report-documented, not fixture-pinned. No production change.
- The apply `all_done` semantics (P2) and the overlength WARNING escalation (P3) are
  behavior-level changes inside unchanged shapes. Executed-CLI evidence (1.14.1 executable,
  change-scope): `instruction` reads "All tracked tasks are complete.\nReview or verify the change
  as appropriate before archiving." with the retired `ready to be archived` phrasing absent from
  the whole payload; `validate <change> --json` exits 0 with a `WARNING`-level `>500 characters`
  issue and `--strict` exits 1 failing the same item. Both become pinned fixture cases.
- The optional `## Workflow follow-up` template section uses plain bullets (not checkbox task
  lines), so the local task reading and `toggleMarkdownTask` (checkbox markers only) are
  unaffected — proven by the task-reading fixtures staying green with zero changes.

## Slices

### Slice 1 — Pin rotation (serial barrier; everything else waits on it)

Owner: main agent. Red first: bump the npm alias to `1.14.1`, reinstall, run
`official-cli-v14-version-report-fixtures.test.ts` against the stale `['1.14.0']` constant —
the identity assertion at `expectPinnedVersion` must fail. Then rotate:

- `packages/core/package.json` alias `openspec-cli-114` -> `@fission-ai/openspec@1.14.1` +
  lockfile regeneration.
- `packages/core/src/__tests__/official-cli-v14-fixtures.ts`:
  `PINNED_OPENSPEC_V14_VERSIONS = ['1.14.1']` + bins-map key + header intent lines.
- `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` -> `87c3595…` + header incident note.
- `packages/core/src/upstream-contract-regression.test.ts` pin assertion -> `87c3595…`.
- `packages/server/src/root-context-cold-start.integration.test.ts`
  `PINNED_OPENSPEC_COMMIT` + observed `cli.version` expectations -> `1.14.1`.
- `packages/web/scripts/w2-project-binding-playwright.ts` `PINNED_OPENSPEC_COMMIT` +
  `--version` assertion -> `1.14.1`.
- `references/openspec` gitlink -> `v1.14.1` (repairs the `06dec8b9` regression).
- `CLAUDE.md` session pointer -> newest report first.
- Consumer-literal sweep: `official-cli-v13-boundary-fixtures.test.ts` (three `'1.14.0'`
  admitted-line literals; retired line stays `1.13.2`) and
  `opsx-kernel-schemas-root.fixtures.test.ts` (local `PINNED_BINS` key — the 1131 header
  documents this exact stale-key crash class).
- Gate: full pinned fixture matrix green with zero assertion relaxations
  (`official-cli-v14-*.test.ts`, the boundary suite, the schemas-root suite, the regression
  suite — 15 files / 47 tests at this point).

### Slice 2 — New fixture proofs (parallelizable after Slice 1)

Owner: main agent.

- P2 case in `official-cli-v14-apply-readiness-fixtures.test.ts`: all-done tracked change ->
  `state: 'all_done'`, `progress {2,2,0}`, `instruction` contains the completion + review wording,
  and the retired `ready to be archived` phrasing absent from the serialized payload.
- P3 case + `createOverlengthChange` helper in
  `official-cli-v14-validation-full-fixtures.test.ts`: >500-char ADDED requirement ->
  non-strict change-scope JSON exit 0 with a `WARNING` `cap-overlength/spec.md` issue;
  `--strict` exit 1 with `{items:1, passed:0, failed:1}`.
- Gate: both files green (16 files / 49 tests total).

### Slice 3 — Evidence docs + specs (parallelizable after Slice 1)

Owner: main agent.

- `references/openspec-1.14.1-report.md` (format mirrors the 1.13.2 report).
- Spec delta `specs/opsx-workflow-ui/spec.md`: MODIFIED "Pinned Workflow Fixtures Are Executable"
  (positive line 1.14.0 -> 1.14.1; retired boundary stays 1.13.2) + ADDED
  "Apply Completion Archive-Separation Fixture Proof" and "Overlength Requirement
  Strict-Escalation Fixture Proof" (split after the first draft tripped 1.14.1's own
  overlength WARNING — the advisory's advice followed verbatim).
- `AGENTS.md`: 2026-10-06 architecture decision paragraph + live-pin line + historical pins list.
- Gate: `openspec validate update-openspec-cli-1141` green; format/lint pass on touched files.

### Slice 4 — Broad gates + Codex review + delivery

- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`
  in the worktree (worktree self-install per repo layout; no rebase expected before first PR).
- Codex (remix) review of the change documents + the full diff; fold blockers and re-verify.
- PR from `target/openspec-cli-1141-patch`; `pr-quality.yml` runs
  `prepare-openspec-reference.mjs`, which validates the repaired gitlink against the rotated
  `EXPECTED_COMMIT` on CI for the first time since the regression.
