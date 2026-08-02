<!--
Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
1. Record the exact OpenSpec 1.7.0 source and registry baseline used by OpenSpecUI 7 planning.
2. Separate upstream protocol changes from fixes that remain owned by the official CLI.
3. Map each adaptation surface to its current OpenSpecUI production owner and objective evidence.
4. Define the decision frontier that must be approved before an OpenSpec Change is created.
5. Record source-versus-generated-dist verification facts required to execute the pinned reference honestly.

Original request (2026-08-01): "更新本地references/openspec，目前 `openspec@v1.7.*` 已经发布，我们开始 `openspecui@v7.*` 的适配计划"
-->

# OpenSpec 1.7.0 → OpenSpecUI 7 adaptation report

## Baseline

```text
Observed at       2026-08-01 Asia/Shanghai
npm package       @fission-ai/openspec
npm latest        1.7.0
Git tag           v1.7.0
Git commit        4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b
Previous pin      v1.6.0 / e1b51d111ab446b54dee2d6159ac245f0339ae52
Local reference   references/openspec
OpenSpecUI line   6.1.0 before the v7 adaptation
```

No later `v1.7.*` tag or npm release existed when this report was written.

## Executive conclusion

OpenSpec 1.7 is not merely a supported-tool refresh. It changes the observable workflow protocol in six
places that OpenSpecUI projects directly:

```text
OpenSpec 1.7
    |
    +-- Workflow runtime inputs
    |     +-- apply: context + operationGuidance
    |     `-- archive: new read-only instructions surface
    |
    +-- Artifact state
    |     `-- skip_specs -> status: skipped + satisfied dependency
    |
    +-- Spec identity
    |     `-- recursive ids such as platform/auth
    |
    +-- Root selection
    |     `-- machine defaultStore fallback
    |
    +-- Tool delivery
    |     +-- Codex becomes skills-only
    |     +-- Devin replaces Windsurf
    |     `-- CodeArts Agent, Hermes, ZCode added
    |
    `-- Schema/config resolution
          +-- symlinked schema directories
          `-- operations.apply/archive.guidance
```

Therefore OpenSpecUI 7 should be a real 1.7 adaptation line, not a version-gate rename. The minimum safe
scope is the typed CLI contract, workflow projection, Config/Context ownership, Spec identity, tool delivery,
and live/static evidence paths described below.

## Objective black-box evidence

The same temporary project was executed with `@fission-ai/openspec@1.6.0` and `1.7.0`. The fixture contained:

- project `context` plus `operations.apply.guidance` and `operations.archive.guidance`;
- a `skip_specs: true` change with proposal and tasks but no delta specs;
- one nested main Spec at `openspec/specs/platform/auth/spec.md`.

| Command                                              | 1.6.0                                     | 1.7.0                                                        | OpenSpecUI consequence                                                                |
| ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `status --change refactor-only --json`               | `specs` is `ready`; no dependency arrays  | `specs` is `skipped`; every artifact has `requires`          | Current Status Zod contract rejects the payload.                                      |
| `instructions apply --change refactor-only --json`   | No runtime inputs                         | Adds `context` and `operationGuidance`                       | Passthrough parsing survives, but the fields have no typed product owner.             |
| `instructions archive --change refactor-only --json` | Fails as unknown artifact                 | Returns `{ changeName, context?, operationGuidance?, root }` | Archive currently consumes Status evidence instead of the new archive-input contract. |
| `list --specs --json`                                | Reports `platform` with zero requirements | Reports `platform/auth` with one requirement                 | Nested Spec identity becomes an official public contract.                             |
| `validate refactor-only --strict --json`             | Exit 1: zero deltas rejected              | Exit 0: explicit `skip_specs` accepted                       | Validation and workflow readiness now distinguish omission from intentional skip.     |

Directly parsing the 1.7 Status fixture through
`packages/core/src/cli-contracts/workflow.ts` fails at `artifacts[1].status` because the current enum accepts
only `done | ready | blocked`. Apply Instructions parses only because the schema is passthrough; that is
forward-tolerant transport evidence, not a complete 1.7 product contract.

### Pinned source and generated `dist` divergence

The `v1.7.0` source tag contains the new Status dependency contract in
`src/core/artifact-graph/instruction-loader.ts`: every emitted artifact carries its direct `requires` edges.
However, the generated `dist` available immediately after checking out the tag was stale and omitted those
fields from `bin/openspec.js` execution. Because `dist/` is ignored by the upstream repository, rebuilding with
`pnpm build` changed no tracked submodule files and left `references/openspec` clean at commit
`4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b`.

OpenSpecUI's executable 1.7 regression fixture therefore performs against the pinned source after that local
build. It proves the actual `bin/openspec.js` boundary emits `status: skipped`, exact `requires`, skipped
dependency evidence, Apply inputs, and Archive inputs. The source/tag remains the protocol authority; stale
generated output must not be mistaken for contradictory 1.7 semantics.

## Adaptation surfaces

### 1. Release-line compatibility

Current owner: `packages/core/src/openspec-compat.ts`.

OpenSpecUI 6 deliberately targets 1.6 and accepts 1.7 only as compatible. OpenSpecUI 7 establishes a hard
1.7 runtime contract instead: only 1.7.x is adapted and supported. OpenSpec CLI 1.6.x is objectively version
mismatched and blocked by default; it is not a legacy-compatible product line.

Recommended boundary:

```text
OpenSpec CLI <1.7.0          unsupported; blocking Dialog
OpenSpec CLI 1.7.x           current / adapted
OpenSpec CLI >=1.8.0         unsupported; blocking Dialog
Explicit Skip version check  bypasses only the UI gate at the user's risk
```

This changes product claims, diagnostics, tests, website copy, package changelogs, and the pinned reference
tag pattern. The bypass exists only in the current in-memory page runtime: refresh, page reconstruction, App
reopen, or a new browser page must re-run the version check. It is never written to browser storage, Workspace
state, project config, or Server state. The bypass does not reclassify the CLI as supported, alter the detected
version, simulate 1.7 semantics, suppress downstream errors, or transfer responsibility back to OpenSpecUI.

### 2. Workflow instructions and archive inputs

Current owners:

- `packages/core/src/cli-contracts/workflow.ts`
- `packages/core/src/cli-contracts/executor.ts`
- `packages/server/src/workflow-invocation-service.ts`
- Change action and CLI-evidence presentation in `packages/web`

OpenSpec 1.7 separates static workflow knowledge from current runtime inputs:

```text
selected Root config
    |
    +-- context --------------------+
    |                               |
    +-- operations.apply.guidance --+--> instructions apply
    |                               |
    `-- operations.archive.guidance +--> instructions archive
```

