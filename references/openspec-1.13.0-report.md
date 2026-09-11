<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Record the verified OpenSpec 1.13 protocol baseline for OpenSpecUI 13 planning.
2. Separate upstream CLI-owned behavior from OpenSpecUI projection and admission responsibilities.
3. Map each observable protocol change to a production owner, exact regression case, and release gate.
4. Preserve the external validation constraints that the v13 Change must not silently repair.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec 1.13 -> OpenSpecUI 13 adaptation report

## Decision

```text
OpenSpecUI 13
  adapted / supported      OpenSpec CLI >=1.13.0 <1.14.0
  current / recommended    OpenSpec CLI >=1.13.0 <1.14.0
  rejected                 <1.13.0 (including the whole 1.12 v12 window), prereleases, >=1.14.0, unparseable
```

The v12 report pre-declared 1.13 admission as "a separately verified decision: either a 12.x window widening
(the 6.1/1.7-bridge precedent) or a new major, depending on the 1.13 protocol delta". This report verifies the
delta and selects the **new-major** path, consistent with the cadence every line since v7 has used (v7 -> 1.7,
v9 -> 1.8+1.9, v11 -> 1.10+1.11, v12 -> 1.12, v13 -> 1.13):

- The delta is small but real: Apply Instructions gains two protocol-visible JSON fields
  (`missingPrerequisites`, `warnings`) whose *projection* is a v13 obligation, and generated guidance content
  changed (explore/propose), which rotates the generator-staleness baseline. Both fit the established
  one-line-per-series delivery vehicle (typed contract + capability window + README scope) better than a
  bridge, and a bridge would force the staleness baseline to become series-conditional inside 12.x.
- No 1.13 capability is removed or renumbered; every 1.12 contract this repo consumes is byte-shape compatible
  (`missingPrerequisites`/`warnings` are additive optional fields that 1.12's `.passthrough()` already
  tolerates). Nothing blocks a fast v13.
- `1.14` is not pre-claimed. Widening again is a separately verified decision, exactly as v12 treated 1.13.

This single-series decision is explicitly vetoable during Change review; every behavior accepted by the v13
admission range remains an implementation and fixture obligation, and the current-page-only
Skip-version-check bypass law carries over unchanged.

## Evidence baseline

```text
Observed                 2026-09-12 Asia/Shanghai
Package                  @fission-ai/openspec
npm latest               1.13.0 (published 2026-09-09T21:08:28Z)
Reference repository     references/openspec
Pinned tag               v1.13.0
Pinned commit            9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461
Previous OpenSpecUI pin  v1.12.0 / e062b9572be933564ba3899d059377dfa1393e32
Current OpenSpecUI line  12.x
Upstream delta           15 commits, src +679/-76 across 10 files (plus tests +2783/-36, docs, CI chores)
```

Sources inspected:

- `references/openspec` at the pinned v1.13.0 tag: `src/commands/workflow/instructions.ts`,
  `src/commands/workflow/shared.ts`, `src/core/parsers/requirement-blocks.ts`, `src/core/specs-apply.ts`,
  `src/core/templates/workflows/{explore,propose}.ts`, `src/core/{init,update,onboarding-commands}.ts`,
  `src/core/shared/tool-detection.ts`, `CHANGELOG.md`, `package.json`.
- The published npm executable `@fission-ai/openspec@1.13.0` (`npm exec --yes --package=...`) against a
  disposable isolated fixture repository (own `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`).
- Current OpenSpecUI owners and tests under `packages/core`, `packages/server`, `packages/web`, `packages/cli`,
  `scripts/prepare-openspec-reference.mjs`.

## Verified CLI observations

Commands below used the npm-published 1.13.0 executable in an isolated fixture (`openspec init . --tools=none`,
then `openspec new change no-specs-but-tasks`, default `spec-driven` schema):

