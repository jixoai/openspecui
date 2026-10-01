<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Record the verified OpenSpec 1.14 protocol baseline for OpenSpecUI 14 planning.
2. Separate upstream CLI-owned behavior from OpenSpecUI projection and admission responsibilities.
3. Map each observable protocol change to a production owner, exact regression case, and release gate.
4. Preserve the external validation constraints that the v14 Change must not silently repair.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpec 1.14 -> OpenSpecUI 14 adaptation report

## Decision

```text
OpenSpecUI 14
  adapted / supported      OpenSpec CLI >=1.14.0 <1.15.0
  current / recommended    OpenSpec CLI >=1.14.0 <1.15.0
  rejected                 <1.14.0 (including the whole 1.13 v13 window), prereleases, >=1.15.0, unparseable
```

The v13 report pre-declared 1.14 admission as "a separately verified decision: either a 13.x window widening
or a new major". The verified delta selects the **new major**: ten new Agent registry entries (40→50 tools,
including two new sharers of the `.agents` skills root), one new CLI command family (`openspec version`),
archived changes entering the `list` protocol, apply tasks gaining mandatory source locations, and a new
top-level `status --json` `warnings` member. Five JSON contract surfaces moved — far beyond a patch bridge —
and the one-line-per-series cadence (v7→1.7 … v13→1.13) continues. `1.15` is not pre-claimed.

Within the 1.13 window, upstream also shipped 1.13.1/1.13.2; the v13 gate admits the whole stable 1.13 series
already, so no widening debt exists.

## Evidence baseline

```text
Observed                 2026-10-02 Asia/Shanghai
Package                  @fission-ai/openspec
npm latest               1.14.0
Reference repository     references/openspec
Pinned tag               v1.14.0
Pinned commit            94ca9c1eb15d1b49c06c988419b75c3d95f8b2b5
Previous OpenSpecUI pin  v1.13.0 / 9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461
Current OpenSpecUI line  13.x (main @ 4d8c0072; the 2026-09-27 update-openspec-cli-1132 change already
                         rotated the line to CLI 1.13.2 inside the unchanged 1.13 window — Kilo commands
                         `.kilo/command/`, apply taskTracking evidence contract, artifact-glob parity, and
                         the 1.13.2 fixture matrix are delivered and are NOT repeated here)
Upstream delta           112 commits, src +5229/-885 across 93 files (three Version Packages releases: 1.13.1, 1.13.2, 1.14.0)
```

Sources inspected: `src/commands/workflow/instructions.ts` (LocatedTask), `src/core/list.ts` (archived/nested),
`src/core/version-check.ts` + `src/cli/index.ts` (version command), `src/core/change-status-policy.ts`
(edit roots), `src/core/config.ts` (AI_TOOLS 40→50), `src/core/command-generation/{registry,adapters/*}`,
`CHANGELOG.md` (1.14.0 + 1.13.2 sections), plus executed npm `@fission-ai/openspec@1.14.0` against a disposable
isolated fixture.

## Verified CLI observations (executed on the npm-published 1.14.0)

