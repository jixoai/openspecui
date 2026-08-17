<!--
Orthogonal intents (updated 2026-08-16 Asia/Shanghai):
1. Record only accepted v9 implementation evidence and recovery results.
2. Separate candidate source state from focused-review completion.
3. Preserve loopback and Owner-only acceptance boundaries for the next Agent.

Original request (2026-08-15): "这里面很大的问题也是因为你作为架构师，openspec change 文件撰写不够清晰，导致Agent 没有如期完成所有开发，请你改进 change 文件，改进开发计划。"
-->

# OpenSpecUI 9 implementation record

## Current state

```text
Change artifacts      planning-valid; R8 closure and Owner boundary are current
Recovery branch       fix/v9-final-review @ f1609e66 (plus current unstaged review edits)
Accepted gates        R0-R7.3 historical closure; R8.1-R8.5 fresh focused/source closure
Open gate             none before Owner gates; final source/distribution evidence and post-release correction are recorded below
Owner gates           4.1 browser/App walkthrough and 4.2 PR/release/archive remain unchecked
```

`loop/recovery-plan.md` remains the execution authority. R8.5 is closed: the workspace timeout is classified as
process-load-sensitive, the final source was tested in an isolated worktree, and source/build/pack/install evidence
was refreshed after the review edits. The implementation is ready for the Owner-only browser/App walkthrough; no
Agent may check 4.1 or 4.2.

| Current gate | State     | Exact boundary                                                                                                                                                                                                   |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R8.1-R8.4    | closed    | Focused behavior and header evidence are current at the last recorded gate; the final-review source edits are listed below.                                                                                      |
| R8.5         | closed    | In an isolated current-revision worktree with no competing workspace workload, the exact Server triple passed 120/120 without timeout inflation; the workspace timeout was classified as process-load-sensitive. |
| 4.1          | ready     | Owner-only browser/App walkthrough may begin after the final source/distribution and independent-review records below.                                                                                           |
| 4.2          | unchecked | Owner-only independent PR/release review. PR #238, tag/publication 9.0.0, and archive PR #239 are objective facts, not Owner acceptance.                                                                         |

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
  pnpm run build:deps && build:packages && build:cli green; historical candidate npm pack → openspecui-8.0.0.tgz
  (not v9 release evidence); isolated
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
`pnpm run build:cli` green; historical candidate `npm pack` → `openspecui-8.0.0.tgz`; isolated
temporary-directory install starts (`--version` 8.0.0, both candidate facts, not v9 release evidence;
`export --help` ok) and carries the fix markers (lazy `node:url` resolution in
terminal-control, registry selection reaching tool states) plus every prior v9 law marker
(`isPlanningComplete`, `CliSchemasFailure`, capability derivation, `schemasRootSelector`, `minCliSeries`,
`unavailableTools`); the shipped web asset carries the admission range, `StaticSchemasCaptureError`, and
the archived-validation unavailable copy. The website docs suite was also run explicitly: 15 passed.
Working tree clean; branch `fix/v9-cli-18-19-recovery` at `a2942782`.

## Post-R5 independent review correction (2026-08-15 Asia/Shanghai)

The preceding R0-R5 and walkthrough records are true historical evidence. They do not close the independent review
findings below. No R6 production edit or focused verification has occurred in this planning pass.

| Gate | Review finding                                                                                  | Required evidence before a checkbox may close                                    |
| ---- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| R6.1 | Bypass/unsupported version can receive 1.9-specific capability or registry                      | bypassed 1.9 prerelease/1.10/no-version has neither inventory nor 1.9 capability |
| R6.2 | retained physical Agent projection drops the selected registry                                  | replacement 1.8 emission stays 1.8-only                                          |
| R6.3 | direct Agent Init validates against complete static registry and may spawn unavailable 1.8 tool | 1.8 Command Code is typed rejection with no spawn; `'all'` remains literal       |
| R6.4 | static capture failure protects only list/bundle accessors                                      | all Schema accessors throw the same typed captured failure                       |
| R6.5 | tracked document data is rendered as task progress; normal Apply count disappears               | list has no implementation count; detail always shows Apply count                |
| R6.6 | archived report uses shallow guard/assertion                                                    | Core schema `safeParse` controls report rendering                                |
| R6.7 | v9-touched TypeScript files lack current intent headers                                         | audited inventory and truthful headers/splits recorded                           |
| R6.8 | Router test uses double assertions at validation fixture boundary                               | typed spy fixture proves 1.8 no-spawn and 1.9 call                               |
| R6.9 | package proof predates all above repairs                                                        | new build/pack/isolated-install plus independent review                          |

For R6, use `loop/recovery-plan.md` as execution authority. Append one entry per green gate using this format:

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

## R6 repair evidence record (2026-08-15 Asia/Shanghai)

Planning correction committed first as `0a4bbb95`. Gates executed linearly on
`fix/v9-cli-18-19-recovery`.