OpenSpecUI should preserve this separation. Apply and Archive prompts must use the CLI-returned current
inputs from the selected Root. They must not reconstruct guidance from YAML, relabel artifact `rules` as
operation guidance, or reuse Status as a substitute for Archive Instructions.

### 3. `skip_specs` and the four-state artifact protocol

Current owners:

- `packages/core/src/cli-contracts/workflow.ts`
- OPSX entity/change projection in `packages/core`
- workflow invocation and Change surfaces in `packages/server` and `packages/web`

The Status artifact state is now:

```text
done       physical output exists
ready      dependencies are satisfied; artifact may be created
blocked    dependencies are missing
skipped    change metadata intentionally suppresses this artifact;
           dependencies treat it as satisfied; no file should be created
```

`skipped` is not `done`, `missing`, or `unsupported`. OpenSpecUI must preserve it as an upstream fact, render
it without failure styling, exclude it from actionable work, and keep the dependency order returned by the
CLI. Artifact Instructions can also return `skipped: true`, dependency entries can be skipped, and skipped
artifacts can carry a warning explaining why no file should be written.

### 4. Nested Spec identity

Current owners:

- `packages/core/src/spec-catalog.ts`
- `packages/server/src/spec-catalog-service.ts`
- `packages/server/src/document-service.ts`
- `packages/cli/src/export.ts` and `packages/cli/src/export-references.ts`
- live routes and SSG route manifest in `packages/web`

The existing compound identity and route encoding already support slash-bearing ids such as
`platform/auth`; focused tests cover `%2F` route generation. The v7 work is therefore verification and gap
closure, not a new identity model. Every list/show/export/search/reference path must prove that it preserves
the complete nested id and never truncates to the first path segment.

### 5. Root selection and global `defaultStore`

Current owners:

- CLI-owned Root Context projection
- Config `Environment Global` surface
- Project Binding and Active Root surfaces

OpenSpec 1.7 adds a machine-level `defaultStore` fallback only when no nearest repository Root resolves. It
belongs to Environment Global configuration and Root Context evidence. It must not be copied into project
`store:` binding, treated as a mutation permission, or presented as if the launch project declared it.

OpenSpecUI 7 gives `defaultStore` a first-class structured control in **Config → Environment Global**. The
control provides Store-id suggestions, preserves a freeform configured value for objective stale-id repair,
supports explicit clearing, and explains that the value is consulted only as the final Root fallback. Root
Context reports the effective selected Root and any stale/unregistered Store diagnostic; it does not own the
edit and Project Binding does not mirror the value.

```text
explicit --store / --store-path
              |
              v
nearest project or Store root
              |
              v
global defaultStore fallback
              |
              v
no root / objective diagnostic
```

### 6. Tool delivery and migration state

Current owners:

- `packages/core/src/tool-config.ts`
- `packages/core/src/tool-init-state.ts`
- Config tool-delivery projection and Update mutation

The local mirror is behind 1.7:

```text
Added       codeartsagent, hermes, zcode
Renamed     windsurf -> devin (legacy alias remains upstream)
Changed     codex: commands + skills -> skills-only
Changed     qwen command format: TOML -> Markdown
Distributed workflow skills are also published under upstream skills/
```

This is a physical-artifact migration, not only a label update. OpenSpecUI must mirror upstream tool ids,
detection paths, skill roots, command paths, aliases, and delivery capability. Codex legacy global prompts
must be represented as cleanup/drift evidence; they cannot remain the current expected command surface.

