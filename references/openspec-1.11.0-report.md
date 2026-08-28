<!--
Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
1. Record the verified OpenSpec 1.10 and 1.11 protocol baseline for OpenSpecUI 11 planning.
2. Separate upstream CLI-owned behavior from OpenSpecUI projection and admission responsibilities.
3. Map each observable protocol change to a production owner, exact regression case, and release gate.
4. Preserve the external validation constraints that the v11 Change must not silently repair.

Original request (2026-08-28): "openspec v0.11.0 开始相关的适配工作。我们目前是 openspecui v9 适配 0.9.*，直接跳过 0.10.0，我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
-->

# OpenSpec 1.10 + 1.11 -> OpenSpecUI 11 adaptation report

## Decision

```text
OpenSpecUI 11
  adapted / supported      OpenSpec CLI >=1.10.0 <1.12.0
  current / recommended    OpenSpec CLI >=1.11.0 <1.12.0
  supported, non-current   OpenSpec CLI 1.10.x
  rejected                 <1.10.0, prereleases, >=1.12.0, unparseable
```

OpenSpecUI 11 deliberately skips a separate v10 release, mirroring the v9-over-v8 precedent. It is not a
1.11-only gate: every behavior accepted by the v11 admission range is an implementation and fixture obligation.
`1.10.x` is supported non-current, not a legacy escape hatch. OpenSpec CLI `1.9.x` and older are blocked by
default in v11; the current-page-only Skip-version-check bypass law carries over unchanged.

## Evidence baseline

```text
Observed                 2026-08-28 Asia/Shanghai
Package                  @fission-ai/openspec
npm latest               1.11.0
Reference repository     references/openspec
Pinned tag               v1.11.0
Pinned commit            a0ddb60d040c61f4907436a9d91310934b1dda63
Previous OpenSpecUI pin  v1.9.0 / 2826b8889e5223a9a8095d4428b60b56597e1020
Current OpenSpecUI line  9.x
Upstream delta           31 commits, src+schemas +2140/-359 across 48 files
```

Sources inspected:

- `references/openspec` at the pinned v1.11.0 tag: `src/commands/workflow/status.ts`, `src/commands/change.ts`,
  `src/commands/show.ts`, `src/utils/requirement-diff.ts`, `src/core/init.ts`, `src/core/validation/`,
  `src/core/specs-apply.ts`, `src/core/archive.ts`, `src/commands/schema.ts`, `src/core/completion-tip.ts`,
  `src/core/config.ts`, `src/core/shared-skill-target.ts`, `src/core/migration.ts`, `src/core/profiles.ts`,
  `src/core/command-generation/adapters/{antigravity,opencode}.ts`, `schemas/spec-driven/schema.yaml`.
- The published npm executables `@fission-ai/openspec@1.10.0` and `@fission-ai/openspec@1.11.0` run against a
  disposable fixture repository (init, status, show, validate).
- Current OpenSpecUI owners and tests under `packages/core`, `packages/server`, `packages/web`, `packages/cli`.

## Verified CLI observations

All commands below used the published executables, not a source-only inference:

```text
npm exec --yes --package=@fission-ai/openspec@1.10.0|1.11.0 -- openspec <command>
```