```text
Gate: R6.1
Feature branch and commit: 045f204b
Primary production owner: openspec-compat.ts; agent-delivery-registry.ts; agent-delivery-projection-service.ts
True red case and command: npx tsx probe — 1.9.0-rc.1/1.10.0/2.0.0 derived archivedValidation and
  schemasRootSelector true with a 38-entry registry; unavailable runners fabricated the pinned 1.9.0.
Code decision: isAdmittedVersion (stable, current or supported non-current) is the sole capability
  input; parseOpenSpecCliSeries returns a series only for stable 1.8.x/1.9.x so every other form
  selects zero inventory; the projection resolves inventory identity only from a live available CLI.
Green case and command: compat+registry focused suites (25 passed) — bypassed forms keep mismatch
  evidence with no capability and no inventory; projection suite (5 passed) incl. new
  unavailable-CLI empty-inventory test; core 56 / server 113 focused tests green.
Focused review result: pass.
Files changed: openspec-compat.ts(+test), agent-delivery-registry.ts(+test),
  agent-delivery-projection-service.ts(+test).
Residual risk or stop-condition check: PINNED_AGENT_GENERATOR_VERSION remains only for on-disk
  generated-by comparison (stale-version detection), never inventory selection.

Gate: R6.2
Feature branch and commit: 621abf7e
Primary production owner: tool-init-state.ts
True red case and command: createToolInitStateProjection rebuilt options without registry — a
  replacement emission fell back to full AI_TOOLS (inspection; new test failed pre-change).
Code decision: retained options clone the selected registry with the same immutability policy as
  delivery/workflows/commandContents.
Green case and command: vitest src/tool-init-state.test.ts (20 passed) incl. new retained-emission
  regression (initial and replacement emissions both 37-tool, no command-code, no restart facts
  across a filesystem mutation); projection service 5 passed.
Focused review result: pass.
Files changed: tool-init-state.ts(+test).
Residual risk or stop-condition check: none; no process-global registry, no in-place mutation.

Gate: R6.3
Feature branch and commit: 22880f8a
Primary production owner: router.ts (agentIntegrations.initStream)
True red case and command: input schema validated against the static full registry and never
  rechecked the projection — direct 1.8 RPC with ['command-code'] reached cliExecutor.initStream.
Code decision: after getCurrent(), explicit tools are checked against projection.registry; typed
  PRECONDITION_FAILED before any spawn; 'all' stays the literal official CLI request.
Green case and command: vitest src/router.test.ts -t initStream (3 passed: 1.8 command-code
  rejected with initStream spy never called; explicit 1.8 claude streams; 1.9 'all' unchanged);
  full router suite 106 passed.
Focused review result: pass.
Files changed: router.ts, router.test.ts.
Residual risk or stop-condition check: browser-only disablement not used; validation is against
  the projection, not getAvailableTools().

Gate: R6.4
Feature branch and commit: 28fe06e7
Primary production owner: static-data-provider.ts
True red case and command: only list/bundle asserted the capture; detail/resolution/templates/
  files/yaml/template-content returned stale or null data for a failed capture.
Code decision: assertSchemasCaptureCaptured(snapshot) before every Schema-related accessor read;
  identical StaticSchemasCaptureError object, no accessor-specific fallbacks.
Green case and command: vitest --project unit static-data-provider.opsx.test.ts (9 passed) — all
  eight accessors reject with the same typed capture; web routes suite 295 passed.
Focused review result: pass.
Files changed: static-data-provider.ts(+test).
Residual risk or stop-condition check: none; no accessor returns null/[]/empty text for a failure.

Gate: R6.5
Feature branch and commit: 7601a497 (dashboard extension c1655acb under R6.9)
Primary production owner: change-list.tsx; apply-progress-notice.tsx
True red case and command: list rendered trackedTaskProgress as n/m, a percent bar, and
  'n% task completion' without Apply Instructions; the notice returned null when sources agreed.
Code decision: list shows only planning phase + CLI artifact facts (no counts/percent/completion);
  notice always renders the source-attributed Apply count when Apply Instructions exist, tracked
  only as clearly secondary divergence evidence.
Green case and command: change-list + apply-progress-notice + change-view suites (29 passed) — a
  tracked-only list claims no implementation progress; an agreeing detail still shows the CLI count.
Focused review result: pass.
Files changed: change-list.tsx(+test), apply-progress-notice.tsx(+test).
Residual risk or stop-condition check: R6.9's asset inspection caught the same violation on
  dashboard active cards; fixed in c1655acb with the same objective-facts rule (20 dashboard
  tests, full web 1134 green).

Gate: R6.6
Feature branch and commit: 16149f97
Primary production owner: archived-validation-evidence.tsx
True red case and command: isValidationReport shallow-checked items/summary presence and the RPC
  result was cast — { items: [], summary: { totals: { items: 'not-a-number' } }, root: '/bare' }
  passed the guard and would crash rendering nested totals.
Code decision: Core CliValidateReportSchema exported and safeParse is the single evidence boundary;
  parse failure renders typed CLI failure evidence; assertion casts removed.
Green case and command: archived-validation-evidence.test.tsx (6 passed) incl. new malformed-
  payload failure-evidence case that asserts no report surface renders.
Focused review result: pass.
Files changed: archived-validation-evidence.tsx(+test), core index.ts.
Residual risk or stop-condition check: no shallow guard, no `as ArchivedValidationReport`, no
  fabricated fallback report remains.

Gate: R6.7
Feature branch and commit: de1ef34f
Primary production owner: 42 TypeScript files changed since 79c41a02
True red case and command: header audit over `git diff --name-only 79c41a02..HEAD` found 27 files
  with intents headers but no 2026-08-15 timestamp/request despite carrying v9 behavior.
Code decision: each file received a truthful v9 intent (real behavior named per owner) and the v9
  original request; files at the five-intent limit got merged truthful wording (router.ts intent 5,
  router.test.ts intent 5) instead of a sixth entry; final audit reports zero violations across
  all 42 files (no missing intents, no missing v9 date, no >5 intents).
Green case and command: pnpm run format:check (batch passed); full typecheck (all packages Done);
  header-touched suites green (core 36, server 106).
Focused review result: pass.
Files changed: 27 files (list preserved in the commit).
Residual risk or stop-condition check: dashboard.tsx entered the diff after the audit (R6.9 fix)
  and received the same standard in c1655acb.

Gate: R6.8
Feature branch and commit: 887382fb
Primary production owner: router.test.ts
True red case and command: three archived-validation assertions used
  `unknown as ReturnType<typeof vi.fn>` to reach contracts.validate.
Code decision: validateContractSpy exposes the typed mock from the shared Router test context; all
  three call sites use it; production types untouched.
Green case and command: vitest src/router.test.ts -t "archived validation" (2 passed) then the full
  suite (106 passed); server typecheck clean.
Focused review result: pass.
Files changed: router.test.ts.
Residual risk or stop-condition check: no any/unknown-as/@ts-nocheck introduced; the pre-existing
  unrelated casts elsewhere in the file are out of R6 scope and unchanged.

Gate: R6.9
Feature branch and commit: c1655acb (+ builds/installs this session)
Primary production owner: source/distribution agreement
True red case and command: R5 tarball proof predated R6 source edits.
Code decision: full gates re-run — format:check, lint (0/0), typecheck (all Done),
  openspec:check-reference (OK v1.9.0), test:ci (core 646 passed + the macOS path-realpath baseline,
  reproduced unchanged at the R6 parent via git stash; server 635 passed + the sqlite baseline, also
  reproduced unchanged; web 1134, app 384, cli 163 green; one new failure found and fixed during
  the gate: agent-integrations-router fixture needed its admitted registry). Clean rebuild
  (build:deps/build:packages/build:cli), historical candidate npm pack, isolated install: openspecui
  --version 8.0.0 (candidate fact, not v9 release evidence),
  export --help ok, installed dist carries admission-gated capabilities, registry selection, the
  retained-registry clone, and all prior law markers; the web asset carries 'Apply task progress'
  and zero '% task completion' copies (the first pack exposed the dashboard violation, fixed in
  c1655acb and re-verified on a clean bundle).
Focused review result: pass; no unclassified failures — both remaining failures are the documented
  baselines reproduced identically at the parent.
Files changed: dashboard.tsx, agent-integrations-router.test.ts.
Residual risk or stop-condition check: test:ci halts at the core baseline before downstream
  packages; each downstream suite was run explicitly and is green apart from the reproduced server
  baseline.
```

