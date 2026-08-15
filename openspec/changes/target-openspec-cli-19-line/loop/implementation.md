<!--
Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
1. Record only accepted v9 implementation evidence and recovery results.
2. Separate candidate source state from focused-review completion.
3. Preserve loopback and Owner-only acceptance boundaries for the next Agent.

Original request (2026-08-15): "这里面很大的问题也是因为你作为架构师，openspec change 文件撰写不够清晰，导致Agent 没有如期完成所有开发，请你改进 change 文件，改进开发计划。"
-->

# OpenSpecUI 9 implementation record

## Current state

```text
Change artifacts      corrected and planning-valid
Recovery branch       fix/v9-cli-18-19-recovery; gates R0-R5 closed with recorded evidence
Candidate source     local main at 79c41a02 was review-rejected and fully superseded
Release/PR/archive    not authorized
Owner browser/App     pending and Owner-only
```

`loop/recovery-plan.md` is the execution authority. Do not restore the former “complete through slices 1-7” claim:
source changes exist for parts of those slices, but the following reviewed obligations remain unaccepted.

| Reopened scope         | Why prior evidence is insufficient                                                  | Required record before closure                                               |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| R0 standards           | `workflow.ts` exceeds the intent limit and a changed test lacks the required header | Physical split/header plus focused Core/Web verification                     |
| R1 schemas             | the Kernel does not forward its selected Root to `schemas()`                        | 1.9 real selected-Root failure and 1.8 no-selector evidence                  |
| R2 archived validation | supported 1.8 sessions can invoke a 1.9-only flag                                   | pre-execution typed unavailable result and 1.9 success/failure evidence      |
| R3 static schemas      | failure capture is lossy and list-only access returns `[]`                          | complete captured evidence and failure propagation through every static read |
| R4 Agent delivery      | fixed 1.9 inventory causes an absent 1.8 adapter to erase the catalog               | executable-backed 1.8/1.9 inventories and isolated missing-adapter evidence  |
| R5 distribution        | package evidence predates the required corrections                                  | recovery-branch build, pack, install, and review results                     |

## Evidence recording rule

For each R0-R5 gate, append one entry only after the named green case passes:

```text
Gate:
Feature branch and commit:
Primary production owner:
True red case and command:
Code decision:
Green case and command:
Focused review result:
Files changed:
Residual risk or stop-condition check:
```

Do not record a mock-only payload as proof of a CLI-specific production path. Do not run R5 to compensate for a
failed focused gate. A test failure may be accepted as baseline-only only after it is reproduced unchanged against the
recovery branch parent and recorded with its exact command and error.

## Preserved candidate facts

- `references/openspec` is pinned to OpenSpec v1.9.0 at `2826b8889e5223a9a8095d4428b60b56597e1020`.
- Existing 1.8/1.9 executable workflow fixtures establish planning completion and Apply-progress behavior, but must
  be extended where R1, R2, and R4 require product-path proof.
- `pnpm test:ci` currently stops on the unchanged macOS `reactive-fs/path-realpath` canonical-path assertion
  (`/private/var` versus `/var`). It is not v9 evidence unless reproduced unchanged as R5 requires.

## Recovery evidence record (2026-08-15 Asia/Shanghai)

Branch `fix/v9-cli-18-19-recovery` from reviewed local `main` `79c41a02`; planning artifacts committed first as
`cc2c51a5` before any production edit.

