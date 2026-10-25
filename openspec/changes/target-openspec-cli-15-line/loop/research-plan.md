<!--
Orthogonal intents (created 2026-10-25 Asia/Shanghai):
1. Convert the verified 1.15.0 line delta into ordered slices with owners, evidence, and gates.

Original request (2026-10-25): "开工"
-->

# OpenSpecUI 15 research plan

Evidence: `references/openspec-1.15.0-report.md` (pin `v1.15.0` @ `8e0288df`; 13 commits,
src 28 files +1617/-344; command/registry/validation/list/show/parsers cores byte-identical).

### CP0 — Planning baseline (done)

Worktree `update-openspec-cli-15-line` off `origin/main` (`3f1c7ca7` = branch point);
submodule pinned `v1.15.0`; report + intake committed. **Planning baseline = `df541f25`** (the
planning commit on top of the branch point — Codex Round-A P1-1 fold). Review per the
upstream-rotation skill: per-slice focused review must pass BEFORE broad gates (repository
focused-review law — Codex Round-A P1-2 fold: Round-C is the implementation review and happens
after focused gates per slice but before the final broad run is treated as delivery evidence;
slice green gates are the per-slice focused review). Round-A dual-channel gates Round-B.

### Slice 1 — Window + scope contract (serial; core only)

- `packages/core/src/openspec-compat.ts`: `OPENSPEC_CLI_TARGET_SERIES='1.15'`,
  supported series `['1.15']`, min/recommended `1.15.0`, accepted range `>=1.15.0 <1.16.0`,
  next-series min `1.16.0`, reference tag pattern `v1.15.*` (exact constant names per file).
- `packages/core/src/cli-contracts/workflow.ts`: `CliVersionSchema.install.scope` enum gains
  `'standalone'` (comment: 1.15 standalone distribution; absent on older CLIs, tolerated as an
  additional legal value).
- `openspec-compat.test.ts`: all hardcoded literals rotate + the 1.15 classification cases
  (accept 1.15.0, reject 1.14.3, reject the stable upper bound `1.16.0` explicitly — not only the
  prerelease — reject `1.16.0-alpha`, accept `openspec 1.15.0` string form).
- `workflow-contract` lane gains an explicit unit regression (Codex Round-A P1-3 fold): decode a
  `version --json` payload with `install.scope: 'standalone'` through `CliVersionSchema` — red on
  the old closed enum, green after the enum gains the value; the real-binary fixture path alone
  does not cover this value.
- Red: compat tests fail against the old constants before the edit (record).
- Green: `pnpm --filter @openspecui/core run typecheck` + compat test + workflow-contract lane.

### Slice 2 — Fixture rotation + boundary rewrite (serial; the big batch)

- `packages/core/package.json`: add `openspec-cli-115 = npm:@fission-ai/openspec@1.15.0`;
  `openspec-cli-114` stays `@1.14.3`; **remove `openspec-cli-113`** (sole consumer retires with
  the old boundary suite); `112`/`111` stay. Install once.
- New helper `packages/core/src/__tests__/official-cli-v15-fixtures.ts`
  (`PINNED_OPENSPEC_V15_VERSIONS = ['1.15.0']`, bins → `openspec-cli-115`), modeled on the v14
  helper (identity lane, JSON discipline incl. the `tip` stderr guard, pinnedFixtureEnv).
- Rename the 13 `official-cli-v14-*.test.ts` → `official-cli-v15-*.test.ts` (imports, per-file
  intent headers gain the 2026-10-25 line note). CP1 order: after alias+install, run the renamed
  matrix BEFORE touching assertion literals; identity-guard reds are expected, contract reds stop
  the slice.
- Boundary rewrite: `official-cli-v13-boundary-fixtures.test.ts` →
  `official-cli-v14-boundary-fixtures.test.ts` — 1.14.3 identity (`--version`), v15-gate
  unsupported classification, 1.15-only surfaces absent on 1.14.3 (`update --dry-run` →
  `error: unknown option '--dry-run'`; `install` → `error: unknown command 'install'` — both
  verified against the real binary), and the 1.14-era member-presence assertions (sourcePath/
  warnings/archived/names) RETAINED as positive 1.14 facts where the old suite had them (they are
  1.14's own features; the "never assert v14-era members absent" discipline applies to v15-only
  surfaces, not to v14's).
- `openspec-cli-112` consumers (`tool-init-state.test.ts`, `agent-command-content.test.ts`) stay
  green; verify `openspec-cli-111` consumer unaffected.
- Green: full renamed matrix + boundary + `pnpm --filter @openspecui/core run typecheck`.

### Slice 3 — Guards, tool-subscription, docs, changeset (serial close)

- Pin guards: `upstream-contract-regression.test.ts` → `8e0288df…`; server cold-start constant +
  two version literals → 1.15.0; `scripts/prepare-openspec-reference.mjs` EXPECTED_COMMIT;
  `w2-project-binding-playwright.ts` SHA + version.
- `tool-subscription-router.test.ts:684`: derive the npm spec from
  `OPENSPEC_CLI_TARGET_SERIES` (file already claims to track the constants).
- `packages/web/src/routes/settings.tsx:371-378`: the "unpublished 1.15" comment and fallback
  semantics rotate to the published 1.15.x line (read the file first; adjust copy + constant).
- CLAUDE.md pointer → `openspec-1.15.0-report.md` (1.14.3 report to history); AGENTS.md pin line
  `(v15: v1.15.0, 8e0288df)` + history gains v1.14.3; clean-build law SHA/date; 2026-10-25
  architecture decision (line decision, scope enum, guard story, fixture roles, deferred B1/B2).
- README audit: root README support range + `packages/cli/README.md` per the release README law
  (this is a major line — README updates ARE expected, unlike patch rotations).
- `.changeset/update-openspec-cli-15-line.md`: **major** bump, four-package naming + fixed-group
  propagation note.
- Green: renamed-matrix rerun + guards + typechecks.

### Verification

Focused per slice (exec + substring filters); broad gates serial at close (format/lint/typecheck/
test:ci/browser:ci); vision smoke walkthrough (production changes exist this line — scope enum is
decode-level, but settings copy and any observable change warrant the walkthrough); Codex Round-C;
PR → archive → release (Owner confirmation; **major release — confirm the `latest` dist-tag
implications**).

## Risks

- Test-file rename breadth (13 files) — do renames mechanically (git mv keeps history), verify
  zero `official-cli-v14` strays outside the boundary suite name.
- The boundary suite rewrite is the highest-judgment step: keep the old suite's structure and
  swap the identity/role, never assert v15-era members absent from 1.14.3.
- `settings.tsx` semantics: read before editing; if the fallback logic is load-bearing beyond
  copy, stop and report instead of guessing.
- Playwright cache may be wiped again between sessions (reinstall path documented in 1143 log).
