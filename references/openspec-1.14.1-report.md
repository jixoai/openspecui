<!--
Orthogonal intents (created 2026-10-06 Asia/Shanghai):
1. Record the verified OpenSpec 1.14.1 patch delta for the OpenSpecUI 14 line.
2. Separate CLI-owned patch behavior from OpenSpecUI projection obligations.
3. Map each observable change to a production owner, regression case, and release gate.
4. Record the gitlink regression this rotation repairs (release commit 06dec8b9).

Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
-->

# OpenSpec CLI 1.14.0 -> 1.14.1 patch adaptation report

## Decision

```text
OpenSpecUI 14 (unchanged line)
  adapted / supported      OpenSpec CLI >=1.14.0 <1.15.0
  current / recommended    OpenSpec CLI >=1.14.0 <1.15.0
  rejected                 <1.14.0, prereleases, >=1.15.0, unparseable
  pinned fixture           openspec-cli-114 rotates 1.14.0 -> 1.14.1
```

1.14.1 is an **in-window patch release**: no new command, no new flag, no
capability-enum change (`git diff v1.14.0..v1.14.1 -- src/index.ts` is empty;
zero commits touch it). The v14 admission window, `deriveOpenSpecCliCapabilities`,
the Agent registry series (`'1.14'`), and the generator staleness baseline
(`1.14.0`, series-aware) therefore **do not move**. First in-window pinned-patch
rotation of the v14 line; delivered inside OpenSpecUI 14.x, not a new major.

Recorded incident repaired by this rotation: the 2026-10-02 release commit
`06dec8b9` (`chore(release): apply changeset version`) accidentally reverted the
`references/openspec` gitlink from v1.14.0 (`94ca9c1e`) back to v1.13.0
(`9d4e5974`). No PR has opened since (the pin guards run in `pr-quality.yml`),
so the drift never fired. This rotation re-pins the gitlink to v1.14.1 and the
PR-time guards (`scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` +
`upstream-contract-regression.test.ts`) prove the restored consistency.

Vetoable in review: shipping without a changeset. This rotation touches zero
production package code (test constants, fixture matrix, CI prepare script,
reference docs only), so the docs/CI-only changeset exception applies; a patch
bump would publish packages with no behavioral delta.

## Evidence baseline

```text
Observed                 2026-10-06 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.14.1
Pinned commit            87c3595ace6a2e22957f39ebe5b74c2f2316e0cb
Previous pin             v1.14.0 / 94ca9c1eb15d1b49c06c988419b75c3d95f8b2b5
Upstream delta           13 commits, src +2015/-1830 across 25 files (mostly the lazy-load shuffle)
```

Sources inspected: the full `v1.14.0..v1.14.1` source diff of `references/openspec`
(every contract-relevant commit read against `src/`), the upstream `CHANGELOG.md`
1.14.1 section, and executed-CLI evidence against the installed
`openspec-cli-114` 1.14.1 executable (init/apply/validate/version families).

## Patch delta by contract relevance

### P1. Archive diagnostics gain the `archive_retirement_cleanup_failed` code (evidence-only; no shape change)