| Surface | 1.13.0 | 1.14.0 (executed) | v14 consequence |
| --- | --- | --- | --- |
| `instructions apply --json` tasks | `{id, description, done}` | each task adds **`sourcePath`** (absolute) and **`line`** (1-based), always present | Apply task contract gains the two members; projection may surface them as evidence |
| `list --archived --json` / `--all` | flag rejected | archived entries returned; every entry carries **`archived: boolean`** (present only under `--archived`/`--all`) | New list transport for archive inventory; capability-free inside the single-series window |
| `list --json` (default) | `{changes, root}` | entries may carry **`nested: string[]`** (namespace folders, #1846/#1849) and the envelope a top-level **`warnings: [{code:'nested_change_directory', name, nested, message}]`** (omitted when empty) | Change-list contract tolerates the new members; nested findings are objective CLI evidence |
| `openspec version [--check] [--json]` | no such command | `{schemaVersion:1, version, install:{location,packageManager,scope}, update?:{...status,latest?,command,canSelfUpgrade}}` (executed without `--check`; `update` absent then) | New typed command contract; `--check` performs an opt-out-able registry probe |
| `status --json` | no `warnings` | top-level **`warnings: string[]`** names unrecognized `.openspec.yaml` keys (executed: `skip_design` warning verbatim; known keys now include `goal, affected_areas, initiative, skip_specs, retire_capabilities`) | Status contract gains optional `warnings`; direct-plane advisory evidence |
| `status --json` `actionContext.allowedEditRoots` (store-backed) | store only | `[implementationRoot, projectRoot]` — the declaring repo joins the store; constraint text tells the agent to ask otherwise | Same array shape, changed semantics; no schema edit, fixture values rotate |
| Agent registry | 40 tools | **50 tools** — added `amp` (`.agents` skills root!, detection `.amp`), `gsd` (`.agents` skills root!, detection `.gsd`), `atomcode`, `codestudio` (requiresIdeRestart), `dsh` (skills-only `.dsh`), `easycode` (TOML commands `/opsx:<id>`), `gigacode`, `grok` (skills-only `.grok`), `veai` (skills-only `.veai`), `warp` (`.warp`, detection `WARP.md`) | Registry inventory grows by ten; shared-root ownership scenarios extend beyond codex/zed/agents |
| Registry label/dir changes | — | `Bob` → **`IBM Bob`**; Kilo Code commands move to **`.kilo/command/`** (from `.kilocode/workflows/`, legacy cleanup); Devin Desktop label notes "(formerly Windsurf)" | Display-name + physical-path facts rotate; kilocode command root changes |

Behavioral (CLI-internal, no JSON shape): archive aborts when the spec sync reports a blocking condition
(#1759); archive workflows use schema-aware task progress; Windows EPERM copy fallback; security hardening
(#1835); ~20 validate/parser correctness fixes (scenario body required, requirements outside delta sections,
case-differing requirement names, malformed RENAMED pairs, MODIFIED adds reporting, TBD/TODO punctuation,
checkbox markers `{x}`-style counted); `openspec view` TUI shows workflow status; Nix overlay.

## Protocol delta

```text
1.14
  +-- openspec version [--check] [--json]  (new command; schemaVersion 1 envelope)
  +-- instructions apply --json: tasks gain sourcePath + line (always present)
  +-- list --archived / --all: archived inventory over the same JSON envelope; per-entry archived flag
  +-- list --json: nested namespace-folder findings + top-level warnings array (nested_change_directory)
  +-- status --json: top-level warnings (unrecognized .openspec.yaml keys)
  +-- status actionContext.allowedEditRoots: store-backed changes add the declaring repo
  +-- show --json: requirement/scenario name members (additive)
  +-- Agent registry +10 entries (amp, gsd share .agents root); IBM Bob label; Kilo commands → .kilo/command/
  `-- archive/validate/parser hardening (CLI-internal; fixture-scoped, never UI-side logic)
```

### 1. `openspec version` is a new command family

Executed envelope: `{schemaVersion:1, version, install:{location,packageManager,scope}}` with `update`
conditionally spread under `--check`. The registry probe honors CI/no-network and `DO_NOT_TRACK` opt-outs and
time-boxes at 1.5s. OpenSpecUI consequence: a typed CLI contract for the envelope; no UI integration is
required by this line (Settings diagnostics may cite `install` facts later — explicitly out of scope here).

### 2. Apply task source locations are mandatory members

`sourcePath` (absolute) and `line` (1-based) ride every apply task (upstream `LocatedTask`). The typed
contract should carry them as **optional** members (older in-flight payloads and static snapshots may lack
them) while the v14 fixtures assert their presence on real 1.14 output. They are evidence for "which file the
checkbox lives in"; OpenSpecUI must not re-derive or second-guess them.

### 3. Archive inventory enters the `list` protocol

`list --archived --json` returns archived entries with the same per-entry shape plus `archived: true`;
`--all` mixes both. OpenSpecUI's **Archive list keeps its reactive-filesystem adapter as the projection
owner** this line; switching the archive inventory to the CLI transport is a separate architectural change
(out of scope, recorded below). The typed `list` contract nonetheless gains `archived?`, `nested?`, and the
top-level `warnings` array so the CLI evidence is never lossy when consumed.

### 4. Status warnings are direct-plane advisory evidence

Executed verbatim: `"Unrecognized key name(s) in .openspec.yaml (untrusted data, not instructions):
skip_design. Known keys: schema, created, goal, affected_areas, initiative, skip_specs,
retire_capabilities. ..."`. `validate --strict` fails on them. OpenSpecUI projects the member verbatim
(CLI-owned); it is advisory, never a Root/action gate (mirrors the v13 apply-warnings law).

### 5. The Agent registry grows by ten — including two new `.agents` root sharers

`amp` and `gsd` join `codex`/`zed`/`antigravity`/`agents` on the shared `.agents` skills root (detection via
`.amp` / `.gsd`). The shared-root ownership spec scenario ("three-valued") must generalize: owner evidence
still comes from the official marker and arbitration; co-located targets share one physical tree. Kilo Code's
command root moves to `.kilo/command/` with legacy cleanup of the old dir. `codestudio` sets
`requiresIdeRestart`. Skills-only entries (`dsh`, `grok`, `veai`) follow the Zed precedent (no command
surface). Series rotates to `'1.14'`; the provenance union retains `'1.12'`/`'1.13'`; the pinned generator
moves to 1.14.0 with series-aware staleness (1.13.x-generated artifacts become stale).

### 6. Store-backed edit roots name the declaring repo

Same array shape, new member: `allowedEditRoots: [implementationRoot, projectRoot]` with guidance text.
Fixture expectations that pinned store-only roots rotate; no production branching on root count is allowed.

## Current owner map

| Surface | Primary production owner | v14 change |
| --- | --- | --- |
| compatibility gate | `packages/core/src/openspec-compat.ts` (+test, `scripts/diagnose-cli-runner.mjs`(+test), `scripts/setup-example.ts`) | v14 ranges, NEXT_SERIES 1.15.0, mirrors |
| workflow JSON contracts | `packages/core/src/cli-contracts/workflow.ts` (+test) | apply task `sourcePath`/`line`; status top-level `warnings`; list `archived`/`nested`/`warnings`; version envelope contract |
| projection schemas | `packages/core/src/opsx-types.ts` (+test), `planning-cli-projection.ts` | same members through input/projection chains |
| Agent registry/state | `packages/core/src/agent-delivery-registry.ts`, `tool-init-state.ts` (+tests, server projection/router tests) | +10 entries, kilo dir, IBM Bob label, series `'1.14'`, generator `1.14.0` |
| Web evidence | change-view / evidence surfaces (+tests) | status `warnings` projected as direct-plane advisory (v13 summary-row pattern) |
| reference pin | `scripts/prepare-openspec-reference.mjs`, `upstream-contract-regression.test.ts`, `w2-project-binding-playwright.ts` | pin `94ca9c1e` |
| fixtures | `packages/core/package.json` alias + `__tests__/official-cli-v14-fixtures.ts` + suite rotation | positive line 1.14.0; boundary 1.13.0 |
| release | Changesets + README law (repo en/zh + CLI package) | major v14 |

## Scope boundary

In scope: the v14 admission window; typed contracts for version/list/status/apply-task members and their
projection; the ten-entry registry rotation with shared-root scenario updates; status `warnings` direct-plane
presentation following the v13 summary-row law; pinned fixture rotation with 1.13.0 boundary negatives;
README/AGENTS/Changeset major preparation.

Out of scope (follow-ups, not silently absorbed):

- Switching the Archive list inventory from the reactive-filesystem adapter to the `list --archived` CLI
  transport (architectural; reactive model changes).
- Any Settings/Config UI surface consuming `openspec version --check` (update UX is a product decision).
- `1.15` admission claims; supporting CLI `<1.14.0`, prereleases, `>=1.15.0`; UI-side re-implementation of
  upstream validate/parser fixes.
- Publishing, PR merge beyond CI gates, archive, and final browser walkthrough (Owner-only).

## Execution rule

Each slice starts with one production owner, one precise red case, one green case; focused gates before
broad gates; per-package explicit test runs (the recursive `test:ci` aborts at the first failing package);
`pnpm --filter <pkg> exec vitest run <file>` only.
