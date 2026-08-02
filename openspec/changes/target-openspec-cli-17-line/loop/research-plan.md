<!--
Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
1. Record objective OpenSpec 1.7 protocol and current OpenSpecUI implementation constraints.
2. Define the approved Config workbench, initialization Alert, Agent Delivery, and Guide product story.
3. Decompose the adaptation into owner-specific implementation slices with fixed evidence.
4. Define risks, local verification, PR, release, and owner-walkthrough boundaries.

Original request (2026-08-01): "更新本地references/openspec，目前 `openspec@v1.7.*` 已经发布，我们开始 `openspecui@v7.*` 的适配计划"
Owner execution request (2026-08-01): complete the interview, create the full Change artifact set, then begin implementation.
Owner Config direction (2026-08-01): route-backed Config workbench, Agent Delivery owner, raw YAML escape hatch, adaptive Guide, and independent `openspec init --tools=none` Alert.
-->

## Research Findings

### 1. Upstream Baseline

```text
OpenSpec package       @fission-ai/openspec
Released line          1.7.x
Pinned release         v1.7.0
Pinned commit          4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b
Local evidence         references/openspec-1.7.0-report.md
OpenSpecUI target      7.x
Supported CLI          >=1.7.0 <1.8.0 only
```

OpenSpecUI 6.1's temporary 1.6/1.7 compatibility bridge is not the 7.x contract. OpenSpecUI 7 is adapted only to
the complete observable 1.7 protocol. Any other CLI version opens the existing mismatch Dialog and is blocked by
default. `Skip version check` changes Web admission only for the current in-memory page runtime and makes no
compatibility claim.

### 2. Observable 1.7 Protocol Changes

The same black-box fixture executed under OpenSpec 1.6.0 and 1.7.0 proves six independent adaptation surfaces:

```text
Status             status: skipped + requires[]
Apply Instructions context + operationGuidance
Archive            new read-only instructions archive --json contract
Spec identity      recursive ids such as platform/auth
Root selection     environment-global defaultStore fallback
Agent delivery     registry, capabilities, aliases, cleanup, physical artifacts
```

The current workflow contract rejects `status: skipped`. Apply Instructions accepts new keys only through
passthrough parsing, which is transport tolerance rather than typed product support. Archive currently lacks the
new selected-Root instruction input. Recursive Spec ids are not consistently protected across all route, export,
search, referenced-Store, and file-lookup paths.

### 3. Agent Delivery Expansion

OpenSpec 1.7 changes Agent adaptation from a flat tool checklist into a physical delivery protocol:

- Codex is skills-only; managed legacy prompt files require cleanup evidence.
- Windsurf is retired in favor of the Devin alias/migration path.
- Qwen commands use Markdown artifacts.
- CodeArts Agent, Hermes, and ZCode join the registry.
- Tool metadata must preserve capability, detection paths, skills/command roots, invocation spelling, version
  evidence, installed workflows, partial state, migration state, and cleanup requirements.

`packages/core/src/tool-config.ts` is a manually duplicated registry and is already behind upstream. The current
Settings initialization UI combines delivery policy, tool inventory, selection, execution, cancellation, and
Terminal evidence, while Environment Global separately edits `profile`, `delivery`, and `workflows`.

### 4. Config Information Architecture

Current `packages/web/src/routes/config.tsx` is 1,655 lines and constructs one horizontal tab strip from fixed
configuration owners plus an unbounded Schema collection:

```text
Project Binding | Active Root | Environment Global | Schema(A) | Schema(B) | ...
```

Desktop truncates later entities; mobile reveals only a clipped subset plus carousel arrows. Configuration domains
and Schema entities are not the same navigation category.

The approved topology is route-backed:

```text
/config                    overview + readiness + Init + Guide + Context
├─ /config/project         Project Binding: store + references
├─ /config/root            structured fields + raw YAML escape hatch
├─ /config/environment     defaultStore + feature flags + advanced evidence
├─ /config/agents          policy + inventory + Init/Update/repair
├─ /config/schemas         Schema catalog
│  └─ /config/schemas/:id  Schema detail/editor
└─ /config/context         effective resolved evidence
```

Settings retains only a concise read-only Agent summary and link. OpenSpec Diagnostics move to the Config
overview/Context evidence plane. No Config secondary page becomes a top-level application navigation item.

### 5. Active Root Ownership

The current Active Root UI replaces the complete YAML document. The same document may contain Project Binding's
`store` and `references`, official Root fields, comments, and team-defined keys.