| Command and fixture                                          | 1.12.0                       | 1.13.0                                                                                                       | v13 consequence                                                                                   |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `openspec --version`                                         | `1.12.0`                     | `1.13.0`                                                                                                     | Version classification input only.                                                                |
| `instructions apply --json`, change with only `.openspec.yaml` | `missingArtifacts:["tasks"]` | `state:blocked`, `missingArtifacts:["tasks"]`, **`missingPrerequisites:["proposal","specs","design","tasks"]`** (build-order closure), no `warnings` | New informational field naming the whole prerequisite chain, not just apply's first hop.          |
| `instructions apply --json`, change with `proposal.md` + `tasks.md` (1/2 done), no delta specs | `state:"ready"` (no field) | `state:"ready"`, **`warnings:[...]`** no-delta-specs advisory naming `openspec validate` failure + both remedies, **`missingPrerequisites:["specs","design"]`** (conditional artifacts not built), `progress:{2,1,1}` | New warning class on the ready state; pairs the ready signal with the validate-refusing gap.       |
| `instructions apply` text (blocked)                          | `Use the openspec-continue-change skill...` | `Not created yet, in build order: ...` + `Create it with \`openspec instructions <artifact> --change <name>\`` | Remedies name CLI verbs now (the `core` profile never installs that skill). Text surfaces must not pattern-match the old string. |
| Engines / packageManager                                     | `>=20.19.0` / pnpm 10        | unchanged (`>=20.19.0`, `pnpm@10.34.5`); pnpm overrides moved out of `package.json` into `pnpm-workspace.yaml`  | Reference-build and fixture-install flow unaffected.                                              |

Executed ready-state document (scenario 2 above; `warnings` shown in full because its exact text is the
projection contract):

```json
{
  "state": "ready",
  "missingArtifacts": null,
  "missingPrerequisites": ["specs", "design"],
  "warnings": [
    "This change has no delta specs and does not declare `skip_specs: true`, so `openspec validate no-specs-but-tasks` fails on it. Write the delta specs before implementing (`openspec instructions specs --change no-specs-but-tasks`), or add `skip_specs: true` to <changeDir>/.openspec.yaml if this change really changes no specified behavior."
  ],
  "progress": { "total": 2, "complete": 1, "remaining": 1 }
}
```

Semantics verified from source (`collectMissingPrerequisites` / `collectApplyWarnings` in
`src/commands/workflow/instructions.ts`):

- `missingPrerequisites` is the transitive closure of `apply.requires` over the schema's artifact graph,
  filtered to not-completed ids, sorted by build order. It can be non-empty in the `ready` state (conditional
  artifacts like `specs`/`design` that apply does not gate on) — it is evidence, not a gate.
- `warnings` fires only when `state !== 'blocked'`, the schema declares a spec-producing artifact, that
  artifact is neither skipped nor present on disk, and no spec artifact produced output. A schema with no
  spec-producing artifact, or one whose spec artifact is `skip_specs`-declared, never warns. The warning text
  names the schema's own spec artifact id when exactly one exists (`<artifact-id>` placeholder otherwise) and
  embeds the absolute metadata path.
- Both fields are conditionally spread — absent (not `null`/`[]`) when empty. 1.12 consumers never saw them.

## Protocol delta

```text
1.13
  +-- instructions apply --json: missingPrerequisites (build-order closure, present even when ready)
  +-- instructions apply --json: warnings (no-delta-specs advisory; ready/all_done states only)
  +-- apply remedies name CLI verbs (instructions/status), not the openspec-continue-change skill
  +-- propose guidance: context-load-first step (openspec context --json gate; no implicit root creation)
  +-- explore/propose guidance: spec-inventory verb (openspec list --specs; show --type spec --json --no-scenarios)
  +-- init/update profile notes name left-out workflows + one `openspec config profile` pointer
  +-- update detects drifted command files (content compare under a generatedBy skill version)
  `-- parser/merge fixes: CommonMark [*+-] markers, duplicate delta sections, per-section rename pairs,
      fence-aware blank collapsing, wrapped scenario bullets