Commit `ba0f508` (#1792, `src/core/archive.ts`): when a change is archived but a
capability-retirement cleanup step fails, the JSON diagnostic now reports
`code: "archive_retirement_cleanup_failed"` (severity `error`, with a preserve-
content `fix` string) instead of the generic `archive_error`, and the message
says the change **was archived** while cleanup did not complete — the old text
incorrectly claimed every backup was kept. `RetirementBackupsRetainedError` was
renamed `RetirementCleanupError`; the finalize-failure message text changed
("Could not finalize the retirement backup …").

OpenSpecUI position: `CliDiagnosticSchema` (`packages/core/src/cli-contracts/common.ts`)
types `code` as an open `z.string()` with `.passthrough()`, so the new value
decodes unchanged and renders verbatim wherever archive diagnostics already
flow. **No production change.** Forcing a retirement-cleanup failure requires
filesystem fault injection (upstream itself proves it through a test-only
`fs.rm` denial), so this fact stays report-documented rather than fixture-pinned.

### P2. Apply separates tracked-task completion from archive readiness (semantics inside unchanged shapes; must fixture-prove)

Commits `7056a58` (#1791) plus the apply part of `7358306` (#2047 changeset),
across `src/core/templates/workflows/apply-change.ts`, `continue-change.ts`,
`src/commands/workflow/instructions.ts`:

- `state: "all_done"` keeps its value and the state chain is unchanged
  (`all_done` still requires every tracked task done and every matched tracking
  file readable).
- The `all_done` `instruction` no longer declares archive readiness. Executed
  1.14.1 evidence: `"All tracked tasks are complete.\nReview or verify the
change as appropriate before archiving."` — the retired 1.14.0 phrasing
  `ready to be archived` appears nowhere in the payload (upstream's own
  regression test asserts the same absence on stdout).
- The tasks template may now end with an optional `## Workflow follow-up`
  section of **plain bullets** for steps that can only happen after archive;
  those steps no longer block task completion. Plain bullets are not checkbox
  task lines, so OpenSpecUI's local task reading and `toggleMarkdownTask`
  (which parse checkbox markers only) are unaffected — verified by the
  task-reading fixture matrix staying green with zero assertion changes.

OpenSpecUI position: the Change Detail projects apply state/progress from the
typed contract; guidance text renders verbatim. No projection change. New
pinned fixture: `separates tracked-task completion from archive readiness on
the all_done state` (`official-cli-v14-apply-readiness-fixtures.test.ts`).

### P3. Overlength requirements become strict-failing WARNINGs (severity upgrade inside unchanged shapes; must fixture-prove)

Commit `760584b` (#2020, `src/core/validation/validator.ts` + specs
instruction): a requirement description over 500 characters is now a WARNING
(previously an informational hint), so `openspec validate --strict` fails on
it — including ADDED requirements inside a change (`validate <change>
--strict`), caught before archive. Non-strict validation and archive still
pass when this is the only finding. Executed 1.14.1 evidence (change scope,
JSON, from the ad-hoc smoke project whose capability folder was named
`cap-over`): non-strict exits 0 with `level: "WARNING"`, `path:
"cap-over/spec.md"`, message containing `Requirement text is very long
(>500 characters)`; `--strict` exits 1 with the same item failing. The pinned
fixture below repeats the proof on a capability folder deliberately named
`cap-overlength` — both paths are fixture-local names, not contract facts.

OpenSpecUI position: `CliValidateFindingsSchema` / `CliValidateReportSchema`
already type severity as level enums and render messages verbatim; the
findings transport is filtered evidence and never the validation truth
source (v12 law). No production change. New pinned fixture: `flags an
overlength ADDED requirement as a WARNING that only strict validation fails`
(`official-cli-v14-validation-full-fixtures.test.ts`).

### P4. Behavior fixes observable through existing envelopes or delivered content (no shape change)

- `2500d6d` (#2031): `openspec view` (upstream TUI dashboard) no longer lists
  or counts archived changes; `list --archived` still serves them on request.
  OpenSpecUI renders its own projections and never consumes `view` output —
  no obligation.
- `852a073` (#2037): the specs instruction writes each capability's spec file
  as soon as it is drafted (announcing each first) instead of planning all
  files before writing any; `continue` now checks for proposal capabilities
  that still have no spec file. Delivered-workflow-template content is
  CLI-owned; OpenSpecUI never re-derives it.
- `43d23cc` (#2028): the verify workflow finds spec/design artifacts by output
  path (`specs/`, `design.md`) instead of hardcoded artifact ids, so custom
  schemas work. Template text only.
- `69cf0a9` (#2039), `112fea5`/`0654cfb` (deps): upstream test and dependency
  hygiene; no CLI surface.

### P5. CLI startup lazy-loads command implementations (performance; surface byte-stability asserted)

Commit `bfa670e` (#2025, large `src/commands/*.ts` shuffle — e.g.
`schema.ts` +1559 lines of moved implementations): each command module loads
only when the command runs (`--version`/`--help` load 24 modules instead of
485). Upstream states output, help text, shell completions, exit codes, and
telemetry are unchanged. OpenSpecUI proof: the entire pinned fixture matrix
(16 files / 49 tests after this rotation) executes the 1.14.1 executable
through `bin/openspec.js` with identity assertions, JSON-stream discipline
assertions, and exit-code contracts — all green with zero assertion changes
beyond the two intentional new cases (P2/P3). The worker-mode import path
(`bin` entry) is unchanged.

### P6. Confirmed non-obligations

- No new command/flag/capability (see Decision); `src/index.ts` byte-identical.
- Zero commits under `src/core/command-generation`, `skill-generation`, or
  `legacy-cleanup`: the Agent registry, its `'1.14'` series snapshot, and
  every physical delivery fact are untouched.
- Generator staleness stays on the `1.14.0` baseline (series-aware); a patch
  release inside the series does not rotate it
  (`tool-init-state.test.ts` `generatedByVersion`/`generatorVersion`
  literals stay `1.14.0` by design).
- The compat gate (`>=1.14.0 <1.15.0`) already admits 1.14.1; no
  `openspec-compat.ts` change.
- Upstream website/CI/changeset commits are upstream-internal.

## Current owner map

| Surface                 | Primary production owner                                                                                                                                                                                                                           | v1.14.1 obligation                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| pinned fixture          | `packages/core/package.json` (`openspec-cli-114` npm alias), `packages/core/src/__tests__/official-cli-v14-fixtures.ts`                                                                                                                            | rotate alias + `PINNED_OPENSPEC_V14_VERSIONS` + bins map to `1.14.1`; regenerate lockfile; re-run matrix              |
| pin guards              | `scripts/prepare-openspec-reference.mjs` (`EXPECTED_COMMIT`), `packages/core/src/upstream-contract-regression.test.ts`, `packages/server/src/root-context-cold-start.integration.test.ts`, `packages/web/scripts/w2-project-binding-playwright.ts` | rotate every commit constant and version assertion to `87c3595` / `1.14.1`; repairs the `06dec8b9` gitlink regression |
| consumer literals       | `packages/core/src/official-cli-v13-boundary-fixtures.test.ts`, `packages/core/src/opsx-kernel-schemas-root.fixtures.test.ts` (local `PINNED_BINS`)                                                                                                | rotate admitted-line literals; retired boundary executable stays 1.13.2                                               |
| apply readiness fixture | `packages/core/src/official-cli-v14-apply-readiness-fixtures.test.ts`                                                                                                                                                                              | new all_done completion/archive-separation case (P2)                                                                  |
| validation fixture      | `packages/core/src/official-cli-v14-validation-full-fixtures.test.ts`                                                                                                                                                                              | new overlength WARNING strict-escalation case (P3)                                                                    |
| archive diagnostics     | `packages/core/src/cli-contracts/common.ts`                                                                                                                                                                                                        | none (open `code: z.string()`; P1 documented here)                                                                    |
| compat window           | `packages/core/src/openspec-compat.ts`                                                                                                                                                                                                             | none (`>=1.14.0 <1.15.0` already admits 1.14.1)                                                                       |
| evidence docs           | `references/openspec-1.14.1-report.md`, `CLAUDE.md` session pointer, `AGENTS.md` pin line + architecture decision                                                                                                                                  | record the new pin                                                                                                    |

## Release gate

- Pinned fixture matrix green against the 1.14.1 executable: 16 files / 49
  tests including the two new cases; zero assertion relaxations (red recorded
  first: the stale `1.14.0` identity assertion failed at `expectPinnedVersion`
  before the constant rotation).
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci`.
- `.changeset/update-openspec-cli-1141.md` patches the four version-locked packages
  (Codex Round-A fold: `changeset-check.mjs` classifies the touched `packages/` paths as
  release-affecting and both prior in-window rotations shipped changesets). README version
  tables stay window-scoped; no runtime text names `1.14.0` as the pinned executable
  (verified by sweep; generator staleness literals are baseline constants, not executable
  pins).
- Owner final browser walkthrough boundary unchanged (2026-07-20 law); this
  rotation has no UI change, so no additional agent E2E walkthrough is
  required beyond the existing browser suites.
