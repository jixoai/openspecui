<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Record the verified OpenSpec 1.13.1 patch delta for the OpenSpecUI 13 line.
2. Separate CLI-owned patch behavior from OpenSpecUI projection obligations.
3. Map each observable change to a production owner, regression case, and release gate.
4. Preserve the constraints the in-window patch rotation must not silently weaken.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.0 -> 1.13.1 patch adaptation report

## Decision

```text
OpenSpecUI 13 (unchanged line)
  adapted / supported      OpenSpec CLI >=1.13.0 <1.14.0
  current / recommended    OpenSpec CLI >=1.13.0 <1.14.0
  rejected                 <1.13.0, prereleases, >=1.14.0, unparseable
  pinned fixture           openspec-cli-113 rotates 1.13.0 -> 1.13.1
```

1.13.1 is an **in-window patch release**: no new command, no new flag, no capability-enum
change (`git diff v1.13.0..v1.13.1 -- src/` adds no `.command(...)`/`.option(...)`;
`src/index.ts` unchanged). The v13 admission window, `deriveOpenSpecCliCapabilities`, the
Agent registry series (`'1.13'`), and generator staleness baseline (series-aware on the
1.13 line) therefore **do not move**. This is the repo's first in-window pinned-patch
rotation; it is delivered as an OpenSpecUI 13.x release, not a new major.

Vetoable in review: retaining a second `1.13.0` executable fixture alongside the pinned
`1.13.1` (rejected by default — the established pattern is one pinned positive fixture per
series plus the `openspec-cli-112` boundary negative, and every 1.13.1 contract change is
additive-optional, so 1.13.0 adds no rejection case the 112 fixture does not already own).

## Evidence baseline

```text
Observed                 2026-09-17 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.13.1
Pinned commit            634c557bd0470eec37861b46172c3f503d283c1b
Previous pin             v1.13.0 / 9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461
Upstream delta           38 commits, src +3402/-499 across 65 files (plus tests/docs)
```

Sources inspected: the full `v1.13.0..v1.13.1` source diff of `references/openspec`
(agents cross-checked every contract-relevant commit against `src/`), the updated
`docs/agent-contract.md`, and the current OpenSpecUI consumers under `packages/core`,
`packages/server`, `packages/web`.

## Patch delta by contract relevance

### P1. `list --json` gains `nested` entries and top-level `warnings` (must adapt)

