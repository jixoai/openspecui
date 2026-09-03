<!--
Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
1. Record the verified OpenSpec 1.12 protocol baseline for OpenSpecUI 12 planning.
2. Separate upstream CLI-owned behavior from OpenSpecUI projection and admission responsibilities.
3. Map each observable protocol change to a production owner, exact regression case, and release gate.
4. Preserve the external validation constraints that the v12 Change must not silently repair.

Original request (2026-09-03): "openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

# OpenSpec 1.12 -> OpenSpecUI 12 adaptation report

## Decision

```text
OpenSpecUI 12
  adapted / supported      OpenSpec CLI >=1.12.0 <1.13.0
  current / recommended    OpenSpec CLI >=1.12.0 <1.13.0
  rejected                 <1.12.0 (including the whole 1.10/1.11 v11 window), prereleases, >=1.13.0, unparseable
```

Unlike v9 (1.8+1.9) and v11 (1.10+1.11), the v12 window contains a single series because only `1.12.0` is
published today; both historical two-series windows were opened after their second minor was published and
fixture-verified, and this line does not claim support for an unpublished, unverified `1.13`. When OpenSpec
`1.13` ships, admission is a separate verified decision: either a 12.x window widening (the 6.1/1.7-bridge
precedent) or a new major, depending on the 1.13 protocol delta. This single-series decision is explicitly
vetoable during Change review; every behavior accepted by the v12 admission range remains an implementation and
fixture obligation, and the current-page-only Skip-version-check bypass law carries over unchanged.

## Evidence baseline

```text
Observed                 2026-09-03 Asia/Shanghai
Package                  @fission-ai/openspec
npm latest               1.12.0
Reference repository     references/openspec
Pinned tag               v1.12.0
Pinned commit            e062b9572be933564ba3899d059377dfa1393e32
Previous OpenSpecUI pin  v1.11.0 / a0ddb60d040c61f4907436a9d91310934b1dda63
Current OpenSpecUI line  11.x
Upstream delta           20 commits, src +418/-95 across 19 files (plus tests/docs/website)
```

Sources inspected:

- `references/openspec` at the pinned v1.12.0 tag: `src/commands/validate.ts`, `src/core/validation/validator.ts`,
  `src/core/specs-apply.ts`, `src/core/command-generation/adapters/codeassistant.ts`,
  `src/core/command-generation/{registry,adapters/index}.ts`, `src/core/config.ts`, `src/core/init.ts`,
  `src/core/update.ts`, `src/core/openspec-root.ts`, `src/core/shared/ide-restart.ts`,
  `src/core/shared/index.ts`, `src/core/templates/workflows/{explore,propose,ff-change}.ts`,
  `src/core/completions/command-registry.ts`, `src/utils/command-references.ts`, `src/cli/index.ts`,
  `package.json`.
- The pinned-reference build (`references/openspec/dist/cli/index.js`, built by
  `scripts/prepare-openspec-reference.mjs` under the new pin guard) run against disposable fixture repositories,
  plus the published npm executable `@fission-ai/openspec@1.12.0` (`npm exec --yes --package=...`) for parity.
- Current OpenSpecUI owners and tests under `packages/core`, `packages/server`, `packages/web`, `packages/cli`.

## Verified CLI observations

Commands below used the pinned v1.12.0 build (npm-published executable verified for parity on version and the
shared JSON failure envelope):