The approved dual editing model is:

```text
Structured mode
  owns: schema, context, rules, operations
  preserves: store, references, comments, unknown nodes

YAML mode
  owns: complete physical document
  accepts: valid YAML including unknown/team-defined keys
  protects: loaded revision against parallel/external replacement
```

Structured saves require YAML-node-level patching rather than parse/stringify normalization. Raw saves require a
revision token, valid YAML syntax, atomic reactive settlement, and refresh of Project Binding, Active Root, Root
Context, Schema, and action-readiness projections. OpenSpecUI warns about official-field diagnostics but does not
reject unknown keys merely because upstream does not define them.

### 6. Environment and Agent Ownership

OpenSpec 1.7 global configuration defines `featureFlags`, `profile`, `delivery`, `workflows`, and `defaultStore`,
with passthrough preservation for unknown fields.

Approved ownership:

```text
Environment
├─ defaultStore
├─ featureFlags
├─ data-scope/config-path evidence
└─ unknown passthrough evidence

Agent Delivery
├─ profile
├─ delivery
├─ workflows
├─ tool inventory/state
└─ Init/Update/repair/cleanup execution
```

Environment cannot retain a second structured editor for Agent Delivery fields. Root Context remains the only owner
of the effective Root result; neither Environment nor Project Binding may infer successful fallback from a saved id.

### 7. Initialization Alert

OpenSpec 1.7 exposes `openspec init [path] --tools --force --profile --no-animation`. The product intentionally uses
one narrower path for project scaffolding:

```text
openspec init <launch-project> --tools=none
```

The startup Alert and Config Init action reuse one executor. They never auto-run, never target an external Active
Root, and never install or migrate Agent artifacts. The Alert state machine is:

```text
absent → confirming → running → success
                  └──────────→ failure
                  └──────────→ cancelled

success actions: [Ok] [Start Guide]
```

The automatic Alert is based on Launch Project local initialization, not Root readiness. A Store-selected Root may
remain readable while local setup is absent. Closing the automatic Alert suppresses it only for the current page
runtime; Config keeps Init visible until local setup exists.

### 8. Adaptive Guide

The approved Guide is one typed workflow, not separate static tours:

```text
Project Binding → Active Root → Agent Delivery → Resolved Context verification
```

The Guide starts only after local initialization or when local setup already exists. Objective ready stages are
skipped. Warnings, stale authority, blockers, and failures remain visible. OpenSpecUI owns stage derivation, Router
navigation, focus targets, mutation handoff, and completion. Driver.js is the preferred lightweight visual actuator;
it owns only focus, mask, and popover presentation.

### 9. Existing Architecture Constraints

- Official CLI output remains the sole parsing, validation, Root selection, archive, schema, and cleanup authority.
- Root-dependent mutations stay inside Manager-owned operation leases.
- Readiness uses one Root action authority; retained stale snapshots never authorize writes.
- Reactive settlement precedes mutation success; watcher delivery is fallback convergence.
- Static and live display mappings remain shared, but mutation-only Config surfaces do not fabricate static authority.
- Final end-to-end browser walkthrough belongs to the owner. Agent automation stops at focused Vitest and basic
  component-browser preparation evidence.

## Decision & Plan (For Approval)

Approved on 2026-08-01. Execute in the following independently reviewable slices.

### Slice 1 — Version Line and Admission Bypass

Production owner: `packages/core/src/openspec-compat.ts` plus the Web admission owner.

1. Replace the 6.1 bridge rule with the OpenSpecUI 7 rule: only `>=1.7.0 <1.8.0` is supported.
2. Preserve mismatch Dialog diagnostics for every other line.
3. Add explicit `Skip version check` to the mismatch Dialog when an executable is available.
4. Hold bypass state only in the current Web page runtime; never persist it or rewrite CLI facts.
5. Update package/website/docs/version claims and add a major Changeset.

Fixed evidence: 1.6 blocks, 1.7 passes, 1.8 blocks, bypass admits 1.6 only until page reconstruction.

### Slice 2 — Typed Workflow and Operation Contracts

Production owner: `packages/core/src/cli-contracts/workflow.ts`, typed executor facades, Kernel, Server Router.

1. Add `skipped` and artifact `requires` to Status contracts.
2. Define dependency satisfaction independently from physical artifact existence.
3. Type Apply `context` and `operationGuidance`.
4. Add Archive Instructions command, selected-Root projection, Router surface, and action consumption.
5. Keep artifact rules and operation guidance physically and semantically distinct.