### Boundary after R6

R6.1-R6.9 are closed with recorded evidence. Automated browser/component evidence remains
preparation; the Owner alone decides the final walkthrough, PR review, merge, release, and archive.
No PR, push, merge, publish, release, or archive action has been taken.

## Independent-review correction after R6 closure (2026-08-15 Asia/Shanghai)

This record supersedes the R6 closure claim above without deleting its historical Agent evidence. The independent
review compared `79c41a02...b5c64f7f`; it found that R6.1-R6.5 and R6.8 have matching focused behavior evidence,
but R6.6, R6.7, R6.9, and the Owner-gate expression do not satisfy their stated stop conditions.

| Gate | Independent evidence                                                                                                                                                                                                 | Required recovery                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R6.6 | `archived-validation-evidence.tsx:34` casts successful `safeParse` data; line 114 casts the tRPC result.                                                                                                             | R7.1 removes both assertion boundaries while retaining typed report and transport diagnostics. |
| R6.7 | `git diff --name-only 79c41a02...b5c64f7f -- 'packages/**/*.ts' 'packages/**/*.tsx'` returns 44 paths, not the recorded 42. `agent-integrations-router.test.ts` was changed by R6.9 but retains a 2026-08-06 header. | R7.2 records the complete dynamic inventory and repairs headers.                               |
| R6.9 | `git diff --check 79c41a02...b5c64f7f` reports 28 trailing-whitespace violations in v9 header edits.                                                                                                                 | R7.2 clears diff hygiene; R7.3 reruns all source/distribution evidence after the correction.   |
| 4.1  | An implementation Agent's browser observation is preparation evidence, not an Owner walkthrough.                                                                                                                     | Keep checkpoint 4.1 unchecked and blocked until R7.3's fresh review succeeds.                  |

Commands run by this independent review:

```text
PASS  openspec validate target-openspec-cli-19-line --strict
PASS  focused Core compatibility/registry/state suites (45 tests)
PASS  focused Web static/progress/archived-validation suites (51 tests)
PASS  focused Server Agent projection/router and archived-validation suites (16 tests)
FAIL  git diff --check 79c41a02...b5c64f7f (28 trailing-whitespace violations)
```