| Command and fixture                                                                | 1.10.0                                                                                  | 1.11.0                                                                                                                                                  | v11 consequence                                                                                             |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `status --all --json` with one healthy change                                      | `error: unknown option '--all'`                                                         | `{ changes: [ChangeStatus...], root }`; per-entry fields identical to single-change status                                                              | Batch transport is a 1.11-only capability requiring a capability gate and a new sum-type contract.          |
| `status --all --json` with a change whose `.openspec.yaml` names an unknown schema | n/a                                                                                     | failed entry is `{ changeName, status: [{severity:'error', code:'change_error', message}] }` in place; process exit 1; full JSON envelope still printed | Parse the envelope regardless of exit code; a failed entry is per-change evidence, not a transport failure. |
| `status --all --json` on a project with zero active changes                        | n/a                                                                                     | `{ changes: [], message: 'No active changes.', root }`; exit 0                                                                                          | The `message` key appears only on the empty set; tolerant parsing required.                                 |
| `show <change> --json --diff` with one MODIFIED delta                              | flag rejected (argument error)                                                          | delta gains `diff` (unified-diff body with `@@` hunks, `-`/`+` lines); payload also carries `root`                                                      | MODIFIED-only additive fields; ADDED/REMOVED/RENAMED deltas unchanged.                                      |
| `init --tools=none --language Chinese`                                             | works; `config.yaml` gains `context: \|` block with `Language: Chinese` + 2 fixed lines | same                                                                                                                                                    | Language persists through the Active Root `context` field, not a new config key.                            |
| `validate --specs --json` with a `TBD` Purpose                                     | no placeholder finding                                                                  | `WARNING` issue `{ path: 'overview', line, message: 'Purpose section is still a placeholder ...' }`; non-strict summary unchanged, strict fails         | New warning class within the existing issue level enum; strict escalation must stay CLI-owned.              |

An empty change directory (no artifacts) still loads as a normal batch entry with blocked/ready artifact states;
the failure-entry shape requires an actual load error. Do not conflate the two.

## Protocol delta

```text
1.10
  +-- init --language (context-block persistence)
  +-- Agent delivery: Zed Agent (skills-only, shared .agents root)
  +-- opencode command argument passthrough ($ARGUMENTS injection)
  +-- custom profile auto-injects sync beside archive workflows
  +-- npm postinstall removed; first-run completion tip on stderr
  `-- telemetry first-run notice moved to stdout -> stderr

1.11
  +-- status --all batch envelope (single spawn, per-change failure sum type)
  +-- show --diff per-requirement diffs + warnings on MODIFIED deltas
  +-- validate Purpose-placeholder warning (+ --strict escalation)
  +-- schema init --default transactional staging/rollback + discovery exclusions
  +-- archive requirement-rename order preservation + retirement guidance
  +-- Antigravity .agent -> .agents migration + shared-root arbitration rework
  `-- explore write-confirmation + ASCII diagrams; tasks verification template
```

### 1. Batch status is a new transport, not a new truth

`status --all --json` returns every active change in one process. A healthy entry's fields are identical to
the single-change `status --change <id> --json` payload (verified: `changeName`, `schemaName`,
`planningHome`, `changeRoot`, `artifactPaths`, `nextSteps`, `actionContext`, `isPlanningComplete`, `isComplete`,
`applyRequires`, `artifacts`); the single-change payload has no root of its own, and the batch adds only the
envelope-level `root`, a `message` key on the empty
set, the per-change failure sum type, and exit 1 on partial failure while stdout remains a complete valid JSON
document. `--all` and `--change` are mutually exclusive upstream. A root-selection failure yields the null shape
`{ changes: [], root: null }` through the shared JSON failure contract, whose diagnostic `status` array must be
preserved.

OpenSpecUI may adopt the batch envelope as the loading transport for admitted 1.11 sessions (replacing the
serial per-change spawn loop), but `isPlanningComplete` / Apply `progress` semantics, the `opsx-status-list`
Work identity, and per-change reactive dependencies must not change meaning. 1.10 sessions keep the per-change
transport behind the same capability gate.

### 2. `show --diff` is evidence, not a re-parse

The JSON delta payload for `MODIFIED` requirements gains optional `diff` (unified-diff body, `@@` hunk headers,
no synthetic file headers) and optional `warning` (exact upstream strings for near-miss headers, missing main
requirement, and absent main spec). A renamed-then-modified requirement diffs against its old name. Main specs
resolve against the same store-aware root as the change. Without `--diff` the payload is unchanged.

OpenSpecUI's local delta parser remains the Change Detail display owner; the CLI diff is separately fetched
evidence. The diff must never be recomputed locally, and the existing strict local `DeltaSchema` does not need
to absorb these fields — they belong to the new CLI contract surface only.

### 3. `init --language` is a context block, not a config key

