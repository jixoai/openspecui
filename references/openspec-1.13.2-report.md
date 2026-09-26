<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Record the verified OpenSpec 1.13.2 patch delta for the OpenSpecUI 13 line.
2. Separate CLI-owned patch behavior from OpenSpecUI projection obligations.
3. Map each observable change to a production owner, regression case, and release gate.
4. Preserve the constraints the in-window patch rotation must not silently weaken.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

# OpenSpec CLI 1.13.1 -> 1.13.2 patch adaptation report

## Decision

```text
OpenSpecUI 13 (unchanged line)
  adapted / supported      OpenSpec CLI >=1.13.0 <1.14.0
  current / recommended    OpenSpec CLI >=1.13.0 <1.14.0
  rejected                 <1.13.0, prereleases, >=1.14.0, unparseable
  pinned fixture           openspec-cli-113 rotates 1.13.1 -> 1.13.2
```

1.13.2 is an **in-window patch release**: no new command, no new flag, no capability-enum
change (`git diff v1.13.1..v1.13.2 -- src/index.ts` is empty; zero commits touch it;
`docs/agent-contract.md` is unchanged in this release — the contract documentation for the
Apply additions lives in `docs-lab/reference/cli.md`). The v13 admission window,
`deriveOpenSpecCliCapabilities`, the Agent registry series (`'1.13'`), and generator
staleness baseline therefore **do not move**. Second in-window pinned-patch rotation;
delivered as an OpenSpecUI 13.x release, not a new major.

Vetoable in review: retaining the `1.13.1` executable fixture alongside the pinned `1.13.2`
(rejected by default — one pinned positive fixture per series plus the `openspec-cli-112`
boundary negative; every 1.13.2 contract change is additive-optional at the decode boundary,
so 1.13.1 owns no rejection case the 112 fixture does not already own).

## Evidence baseline

```text
Observed                 2026-09-26 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.13.2
Pinned commit            db2309783547a14e150dbcbfc19120e4028446c3
Previous pin             v1.13.1 / 634c557bd0470eec37861b46172c3f503d283c1b
Upstream delta           32 commits, src +883/-268 across 23 files (plus tests/docs/website)
```

Sources inspected: the full `v1.13.1..v1.13.2` source diff of `references/openspec`
(every contract-relevant commit read against `src/`), the updated
`docs-lab/reference/cli.md` Apply contract paragraphs, `docs/supported-tools.md`, and the
current OpenSpecUI consumers under `packages/core`, `packages/server`, `packages/web`.

## Patch delta by contract relevance

### P1. `instructions apply --json` gains `taskTrackingConfigured` + `unavailableTrackingFiles`, and tracked globs resolve by schema path (must adapt)

Commit `072de6bc3` (#1732, `src/commands/workflow/shared.ts` + `instructions.ts`; contract
text in `docs-lab/reference/cli.md` after the `apply` form):

```json
{ "contextFiles": ..., "progress": ..., "tasks": ...,
  "taskTrackingConfigured": true,
  "unavailableTrackingFiles"?: [ { "path": "/abs/path", "reason": "EACCES: ..." } ],
  "state": "blocked | ready | all_done", "instruction": "..." }
```

Verbatim contract semantics (docs-lab/reference/cli.md):

- `taskTrackingConfigured` is **always a boolean**: `true` when the schema sets a non-null
  `apply.tracks`, even if no file matches, `false` otherwise. On 1.13.0/1.13.1 the member
  does not exist at all.
- `unavailableTrackingFiles` contains the absolute `path` and error `reason` of every matched
  tracking file that could not be read; **omitted when every matched file is readable**
  (never `[]`).
- Readable files still contribute to `tasks` and `progress`, but `state` cannot be `all_done`
  until every matched file is read.
- State-chain changes in `generateApplyInstructions`: unreadable tracking files with zero
  readable tasks -> `blocked` with `instruction` "No readable task descriptions are
  available."; `all_done` additionally requires `unavailableTrackingFiles.length === 0`; when
  any tracking file was unavailable, `instruction` appends the block
  "Task completion is not verified because tracking evidence was unavailable:" with one
  `- <path>: <reason>` line per file.
- Task evidence aggregation changed source: `apply.tracks` is resolved through
  `resolveArtifactOutputs` (glob semantics against every artifact's output paths — a tracking
  path may be a glob owned by an artifact with any ID), replacing the single literal
  `resolveArtifactOutputPath` read. `contextFiles` is unchanged.

OpenSpecUI red today: `CliApplyInstructionsSuccessSchema`
(`packages/core/src/cli-contracts/workflow.ts`) is `.passthrough()` so decode survives, but
the members stay untyped; the strict `ApplyInstructionsInputSchema` /
`ApplyInstructionsProjectionSchema` (`packages/core/src/opsx-types.ts`) strip both members, so
neither reaches the Web. The Web Change Detail already mounts the direct status region for
Apply `warnings` / `missingPrerequisites` (`packages/web/src/routes/change-view.tsx`
`hasDirectStatus`); unreadable-tracking evidence has no typed path to that plane. Divergence
parity risk: the CLI now aggregates every file matched by the `apply.tracks` glob, while the
local `trackedTaskProgress` already resolves globs by pattern-matching change files
(`task-progress.ts` `opsxPathMatchesPattern`) — the pinned fixture matrix must prove counts
agree on a glob-tracked schema (no production change expected; `createApplyInstructionProgress`
compares CLI `progress` against the local projection as before).