`pnpm run format:check` without `FORMAT_CHECK_BASE_SHA` is not attributable to the v9 diff because it includes the
user-owned untracked `pb.html`. R7.2/R7.3 therefore use the scoped base-SHA command. No production source, package
output, user project, PR, merge, release, or archive was changed by this review. The R7 authority is
`loop/recovery-plan.md`; checkpoints remain open until fresh evidence is appended here.

## R7 repair evidence record (2026-08-15 Asia/Shanghai)

Planning correction committed first as `fff3729d`. Gates executed linearly; each production commit below carries its
own detailed message.

```text
Gate: R7.1
Feature branch and commit: 0d44b37e
Primary production owner: archived-validation-evidence.tsx (+ core index export)
True red case and command: parseValidationReport safeParse'd but cast parsed.data into a local alias; the RPC
  result was cast wholesale to CliCommandResult<CliValidate> (grep: both casts present pre-change).
Code decision: the parse returns the schema-inferred CliValidateReport (newly exported from Core) directly; the
  transport result is runtime-validated before state assignment — an unrecognized shape becomes typed failure
  evidence with transport/contract diagnostics retained.
Green case and command: pnpm --filter @openspecui/web exec vitest run --project unit
  src/components/archived-validation-evidence.test.tsx (6 passed); web typecheck clean.
Focused review result: pass; no assertion cast remains at the boundary.

Gate: R7.2
Feature branch and commit: 820ac99e (whitespace) + e17429b3 (audit)
Primary production owner: every TS/TSX path changed since 79c41a02
True red case and command: git diff --name-only 79c41a02...HEAD returned 44 paths vs the recorded 42;
  agent-integrations-router.test.ts retained its 2026-08-06 header; git diff --check reported 28 trailing-
  whitespace violations.
Code decision: every changed file stripped of trailing whitespace; the stale header updated to the v9 intent
  with the current timestamp; the scoped formatter covers the md artifacts touched by the planning correction.
Green case and command: git diff --check 79c41a02...HEAD exits 0; FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run
  format:check passes (55 then 56 files).
Focused review result: pass at the time — but the fresh independent review then exposed deeper header corruption
  this audit missed (duplicate intent numbering, mid-sentence merges, a malformed router.ts request line);
  repaired under R7.3 and recorded there. Honesty requires keeping this note rather than a clean claim.

Gate: R7.3
Feature branch and commit: 41e3f109 (header repairs) + 92b2b8b9 (spec findings) + 6e3859da (new-owner header)
Primary production owner: source/distribution agreement and the independent-review boundary
True red case and command: the R6.9 build/pack record predated R7 source edits; its "clean gate" was false.
Code decision and evidence:
  1. A fresh independent whole-change review (parallel Standards + Spec sub-agents over 79c41a02...HEAD) ran
     first. Beyond confirming R7.1/R7.2 it exposed: corrupted intent headers the audits missed (duplicate
     numbering in agent-delivery-registry.test, official-cli-19-validation-fixtures, terminal-control;
     truncated merges in export.ts, opsx-kernel.ts, opsx-types.ts, cli-executor.ts, core index,
     cli-executor-tracing.test; a malformed duplicated request line in router.ts), unparseable-version
     evidence omitting the accepted/recommended ranges, two version parsers able to disagree between
     admission and inventory, the static export never forwarding the selected Root selector, and a shallow
     transport key-presence guard contradicting the component's own no-shallow-guard intent.
  2. All repaired: headers rewritten as truthful five-intent statements (41e3f109); unknown-version evidence
     names both ranges; parseOpenSpecCliSeries delegates to parseOpenSpecCliVersion so one parser feeds both
     boundaries; the export resolves the project's selected Store from the official config and forwards it
     only on a 1.9-capable CLI, recording the forwarded selector in the capture; the transport envelope
     validates via the new CliCommandTransportSchema (92b2b8b9) with the newly touched owner's header added
     (6e3859da). The eager-success finding was resolved by precisely documenting the CliResult transport-
     success contract rather than a global semantic flip (requireCommandData gates on transport success;
     flipping would break the parsed-envelope success path) — a recorded decision, not a silent drop.
  3. Full re-verification: focused Core 45 / Server 120 / Web 44 passed; scoped format check passes (56
     files); lint 0/0; typecheck all Done; reference OK v1.9.0; git diff --check exits 0; full suites — core
     646 passed plus the single documented macOS path-realpath baseline (reproduced unchanged at 79c41a02 in a
     dedicated worktree; the previously recorded "server sqlite baseline" is withdrawn — it was an artifact of
     a worktree install corrupting the shared better-sqlite3 native build; after rebuild the server suite is
     fully green at 638 passed), web 1134, app 384, cli 163.
  4. Fresh clean rebuild (deps/packages/cli), historical candidate npm pack, isolated install: openspecui
     --version 8.0.0 (candidate fact, not v9 release evidence),
     export --help ok; the installed dist carries the unified parser, capability derivation, registry
     selection, and the retained-registry clone; the shipped web asset carries the Apply-progress surface
     with zero task-completion copy, StaticSchemasCaptureError, and the range-naming unknown-version message.
Green case and command: every command in the recovery-plan R7.3 block executed; no unclassified failures.
Focused review result: the review's findings were repaired and re-verified; the review output itself is the
  gate's independent evidence, preserved in the session record.
Residual risk or stop-condition check: the one remaining CI failure is the documented macOS baseline
  reproduced at the reviewed parent; test:ci halts there before downstream packages, which were each run
  explicitly and are green.
```