| Command and fixture                                                              | 1.11.0                                    | 1.12.0                                                                                                                            | v12 consequence                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `validate --all --report findings --json` with one change whose delta MODIFIES a nonexistent spec | flag rejected (argument error)          | findings JSON (below); item stays `valid: true` with an `INFO` issue `Archive would refuse this delta: ...`; exit 0                | New report kind and a merge-conflict INFO class; verdict and exit semantics unchanged.                    |
| `validate --specs --report findings --json` on a project with zero specs         | n/a                                       | `{ report: { kind:'validation-findings', version:'1.0', scope:'specs', returnedItems:0, totalItems:0 }, itemFindings: [], ... }`   | Empty-scope findings is a normal success document, not a failure sum type.                                |
| `validate --archived --report findings --json`                                   | n/a                                       | same envelope with `scope:'archived'`; `--all --archived --report findings` rejected with `invalid_validation_report_request`       | Archived findings is a separate scope; archived+active mixing is a typed request error (exit 1).          |
| `validate --report findings` (no bulk scope) / with item name / `--report bogus` | n/a                                       | `{ status:[{ severity:'error', code:'invalid_validation_report_request', message, fix }] }`, exit 1                                | Typed request-error envelope; findings requires an explicit bulk scope and no item name.                  |
| `validate --all` (text mode) with a failing change                               | prints only `✗ change/<id>` per item      | prints `✗ change/<id>` then per-issue lines `  ✗ [ERROR] path: message`; `Details:` hint unchanged                                  | Human bulk output gained per-issue detail; JSON full report unchanged (`{items, summary, version, root}`). |
| `init . --tools codeassistant`                                                   | unknown tool                              | `11 skills and 11 commands in .codeassistant/`; skills `.codeassistant/skills/openspec-*/SKILL.md`, commands `.codeassistant/commands/opsx-*.md`; no IDE-restart line | New Agent delivery matrix entry; skills referenced by natural language, not slash commands.        |
| `init . --tools qoder`                                                           | `Restart your IDE for the new commands to take effect.` | `Restart your IDE to refresh commands.`                                                                             | Shared init/update restart wording; new shared module is the sole source.                      |
| `init` directory structure                                                       | empty `openspec/specs/`, `openspec/changes/archive/` untracked by Git | both gain `.gitkeep` anchors; re-init restores missing markers without overwriting files or following marker symlinks | Anchored empty dirs are part of init's created-path ledger.                                       |

A delta whose MODIFIED spec also fails structural validation produces the ERROR finding only; the merge-conflict
INFO for the same path is suppressed by the already-reported filter. Do not expect both on one path.

## Protocol delta

```text
1.12
  +-- validate --report full|findings (explicit bulk scope; request-error sum type)
  +-- validate merge-conflict INFO findings (archive merge dry-run; advisory, verdict-neutral)
  +-- buildUpdatedSpec preserves non-ENOENT filesystem errors (unreadable != missing)
  +-- Agent delivery: SourceCraft Code Assistant (.codeassistant; skills natural-language)
  +-- init writes .gitkeep directory anchors (wx flag; extend mode too; re-init restores)
  +-- shared IDE restart hint module (init + update; wording covers removals)
  +-- code-grounded planning templates (explore/propose/ff prompt content)
  `-- human validate/change output prints INFO; next-steps only when invalid
```

### 1. Findings is a new report transport, not a new truth

`validate --report findings` requires an explicit bulk scope (`--all`, `--changes`, `--specs`, `--archived`),
rejects an item name and archived+active mixing, and answers with one JSON document:

```text
{ report: { kind: 'validation-findings', version: '1.0', scope, returnedItems, totalItems },
  itemFindings: BulkItemResult[] (only items with issues; full issue arrays),
  summary: { totals, byType }, root }