### P2. Kilo Code command path moves `.kilocode/workflows/` -> `.kilo/command/` (must adapt — registry physical fact)

Commit `fe429a13d` (#1938, `src/core/command-generation/adapters/kilocode.ts` +
`src/core/legacy-cleanup.ts`; `docs/supported-tools.md` row updated):

- Commands are generated at `.kilo/command/opsx-<id>.md` (plain markdown, unchanged format).
- `skillsDir` stays `.kilocode` (`src/core/config.ts` row unchanged); `requiresIdeRestart`
  stays `true`.
- Legacy cleanup (`LEGACY_KILOCODE_COMMAND_FILES`) now removes **both generations** from the
  old folder: `opsx-<workflow>.md` for every workflow plus the three legacy
  `openspec-{proposal,apply,archive}.md` files. In-pattern reading: cleanup patterns
  `.kilocode/workflows/opsx-*.md` + `.kilocode/workflows/openspec-*.md`.

OpenSpecUI red today: `packages/core/src/agent-delivery-registry.ts` Kilo Code entry carries
`command: command('.kilocode/workflows/opsx-{workflow}.md', plainMarkdown)` and
`cleanup: projectCleanup('.kilocode/workflows/openspec-*.md')` — both stale against 1.13.2
(the cleanup pattern additionally fails to cover the `opsx-*` generation even for 1.13.1
facts). The registry's `command()` options already model `legacyPathTemplates` (OpenCode
precedent at line 703), so the old path is expressible as legacy evidence without a second
entry. The per-series snapshot mechanism is minor-grained (`'1.13'`); upstream itself treats
in-series physical drift by writing the new path and cleaning both generations, so the
registry rotates its snapshot to the pinned patch's physical reality.

### P3. Artifact-glob recognition widened: brace expansion + extglob (parity; dependency-watch granularity only)