### Boundary after R7

R7.1-R7.3 are closed with fresh evidence, including a repair round the independent review itself triggered.
Checkpoint 4.1 (Owner-personal walkthrough) and 4.2 (PR/merge/release/archive) remain Owner-only and unchecked.
No PR, push, merge, publish, release, or archive action has been taken. User-owned untracked files (`deno.lock`,
`pb.html`, `packages/app/public/native-icons/**`) were preserved unstaged throughout.

## Independent-review correction after R7 closure (2026-08-15 Asia/Shanghai)

The R7 closure record above is superseded. A fresh two-axis review against `79c41a02...2b3146e3`, followed by
current focused execution, found the following blockers:

| Gate | Current evidence                                                                                                                                                                                                             | Required recovery                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| R8.1 | `static-data-provider.ts:1143`, `:1152`, `:1269`, and `:1286` return on missing optional identity before `assertSchemasCaptureCaptured`; failed static captures can be bypassed with `undefined`.                            | Move the capture assertion before every optional-identity/default branch and add undefined-identity tests.         |
| R8.2 | `archived-validation-evidence.tsx:127` assigns `payload: null` after transport validation; malformed report parsing loses the schema diagnostic.                                                                             | Preserve payload and render the schema contract diagnostic with transport evidence.                                |
| R8.3 | `packages/cli/src/export.ts:473` parses YAML `store` using a line regex despite the existing typed YAML/config owner.                                                                                                        | Reuse the typed config parser and test quoted/commented/invalid values.                                            |
| R8.4 | The final inventory command returns 45 paths, not 44. `agent-delivery-registry.ts:1` imports before its header; `agent-command-content.ts` and `agent-delivery-projection-service.test.ts` contain duplicate intent entries. | Reconcile all 45 headers and capture the complete final path list.                                                 |
| R8.5 | Earlier current-branch run: 116 passed, 4 timeouts. Fresh complete run: 118 passed, 2 failed by 5-second timeout; isolated rerun reproduces both.                                                                            | Reproduce at current and reviewed parent without timeout inflation; classify or repair before distribution review. |

Current verification summary:

```text
PASS  openspec validate target-openspec-cli-19-line --strict
PASS  FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run format:check (56 files)
PASS  pnpm run lint
PASS  pnpm run typecheck
PASS  pnpm run openspec:check-reference
PASS  focused Core suites (53 tests)
PASS  focused Web suites (44 tests)
FAIL  complete Server Agent/router file run (118 passed, 2 timeouts)
FAIL  isolated Server timeout rerun (2 passed, 2 timeouts)
PASS  git diff --check 79c41a02...HEAD
```

No Owner browser/App walkthrough, PR, merge, release, or archive is authorized. R8 is now the execution authority;
its evidence must be appended after the final source edit and before any Owner gate is considered.

## R8 repair evidence record (2026-08-15 Asia/Shanghai)

Planning correction committed first as `86bbcef7`. Gates executed linearly. Final 45-path
inventory (sorted) is preserved below this record per the R8.4 requirement.

```text
Gate: R8.1
Feature branch and commit: 9278e305
Primary production owner: static-data-provider.ts
True red case and command: getOpsxSchemaDetail/Resolution/Yaml and getOpsxTemplateContent
  returned null on an absent identity before the capture assertion (inspection pre-change).
Code decision: every Schema accessor loads the snapshot and asserts the captured failure
  before any optional-identity/default branch; template content delegates to the asserting
  contents accessor even when its identity is absent.
Green case and command: undefined-identity test (7 accessor shapes) plus the full-accessor
  suite — 10 passed; web typecheck clean.
Focused review result: pass (independently re-verified below with file:line evidence).

Gate: R8.2
Feature branch and commit: 770b8caa
Primary production owner: archived-validation-evidence.tsx (+ command-result.ts runtime schema)
True red case and command: state assignment nulled payload after transport validation; a
  malformed report lost its safeParse diagnostic behind a generic string.
Code decision: the validated envelope (data and payload as CliJsonValue with a runtime
  recursive schema) flows into state verbatim; parseValidationReport returns the typed report
  plus path:message schema issues that render in CLI failure evidence beneath any explicit
  transport/contract error; no assertion casts anywhere at the boundary.
Green case and command: payload-retention and schema-diagnostic tests — 8 passed; core+web
  typechecks clean.
Focused review result: pass (independently re-verified).

Gate: R8.3
Feature branch and commit: 67283631
Primary production owner: export.ts
True red case and command: the selector came from a /^\s*store:...$/m regex — `store: "shared"
  # comment` would forward quotes or truncation.
Code decision: inspectProjectBinding (the live planning-config typed owner) is the sole
  selector source; --store forwards only for a declared valid Store on a 1.9-capable CLI;
  the exact selector is preserved in the capture.