```text
Gate: R0
Feature branch and commit: fix/v9-cli-18-19-recovery @ 3ad590eb
Primary production owner: packages/core/src/cli-contracts/schema-resolution.ts (new); workflow.ts trimmed
True red case and command: workflow.ts header declared six intents; static-data-provider.opsx.test.ts had no
  Orthogonal-intents/Original-request header (inspection at 79c41a02).
Code decision: physically moved CliSchemaInfoSchema, the success array, 1.9 failure envelope, union, and
  isCliSchemasFailure into schema-resolution.ts (4 intents); workflow.ts reduced to 5 intents; repointed
  executor.ts, opsx-types.ts, opsx-kernel.ts, workflow.test.ts, official-cli-19-validation-fixtures.test.ts,
  and the barrel index; added the required test header.
Green case and command: pnpm --filter @openspecui/core exec vitest run src/cli-contracts/workflow.test.ts
  (10 passed) and pnpm --filter @openspecui/web exec vitest run --project unit
  src/lib/static-data-provider.opsx.test.ts (9 passed); tsc --noEmit clean in core and web.
Focused review result: pass; no type cycle, behavioral coverage unchanged.
Files changed: packages/core/src/cli-contracts/{schema-resolution.ts,workflow.ts,executor.ts,index.ts,
  workflow.test.ts}, packages/core/src/{opsx-types.ts,opsx-kernel.ts,official-cli-19-validation-fixtures.test.ts},
  packages/web/src/lib/static-data-provider.opsx.test.ts.
Residual risk or stop-condition check: none; header intents truthfully count 4 and 5.

Gate: R1
Feature branch and commit: fix/v9-cli-18-19-recovery @ c8f39156
Primary production owner: packages/core/src/{cli-contracts/executor.ts,cli-executor.ts,opsx-kernel.ts,
  openspec-compat.ts}
True red case and command: OpsxKernel.fetchSchemasProjection called contracts.schemas() with no selector, so
  `schemas --json --store ghost` was unreachable through Config and the 1.8 unknown-option boundary was
  invisible (inspection plus new fixture failing pre-change: 1.9 case expected a selected-Root failure and got
  a successful catalog).
Code decision: deriveOpenSpecCliCapabilities/parse in openspec-compat; Kernel resolves capabilities once per
  lifetime from checkAvailability and forwards {store} only when schemasRootSelector is declared (1.9+);
  contracts.schemas()/raw schemas() accept the selector; fixing reachability exposed the eager-JSON fast path
  fabricating exit code 0 for slow-exiting failure envelopes — eager-resolved results now report exitCode null
  (unknown) with transport success preserved.
Green case and command: npx vitest run src/opsx-kernel-schemas-root.fixtures.test.ts — pinned 1.9.0 executable
  driven through the real OpsxKernel surfaces the selected Root's typed CliProjectionCommandError
  (unknown_store/no_registered_stores, exit honestly null, spy proves {store:'ghost'} forwarded); pinned 1.8.0
  succeeds with the selector withheld (spy proves {}). Kernel/executor/spawn-safe/contracts/compat suites
  (87 tests) green.
Focused review result: pass; baseline path-realpath failure reproduced unchanged at parent 79c41a02 via
  git stash (exact /private/var vs /var assertion recorded).
Files changed: packages/core/src/{openspec-compat.ts,cli-contracts/executor.ts,cli-executor.ts,opsx-kernel.ts,
  opsx-kernel-schemas-root.fixtures.test.ts}.
Residual risk or stop-condition check: exitCode null on eager-resolved commands is an honest-unknown contract
  change; downstream characterization updated in R5 (cli-executor-tracing.test.ts).

Gate: R2
Feature branch and commit: fix/v9-cli-18-19-recovery @ 79f47100
Primary production owner: packages/server/src/router.ts; packages/web/src/components/archived-validation-evidence.tsx
True red case and command: cli.validate accepted {kind:'archived'} regardless of CLI version (router.ts at
  79c41a02); the web panel offered the run button on a detected 1.8 session.
Code decision: server rejects archived requests with typed PRECONDITION_FAILED naming the archived-validation
  capability before any process spawn when deriveOpenSpecCliCapabilities says the detected CLI lacks it; the
  web panel renders an explicit Unavailable-on-this-CLI-line state naming the detected version with no run
  action; pending CLI evidence defers to the server guard.
Green case and command: pnpm --filter @openspecui/server exec vitest run src/router.test.ts -t "archived
  validation" (2 passed: 1.9 forwards {target archived, store shared}; 1.8 rejects and validate spy proves no
  CLI call); web unit archived-validation-evidence.test.tsx (5 passed incl. new 1.8 no-command case).
Focused review result: pass; router + planning projection suites 114 green; web tsc clean.
Files changed: packages/server/src/router.ts, packages/server/src/router.test.ts,
  packages/web/src/components/archived-validation-evidence.tsx(+.test.tsx).
Residual risk or stop-condition check: none; capability derivation unit-probed for 1.8.0/1.9.0/1.7.0/rc/garbage.

Gate: R3
Feature branch and commit: fix/v9-cli-18-19-recovery @ 020e612c
Primary production owner: packages/core/src/export-types.ts; packages/cli/src/export.ts;
  packages/web/src/lib/static-data-provider.ts
True red case and command: schemasCapture was {ok:false,error:string} only (string lossy) and
  getOpsxSchemas() still returned snapshot.schemas ?? [] as successful data (static-data-provider.ts at
  79c41a02).
Code decision: StaticSchemasCaptureFailure typed on ExportSnapshot.opsx.schemasCapture with command, selector,
  rootAvailable, diagnostics, stdout, stderr, exitCode, payload, contractError; exporter parses the failing
  observation (diagnostics via CliDiagnosticFailureSchema) and throws-vs-captures honestly; static provider
  raises StaticSchemasCaptureError(capture) from BOTH the list and bundle accessors.
Green case and command: pnpm --filter @openspecui/web exec vitest run --project unit
  src/lib/static-data-provider.opsx.test.ts (9 passed incl. typed-capture propagation through both accessors);
  packages/cli export.test.ts (18 passed; no-runner fixture asserts typed failure fields).
Focused review result: pass; core/cli/web tsc clean.
Files changed: packages/core/src/{export-types.ts,index.ts}, packages/cli/src/{export.ts,export.test.ts},
  packages/web/src/lib/{static-data-provider.ts,static-data-provider.opsx.test.ts}.
Residual risk or stop-condition check: none; no static read path can flatten a failed observation to [].

Gate: R4
Feature branch and commit: fix/v9-cli-18-19-recovery @ e2d379f6
Primary production owner: packages/core/src/{agent-delivery-registry.ts,agent-command-content.ts};
  packages/server/src/agent-delivery-projection-service.ts
True red case and command: the projection cloned the fixed 1.9 AI_TOOLS for every session and
  loadOpenSpecAgentCommandContents returned null for the whole catalog when any one adapter was missing
  (agent-command-content.ts `if (!adapter) return null` at 79c41a02); executable diff of official
  @fission-ai/openspec 1.8.0 vs 1.9.0 config proved 1.8 ships 37 tools (no command-code) and no
  requiresIdeRestart fields.
Code decision: registry gains minCliSeries/requiresIdeRestartSince scope facts and
  selectAgentDeliveryRegistry(version); loader isolates a missing adapter as per-tool version-scoped
  unavailableTools reason keeping every unrelated adapter's evidence; server projection selects the registry
  from the admitted version and threads unavailableCommandTools into ToolInitState
  (commandSurfaceUnavailableReason) rendered by the Config Agent page.
Green case and command: core agent-delivery-registry.test.ts (selectAgentDeliveryRegistry '1.8.0' → 37 tools,
  no command-code, no restart facts; '1.9.1' → full 38 with restart facts; null/garbage/1.7.0 → newest) and
  agent-command-content.test.ts (pinned 1.8 runner: result non-null, claude/amazon-q/qwen evidence intact,
  command-code unavailable naming its 1.9 introduction; pinned 1.9: unavailableTools {}); server
  agent-delivery-projection-service.test.ts (new 1.8 inventory test) — 51 core + 4 server focused tests green.
Focused review result: pass; web config-agents/settings/agent-integrations suites green.
Files changed: packages/core/src/{agent-delivery-registry.ts(+test),agent-command-content.ts(+test),
  tool-init-state.ts(+test),index.ts}, packages/server/src/agent-delivery-projection-service.ts(+test),
  packages/web/src/{routes/config-agents.tsx(+test),components/settings/openspec-settings-section.test.tsx,
  lib/use-agent-integrations.test.tsx}.
Residual risk or stop-condition check: none; unknown/unsupported versions intentionally fall back to the
  newest supported inventory rather than an empty one.

Gate: R5
Feature branch and commit: fix/v9-cli-18-19-recovery @ 38a28c46 (with 81237fa5)
Primary production owner: distribution pipeline; no new source owner
True red case and command: two downstream consumers still assumed the old shapes — server
  tool-subscription-router.test.ts read commandContents?.claude (typecheck failed) and cli-executor-tracing
  fixtures asserted the fabricated eager exit 0 (new failure after R1).
Code decision: fixture reads .catalog and characterizes honest eager exitCode null only where the child was
  terminated before natural exit; worker-mode natural-exit cases keep 0.
Green case and command: pnpm run typecheck (all packages Done); pnpm run lint (0 warnings/errors);
  pnpm run openspec:check-reference (OK: v1.9.0); suites — core 643 passed + 1 baseline failure, server 632
  passed + 2 baseline failures, web 1133 passed, app 384 passed, cli 163 passed, search 6 passed;
  pnpm run build:deps && build:packages && build:cli green; npm pack → openspecui-8.0.0.tgz; isolated
  /tmp install: openspecui --version starts, dist markers verified (selectAgentDeliveryRegistry,
  deriveOpenSpecCliCapabilities, archivedValidation, schemasRootSelector, minCliSeries, unavailableTools,
  isPlanningComplete, schemasCapture+rootAvailable in cli.mjs, admission ranges and
  StaticSchemasCaptureError in the web asset).
Focused review result: pass. Baseline-only failures reproduced unchanged at parent 79c41a02 via git stash:
  core reactive-fs/path-realpath (/private/var vs /var) and server translation-cache-adapter sqlite (2 tests).
Files changed: packages/server/src/{tool-subscription-router.test.ts,cli-executor-tracing.test.ts}.
Residual risk or stop-condition check: `pnpm run test:ci` still exits non-zero solely because it halts at the
  core baseline failure before running downstream packages; each downstream package suite was therefore run
  explicitly and is green apart from the reproduced server sqlite baseline.
```