```

`summary`/`root` are the full-report values; `returnedItems`/`totalItems` distinguish the filtered view from the
run size, and the process exit code stays the full-run rule (`failed > 0 -> 1`), so findings never re-labals
verdicts. `--report full` is the explicit default and changes nothing. Invalid requests produce the shared
`status`-array error envelope with code `invalid_validation_report_request` and a `fix` string. The full bulk
JSON envelope (`items`, `summary`, `version: '1.0'`, `root`) is byte-compatible with 1.11.

OpenSpecUI consequence: a new capability-gated CLI contract (`findingsReport`), used as evidence/surface
transport. Findings must not replace the full report as the validation truth source, and UI presentation of a
findings document must show both its filtered `returnedItems` and the full-run totals it preserves.

### 2. Merge-conflict findings are informational, advisory, and verdict-neutral

With `mainSpecsDir` known, change validation dry-runs archive's `findSpecUpdates` + `buildUpdatedSpec` and
emits `INFO` issues: `Archive would refuse this delta: <reason>` per conflicting delta, or one
`Could not check archive merge conflicts: <error>` when the advisory check itself fails (which no longer
discards the report). Filesystem errors (errno defined) inside the dry run are skipped, and paths already
reported as ERROR/WARNING/missing-header/empty-section are not duplicated. `INFO` existed in the level enum
before 1.12; validate now produces it, `--strict` escalation unchanged (strict counts errors/warnings).

Related: `buildUpdatedSpec` rethrows every filesystem error except `ENOENT`/`ENOTDIR`, so an unreadable target
spec is no longer synthesized as a missing-target finding. Validation evidence parsing must treat INFO as a
first-class level (display class, not noise) while keeping validity arithmetic CLI-owned.

### 3. SourceCraft Code Assistant is a new physical delivery matrix entry

```text
toolId            codeassistant
AI_TOOLS entry    SourceCraft Code Assistant; skillsDir .codeassistant; available; NOT requiresIdeRestart
skills root       .codeassistant/skills/openspec-<workflow>/SKILL.md (11 skills)
commands root     .codeassistant/commands/opsx-<command>.md (11 commands; YAML frontmatter description only)
skill references  natural-language prose (NATURAL_LANGUAGE_SKILL_TOOLS), no slash invocation for skills
migrations        none; detection is the default .codeassistant root
```

The registry, detection, generated-by version, and update outcome travel together as in prior lines.
OpenSpecUI projects the inventory and invokes the official CLI; it never hand-writes or deletes Agent
artifacts. The default v12 decision is to add the registry entry with `minCliSeries: '1.12'` and no
per-series overrides, mirroring how Zed entered at 1.10.

### 4. Init anchors empty directories in Git

`init` (both fresh and `--extend`) writes `.gitkeep` anchors under `ANCHORED_OPENSPEC_DIRS` (`specs/`,
`changes/archive/`) through the now-exported `ensureDirectoryAnchor`: it lists the directory first, writes with
the `wx` flag only when empty, tolerates `EEXIST`, and never replaces a file or follows a marker symlink.
Re-running init restores missing markers without overwriting existing files. OpenSpecUI's Initialize Project
Alert keeps delegating to `openspec init`; no parallel anchor logic may be introduced, and direct directory
enumeration that counts anchors as content must treat `.gitkeep` as an anchor, not an artifact.

### 5. The IDE restart hint is one shared module

`src/core/shared/ide-restart.ts` (`resolveIdeRestartSurface` / `formatIdeRestart`) is now the sole owner of the
restart rule and wording for both `init` and `update`: `Restart your IDE to refresh commands.` /
`Restart your IDE to refresh skills.` The same-tool coupling (IDE-resident tool plus a generated surface under
the active delivery, commands precedence) is preserved, and the wording deliberately covers workflow removal,
including an empty selection that removes every generated file. The `ValidatedInitTool` result no longer
carries `requiresIdeRestart`; the tool table remains the flag's source. OpenSpecUI's
`requiresIdeRestartSince`-style projection continues to derive from the AI_TOOLS table, and no new tool in
1.12 sets the flag.

### 6. Code-grounded planning changes generated template content

The explore skill gains a `PLANNING_GUIDANCE` section (focused discovery questions, dependency-aware ordering,
grounded recommendations, conversation-only decision record); propose and fast-forward gain
`Inspect the relevant project before drafting` instructions. These change generated skill/command artifact
content and agent behavior, not CLI JSON shapes. OpenSpecUI consequence: generator staleness rotation — under
the v12 single-series window, artifacts `generatedBy` 1.11 become stale (below-admitted), and the pinned
generator display version moves to `1.12.0`.

### 7. Human output now prints INFO findings

Single-item `validate`/`change` text output prints every issue level (ERROR/WARNING/INFO) even for valid
items, and the next-steps footer is gated on `!valid`. Bulk text output prints per-issue detail lines under
each item. JSON envelopes are unchanged. OpenSpecUI's typed executors parse JSON; any stderr/stdout prose
capture in evidence surfaces must tolerate the new lines rather than pattern-match 1.11 text.

### 8. Upstream packaging notes (fixture-install implications only)

`packageManager` moved pnpm 9 -> 10, `prepare` is `node build.js` (npm Git installs no longer require pnpm on
the consumer machine), changesets devDependencies were bumped, and chalk stays Node-20-compatible; the
`engines` floor is unchanged (`>=20.19.0`). OpenSpecUI's `prepare-openspec-reference.mjs` flow
(`pnpm install --ignore-scripts` then `pnpm run build`) still produces `dist/cli/index.js`; it invokes the
workspace pnpm, not the declared packageManager, so the pin guard and fixture harness are unaffected. The
fast-uri advisory patch is upstream-internal.

## Changelog-visibility gap

The published 1.12.0 changelog section lists 7 entries (2 minor, 5 patch); 13 additional merged commits are
absent from it, but all are docs (store links, community showcase, PowerShell completion, archive guide,
pixel routing, spec-behavior alignment), CI (changesets/action bump), or dependency chores (website group,
eslint, security advisories). No protocol-relevant commit is missing this cycle. Adaptation still follows the
pinned source diff, not changelog prose.

## Current owner map

| Surface                     | Primary production owner                                             | Existing evidence owner                  | v12 change                                                                        |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| compatibility gate and copy | `packages/core/src/openspec-compat.ts`                               | `openspec-compat.test.ts`                | v12 accepted/current classification; 1.10/1.11 -> blocked; NEXT_SERIES 1.13.0      |
| workflow JSON contracts     | `packages/core/src/cli-contracts/workflow.ts`, `executor.ts`         | contract tests                           | findings report contract; `invalid_validation_report_request`; INFO level passthrough |
| CLI execution               | `packages/core/src/cli-executor.ts`                                  | executor contract tests                  | `validate --report <full|findings>` argv                                            |
| capability gates            | `packages/core/src/openspec-compat.ts` (`deriveOpenSpecCliCapabilities`) | capability tests                     | `findingsReport` 1.12-only; batchStatus/requirementDiff disposition per source     |
| Agent registry/state        | `packages/core/src/agent-delivery-registry.ts`, `tool-init-state.ts` | registry/state tests                     | codeassistant entry; series type `'1.12'`; pinned generator 1.12.0                  |
| Agent delivery projection   | `packages/server/src/agent-delivery-projection-service.ts`           | service tests                            | objective presentation of the new inventory entry                                   |
| Config Agent UI             | `/config/agents`                                                     | Web component tests                      | SourceCraft inventory row; natural-language skill reference display                 |
| validation evidence         | Change/validation evidence owners (`archived-validation-evidence`, server validate services) | component/service tests   | findings surface; INFO as first-class display class                                  |
| distribution release        | Changesets plus package build/pack scripts                           | release/package tests                    | major v12 preparation only                                                          |

## Scope boundary

In scope:

- OpenSpecUI 12 compatibility, typed contracts, findings report evidence surface, merge-conflict INFO
  presentation, SourceCraft Agent delivery projection, init/update passthrough behavior, generator staleness
  rotation, and evidence presentation for every supported 1.12.x behavior above.
- Real pinned 1.12.0 fixtures, focused owner tests, package build/pack preparation, a major-version Changeset,
  README updates under the release README law, and reference pin publication.

Out of scope:

- Any `1.13` admission claim, a separate OpenSpecUI 13 release, or a 1.11 compatibility bridge.
- Supporting OpenSpec CLI `<1.12.0`, prereleases, or `>=1.13.0`.
- Changing OpenSpec source, replicating archive/merge logic locally, or repairing unrelated historical Changes.
- Publishing, PR merge, archive, release, and final end-to-end browser acceptance. Those remain later owner
  actions.

## Execution rule

Each implementation slice starts with one production owner, one precise red case, and one green case. A failed
focused review stops the slice before broader gates. Only after all focused evidence passes may the
implementation agent run package, build, and distribution checks. Browser automation remains preparation
evidence; the final interactive walkthrough is Owner-only.