Fixed evidence: official 1.7 fixtures parse; removing `skipped`, `requires`, Apply fields, or Archive command wiring
breaks the named tests.

### Slice 3 — Nested Spec Identity

Production owner: `packages/core/src/spec-catalog.ts` plus route/export/search/file owners.

1. Preserve recursive Spec ids as opaque complete identities.
2. Update live owned/referenced routes and static route manifests.
3. Update search, export snapshot, SSG hydration, document lookup, and mutation guards.
4. Reject traversal without flattening valid nested ids.

Fixed evidence: `platform/auth` round-trips through owned, referenced, search, export, SSG, and detail lookup.

### Slice 4 — defaultStore and Root Evidence

Production owner: Environment Global typed projection, Planning Config Router, Root Context display.

1. Add `defaultStore` to typed global config and file projections.
2. Add Store-id suggestion, explicit clear, stale display, conflict, and save settlement.
3. Preserve machine fallback semantics and CLI Root diagnostics.
4. Prevent Project Binding from mirroring or mutating the value.

Fixed evidence: configured, cleared, stale, invalid, unresolved, and effective CLI-selected fallback states remain
distinct.

### Slice 5 — Agent Delivery Protocol

Production owner: new Core Agent delivery registry/projection modules plus `/config/agents`.

1. Mirror the complete upstream 1.7 registry and capability metadata.
2. Detect physical skill/command artifacts, installed workflows, generated version, partial state, aliases, and
   cleanup requirements.
3. Implement Codex skills-only and legacy cleanup evidence.
4. Implement Devin/Windsurf migration, Qwen Markdown commands, CodeArts Agent, Hermes, and ZCode.
5. Move `profile`, `delivery`, `workflows`, inventory, Init/Update/repair, cancellation, and Terminal evidence under
   `/config/agents`.
6. Replace Settings initialization with a read-only summary and Manage link.

Fixed evidence: every official tool has checked metadata; removing one capability/detection/cleanup mapping breaks
registry or physical-state tests.

### Slice 6 — Config Workbench Routes

Production owner: route tree plus focused Config shell and secondary route modules.

1. Replace the mixed tab route with overview and owner-specific secondary routes.
2. Add responsive local navigation without horizontal page scrolling.
3. Preserve `/config/context` and static Context rules.
4. Move Schema collection into catalog/detail routes.
5. Keep one page-level scroll owner per route and direct failure presentation.

Fixed evidence: desktop, narrow component fixtures, route registration, back navigation, and static manifest tests.

### Slice 7 — Structured and Raw Active Root

Production owner: Planning Config typed mutation service and `/config/root`.

1. Add structured official-field projection and YAML-node patch mutations.
2. Add 1.7 `operations.apply/archive.guidance` controls.
3. Preserve comments, ordering, binding nodes, and unknown keys.
4. Add raw YAML mode with revision token, syntax check, conflict result, atomic write, and dependent invalidation.
5. Keep external/shared Store consequence visible and Root action locking authoritative.

Fixed evidence: structured mutation preserves custom nodes; raw mutation accepts custom keys; stale revision fails;
removing the revision guard or dependent refresh makes the named test fail.

### Slice 8 — Initialize Project Alert

Production owner: one Launch Project initialization service plus global Web Alert and Config overview action.

1. Project local-initialization state reactively from the Launch Project.
2. Open the automatic Alert once per page runtime when local setup is absent.
3. Require explicit confirmation before running `openspec init <launch-project> --tools=none`.
4. Stream exact command/output/cancel/failure evidence.
5. On success expose only `[Ok] [Start Guide]` and refresh Root/Config/tool projections.
6. Remove the second Settings executor.

Fixed evidence: no automatic mutation, exact Launch cwd/arguments, external Store does not suppress the local fact,
session dismissal resets on page reconstruction, and success alone enables Guide transition.

### Slice 9 — Adaptive Config Guide

Production owner: typed Config guide state/orchestrator plus Driver.js adapter.

1. Derive stage status from current Config/Root/Agent projections.
2. Navigate to route-backed targets and wait for registered focus anchors.
3. Skip only objectively ready stages.
4. Pause at stale, warning, blocked, failed, or user-edit states.
5. Finish only when Resolved Context is current and the selected Root is usable.
6. Provide reduced-motion and keyboard-accessible behavior; unload Driver.js outside guide use.

Fixed evidence: state reducer tests plus basic component-browser focus/navigation fixtures. Final UX walkthrough remains
owner-owned.

