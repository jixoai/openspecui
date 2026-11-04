<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Record the verified OpenSpec 1.16.0 delta and the OpenSpecUI 16 line decision.
2. Separate CLI-owned behavior from OpenSpecUI projection obligations.
3. Map every obligation to a production owner, fixture, and gate; record the
   zero-production-change evidence where the existing open shapes already decode.

Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流
推进上线。" — the first scheduled detection found v1.16.0 and opened the OpenSpecUI 16 line
per the upstream-rotation skill.
-->

# OpenSpec CLI 1.16.0 line adaptation report (OpenSpecUI 16)

## Decision

```text
OpenSpecUI 16 (new major line)
  adapted / supported      OpenSpec CLI >=1.16.0 <1.17.0
  current / recommended    OpenSpec CLI >=1.16.0 <1.17.0
  rejected                 <1.16.0 (the whole 1.15 v15 window), prereleases, >=1.17.0, unparseable
  pinned fixture           openspec-cli-116 NEW (1.16.0 positive)
  boundary fixture         openspec-cli-115 (1.15.0 — version unchanged, role becomes below-admitted)
  retired                  openspec-cli-114 (1.14.3 — sole real consumer was the v14 boundary suite)
  kept (historical)        openspec-cli-112 (two consumers), openspec-cli-111 (one consumer),
                           openspec-cli-110, openspec-cli-14/15/16/18 (generator-evidence facts)
```

16.0 is a **new minor line** admitted as a new major per the one-line-per-series cadence
("1.16 not pre-claimed" per the 2026-10-25 v15 decision). The command surface is
byte-identical (`src/index.ts` unchanged, `docs/agent-contract.md` unchanged), so this line's
work is a **window rotation with zero production projection changes** — every observable
delta rides a shape OpenSpecUI already decodes. Recorded alternative: a `>=1.15.0 <1.17.0`
widening would mix two series in one fixture matrix and contradict the single-series law;
kept as a fallback only.

The one breaking fact is an **install-time** contract, not a protocol one: the npm package's
Node engine floor moves `>=20.19.0` → `>=22.12.0`. OpenSpecUI's own packages declare no
`engines` field and CI runs Node 24, so no repository change follows; it is release-note
material for npm-installed CLI users (the standalone binary is Node-free).

## Evidence baseline

```text
Observed                 2026-11-04 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.16.0
Pinned commit            27c0515724decc633818c735ee596481eec78a8b
Previous pin             v1.15.0 / 8e0288df12d401b0e183e2f47254d22528c1dffb
Upstream delta           19 commits (linear, 0 merges), 231 files +4615/-1581
                         (src 12 files +404/-41)
Unchanged (key)          src/index.ts, docs/agent-contract.md, src/core/config.ts (AI_TOOLS),
                         src/core/profiles.ts, src/core/command-generation/,
                         src/core/shared/skill-generation.ts
Changed src              src/commands/{validate,completion}.ts,
                         src/core/{id,project-config,root-selection}.ts,
                         src/core/store/git.ts,
                         src/core/parsers/{code-fence,requirement-blocks,requirement-text,spec-structure}.ts,
                         src/core/validation/validator.ts,
                         src/core/completions/installers/zsh-installer.ts
```

Sources inspected: the full `v1.15.0..v1.16.0` source diff of `references/openspec`, the
upstream `CHANGELOG.md` 1.16.0 section, and executed-CLI evidence against the installed
`openspec-cli-116` 1.16.0 executable (init/new/validate families) with `openspec-cli-115`
1.15.0 driven against the same fixtures for A/B contrast.

## Obligations

### O1. `validate --json` gains a bare diagnostic-failure envelope on a broken project config (decode: already covered; fixture: new)