## Boundary after recovery

R0-R5 gates are closed with recorded evidence. Remaining work is Owner-only: browser/App walkthrough on real
1.8.x and 1.9.x projects, then independent PR review, merge, release, and archive decisions. No PR, push,
merge, publish, release, or archive action has been taken.

## Browser walkthrough record (2026-08-15 Asia/Shanghai)

Performed by the implementation Agent with ego-browser at the Owner's explicit instruction (“你自己用
ego-browser 进行走查”), against real fixture projects initialized by the pinned executables
(`/tmp/v9r-walk/proj19` with openspec-cli-19 1.9.0, `/tmp/v9r-walk/proj18` with openspec-cli-18 1.8.0),
served by `packages/server/src/standalone.ts` + the web dev server.

### Observed evidence

1.9.0 session — Settings → OpenSpec Diagnostics: “Current 1.9 line”, “CLI 1.9.0”, Root current, Launch
planning selected. `/config/agents`: “38 official entries”; Command Code card present with capability
`adapter-backed`, skills `.commandcode`, commands path, `/opsx-{workflow}` invocation, 0/11 counts;
Amazon Q shows “IDE restart: required to load regenerated artifacts”; MiniMax shows “Global skills:
~/.minimax/skills” and “Skills scope: user-global”; Codex shows “Skills: .agents” plus “Legacy skills:
.codex”. `/config/schemas`: spec-driven package schema with 4 artifacts. Change Evidence → Archived
validation: run produced the typed report “0 passed · 1 failed”, Root `/private/tmp/v9r-walk/proj19`,
“Exit unknown” (the honest eager-resolution exit evidence), totals “0 passed · 1 failed · 1 archived
changes”, per-change failure `2026-08-15-legacy-cleanup ERROR · tasks.md · 1 incomplete task (1/2
completed)`, and a Rerun control with no repair/archive action.

