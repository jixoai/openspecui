<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Record source- and CLI-backed OpenSpec 1.10/1.11 research facts.
2. Define the approved OpenSpecUI 11 compatibility decision and implementation topology.
3. Assign one production owner and exact red/green evidence to each implementation slice.
4. State risk, validation, release, and Owner-only acceptance boundaries.

Original request (2026-08-28): "我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
-->

# OpenSpecUI 11 research and implementation plan

## Research Findings

The full executed evidence is recorded in `references/openspec-1.11.0-report.md`. Planning-critical facts:

```text
CLI 1.11 status --all --json
  envelope        = { changes: [...], root }
  healthy entry   = single-change status payload fields (no per-entry root; envelope owns root)
  failed entry    = { changeName, status: [StoreDiagnostic] } in place
  empty set       = adds message: 'No active changes.' (exit 0)
  partial failure = exit 1, stdout still one complete valid JSON document
  1.10 boundary   = unknown option '--all' (verified against published 1.10.0)

CLI 1.11 show <change> --json --diff
  MODIFIED deltas gain optional diff (unified body, @@ hunks) and warning (3 exact upstream texts)
  payload carries root; ADDED/REMOVED/RENAMED deltas unchanged
  1.10 boundary   = flag rejected (verified)

CLI 1.10 init --language <language>
  persists a fixed 3-line context block in openspec/config.yaml (verified on 1.10.0)
  refuses to overwrite an existing config; init has no --json mode

CLI 1.11 validate
  Purpose-placeholder WARNING { path: 'overview', line?, message } (verified)
  non-strict validity unchanged; --strict fails; existing issue level enum suffices

Agent delivery 1.10/1.11
  + zed (skills-only, .agents/skills, no adapter, enters --tools all) — available from 1.10
  antigravity root migration .agent -> .agents — 1.11 ONLY (1.10 still treats .agent as current)
  shared .agents owner candidates = codex | zed | agents (antigravity excluded, adapter-backed)
  opencode command templates inject "**Provided arguments**: $ARGUMENTS"
  update suggests IDE restart only for IDE-resident tools actually written
  custom profile auto-injects sync beside archive/bulk-archive

Stream discipline
  telemetry notice + first-run completions tip print to stderr, deferred on JSON runs
  npm package: postinstall removed (prepare/prepublishOnly remain); new runtime dep diff@^9
```

Changelog-visibility gap: six merged commits are absent from the published 1.10/1.11 changelog sections but
real in the tagged source (Zed, opencode passthrough, profile sync injection, telemetry stderr, feedback body,
no-spec schema validation). The pinned source diff, not changelog prose, is the adaptation baseline.

The current OpenSpecUI 9 source is intentionally single-line 1.8/1.9:

```text
packages/core/src/openspec-compat.ts
  accepted:    >=1.8.0 <1.10.0        -> becomes >=1.10.0 <1.12.0
  recommended: >=1.9.0 <1.10.0        -> becomes >=1.11.0 <1.12.0
  series model: string '1.8'|'1.9' literal comparison (1.11 does NOT auto-match a '1.10' series constant)

packages/core/src/agent-delivery-registry.ts
  AgentCliSeries = '1.8' | '1.9'; no zed entry; antigravity paths pre-migration

packages/core/src/tool-init-state.ts
  PINNED_AGENT_GENERATOR_VERSION = '1.9.0'

packages/core/src/opsx-kernel.ts fetchStatusList()
  serial per-change spawn loop (N x ~500ms module load per project refresh)

packages/core/src/cli-contracts/executor.ts
  no status --all, no show-change-diff, no init --language passthrough
```

## Decision & Plan (For Approval)

### Compatibility law

```text
                    stable 1.10.x            stable 1.11.x
OpenSpecUI 11        supported                current + recommended
Admission            allowed                  allowed
Compatibility badge  supported non-current    current

all prereleases, <1.10.0 (including 1.9.x), >=1.12.0, unknown -> blocked by default
```

The current-page-only version-bypass law remains unchanged. Bypass never rewrites compatibility evidence or
support claims and does not conceal later protocol failures.

### Procedural topology

```text
pinned 1.10 / 1.11 executable fixtures
                 |
                 v
Core CLI contracts + compatibility classification
                 |
        +--------+---------------------------+
        v        v                           v
batch status   diff evidence + UI      Agent physical projection
transport                                  |
        +--------+---------------------------+
                 v
        Server reactive read model
                 v
        Web / Config / Change Evidence owners
                 v
        focused owner review -> package gates -> Owner acceptance
```

### Ordered implementation slices