Commit `ae7ad75` (#1892, `src/commands/validate.ts` + `src/core/project-config.ts`): every other
command ignores an unreadable or unparseable `openspec/config.yaml` with a warning; `validate`
now fails instead so CI can catch it. `readConfigParseError` runs before scope handling, so
**every** validate invocation (`--all`, `--changes`, `--specs`, an item name, `--report
findings`, `--strict`) short-circuits at exit 1 with a bare envelope:

```json
{ "status": [ { "severity": "error",
                "code": "unreadable_config" | "unparseable_config",
                "message": "Could not read|parse <abs config.yaml> (<cause>).",
                "fix": "Make <path> a readable file, or remove it."
                      | "Fix the YAML syntax in <path>." } ] }
```

Executed 1.16.0 evidence (real binary, throwaway project):

- unparseable `config.yaml` → exit 1, `code: "unparseable_config"`, top-level keys exactly
  `["status"]`.
- `chmod 000 config.yaml` → exit 1, `code: "unreadable_config"`, same single-key shape.
- the same broken config with `--report findings` → the identical `{status}` envelope, **not**
  the `validation-findings` document.
- a healthy project still returns the unchanged report shape
  (`items`/`root`/`summary`/`version`) and the unchanged findings shape
  (`itemFindings`/`report`/`root`/`summary`).

OpenSpecUI position: **no production change.** `CliValidateSchema` is already
`z.union([CliValidateReportSchema, CliDiagnosticFailureSchema])` and
`CliValidateFindingsResultSchema` is already `z.union([CliValidateFindingsSchema, <the same
diagnostic failure>])`; `CliDiagnosticSchema` types `code` as an open `z.string()` with
`.passthrough()`, so both new codes decode and render verbatim. New pinned fixture: both
codes plus the unchanged healthy shapes, asserted through the real executable.

### O2. Scenario step coverage becomes a WARNING class (decode: already covered; fixture: new)

Commit `dc37609` (#2079, `src/core/validation/validator.ts` + `src/core/parsers/`): a counted
scenario that has a body but carries no `**WHEN**`/`**GIVEN**` step, or no `**THEN**` step, is
reported as `level: 'WARNING'` — in change deltas (ADDED and MODIFIED) and in main specs.
`--strict` fails on it; plain `validate` and `archive` are unchanged. The check walks the same
`#### ` blocks the scenario-loss comparison reads (`parseScenarioBlocks` / `hasScenarioBody` /
`scenarioStepCoverage` are now shared exports, closing the two-readers drift), and it warns
only on blocks whose header literally carries the `Scenario:` label — a `#### Notes` child is
prose on purpose.

Executed 1.16.0 evidence (change-scope, real binary): four scenarios in one ADDED requirement
produced exactly three WARNINGs (`missing a WHEN/GIVEN step and a THEN step`, `missing a THEN
step`, `missing a WHEN/GIVEN step`), the complete scenario produced none, the item stayed
`valid: true` and the exit code stayed 0; the same change under `--strict` exited 1 with
`summary.totals = {items: 1, passed: 0, failed: 1}`.

OpenSpecUI position: **no production change.** Findings ride the existing
`{level, path, line?, message}` shape with `level` already an open string enum, and the
findings surface renders messages verbatim. New pinned fixture: the three missing-step
variants plus the strict escalation.

### O3. Parser correctness fixes inside unchanged shapes (no obligation)

- `a6cd3bc` (#2131, `src/core/parsers/code-fence.ts`): a line that starts with a triple
  backtick whose info string contains another backtick (` ```npm test``` `) is CommonMark
  inline code, not a fence opener; treating it as a fence masked every following line and hid
  later requirements. The fence matcher also stops anchoring at end-of-line so CRLF openers
  match.
- `cb1adee` (#2133, `src/core/parsers/spec-structure.ts`): `###Requirement:` (no space after
  the hashes) is now recognized as a requirement header for main specs, matching how archive
  reads them, so duplicate/misplaced requirements written that way are reported.
- `src/core/parsers/requirement-blocks.ts` / `requirement-text.ts`: the scenario-block reader
  and step helpers become shared exports; no output change beyond O2.

OpenSpecUI mirror: the local `isGlobPattern`/task-line readers are unaffected (no upstream
change to those helpers). CLI-owned parser fixes; no local obligation.

### O4. No-root error suggests a store matching the repo's git origin (message-level)

Commit `18a75a5` (#2077, `src/core/root-selection.ts`, `src/core/store/git.ts`,
`src/core/id.ts`): when no OpenSpec root is found and stores are registered, the CLI probes
`git origin` on that failure path only and — if a registered store id equals the kebab-cased
repository name — throws a `RootSelectionError` naming that store with the `--store` flag and
the `store:` declaration that would select it. It never selects a store by name (two orgs can
share a repo name). `GIT_REPO_LOCATION_ENV_VARS` are stripped so a hook-inherited `GIT_DIR`
cannot redirect the probe.

OpenSpecUI position: **no production change.** Root selection is delegated to the CLI and the
error text is surfaced verbatim through the existing diagnostic path; there is no new JSON
member. Fixture-verify only: the suggested-store message must not become a fabricated root
selection.

### O5. Completion / zsh installer (CLI-owned)

`d68fc51` (#2160) moves release files to `.tar.gz` and documents `openspec.dev` install
scripts; `05cc75f` (#2172) writes zsh completion to `$ZDOTDIR/.zshrc` when `ZDOTDIR` is an
absolute path, and `completion uninstall` cleans the same file. Both are CLI-owned surfaces
OpenSpecUI never invokes.

### O6. Node engine floor (install-time contract, release-note material)

`33c6f93` (#2159): `package.json` `engines.node` `>=20.19.0` → `>=22.12.0`. npm installs on
Node 20 fail/warn; the standalone binary (default install since 1.15) does not use Node;
Homebrew manages its own Node. OpenSpecUI declares no `engines` and CI runs Node 24 — no
repository change, but the release notes and README must say it, because `openspec-cli-116`
fixtures install from npm and any consumer on Node 20 hits the floor.

## Fixture matrix prediction (to be observed, not assumed)

- `openspec-cli-116` (1.16.0) proves every accepted contract; the 14 existing positive suites
  keep their assertions with only the version literal and bin alias rotated.
- `openspec-cli-115` (1.15.0) becomes the boundary: identity is exactly `1.15.0`, the v16 gate
  classifies it `unsupported`, and the 1.16-only surfaces are absent — `update --dry-run` is
  unknown to 1.15 (it arrived in 1.15, so it is **present**; the correct 1.16-only probe must
  be chosen from this line's own additions, and this report makes no claim until the boundary
  suite is written against the real binaries).
- `openspec-cli-114` retires: its only real consumer is the v14 boundary suite, which rotates
  to the v15 boundary suite.

## Current owner map

| Surface             | Primary production owner                                                                                                                                            | v1.16.0 obligation                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| compat window       | `packages/core/src/openspec-compat.ts`                                                                                                                              | rotate all five constants to `1.16.0` / `>=1.16.0 <1.17.0` / next `1.17.0`                                       |
| pinned fixture      | `packages/core/package.json` (`openspec-cli-116` npm alias), `packages/core/src/__tests__/official-cli-v16-fixtures.ts`                                             | add alias; rename helper with `PINNED_OPENSPEC_V16_VERSIONS = ['1.16.0']` + bins map key                         |
| fixture suites      | `packages/core/src/official-cli-v16-*.test.ts` (14)                                                                                                                 | rotate file set from v15 with the version literal and header intents updated                                     |
| boundary suite      | `packages/core/src/official-cli-v15-boundary-fixtures.test.ts`                                                                                                      | rotate from v14 boundary: `openspec-cli-115` = 1.15.0 identity, 1.15.0 classified unsupported under the v16 gate |
| pin guards          | `scripts/prepare-openspec-reference.mjs`, `upstream-contract-regression.test.ts`, `root-context-cold-start.integration.test.ts`, `w2-project-binding-playwright.ts` | rotate commit `27c05157…` and version assertions                                                                 |
| agent registry      | `packages/core/src/agent-delivery-registry.ts`                                                                                                                      | rotate series `'1.15'` → `'1.16'`; every physical fact carries forward (upstream AI_TOOLS unchanged)             |
| generator staleness | `packages/core/src/tool-init-state.ts`                                                                                                                              | `PINNED_AGENT_GENERATOR_VERSION` → `1.16.0`                                                                      |
| validate transports | `packages/core/src/cli-contracts/workflow.ts`                                                                                                                       | **none** — both unions already decode the O1 envelope; fixtures prove it                                         |
| findings surface    | `packages/web/src/components/validation-findings-evidence.tsx`                                                                                                      | **none** — renders O2 messages verbatim                                                                          |
| docs                | `references/openspec-1.16.0-report.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `packages/cli/README.md`                                                             | record the new window and the Node floor                                                                         |

## Release gate

- Pinned fixture matrix green against the 1.16.0 executable with zero assertion relaxations;
  the boundary suite green against the retained 1.15.0 executable.
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci`.
- Changeset for the four version-locked packages (the rotation touches `packages/`).
- README + package README carry the new window and the Node `>=22.12.0` floor.
- No UI change ships: no new visual surface, so the Owner browser-walkthrough boundary is
  unchanged and no fresh agent E2E walkthrough is required beyond the existing browser suites.