The complete tool-delivery migration is part of the initial OpenSpecUI 7.0 adaptation, not deferred to a later
minor. The current Settings surface is already too dense for the 1.7 Agent contract: its inline initialization
component owns tool inventory, artifact details, selection, Init execution, Terminal output, cancellation, and
delivery interpretation inside a Settings page with many unrelated ToC sections.

Recommended product topology, pending owner approval:

```text
Settings
  `-- Agent Integrations (read-only summary)
        +-- configured / drift / failure counts
        +-- direct blocking failures
        `-- Manage Agent Integrations
                    |
                    v
Config title actions
  `-- Agent Integrations -> /config/agents
        +-- tool inventory + filters
        +-- selected Agent delivery contract
        +-- Skills / Commands / invocation / physical scope
        +-- expected / present / legacy / cleanup evidence
        +-- Init / Update / repair action owner
        `-- collapsible Terminal evidence
```

This keeps the low-frequency capability out of primary navigation while assigning it to the correct domain
owner. Settings is the OpenSpecUI runtime-preference and read-only diagnostic surface; Agent integration changes
OpenSpec delivery state in the Launch Project and Environment Global scopes, so Config owns the detailed page.
The `/config/agents` secondary page follows the existing `/config/context` precedent, provides URL/back/refresh
semantics and page-grade responsive space, and can be opened from Settings, Config, project initialization, or a
drift/failure repair entry without creating parallel UIs.

Rejected shapes:

- **Top-level Agent page** — too much persistent navigation weight for an initialization/repair capability.
- **Inline Settings editor** — preserves the current ownership error and overloads an already dense one-scroll
  Settings page.
- **Settings secondary page** — solves space but not domain ownership; mutations still live under the wrong
  product boundary.
- **Ordinary Dialog** — weak for long-running CLI work, terminal evidence, refresh/back semantics, mobile space,
  and accidental close recovery.

### 7. CLI-owned fixes that should not become parallel OpenSpecUI logic

OpenSpec 1.7 also improves archive drift checks, already-synced delta handling, fenced-code parsing, numeric
change ids, change discovery without `proposal.md`, local archive dates, Store-aware sync/archive, and symlinked
schema resolution. OpenSpecUI should adapt typed outputs and regression fixtures where these behaviors cross a
projection, but should continue delegating the underlying operation to the official CLI.

## Recommended v7 planning topology

The formal Change should remain decision-first and use the project `opsx-collab-pr-loop` schema.

```text
target-openspec-cli-17-line
    |
    +-- A. compatibility and release law
    +-- B. workflow JSON contract
    +-- C. skip_specs artifact lifecycle
    +-- D. apply/archive runtime inputs
    +-- E. nested Spec live/static continuity
    +-- F. defaultStore Config/Context ownership
    +-- G. tool matrix and physical delivery
    `-- H. verification, PR, and owner acceptance boundary
```

Recommended execution phases after approval:

1. **Contract fixed points** — capture 1.6 and 1.7 JSON fixtures; make 1.7 red tests fail for the intended
   reason before changing production contracts.
2. **Core protocol** — advance compatibility constants; type `skipped`, artifact `requires`, instruction
   skip fields, Apply runtime inputs, and Archive Instructions.
3. **Server ownership** — route Apply/Archive through their exact CLI evidence and preserve selected-Root
   provenance; add Root/defaultStore and schema-symlink observation cases.
4. **Product projection** — expose intentional skip, runtime guidance, and default Store according to the
   OPSX-first hierarchy without duplicating CLI authority.
5. **Spec continuity** — prove nested ids across owned/reference catalog, detail, search, export, SSG, and
   static document lookup.
6. **Tool delivery** — synchronize the complete upstream tool registry for 7.0, prove Codex skills-only plus
   legacy cleanup semantics against real paths, and move mutations into the approved Config-owned Agent
   Integrations subpage while Settings retains a read-only summary.
7. **Delivery** — focused red/green/mutation evidence first, then CI-equivalent gates, PR, independent review,
   owner-only final browser walkthrough, and a major-version changeset.

## Explicit non-goals

- Do not reimplement OpenSpec parsers, validation, archive merging, or root selection.
- Do not redesign the App Workspace/Store information architecture as part of the CLI adaptation.
- Do not claim OpenSpec 1.8 compatibility.
- Do not infer operation guidance from artifact rules or UI-authored text.
- Do not create migration glue that preserves Codex custom prompts as a current delivery surface.
- Do not start production implementation before the compatibility and presentation decisions are approved and
  recorded in the new OpenSpec Change.

## Confirmed compatibility decision

OpenSpecUI 7 supports only OpenSpec CLI 1.7.x. Every other parseable version is reported as unsupported and
opens the version-mismatch Dialog. When an unsupported CLI executable is present, the user may explicitly click
`Skip version check` to dismiss the gate and force the current OpenSpecUI surface to run on that CLI at their own
risk. This escape hatch bypasses admission only; it creates no compatibility promise and no synthetic protocol.
The decision is page-runtime-only: any refresh, reconstruction, or reopen clears it and presents the mismatch
again.