`--language <value>` writes a fixed three-line `context` block into the project `openspec/config.yaml`
(`Language: <x>` / all-artifacts line / structural-headings line). It refuses to overwrite an existing config,
validates against control characters and the context size limit, and `init` has no `--json` mode. Because the
Active Root structured editor already owns the `context` field, no new OpenSpecUI editing surface is required;
the default v11 decision is not to expose a language input in the Initialize Project Alert.

### 4. Validation gained a placeholder warning class

A `## Purpose` that is still the archive-generated placeholder sentence or opens with `TBD`/`TODO` produces a
`WARNING`-level issue on `overview` with a best-effort `line`. Non-strict validity is unchanged; `--strict`
fails. The issue shape stays inside the existing level enum, so the typed contract tolerates it, but UI
presentation should render it as a distinct "Purpose not authored" signal rather than generic noise.

### 5. Archive fixes do not change the result envelope

Requirement renames now preserve source position in the rebuilt spec; capability-retirement aborts carry
structured, length-bounded guidance naming the blocking content and the `retire_capabilities` marker status;
control characters are stripped from quoted authored content. The `archive --json` success/failure envelopes and
`warnings` array shape are unchanged. OpenSpecUI keeps rendering these as CLI-owned evidence.

### 6. `schema init --default` is transactional and discovery-safe

Config staging plus schema staging/backup with fingerprint-based concurrency detection, rollback, and
discovery-level exclusion of `.init-staging-*` / `*.init-backup-*` (alongside the fork equivalents). The command
now sets the real `schema` config key and removes the dead `defaultSchema` key. Schema listings obtained through
the CLI never observe the transients; any OpenSpecUI-side direct directory enumeration must replicate the four
exclusion prefixes.

### 7. stderr stream discipline hardened for machine consumption

The first-run telemetry notice and the new first-run completions tip both print to stderr and are deferred (not
consumed) on JSON runs; the tip additionally defers on non-TTY stderr, and `OPENSPEC_NO_COMPLETIONS=1` /
telemetry opt-outs apply. stdout is now stable: a single JSON document on `--json`, or the command's text.
The npm package drops its `postinstall` script (its `prepare` and `prepublishOnly` scripts remain) and gains a
runtime `diff@^9` dependency.

OpenSpecUI implication: typed JSON invocations keep a clean stderr, so `expectPinnedVersion`-style strict
stdout parsing and the eager-JSON fast path remain safe for JSON runs. The eager-JSON termination condition
that refuses early exit while stderr is non-empty stays correct for JSON runs and must not be relaxed into
ignoring stderr noise, because stderr remains the legitimate channel for real command diagnostics.

### 8. Agent delivery is still a physical artifact protocol

```text
Zed Agent      project skills root:    .agents/skills (shared; skills-only; no adapter; available from 1.10)
Antigravity    project skills root:    .agents/skills (from 1.11; was .agent through 1.10; legacy root migrates after-generation)
               commands root:          .agents/workflows/opsx-<id>.md (from 1.11; was .agent/workflows)
Shared agents  project skills root:    .agents/skills (owner marker .openspec-target)
Codex          project skills root:    .agents/skills (shared-root writer candidate, default owner)
opencode       commands root:          .opencode/commands/opsx-<id>.md (+ injected `**Provided arguments**: $ARGUMENTS` line)
```

The Antigravity root migration and the shared-root arbitration rework landed after the v1.10.0 tag and are
1.11-only: a 1.10 session still sees `.agent` as Antigravity's current root, while Zed already exists on 1.10.
(An upstream in-source comment references a future "v1.20.5" for the Antigravity change; that comment is
stale — the tag topology above is the version fact.) The
shared `.agents` skills root owner candidate set is three-valued (`codex`, `zed`, vendor-neutral
`agents`) on both lines; Antigravity is adapter-backed and never writes the shared skills tree, but keeps its
own commands root. Owner arbitration is `.openspec-target` marker, then inferred owner, then `agents` when
skills exist, then `codex` fallback. `update` suggests IDE restarts only for IDE-resident tools it actually
wrote for. A custom profile that selects archive/bulk-archive now auto-includes `sync`; the core workflow set
is unchanged.