```

### 1. Apply readiness guidance is two new typed fields, not a new gate

`missingPrerequisites` and `warnings` are additive optional members of the Apply Instructions success
document. Apply still blocks on `apply.requires` alone; the new fields describe *why* and *what else*, and the
warning names the objective downstream fact (`openspec validate` fails) rather than changing apply's verdict.
`state`, `progress`, `tasks`, `missingArtifacts`, exit codes, and the failure sum type are unchanged.

OpenSpecUI consequence: `CliApplyInstructionsSuccessSchema` gains the two optional fields and the planning
projection surfaces them. Per the OPSX-first information hierarchy law the warning is direct-plane evidence
(it predicts a validation failure), while `missingPrerequisites` is readable next-step evidence. The 2026-08-18
law still holds: `Applying` plus CLI `completed/total` remains driven by CLI task evidence, not by these
fields.

### 2. Apply remedy text now names CLI verbs

The blocked/tracking-file remedy strings no longer reference the `openspec-continue-change` skill (which the
default `core` profile never installs); they name `openspec instructions <artifact> --change <name>` and
`openspec status --change <name>`. JSON consumers are unaffected; any OpenSpecUI surface that captures
instruction prose must not pattern-match the old skill name.

### 3. Propose guidance loads context before planning

The generated propose skill/command inserts an explicit step: run `openspec context --json` (honoring
`--store`), use `root.path` as authoritative, stop without writing on `no_openspec_root` and offer `openspec
init` instead of creating an implicit root, and apply a valid `context` field (<= 51,200 bytes UTF-8) from
`config.yaml`/`config.yml` as planning constraint. Later steps renumber (2->3, 3->4...). This changes generated
artifact content, not CLI JSON shapes.

### 4. Explore and propose guidance teach the spec-inventory verb

`openspec list --specs` (and `openspec show <spec-id> --type spec --json --no-scenarios`) now appear in the
explore and propose generated guidance, with `--store` rules and the full-read-before-deciding caveat. Same
consequence class as 3: generator-staleness rotation, no typed-contract change.

### 5. Init/update profile notes and update drift repair

`init` and `update` print one consolidated notes block that names the workflows the active profile left out
with a single `openspec config profile` pointer (`formatOptionalWorkflowsNote`; skipped when no tool received
a workflow surface). Separately, `update`'s staleness check now also compares command-file content when a
skill `generatedBy` version exists — a hand-edited or truncated command file no longer reads as "up to date"
(#1808). The repair itself is CLI-owned; OpenSpecUI's Agent Update projection keeps invoking `openspec update`
and may now observe *more* repairs, which its evidence presentation must tolerate without new logic.

### 6. Parser and archive-merge correctness fixes (CLI-internal)

`requirement-blocks.ts` accepts every CommonMark bullet marker (`-`, `*`, `+`) in REMOVED/RENAMED sections,
keeps duplicate delta section headers as a list (each body read, own line numbers; rename pairs per section),
and the archive audit handles wrapped scenario bullets and `+`-bulleted specs. `specs-apply.ts` collapses blank
runs only outside fenced code blocks. These change what validates and archives successfully — more inputs are
now accepted and fewer silently dropped — but no JSON shape moved. OpenSpecUI delegates parsing/merging to
the CLI (CLI-first law); fixtures that assert *acceptance* of these forms belong to the pinned 1.13.0 fixture
matrix, not to parallel UI-side logic.

### 7. Upstream packaging notes (fixture-install implications only)

`package.json` drops the `pnpm.overrides` block (overrides now live only in `pnpm-workspace.yaml`), `engines`
(`>=20.19.0`) and `packageManager` (`pnpm@10.34.5`) are unchanged, and website/CI dependency chores are
upstream-internal. The `prepare-openspec-reference.mjs` flow (install + build -> `dist/cli/index.js`) is
unaffected apart from the pin guard commit.

## Changelog-visibility gap

The published 1.13.0 changelog lists 9 entries (1 minor, 8 patch); the remaining merged commits are docs
(CONTRIBUTING.md), CI (flake hash reporting), and dependency chores (website group, zod/eslint, pnpm overrides
placement). No protocol-relevant commit is missing from the changelog this cycle. Adaptation still follows the
pinned source diff, not changelog prose.

## Current owner map

| Surface                     | Primary production owner                                             | Existing evidence owner                  | v13 change                                                                        |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| compatibility gate and copy | `packages/core/src/openspec-compat.ts`                               | `openspec-compat.test.ts`                | v13 accepted/current classification; 1.12 -> blocked; NEXT_SERIES 1.14.0           |
| workflow JSON contracts     | `packages/core/src/cli-contracts/workflow.ts`, `executor.ts`         | contract tests                           | Apply Instructions `missingPrerequisites` + `warnings` optional members            |
| CLI execution               | `packages/core/src/cli-executor.ts`                                  | executor contract tests                  | no argv change (instructions apply flags unchanged)                               |
| capability gates            | `packages/core/src/openspec-compat.ts` (`deriveOpenSpecCliCapabilities`) | capability tests                     | target series '1.13'; existing capabilities stay true; no new flag required        |
| Agent registry/state        | `packages/core/src/agent-delivery-registry.ts`, `tool-init-state.ts` | registry/state tests                     | pinned generator 1.13.0; staleness rotation; no new tool entries in 1.13           |
| Agent delivery projection   | `packages/server/src/agent-delivery-projection-service.ts`           | service tests                            | tolerate update-driven command-file repairs in evidence                            |
| planning projection         | `packages/core/src/planning-cli-projection.ts`, server service       | projection tests                         | project apply warnings (direct plane) + missingPrerequisites (readable evidence)   |
| Change Detail apply UI      | Change Detail Apply dialog owner                                     | Web component tests                      | warnings and build-order chain presentation                                        |
| reference pin guard         | `scripts/prepare-openspec-reference.mjs`                             | script + fixture guards                  | EXPECTED_COMMIT -> 9d4e5974; intent header update                                 |
| pinned fixtures             | `packages/core/src/__tests__/official-cli-v12-fixtures.ts` + alias   | fixture matrix tests                     | new v13 helper + `openspec-cli-113` alias; retained 1.12.0 proves boundary rejections |
| distribution release        | Changesets plus package build/pack scripts                           | release/package tests                    | major v13 preparation only                                                        |

## Scope boundary

In scope:

- OpenSpecUI 13 compatibility window, Apply Instructions typed contract extension and its Web projection,
  generator-staleness rotation to the 1.13.0 baseline, reference pin (submodule + guard) publication, pinned
  1.13.0 fixture matrix with 1.12.0 boundary negatives, and evidence presentation for every supported 1.13.x
  behavior above.
- Focused owner tests, package build/pack preparation, a major-version Changeset, and README updates under
  the release README law (repository README version table + `packages/cli/README.md` line scope).

Out of scope:

- Any `1.14` admission claim, a 1.12 compatibility bridge inside 13.x, or reopening the v12 line.
- Supporting OpenSpec CLI `<1.13.0`, prereleases, or `>=1.14.0`.
- Changing OpenSpec source, replicating parser/merge logic locally, or repairing unrelated historical Changes.
- Publishing, PR merge, archive, release, and final end-to-end browser acceptance. Those remain later owner
  actions.

## Execution rule

Each implementation slice starts with one production owner, one precise red case, and one green case. A failed
focused review stops the slice before broader gates. Only after all focused evidence passes may the
implementation agent run package, build, and distribution checks. Browser automation remains preparation
evidence; the final interactive walkthrough is Owner-only.