Commit `fd56e12c9` (#1885, `src/core/artifact-graph/outputs.ts`): `isGlobPattern` now also
recognizes brace expansions (`docs/{api,cli}.md`, `specs/{a,b}/…`) and extglobs
(`!(…)`, `+(…)`), normalizes to POSIX separators first, and `resolveArtifactOutputs` validates
every generated task base (brace-expanded) plus each positive pattern's directory traversal.

OpenSpecUI mirror: `packages/core/src/opsx-types.ts:35` `isGlobPattern` is a verbatim copy of
the pre-1.13.2 recognition, used only by `touchArtifactOutputDeps`
(`packages/core/src/opsx-kernel.ts:279`) to decide reactive dependency-watch granularity
(directory-tree watch vs single-file watch). A brace/expglob output path is today watched as a
literal file (misses creation of expanded siblings). Parity fix is the widened recognition
ported verbatim (plus the POSIX normalization the upstream helper applies); no schema/projection
change follows from it.

### P4. Validation semantics and message content change inside unchanged shapes (fixture evidence)

- `8826c0c4a` (#1912, `src/core/validation/purpose-placeholder.ts`): a leading `TBD`/`TODO`
  Purpose marker now needs punctuation (or line end) when **not fully upper-case** —
  `TODO:`/`TBD -`/`todo -`/`tbd.` still report; `TODO write this later` (shouted, no
  punctuation) still reports; lowercase Spanish/Portuguese sentence openers (`Todo el …`)
  stop reporting. Upper-case markers keep reporting whatever follows.
- `a5ceea32c` (#1809, `src/core/parsers/requirement-blocks.ts` + `validator.ts` +
  `specs-apply.ts`): MODIFIED-block scenario messages now also describe what the block **adds**
  (`diffScenarioNames` + `describeScenarioBalance`) instead of only what it drops; the
  archive-time `buildUpdatedSpec` error text carries the same balance suffix. Message-level
  only; both ride the existing `{level, path, line?, message}` finding shape and the existing
  failure envelopes.

`CliValidateFindingsSchema` decodes both unchanged; the findings surface renders messages
verbatim. **No production change**; pinned-fixture expectations that assert these exact
message texts must be updated where they fire (verify against the executable, do not assume).

### P5. Behavior fixes observable through existing envelopes or delivered content (no shape change)

- Archive Windows robustness: `f2812f6d1` (#1926) copy-without-staging when EPERM/EXDEV blocks
  the staging rename (verified entry-set removal, claim-suffix renames); `d3d770736` (#1769)
  releases the archive lock on Windows failures. CLI-side closure; OpenSpecUI delegates
  archive to the CLI.
- Line-ending preservation on rewrite: `1d35e9088` (#1958) adds `src/utils/line-endings.ts`
  (`detectLineEnding`/`applyLineEnding`/`matchLineEnding`, dominant-ending semantics, CRLF
  wins ties) used by marker-block updates, `removeMarkerBlock`, and `writeUpdatedSpec`. The
  CLI's own file writes stop rewriting CRLF specs as LF. OpenSpecUI's `toggleMarkdownTask`
  already writes back per-line marker bytes and does not normalize whole-file endings;
  no mirror obligation identified (fixture-verify only).
- Delivered workflow-template content (CLI-owned; the physical artifact matrix beyond Kilo is
  untouched): `fb1b87613` (#1795) archive/bulk-archive templates read task progress from
  `openspec list --json` instead of artifact paths; `336414665` (#1962) + the #1732 template
  part rework `verify-change` (advisory semantics, `Not applicable` / `Not verified`
  dimensions, REMOVED/RENAMED-aware coverage, no-readiness-claim-when-skipped);
  `ed5d386a5` (#1955) tasks template keeps tests/docs inside each task group;
  `0b5ce44b5` (#1940) approval-threshold alignment; `72fbe4c90` (#1733) update closes the
  partially-populated-glob dead end (can propose a missing companion file for a glob
  artifact); `0dde57b40` (#1944) `continue` adapter injects "This workflow prompt is already
  active…" into delivered command files; `5b5526377` (#1744) init hint distinguishes the
  Codex desktop app skill picker; `a64303fe1` (#1939) update reports legacy Codex bootstrap
  failures.
- `518e1a012` (#1905): legacy cleanup reads a legacy command through the opened handle
  (O_NOFOLLOW/O_NONBLOCK on POSIX, lstat refusal on Windows) — internal correctness.
- Dependency bumps (`@inquirer/core` 12.0.0, `@changesets/cli` 3.0.3, production-deps group)
  — interactive TUI internals; OpenSpecUI invokes JSON/non-interactive surfaces only.

### P6. Confirmed non-obligations

- No new command/flag/capability (see Decision); `src/index.ts` byte-identical.
- `docs/agent-contract.md` unchanged in 1.13.2 (verified empty diff) — the P1 contract text
  lives in `docs-lab/reference/cli.md`; P1 is still a real typed-contract obligation because
  the executable emits the members.
- The `OpenSpec-UI -> OpenSpec Workbench` rename (#1934) and the `openspec-guard` community
  entry are upstream docs edits about a third-party project; OpenSpecUI naming is unaffected.
- Website/llms.txt/completions/CI commits: upstream-internal.

## Current owner map

| Surface | Primary production owner | v1.13.2 obligation |
| --- | --- | --- |
| pinned fixture | `packages/core/package.json` (`openspec-cli-113` npm alias), `packages/core/src/__tests__/official-cli-v13-fixtures.ts` | rotate alias + `PINNED_OPENSPEC_V13_VERSIONS` to `1.13.2`; regenerate lockfile; re-run matrix |
| apply contract | `packages/core/src/cli-contracts/workflow.ts` | type `taskTrackingConfigured?: boolean` (absent on 1.13.0/1.13.1 — never synthesized) and `unavailableTrackingFiles?: {path, reason}[]` (absent-when-empty) |
| apply projection | `packages/core/src/opsx-types.ts` | carry both members through input + projection schemas as evidence; they never gate apply state or CLI progress authority |
| apply surface | `packages/web/src/routes/change-view.tsx` (+ its status-region component) | mount unreadable-tracking evidence on the direct status plane when present, mirroring the `warnings`/`missingPrerequisites` treatment |
| agent registry | `packages/core/src/agent-delivery-registry.ts` | Kilo Code command pathTemplate `.kilo/command/opsx-{workflow}.md`; `legacyPathTemplates` for `.kilocode/workflows/opsx-{workflow}.md`; cleanup patterns cover both generations |
| glob recognition | `packages/core/src/opsx-types.ts` (`isGlobPattern`) | port the widened recognition (brace/expglob + POSIX normalization) for dependency-watch parity |
| validate findings | decode `cli-contracts/workflow.ts`, render `validation-findings-evidence.tsx` | none (shape-compatible); fixture expectations updated where new message texts fire |
| compat window | `packages/core/src/openspec-compat.ts` | none (`>=1.13.0 <1.14.0` already admits 1.13.2) |
| evidence docs | `references/openspec-1.13.2-report.md`, `CLAUDE.md` session pointer, `AGENTS.md` pin line, `scripts/prepare-openspec-reference.mjs` guard | record the new pin |

## Release gate

- Focused: contract tests (`workflow.test.ts`), `opsx-types` tests, registry tests, web
  change-view tests, `task-progress` tests (regression guard).
- Pinned fixture matrix (`official-cli-v13-*.test.ts`) green against the 1.13.2 executable,
  including new apply-evidence assertions and the Kilo path assertions.
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci` (or the scoped subset justified in PR notes).
- Changeset for an `openspecui` 13.x patch release; README version-scope tables stay
  `1.13.x` (no README-law trigger — verify no runtime text names `1.13.1` explicitly).
- Agent-run E2E walkthrough (vision subagent + ego-browser) covers the Change Detail apply
  evidence plane; the Owner's final browser walkthrough boundary is unchanged (2026-07-20 law)
  — the agent walkthrough is preparation evidence only.