The registry, detection, generated-by version, legacy roots, migration, cleanup, and update outcome travel
together. OpenSpecUI observes and invokes the official CLI; it never hand-writes, deletes, or renames Agent
files as a compensating migration. The upstream `docs/supported-tools.md` Antigravity row is stale at v1.11.0;
`src/core/config.ts` plus the adapters are the source of truth for the registry projection.

### 9. Generated-planning templates changed shape

The spec-driven schema's specs instructions now address the store-aware
`<planningHome.root>/openspec/specs/...` for main-spec reads/edits; generated tasks must state per-task
verification, and integration verification is a separate section. The explore skill requires an explicit,
scope-bound confirmation before any write action and draws diagrams in plain ASCII. These change generated
artifact content and agent behavior, not CLI JSON shapes; OpenSpecUI surfaces them through existing
instruction/evidence passthrough.

## Changelog-visibility gap

Six merged upstream commits are absent from the published 1.10.0/1.11.0 changelog sections but are real in the
tagged source: Zed Agent support (#1659), opencode argument passthrough (#1664), custom-profile sync injection
(#1663), telemetry notice stderr move (#1666), feedback body preservation (#1653), and no-spec schema-change
validation (#1655). Adaptation is based on the pinned source diff, not the changelog prose.

## Current owner map

| Surface                     | Primary production owner                                             | Existing evidence owner   | v11 change                                                             |
| --------------------------- | -------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| compatibility gate and copy | `packages/core/src/openspec-compat.ts`                               | `openspec-compat.test.ts` | v11 accepted/current classification; 1.9 -> blocked                    |
| workflow JSON contracts     | `packages/core/src/cli-contracts/workflow.ts`, `executor.ts`         | contract tests            | batch status sum type; show-diff contract; language passthrough        |
| CLI execution               | `packages/core/src/cli-executor.ts`                                  | executor contract tests   | `status --all`, `show --diff`, `init --language` argv                  |
| status loading transport    | `packages/core/src/opsx-kernel.ts` + `cli-projection-sequence.ts`    | projection tests          | capability-gated batch path for 1.11                                   |
| Agent registry/state        | `packages/core/src/agent-delivery-registry.ts`, `tool-init-state.ts` | registry/state tests      | zed entry; antigravity paths/legacy/migration; pinned generator 1.11.0 |
| Agent delivery projection   | `packages/server/src/agent-delivery-projection-service.ts`           | service tests             | three-valued shared-root owner evidence                                |
| Config Agent UI             | `/config/agents`                                                     | Web component tests       | objective presentation of new inventory                                |
| Change diff evidence        | Change Detail owners                                                 | Web component tests       | MODIFIED delta diff/warning display                                    |
| distribution release        | Changesets plus package build/pack scripts                           | release/package tests     | major v11 preparation only                                             |

## Scope boundary

In scope:

- OpenSpecUI 11 compatibility, typed contracts, batch status transport, diff evidence, Agent delivery projection,
  and evidence presentation for every supported 1.10.x and 1.11.x behavior above.
- Real pinned 1.10.0 and 1.11.0 fixtures, focused owner tests, package build/pack preparation, a major-version
  Changeset, README updates under the release README law, and reference pin publication.

Out of scope:

- A separate OpenSpecUI 10 release or a 1.10-only compatibility line.
- Supporting OpenSpec CLI `<1.10.0`, prereleases, or `>=1.12.0`; a 1.9 compatibility bridge.
- Changing OpenSpec source, replicating archive/diff logic locally, or repairing unrelated historical Changes.
- Exposing an `init --language` UI input (default decision; the `context` field remains the Active Root owner).
- Publishing, PR merge, archive, release, and final end-to-end browser acceptance. Those remain later owner
  actions.

## Execution rule

Each implementation slice starts with one production owner, one precise red case, and one green case. A failed
focused review stops the slice before broader gates. Only after all focused evidence passes may the
implementation agent run package, build, and distribution checks. Browser automation remains preparation
evidence; the final interactive walkthrough is Owner-only.