1.8.0 session — Settings → OpenSpec Diagnostics: “Supported within >=1.8.0 <1.10.0”, “CLI 1.8.0”,
admitted without a mismatch dialog. `/config/agents`: “37 official entries”; Command Code absent
(name and id); Amazon Q carries no IDE-restart line; MiniMax global root and Codex roots unchanged.
Change Evidence → Archived validation: “Unavailable on this CLI line — Archived-task validation
requires the OpenSpec 1.9 line (detected 1.8.0). This session's CLI does not declare the capability,
so no command is offered.”; no run control exists in the DOM.

### Defects found and fixed during the walkthrough

- Project Web could not boot in a browser at all: `terminal-control.ts` accessed `node:url`'s
  `fileURLToPath` at module-evaluation time and `notifications.ts` re-exports `TerminalControlParser`
  as a value, so Vite's browser-external stub threw during import and React never mounted. Fixed by
  resolving the Node API lazily inside `parseFileUriPath` (commit `5a4d5801`). The chain predates the
  recovery branch (empty diff at `79c41a02`) and was invisible to the jsdom suites that mock the module
  boundary.
- The version-selected inventory covered the registry but not the per-tool physical states: a real
  1.8.0 session still rendered 1.9-only IDE-restart facts on tool cards (registry 37 while states
  stayed 38). Fixed by threading the selected registry through `ToolInitProjectionOptions` at both
  projection call sites and extending the 1.8 projection test to assert state-level exclusion (commit
  `cc8900b7`). Operational note: the standalone server consumes Core through the built `dist`, so the
  walkthrough initially observed stale behavior until `packages/core` was rebuilt — distribution
  verification must always follow a source fix.