| Order | Slice and production owner                                                                                                                                                                                                                                           | Precise red case                                                                                                                                                                                                                                                                                                                                                                                                                       | Green case and focused gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1     | `packages/core/src/openspec-compat.ts` + compatibility UI copy + `scripts/setup-example.ts` mirror                                                                                                                                                                   | `1.10.0` blocked or `1.11.0-rc.1` admitted; a `1.9.x` executable still admitted; setup-example still pins 1.9                                                                                                                                                                                                                                                                                                                          | 1.10.x supported non-current, 1.11.x current, 1.9.x rejected with actionable copy; both constant sites agree. Run `openspec-compat.test.ts` first.                                                                                                                                                                                                                                                                                                                                                                      |
| 2     | `packages/core/src/cli-contracts/workflow.ts` + `executor.ts` + `cli-executor.ts`                                                                                                                                                                                    | a batch failure entry parsed as a healthy status; a partial-failure batch (exit 1 + valid stdout JSON) is discarded by the existing `requireCommandData` success gate (`opsx-kernel.ts:275-291`); `show --diff` payload rejected; `init --language` dropped or corrupted                                                                                                                                                               | typed discriminated batch sum type preserves per-change diagnostics and decodes from the stdout envelope regardless of exit code (the batch path must not route through the whole-result success gate); diff contract carries MODIFIED-only `diff`/`warning`; language argv round-trips. Run contract tests.                                                                                                                                                                                                            |
| 3     | `packages/core/src/agent-delivery-registry.ts` + `tool-init-state.ts` + Agent command content                                                                                                                                                                        | zed missing for 1.10/1.11; antigravity projected with `.agents` roots on a 1.10 session (or `.agent` on 1.11 without migration evidence); a flat merged 1.10/1.11 registry cannot express the antigravity split; opencode equivalence broken by the injected `**Provided arguments**` line; generator evidence still pinned to 1.9.0; `isCurrentGeneratedByVersion` exact-equality flags a 1.10-generated tree stale in a 1.11 session | per-series registry snapshots: 1.10 keeps antigravity `.agent` current, 1.11 declares `.agents` + `.agent` legacy/migration; zed on both with `minCliSeries '1.10'`; three-valued shared-root owner; per-tool IDE restart; opencode template equivalence; `PINNED_AGENT_GENERATOR_VERSION = '1.11.0'`; series-model `'1.10'                                                                                                                                                                                             | '1.11'`; generated-by comparison becomes series-aware. Run registry/state tests. |
| 4     | Real fixture harnesses: core `package.json` devDeps (`openspec-cli-110`/`-111` aliases), `__tests__/official-cli-v11-fixtures.ts`, `opsx-kernel-schemas-root.fixtures.test.ts` bins map, `official-cli-*` test version loops, `upstream-contract-regression.test.ts` | a hand-authored payload or a 1.9 executable proves a 1.10/1.11 behavior; upstream source assertions still reference pinned commit `2826b88`                                                                                                                                                                                                                                                                                            | pinned 1.10.0 and 1.11.0 executables prove the batch envelope (healthy/failed/empty), show-diff fields, init-language persistence, placeholder warning, clean-stdout discipline, and the 1.10 capability-boundary rejections; `upstream-contract-regression.test.ts` re-pins to `a0ddb60`. Run matrix tests independently first.                                                                                                                                                                                        |
| 5     | `packages/core/src/opsx-kernel.ts` + `cli-projection-sequence.ts` batch status transport                                                                                                                                                                             | a 1.11 session still spawns per-change status loops, or a 1.10 session invokes `--all` and fails, or `opsx-status-list` identity/dependency semantics drift, or a partial-failure batch fails the whole status-list projection                                                                                                                                                                                                         | a dedicated batch decoder produces per-change entries (healthy or failure-evidence) feeding the existing per-change status projection; 1.11 sessions load the full list in one spawn behind the capability gate; 1.10 keeps the serial path; Work identity, per-change reactive deps, and Applying progress semantics unchanged. Run kernel/projection tests.                                                                                                                                                           |
| 6     | Server read-model + Web surfaces: `agent-delivery-projection-service` tests, `/config/agents`, Change Detail diff evidence, `cli-health-gate`/settings copy                                                                                                          | diff/warning evidence absent or rendered as generic noise; no Core-to-Web data chain exists for CLI diff (current `DeltaSchema` strips unknown fields and `change-overview` has no diff field); registry empty for an admitted 1.11 session; blocked-1.9 dialog copy still naming v9 ranges                                                                                                                                            | an end-to-end typed chain: Core `show --diff` contract -> Server projection input (document-service family) -> Change Detail delta surface (`change-overview` / change-detail owners) rendering the unified diff body and exact upstream warnings with CLI provenance (strict local `DeltaSchema` untouched); Purpose-placeholder warnings render as a distinct validation signal; Agent inventory objective for 1.10/1.11 series snapshots; mismatch dialog names `>=1.10.0 <1.12.0`. Run focused Web component tests. |
| 7     | Release preparation: Changesets (major v11), `README.md` + `README-zh.md` + `packages/cli/README.md` under the release README law, package build/pack, reference pin publication                                                                                     | packed CLI/Web assets still carry the v9 gate; README version table still describing 1.8/1.9 as current                                                                                                                                                                                                                                                                                                                                | one v11 major Changeset for the fixed group; both READMEs state the v11 line; pack evidence proves source and distribution shape agree. No publish/release action.                                                                                                                                                                                                                                                                                                                                                      |