Green case and command: quoted (with trailing comment), single-quoted, plain, explicit-null,
  commented-out, and non-string cases tested against owner semantics — 24 export tests
  passed; a quoted value with a trailing comment correctly resolves to the bare id.
Focused review result: pass; noted residual — the declared-to-forward wiring is asserted
  against the owner (no CLI in the fixture), matching the fixture's constraints.

Gate: R8.4
Feature branch and commit: 8b26903a (+ planning 86bbcef7)
Primary production owner: all 45 changed TS/TSX paths
True red case and command: agent-delivery-registry.ts carried its import above the header;
  agent-command-content.ts and agent-delivery-projection-service.test.ts duplicated intents.
Code decision: import moved below the header; both duplications removed; the sorted 45-path
  inventory recorded; full audit (header-first, unique sequential intents within five, v9
  request, current date, no run-together closings) reports zero issues.
Green case and command: registry/command-content suites 19 passed; projection suite 5 passed;
  FORMAT_CHECK_BASE_SHA scoped check passes; git diff --check zero.
Focused review result: pass after the R8.5 review round repaired 19 run-together closings
  and 13 stale dates it exposed (ea22d5f7).

### Superseded R8.5 closure record (2026-08-15)

The following record is retained as historical Agent evidence only. The final-review source edits and
the current Server timeout classification supersede its closure claim.

Gate: R8.5
Feature branch and commit: ea22d5f7 (final)
Primary production owner: source/distribution agreement
True red case and command: R7 package proof predated R8 edits; two Server focused cases had
  timed out at 5s without classification.
Code decision and evidence:
  1. Timeout classification: the focused Server triple ran EIGHT times across this gate —
     every run 120/120 passed, individual tests 1-30ms, the triple completing in ~9s. The
     reviewer's 5s timeouts never reproduced in any configuration (parallel, serial
     --no-file-parallelism, repeated runs). One full serial run surfaced a transient
     cli-stream-observable failure that never recurred across five subsequent runs.
     Classification: not reproducible at HEAD in 8+ runs; recorded as machine/load-sensitive
     flake evidence for the reviewer to re-verify, NOT as an accepted baseline. (A
     parent-worktree probe failed only on missing submodule artifacts — a worktree
     limitation, unrelated to the timeouts.)
  2. Fresh independent review (parallel sub-agent) verified R8.1/R8.2/R8.3, the three named
     R8.4 defects, and all standing v9 laws with file:line evidence; it additionally exposed
     19 run-together header closings and 13 stale dates, repaired in ea22d5f7 and re-audited
     to zero.
  3. Full re-verification after the last source edit: focused Core 53 / Server 120 / Web 47 /
     CLI 24; scoped format check passes; lint 0/0; typecheck all Done; reference OK v1.9.0;
     git diff --check zero; test:ci — core 646 passed plus the single documented macOS
     path-realpath baseline (previously reproduced at 79c41a02 in a dedicated worktree);
     server 638 full; web 1137; app 384; strict Change validation valid with 0 issues;
     openspec instructions apply OK.
  4. Clean rebuild (deps/packages/cli), historical candidate npm pack, isolated install: openspecui --version
     8.0.0 (candidate fact, not v9 release evidence); all final install markers pass (typed selector owner, payload retention runtime
     schema, transport schema, static terminal error, Apply authority with zero
     task-completion copy, admission/registry laws, prior law markers).
Green case and command: all R8.5 plan-block commands executed; no unclassified failures.
Focused review result: the independent review verified every finding fixed except the
  header-convention residue, repaired and re-audited within this gate.
Residual risk or stop-condition check: the two reviewer-observed timeouts are documented as
  non-reproducing flake evidence (8+ clean runs) rather than silently claimed fixed; the
  reviewer may re-run the triple to confirm on their machine.
```

## Final-review correction after R8 closure (historical red record; superseded by the 2026-08-16 closure below)

The following correction table and two paragraphs describe the intermediate state before the final re-verification.
They are retained for audit history only and are not current execution instructions.

The final independent review found no remaining v9 behavior defect in R8.1-R8.4, but it corrected five
post-closure evidence/standards defects before Owner acceptance:

| Owner                                                                       | Finding                                                                                        | Correction                                                                                                       | Focused evidence                                                                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/scripts/w2-project-binding-playwright.ts`                     | The header said it pinned OpenSpec 1.7 while `assertPinnedCli()` required 1.9.0.               | The header now states the 1.9 fixture truth and preserves the 1.7 request as historical context.                 | Header audit after the edit.                                                                                                                                               |
| `packages/cli/src/export.ts`                                                | `JSON.parse()` evidence was cast to a root-bearing object and `CliJsonValue`.                  | `CliJsonValueSchema.safeParse` now establishes the external boundary before root evidence or snapshot retention. | `pnpm --filter openspecui exec vitest run src/export.test.ts` (24 passed).                                                                                                 |
| `packages/web/src/lib/static-data-provider.opsx.test.ts`                    | The typed-failure test used an avoidable assertion cast.                                       | Runtime `instanceof StaticSchemasCaptureError` narrows before inspecting the capture.                            | `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts src/components/archived-validation-evidence.test.tsx` (18 passed). |
| `packages/server/src/router.ts` and `packages/web/src/routes/dashboard.tsx` | The v9 request was duplicated; the Dashboard header also had a run-together closing delimiter. | Duplicate lines were removed and both headers end with an independent `*/`.                                      | Final header audit and `git diff --check`.                                                                                                                                 |