### Boundary after the walkthrough

The walkthrough was agent-executed at the Owner's instruction; it is recorded as evidence, not as the
Owner's own acceptance. Checkpoint 4.1 is marked accordingly. PR review, merge, release, and archive
(4.2) remain Owner-only, and no such action has been taken.

### Post-walkthrough distribution re-verification (2026-08-15 Asia/Shanghai)

The two walkthrough fixes changed source after the R5 pack, so distribution was re-verified:
`pnpm run build:cli` green; `npm pack` → `openspecui-8.0.0.tgz`; isolated temporary-directory install
starts (`--version` 8.0.0, `export --help` ok) and carries the fix markers (lazy `node:url` resolution in
terminal-control, registry selection reaching tool states) plus every prior v9 law marker
(`isPlanningComplete`, `CliSchemasFailure`, capability derivation, `schemasRootSelector`, `minCliSeries`,
`unavailableTools`); the shipped web asset carries the admission range, `StaticSchemasCaptureError`, and
the archived-validation unavailable copy. The website docs suite was also run explicitly: 15 passed.
Working tree clean; branch `fix/v9-cli-18-19-recovery` at `a2942782`.

## Loopback triggers

- The official 1.8 or 1.9 executable contradicts a command, payload, selector, or Agent-inventory assumption in a
  delta Spec.
- A fix requires a second production owner not named in the relevant recovery gate.
- A static capture cannot carry the complete typed command evidence without widening the public projection contract.
- A focused gate fails, a new global-root mutation is introduced, or source/distribution output diverges.
- The request broadens support beyond stable `>=1.8.0 <1.10.0` or asks for PR, merge, publish, release, archive, or
  Owner acceptance.

When a trigger occurs, stop implementation, amend `loop/research-plan.md`, the affected delta Spec, and
`loop/recovery-plan.md`, then wait for approval before continuing.