Slice 4 may land its runner before slices 2/3, but each assertion belongs to the owner slice it proves.
Slice 5 depends on slices 2 and 4. Slice 6 depends on 2/3/5. Slice 7 starts only after focused checks for
1-6 pass. No broad gate substitutes for a failed focused owner review.

### Required implementation decisions

1. Extend the compat series model to `['1.10','1.11']` with explicit literal constants (`NEXT_SERIES_MIN_VERSION`
   `'1.12.0'`, `REFERENCE_TAG_PATTERN 'v1.11.*'`); string series equality means 1.11 must be listed, not derived.
2. Model the batch envelope as a sum type: healthy entries (single-change status fields, no per-entry root),
   per-change failure entries, the empty-set `message` key, and the `{ changes: [], root: null }` null shape
   with its diagnostic `status` preserved. Parsing must not consult the process exit code.
3. Gate `status --all` and `show --diff` behind new capability flags in `deriveOpenSpecCliCapabilities`
   (batch status and requirement diff are 1.11-only; `init --language` is 1.10+). 1.10 sessions must never
   receive these argv.
4. Keep the local delta parser as the Change Detail display owner; the CLI diff is separately fetched evidence
   and is never recomputed or backfilled locally.
5. Rebuild the Agent registry from the pinned v1.11 source inventory rather than one-off additions: zed entry
   (`minCliSeries '1.10'`), antigravity current/legacy roots + migration + detection paths, shared-root owner
   candidate set, opencode template equivalence, per-tool `requiresIdeRestart` timing.
6. `PINNED_AGENT_GENERATOR_VERSION` moves to `1.11.0`, and the generated-by comparison in `tool-init-state.ts`
   becomes series-aware: artifacts generated by either admitted series are current for both; only
   below-admitted generators are stale. The constant never substitutes for a live resolution.
7. Fixture discipline: pinned 1.10.0/1.11.0 executables only; no hand-authored payloads for newly accepted
   contracts; `expectPinnedVersion`-style strict stdout parsing must keep passing (stdout purity is part of the
   1.11 contract).
8. README law: repository README keeps the full version table (v11 current, v9 line archived) and the package
   README is scoped to the current release line only; both update in this delivery.
9. Spec hygiene rides with this Change: the delta Specs also advance the stale v9 wording in
   `Explicit Planning Completion Projection`, `Schema Resolution JSON Sum Type`, and
   `Archived Validation Evidence` to the admitted 1.10/1.11 lines, and rename the version-bound
   `v9 Workflow Fixtures Are Executable` and `Static Projection Does Not Invent v9 Runtime Evidence`
   requirements. One delta file uses at most one `## MODIFIED Requirements` section (the upstream parser
   overwrites same-title sections, silently dropping earlier ones).

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI 11 admits stable CLI 1.10.x and 1.11.x, recommends 1.11.x.
- One-spawn batch status loading for admitted 1.11 sessions.
- Change Detail MODIFIED-delta diff/warning evidence from `show --diff`.
- Agent delivery inventory projects zed, migrated antigravity paths, three-valued shared-root ownership, and
  opencode argument-passthrough templates.
- Validate surfaces the Purpose-placeholder warning class; strict escalation stays CLI-owned.

### Modified Behavior

- 1.8.x/1.9.x change from admitted to blocked in OpenSpecUI 11 (mismatch dialog; session-only bypass unchanged).
- The serial per-change status spawn loop becomes the 1.10 fallback behind the batch capability gate.
- Agent generator/version expectations move from 1.9.0 pinning to 1.10/1.11 fixture facts.
- READMEs and compatibility copy state the new ranges everywhere they appeared for v9.

## Risks and Mitigations

| Risk                                                       | Mitigation                                                                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.10 passes admission but is only tested against 1.11      | pin and execute separate 1.10.0/1.11.0 fixture cases for every accepted contract, including capability-boundary negatives (1.10 rejects `--all`/`--diff`). |
| Batch envelope parsing trusts exit code                    | contract tests assert exit-1-with-valid-JSON parsing and the per-change failure sum type.                                                                  |
| Batch transport changes Work identity/reactivity semantics | slice 5 red cases pin `opsx-status-list` identity, per-change deps, and Applying projection; capability gate keeps 1.10 on the old path.                   |
| Shared-root arbitration misprojected (codex/zed/agents)    | registry tests encode the pinned arbitration order and the antigravity exclusion from skills-writer candidates.                                            |
| eager-JSON fast path silently weakened                     | do not relax the stderr-empty early-termination condition; fixture asserts JSON-run stdout/stderr discipline on 1.11.                                      |
| Upstream docs drift (stale antigravity row)                | registry tests assert against `src/core/config.ts` + adapters at the pinned commit, not generated docs.                                                    |
| Scope creep into unrelated website work                    | the change touches only the packages/files named in slices; `packages/website` in-progress owner work stays untouched.                                     |

## Owner acceptance boundary

Automated evidence (focused Vitest, pinned fixtures, component-level Playwright, pack checks) prepares
acceptance only. The Owner performs every final end-to-end browser walkthrough, PR delivery, archive, merge,
and release decision.