Commit `09a999b` (#1849, `src/core/list.ts`, contract `docs/agent-contract.md` §4.1):

```json
{ "changes": [ { "name", "completedTasks", "totalTasks", "lastModified", "status",
                 "nested"?: ["<area>/<name>", ...] } ],
  "warnings"?: [ { "code": "nested_change_directory", "name", "nested", "message" } ],
  "root": RootOutput }
```

- A directory under `changes/` that only wraps nested change directories is **still listed**
  with full regular fields plus `nested: string[]`; its `status` is meaningless. The contract says:
  "Do not treat such an entry as a change; report the message and leave the directories alone." The
  fields are computed by the same code path as real changes (`list.ts` runs
  `getTaskProgressForChange` on the namespace dir), so the typical 0/0 -> `no-tasks` shape is the
  common case, not a guarantee — a namespace root that happens to contain a `tasks.md` reports its
  counts; fixture construction must not rely on 0/0.
- Row-source fact (Round-A review B1): OpenSpecUI's change **row ids** do not come from the CLI list
  at all — `changes-projection-service.ts` builds rows from `adapter.listChanges()` (local directory
  listing) and joins CLI entries only for task summaries; Dashboard/Kanban/search use the local
  `listChangesWithMeta()`; Store content decodes `list --json` through a second independent schema
  (`store-content-projection.ts`). Filtering CLI entries alone therefore removes summaries, not rows.
- Top-level `warnings` is omitted when empty (never `[]`).
- Companion behaviors: `status --change`/`instructions --change`/`show`/`validate` report
  errors for namespaced ids; `archive` refuses them; `status --all` emits a
  `change_error`-shaped entry.

OpenSpecUI red today: `CliChangeListEntrySchema` is `.passthrough()` so decode survives,
but the entry flows through `fetchChangeListProjection` (`opsx-kernel.ts`), the strict
`opsx-change-list` projection schema (`planning-cli-projection.ts` strips `nested`),
`readCliChangeListEntriesFor` (`planning-root-service.ts`), `changes-projection-service.ts`,
`dashboard-summary.ts`, and renders as a normal change (`Tasks 0/0`) in Changes /
Dashboard Active Changes; a namespaced change would also be clickable into a detail route
whose CLI reads now fail. The top-level `warnings` array is dropped un-projected.

### P2. Task-line reading widened (must adapt — local parser divergence)

Commits `8fc65b7` (#1862) + `11a9691` (#1773), `src/utils/task-progress.ts`. The v1.13.1
line pattern, verbatim:

```ts
const TASK_LINE_PATTERN =
  /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/;
```

Semantics (each bullet is a dimension where the old reading dropped lines):

- every CommonMark list marker — `-`, `*`, `+`, ordered `1.`/`1)` up to nine digits;
- leading indentation counts (nested sub-tasks);
- marker inside the box: any **single** non-`]`/non-whitespace character (`[ ]`, `[x]`, `[~]`,
  `[1]`, …), optionally padded with whitespace (`[ x]` captures marker `x`), or a
  whitespace-only box (`[]`, `[  ]`); a **multi-token** marker (`[WIP]`) never matches — the
  upstream-accepted residue that keeps link labels out;
- closing `]` must **not** be followed by `(` or `[` (keeps `- [Some doc](./doc.md)` and
  reference links out of the counts; whitespace-only boxes keep counting regardless);
- done iff the marker lowercases to `x` (`[x]`, `[X]`, `[ x]` are done); every other marker
  (and none) reads not-done;
- unanchored at the end (CRLF files keep parsing).

Upstream rationale (source comment): any line this parser drops is a task `openspec
archive` stops warning about — silent loss; the wide class instead over-counts loudly
(`- [1] ...` reads as one unfinished task), which is correctable.

OpenSpecUI red today: `packages/core/src/task-progress.ts:119`
`CHECKBOX_TASK_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/` recognizes only `-`/`*`, requires
space after the marker and after the box, only `[ xX]` markers, requires a non-empty
description, and `$`-anchors (CRLF lines drop). Every widening above is a line the local
`trackedTaskProgress` misses while the CLI counts it, so on a change using `+ [ ]`,
`1. [ ]`, indented sub-tasks, or `- [~]`:

- Kanban lane phase (local `trackedTaskProgress.phase`) disagrees with the CLI
  `completedTasks/totalTasks` shown beside it on Changes / Dashboard;
- `applyInstructionProgress.divergence` (local tracked projection vs CLI apply `tasks[]`)
  fires a tracked-task-mismatch badge that is now false evidence;
- `documentChecklistSummary` (secondary analytics) undercounts the same way.

`toggleMarkdownTask` (`task-progress.ts:321`) writes back only `[-*] [ xX]` forms, so the
toggle feature stays consistent only for the narrow syntax; widened forms are readable by
the CLI but not toggleable.

### P3. `schema validate --json` `valid` semantics (no consumer; fixture evidence only)

Commit `7090e16` (#1868): `schema validate` may now return `valid: true` with a non-empty
`issues` array (new `{level:'warning', path:'apply.tracks'}` entries), and an unknown
`apply.requires` id makes the schema **load** fail (`parseSchema` throws), which surfaces
through `status`/`instructions` failure envelopes. OpenSpecUI never invokes
`schema validate` (the executor implements `schemas`, `schema which`, `templates` only)
and no UI path judges failure by `issues.length` — `spec-validation-evidence.tsx:180`
already renders `valid:true && issues.length>0` as amber. The load-failure path decodes
through the existing `CliDiagnosticFailureSchema`. **No production change.**

### P4. Validate findings gain content, not shape (no consumer change; fixture evidence)

Additive findings inside the unchanged `{level,path,line?,message}` shape:

| Commit | Level | Trigger |
| --- | --- | --- |
| `a5bf5c6` (#1804) | WARNING | requirement outside any delta section (under `## Notes` etc.) |
| `09984b8` (#1774) | WARNING | tracked task file with zero checkbox lines |
| `e01ed07` (#1870) | ERROR | delta file under `specs/` the merge path never reads |
| `db560ae` (#1858) | ERROR suffix | scenario header with no body (`(a scenario header with no body under it does not count; ...)`) |

`CliValidateFindingsSchema` decodes them (its superRefine only requires non-empty issues);
`validation-findings-evidence.tsx` renders level-generic chips and passes messages through
verbatim, and the summary chip keys off `summary.totals.failed`. **No production change**;
the pinned-fixture positive matrix should exercise the new classes.

### P5. Behavior fixes observable through existing envelopes (no shape change)

- `605d9e7` (#1876): unparseable global config — `config set/unset/profile` now refuse with
  **plain stderr text** (`Error: <path> could not be parsed, so it was left unchanged.` + a fix hint)
  and `process.exitCode = 1` instead of silently rewriting the file; there is **no JSON envelope** on
  this refusal path (`src/commands/config.ts` `refuseUnreadableConfig`), so no status-array shape is
  involved. `config list` normalizes a non-object root instead of crashing. (Round-B correction: an
  earlier draft wrongly claimed a status-array payload.)
- `9f8dec5` (#1880): `store remove` refuses when the target contains another registered
  store — new error code `store_remove_contains_registered_store` (added to
  `docs/agent-contract.md`), same failure payload shape.
- `e571b5b` (#1835, security): hostile-repository hardening — instruction envelopes escape
  repo-sourced text in **text/markdown** output only (`--json` untouched); `validate
  --type <id>` rejects path-traversal ids with error code `invalid_item` + exit 1; git
  probes gain 15s/16MB bounds with degradation warnings on **stderr** (stdout JSON stays
  clean); schema artifact count capped at 1000; symlink re-rooting tightened on the
  archive write path. CLI-side closure; OpenSpecUI mirrors nothing, but UI surfaces that
  forward user input as item ids must tolerate the `invalid_item` code.
- `767d63c`/`6e62b1d`/`4b5c07a`/`46ff91f`: parser/archive correctness (case-colliding
  requirement names, malformed RENAMED pairs, ATX closing hashes, `show --deltas-only`
  now derives from the archive reader so bullet-form REMOVED stops misreporting as
  MODIFIED). Error texts ride existing carriers.
- `8146be5` (#1866): `list` dating skips unresolvable entries (dangling symlink / loop)
  instead of failing the whole command — strictly fewer failures.
- `8b99c07` (#1786): text `status` prints a `Next:` line; `--json` `nextSteps` are
  byte-identical to 1.13.0.

### P6. Confirmed non-obligations

- No new command/flag/capability (see Decision); `--init-git/--no-init-git` existed in
  1.13.0 (now actually honored by `store setup`, `5d22145`).
- Generated-template content changes (`3312af4` adds a top-level `# Proposal` heading to
  default templates; skills wording `9827762`/`5f5914e`) change scaffold output only —
  the Agent-delivery **physical artifact matrix** (paths, migrations, restart) is
  untouched, so `agent-delivery-registry.ts` and staleness logic do not move.
- Store root classification fix (`208b5b5`) and `store setup --no-init-git` (`5d22145`)
  change resolution behavior, not doctor/context JSON shapes.
- Skills/website/docs/completions/nix commits: upstream-internal.

## Current owner map

| Surface | Primary production owner | v1.13.1 obligation |
| --- | --- | --- |
| pinned fixture | `packages/core/package.json` (`openspec-cli-113` npm alias), `packages/core/src/__tests__/official-cli-v13-fixtures.ts` | rotate alias + `PINNED_OPENSPEC_V13_VERSIONS` to `1.13.1`; regenerate lockfile; re-run matrix |
| change-list contract | `packages/core/src/cli-contracts/workflow.ts` | type `nested?: string[]` on entries; type top-level `warnings[]` |
| change-list projection | `packages/core/src/planning-cli-projection.ts`, `packages/core/src/opsx-kernel.ts` | keep nested entries out of the actionable projection (`entries` and compat `value`); project `warnings` as the single source of the nested-name set |
| change-list consumers | `packages/server/src/planning-root-service.ts`, `changes-projection-service.ts`, `dashboard-summary.ts`, `search-documents.ts`, `store-content-projection-service.ts` | row builders subtract the structurally-derived namespace-name set (entry `name`s carrying `nested`) from their own id sources while the CLI projection is available; warnings are display evidence only |
| changes surface | `packages/web/src/routes/change-list.tsx` (+ dashboard row) | render `nested_change_directory` warnings as direct-plane evidence; no fake `Tasks 0/0` rows |
| task reading | `packages/core/src/task-progress.ts` | mirror the CLI task-line semantics for `trackedTaskProgress`, `documentChecklistSummary`, `toggleMarkdownTask` write-back |
| validate findings | `packages/core/src/cli-contracts/workflow.ts` (decode), `packages/web/src/components/validation-findings-evidence.tsx` (render) | none (shape-compatible); pinned-fixture positive coverage for P4 classes |
| compat window | `packages/core/src/openspec-compat.ts` | none (`>=1.13.0 <1.14.0` already admits 1.13.1) |
| evidence docs | `references/openspec-1.13.1-report.md`, `CLAUDE.md` session pointer, `AGENTS.md` pin line, `scripts/prepare-openspec-reference.mjs` guard | record the new pin |

## Release gate

- Focused: contract tests (`workflow.test.ts`), `task-progress` tests, projection tests,
  changes/dashboard service tests, web changes-surface tests.
- Pinned fixture matrix (`official-cli-v13-*.test.ts`) green against the 1.13.1
  executable, including new nested/warning assertions.
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci` (or the scoped subset justified in PR notes).
- Changeset for an `openspecui` 13.x patch release; README version-scope tables stay
  `1.13.x` (no README-law trigger unless text names `1.13.0` explicitly — verified and
  updated where it does).
- Owner-only final browser walkthrough boundary unchanged (2026-07-20 law).