### Slice 10 — Delivery and Release Evidence

Production owner: package manifests, docs, Changesets, CI, and owner walkthrough artifacts.

1. Update README/version claims and adaptation documentation.
2. Add a major Changeset for publishable packages.
3. Run focused checks before broad CI-equivalent checks.
4. Prepare numbered owner walkthrough cases with setup, trigger, observation, and restore commands.
5. Open PR only after local gates pass; follow Manager merge/release policy.

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI 7 hard-adapts to OpenSpec CLI 1.7.x.
- Workflow UI understands skipped artifacts and operation-level Apply/Archive inputs.
- Recursive Spec ids remain intact across every projection.
- Environment exposes machine `defaultStore` without duplicating Root authority.
- Config becomes a route-backed workbench.
- Agent Delivery becomes a first-class Config capability.
- Active Root gains official structured controls plus safe custom YAML editing.
- Missing local setup produces an explicit initialization Alert and Config Init action.
- Config provides one adaptive project-configuration Guide.

### Modified Behavior

- OpenSpec CLI 1.6.x is blocked by default in OpenSpecUI 7.
- Settings loses Agent mutation and initialization ownership.
- Environment loses structured `profile`/`delivery`/`workflows` mutation ownership.
- Schema entities no longer compete with configuration domains in a horizontal tab strip.
- Archive actions consume Archive Instructions instead of deriving input from Status.
- Raw Active Root writes become revision-aware rather than silent whole-file replacement.

## Risks and Mitigations

| Risk                                                     | Mitigation                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A 1.6 executable is forced and later payloads fail       | Bypass is explicit, session-only, and never suppresses downstream contract errors.          |
| Skipped artifacts are mistaken for done or missing files | Model dependency satisfaction and physical existence as separate facts.                     |
| Raw YAML overwrites Project Binding or external edits    | Revision token, syntax validation, atomic reactive write, conflict UI, dependent refresh.   |
| Structured edit destroys comments/custom keys            | Patch YAML nodes in place; mutation tests retain comments and unknown nodes.                |
| Config routes become another oversized shell             | One route module per owner; shared shell only owns overview/navigation.                     |
| Agent registry drifts again                              | Central typed registry with completeness tests against official 1.7 metadata evidence.      |
| Init accidentally installs Agent artifacts               | Fixed `--tools=none` arguments and exact command-plan tests.                                |
| Startup Alert blocks Store-backed users                  | Separate local initialization from effective Root readiness; allow dismissal.               |
| Guide library becomes workflow authority                 | Typed OpenSpecUI reducer/orchestrator owns truth; Driver.js remains an adapter.             |
| Guide targets disappear across responsive routes         | Registered semantic anchors, route settlement waits, and missing-target failure state.      |
| Static Config fabricates mutation authority              | Static routes remain read-only and publish only approved snapshot facts.                    |
| Scope becomes impossible to review                       | Ten ordered slices, each with one production owner and focused evidence before broad gates. |

## Verification Strategy

### Fixed Red Evidence

Before implementing each slice, add or identify a test that fails at the named production owner for the intended
reason. Characterization-only tests must be labelled honestly. Lifecycle/cleanup requirements additionally require
mutation evidence that fails when the exact transition or guard is removed.

### Focused Green Evidence

Run package-local checked tests for each slice before any broad gate. Public Router, Manager service, Adapter,
executor, and registry contracts require typechecked fixtures without `any`, `as never`, fabricated non-null state,
or suppression comments.

### Static and Browser Preparation

- Rebuild SSG before judging static Config/Context/Spec changes.
- Run the real CLI export path after a clean Server/Web build when export contracts change.
- Use focused Vitest and basic component-browser fixtures for route, narrow layout, Alert, and Guide preparation.
- Do not claim final browser acceptance; provide the owner exact numbered walkthrough cases.

### CI-Equivalent Local Gates

```bash
pnpm format:check
pnpm lint:ci
pnpm typecheck
pnpm test:ci
pnpm test:browser:ci
pnpm --filter @openspecui/web build:ssg
git diff --check
```

Run a justified focused subset during development; all required gates must pass before PR delivery.

### Release Boundary

- Include a major `.changeset/*.md` for publishable OpenSpecUI packages.
- Do not open/update the PR until local gates pass.
- Auto-merge only after required PR checks pass under Manager mode.
- Ask the manager before release; release automation and registry/tag/GitHub evidence remain separate completion facts.
- Archive this Change only after implementation, verification, PR, merge, and explicit archive/release decisions.