These source edits occurred after R8.5's earlier source/distribution run. At that intermediate point R8.5 was reopened
until the required focused/source/distribution sequence and independent review were fresh. On this review machine, the
exact Server triple timed out in unrelated real-Git tests while other workspace compilation/browser processes
consumed CPU; this was recorded as an environment-sensitive re-verification result, not proof that the prior clean
run regressed. The required no-competing-workload rerun and fresh evidence were subsequently completed and are
recorded below; the current state is R8.5 closed and checkpoint 4.1 ready for the Owner.

### Final 45-path inventory (R8.4, sorted)

- packages/cli/src/export.test.ts
- packages/cli/src/export.ts
- packages/core/src/agent-command-content.test.ts
- packages/core/src/agent-command-content.ts
- packages/core/src/agent-delivery-registry.test.ts
- packages/core/src/agent-delivery-registry.ts
- packages/core/src/cli-contracts/command-result.ts
- packages/core/src/cli-contracts/executor.ts
- packages/core/src/cli-contracts/index.ts
- packages/core/src/cli-contracts/schema-resolution.ts
- packages/core/src/cli-contracts/workflow.test.ts
- packages/core/src/cli-contracts/workflow.ts
- packages/core/src/cli-executor.ts
- packages/core/src/export-types.ts
- packages/core/src/index.ts
- packages/core/src/official-cli-19-validation-fixtures.test.ts
- packages/core/src/openspec-compat.test.ts
- packages/core/src/openspec-compat.ts
- packages/core/src/opsx-kernel-schemas-root.fixtures.test.ts
- packages/core/src/opsx-kernel.ts
- packages/core/src/opsx-types.ts
- packages/core/src/terminal-control.ts
- packages/core/src/tool-init-state.test.ts
- packages/core/src/tool-init-state.ts
- packages/server/src/agent-delivery-projection-service.test.ts
- packages/server/src/agent-delivery-projection-service.ts
- packages/server/src/agent-integrations-router.test.ts
- packages/server/src/cli-executor-tracing.test.ts
- packages/server/src/router.test.ts
- packages/server/src/router.ts
- packages/server/src/tool-subscription-router.test.ts
- packages/web/scripts/w2-project-binding-playwright.ts
- packages/web/src/components/apply-progress-notice.test.tsx
- packages/web/src/components/apply-progress-notice.tsx
- packages/web/src/components/archived-validation-evidence.test.tsx
- packages/web/src/components/archived-validation-evidence.tsx
- packages/web/src/components/settings/openspec-settings-section.test.tsx
- packages/web/src/lib/static-data-provider.opsx.test.ts
- packages/web/src/lib/static-data-provider.ts
- packages/web/src/lib/use-agent-integrations.test.tsx
- packages/web/src/routes/change-list.test.tsx
- packages/web/src/routes/change-list.tsx
- packages/web/src/routes/config-agents.test.tsx
- packages/web/src/routes/config-agents.tsx
- packages/web/src/routes/dashboard.tsx

### Current boundary after R8

R8.1-R8.5 are closed with fresh focused evidence. Checkpoint 4.1 (Owner-personal walkthrough) and 4.2
(PR/merge/release/archive) remain Owner-only and unchecked. No PR, push, merge, publish, release, or
archive action has been taken. User-owned untracked files were preserved unstaged throughout.

### R8.5 verification after final-review edits (2026-08-16 Asia/Shanghai)

The exact Server command was rerun without a build process:

```text
pnpm --filter @openspecui/server exec vitest run \
  src/agent-delivery-projection-service.test.ts \
  src/agent-integrations-router.test.ts \
  src/router.test.ts
```

Workspace result: **119 passed, 1 failed by the 5-second test timeout** at `router.test.ts:2336` while several
long-running workspace browser/build processes were active. The isolated current-revision worktree rerun of the
same exact triple passed **120/120** (three files, no timeout override); the parent `79c41a02` fixture also passed
the named test in 1.8s. Git trace showed identical command counts and sub-second Git execution, with only the
workspace run incurring delayed child scheduling. Classification: environment/process-load-sensitive evidence,
not a v9 behavior regression or accepted code baseline.

### R8.5 closure record (2026-08-16 Asia/Shanghai)

Gate: R8.5
Feature branch and commit: `fix/v9-cli-18-19-recovery @ 7b62a738` plus the final review source edits
Primary production owner: source/distribution agreement and independent-review boundary
True red case and command: the workspace Server triple timed out at `router.test.ts:2336` under concurrent
browser/build processes; no timeout was widened.
Code decision: no production Git or test timeout change. The fixture was rerun from an isolated worktree at the
current revision; Git trace proved the same command inventory as `79c41a02`, and the isolated triple passed 120/120.
Green case and command: direct Vitest invocation of `src/agent-delivery-projection-service.test.ts`,
`src/agent-integrations-router.test.ts`, and `src/router.test.ts` in the isolated current-revision worktree.
Focused review result: R8.1-R8.4 behavior and standards findings are closed; the timeout has a recorded
environment classification and is not hidden as a baseline.
Residual risk or stop-condition check: final source/build/pack/install evidence and the independent review are
recorded in the final re-verification below; only Owner gates remain.

### Final source/distribution re-verification (2026-08-16 Asia/Shanghai)

The final review edits were applied to a detached worktree, dependencies were installed from the local pnpm store,
and the exact Server triple passed `120/120` with the repository's original timeout settings:

```text
pnpm --filter @openspecui/server exec vitest run \
  src/agent-delivery-projection-service.test.ts \
  src/agent-integrations-router.test.ts \
  src/router.test.ts
PASS  3 files, 120 tests
```

Current-worktree focused evidence:

```text
PASS  Core v9 suites: 53 tests
PASS  Web v9 suites: 47 tests
PASS  CLI export suite: 24 tests
PASS  pnpm run lint: 0 warnings, 0 errors
PASS  pnpm run typecheck: all workspace packages
PASS  openspec validate target-openspec-cli-19-line --strict
PASS  FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run format:check (56 files)
PASS  git diff --check
PASS  pnpm run build:packages
PASS  pnpm run build:cli
PASS  historical candidate npm pack openspecui@8.0.0 (not v9 release evidence)
PASS  isolated npm install of the candidate tarball; openspecui --version => 8.0.0 (not v9 release evidence)
PASS  installed CLI --help, Web asset, App asset, and v9 selector/evidence markers
```

The installed tarball contains the rebuilt `web/`, `app/`, and CLI `dist/` trees. The two independent review axes
found no remaining standards or implementation defect. The main-worktree timeout is retained as environment evidence
only; it is not a production baseline and no test timeout was widened.

## Final audit correction (2026-08-17 Asia/Shanghai)

This entry corrects audit metadata without rewriting historical candidate records. Earlier R5/R6/R8 paragraphs
contain candidate or pre-release distribution observations such as openspecui-8.0.0.tgz and an installed
--version of 8.0.0; those observations remain historical evidence and are not the v9 release truth. The earlier
R4 sentence that described unsupported versions as falling back to the newest inventory is also superseded by the
final admission law: unknown, unparsable, prerelease, versions below 1.8.0, and versions at or above 1.10.0
select neither admitted capabilities nor an Agent registry.

Fresh post-release distribution verification was run from the current v9 source after the final review correction:

    pnpm run build:deps && pnpm run build:packages && pnpm run build:cli  -> PASS
    (cd packages/cli && npm pack)                                      -> openspecui-9.0.0.tgz
    isolated npm install of openspecui-9.0.0.tgz                       -> PASS
    installed openspecui --version                                     -> 9.0.0
    installed openspecui --help, Web/App assets, and v9 admission/registry markers -> PASS

The authoritative release facts are PR #238 merge 64abcb80, tag openspecui@9.0.0, the published npm package
and GitHub Release, followed by archive PR #239 merge f1609e66. These facts do not check Owner gates 4.1 or 4.2;
the Owner still owns personal browser/App acceptance and the independent release review.

## Post-release Schema evidence correction (2026-08-17 Asia/Shanghai)

The final review found that the static exporter still used the raw `CliExecutor.schemas()` path, so a typed
`contractError` produced for a failed Schema command could be lost. Commit `dc854a88` routes this observation
through `cliExecutor.contracts.schemas()` and retains the typed payload, diagnostics, process facts, and
`contractError`; a failed result cannot become a successful empty Schema catalog. The changeset
`.changeset/fresh-lions-dance.md` requests the normal fixed-group patch release (future `9.0.1`).

Fresh evidence after that source correction:

    CLI export suite: 26/26 passed, including non-zero exit + non-JSON stdout evidence
    Core CLI contract suites: 19/19 passed
    pnpm run build: all workspace typechecks and Web/App/CLI builds passed
    pnpm pack + isolated npm install: package/dist/cli.mjs and package/web/index.html present; --version => 9.0.0
    format:check, lint:ci, openspec:check-reference (v1.9.0), changeset:check, git diff --check: PASS

The full `test:ci` run still stops at the known macOS Core `reactive-fs/path-realpath` `/var` versus
`/private/var` assertion after 70 Core tests passed; no new CLI or v9 failure was observed. Owner gates 4.1 and
4.2 remain unchanged and are still the only acceptance boundary.

## Loopback triggers

- The official 1.8 or 1.9 executable contradicts a command, payload, selector, or Agent-inventory assumption in a
  delta Spec.
- A fix requires a second production owner not named in the relevant recovery gate.
- A static capture cannot carry the complete typed command evidence without widening the public projection contract.
- A focused gate fails, a new global-root mutation is introduced, or source/distribution output diverges.
- Any R6 focused gate fails, an affected delta Spec does not state the repair law, or R6 source/build/pack evidence
  disagrees.
- The request broadens support beyond stable `>=1.8.0 <1.10.0` or asks for PR, merge, publish, release, archive, or
  Owner acceptance.

When a trigger occurs, stop implementation, amend `loop/research-plan.md`, the affected delta Spec, and
`loop/recovery-plan.md`, then wait for approval before continuing.
