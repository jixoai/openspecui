<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Track the actual implementation state against the approved ten-slice plan.
2. Record settled architecture decisions and exact divergence/loopback boundaries.
3. Name the current production owner, evidence state, and next executable slice.

Original request (2026-08-01): complete the Change artifacts after interview, then begin implementation.
-->

## Implementation State

```text
Change             target-openspec-cli-17-line
Schema             opsx-collab-pr-loop
Planning           approved and complete
Apply              started
Current slice      10 / Adaptive Config Guide — automated preparation complete; owner acceptance pending
Browser acceptance owner / manager
```

### Slice Ledger

| Slice                   | Production owner                            | State    | Focused evidence               |
| ----------------------- | ------------------------------------------- | -------- | ------------------------------ |
| 1. Version/admission    | Core compatibility + Web admission          | complete | red/green/mutation/review pass |
| 2. Workflow contracts   | Core CLI contracts/Kernel + Server          | complete | red/green/mutation/review pass |
| 3. Nested Spec identity | Spec catalog + route/export/search owners   | complete | red/green/mutation/review pass |
| 4. defaultStore         | Environment projection + Root Context       | complete | red/green/mutation/review pass |
| 5. Agent Delivery       | Core registry/projection + `/config/agents` | complete | red/green/mutation/review pass |
| 6. Config routes        | Web route tree + Config shell               | complete | red/green/mutation/review pass |
| 7. Active Root          | Planning Config service + `/config/root`    | complete | red/green/mutation/review pass |
| 8. Init Alert           | Launch Project init service + global Alert  | planned  | red evidence pending           |
| 9. Adaptive Guide       | typed guide orchestrator + Driver adapter   | planned  | red evidence pending           |
| 10. Delivery            | package/docs/Changeset/PR evidence          | planned  | gate evidence pending          |

### Slice 1 Evidence (2026-08-01)

- Red: Core focused test failed because 1.7 was still `compatible` and 1.6 was still `current`.
- Red: Web focused test failed because 1.6 did not open the gate and the title still advertised
  `>=1.6.0 <1.8.0`.
- Green: `packages/core/src/openspec-compat.test.ts` passes 4/4.
- Green: `cli-health-gate.test.tsx` plus `openspec-settings-section.test.tsx` pass 21/21.
- Stable-range edge: `1.7.0-rc.1` preserves its prerelease identity and remains blocked instead of being admitted
  as stable `1.7.x`.
- Checked type evidence: Core and Web package typecheck lanes pass.
- Mutation: removing `forceBypassed` from the production admission condition makes the named bypass test fail;
  restoring the guard returns it to green.
- Public copy: English and Chinese README compatibility tables now separate v7 from the historical v6 bridge.
- Structural non-persistence evidence: bypass ownership remains one `useState` inside root-layout-owned
  `CliHealthGate`; no persistence or Server/config handoff exists, and remount evidence reopens the gate.
- Objective failure evidence remains unchanged because bypass only alters the gate return condition; Root Context
  CLI facts, classifier status, Router data, and execution paths are not mutated.
- Independent focused review: the prerelease-classification blocker and stale Settings test intent were corrected;
  re-review returned `no findings`.

### Slice 2 Evidence (2026-08-01)

- Initial red — `packages/core/src/cli-contracts/workflow.test.ts`: `CliWorkflowStatusSuccessSchema` rejected
  official `status: skipped` and exact artifact `requires` evidence.
- Initial red — `packages/core/src/opsx-types.test.ts`: `ApplyInstructionsSchema` stripped project `context` and
  `operationGuidance`; Artifact Instructions stripped dependency `skipped` evidence.
- Initial red — `packages/server/src/workflow-invocation-service.test.ts`: Archive composition invoked Status
  instead of selected-Root Archive Instructions.
- Real CLI fixture — `packages/core/src/official-cli-17-workflow-fixtures.test.ts` executes
  `references/openspec/bin/openspec.js` at version `1.7.0` and proves skipped state, exact dependency edges,
  absent spec output, Apply inputs, Archive inputs, and separation from artifact `rules`.
- Upstream build fact — the pinned tag's source emitted `requires`, while its pre-existing generated `dist` was
  stale. `pnpm build` inside `references/openspec` regenerated ignored output without dirtying the submodule.
- Core focused green — six files, 38/38 tests passed, including the real executable fixture.
- Server focused green — three files, 25/25 tests passed, including selected-Root projection retirement and
  Archive workflow composition.
- Web focused green — six primary files, 30/30 tests passed; the touched Change List suite passed 14/14.
- Checked type evidence — Core, Server, and Web package typecheck lanes all passed.
- Reactive lifecycle evidence — projection tests cover current Root A, stale-display-only Root A while Root B
  revalidates, Root B failure without mutation authority, Root C recovery, and rejection of late Root A Archive
  callbacks after generation retirement. The Archive Dialog keeps stale inputs readable while disabling Archive.
- Owner boundary — no final visual or end-to-end browser acceptance is claimed; the owner retains that walkthrough.

#### Mutation 1 — skipped dependency satisfaction

```text
Mutation: remove `artifact.status === 'skipped'` from getChangeApplyAvailability.
Command:  pnpm --filter @openspecui/web exec vitest run --project unit src/lib/change-operator-availability.test.ts
Red:      "accepts a skipped required artifact without a physical relative path" failed;
          received available=false and missingArtifactIds=["specs"].
Restore:  restore the skipped branch and rerun the same command.
Green:    2/2.
```

#### Mutation 2 — Apply runtime inputs

```text
Mutation: remove `context` and `operationGuidance` from ApplyInstructionsSchema.
Command:  pnpm --filter @openspecui/core exec vitest run src/opsx-types.test.ts
Red:      "preserves project context and Apply operation guidance" failed with parsed.context=undefined.
Restore:  restore both optional typed fields and rerun the same command.
Green:    6/6.
```

#### Mutation 3 — Archive command ownership

```text
Mutation: route the Archive branch through workflowStatus instead of archiveInstructions.
Command:  pnpm --filter @openspecui/server exec vitest run src/workflow-invocation-service.test.ts
Red:      "uses selected-Root Archive Instructions instead of Status evidence" failed because the prompt lost
          Archive project context and operation guidance.
Restore:  explicitly restore workflowStatus for update/verify/sync and archiveInstructions for archive;
          rerun the same command.
Green:    13/13.
```

### Slice 2 Focused Review Corrections (2026-08-01)

Round 1 found two blockers; checkpoint 3.14 remained open.

1. **Archive generation atomicity** — Archive Instructions authority and Root Context authority could each be
   `current` while referring to different generations during a silent regional subscription rebind. The queue did
   not carry the generation that produced the displayed guidance, and the Server stream did not reject a changed
   Root before validation/archive admission.
2. **Typed public-test evidence** — the new Core workflow/schema fixtures and Server workflow-composition test ran
   through Vitest but were not included in an explicit TypeScript test lane.

Correction evidence:

- Red — `PlanningCliProjectionService > retains Archive inputs through refresh failure and publishes only recovered
current authority` failed because Archive projection data did not expose `rootGeneration`.
- Red — `GlobalArchiveModal > does not queue Archive when current Root Context and inputs have different
generations` failed because independently current Root B and Archive A could still queue mutation work.
- Red — `appRouter > cli > rejects stale Archive Instructions generation before strict validation starts` reached
  strict-archive startup instead of returning `CONFLICT` before Validate.
- Green — `opsx-archive-instructions` projection data now carries the exact Manager-owned Root generation used by
  its Work identity. The Web requires equality with current Root Context before queuing or enabling Archive.
- Green — `archive-strict` transport requires `expectedRootGeneration`; the Server compares it with the leased
  `gitBindingToken` before strict validation and returns `CONFLICT` on mismatch.
- Green — Server generation-focused tests pass 29/29; Web Archive/runner tests pass 21/21.
- Typed evidence — `packages/core/tsconfig.workflow-contract-tests.json` compiles the Status/schema/real-CLI tests;
  `packages/server/tsconfig.workflow-contract-tests.json` compiles Workflow Invocation composition. Both lanes are
  part of their package `typecheck` scripts.
- Post-correction gate — Core 38/38, Server focused 37/37, Web 59/59; Core, Server, and Web typechecks pass;
  `pnpm format:check`, `git diff --check`, and strict OpenSpec Change validation pass.
- Residual static note — static Status reconstruction still requires an explicit later-slice decision for
  `skip_specs`; no mutation authority is exposed in static mode, so it is not treated as a Slice 2 blocker.

Round 2 confirmed the production generation fix but found the public Router `CONFLICT` assertion still lived only
in the transpile-only aggregate `router.test.ts`. The assertion was moved into
`packages/server/src/archive-router-subscription.test.ts`, which already owns the public Archive Router boundary.
That checked fixture mocks Validate and Archive with typed `CliStreamHandle` values, proves both remain uncalled on
generation conflict, and is explicitly included in `tsconfig.workflow-contract-tests.json`. The duplicate aggregate
test was removed. Archive Router plus Workflow Invocation tests pass 16/16; the focused Server lane and full Server
typecheck both pass.

Round 3 independently verified the real `createServer`/`appRouter` fixture, typed `CliStreamHandle` mocks,
pre-Validate `CONFLICT`, uncalled Validate/Archive transports, explicit `tsconfig.workflow-contract-tests.json`
inclusion, package-script admission, and `tsc --listFiles` evidence. Result: `no findings`; checkpoint 3.14 passed.

### Slice 3 Evidence (2026-08-01)

- Official 1.7 fixture — `packages/core/src/official-cli-17-nested-spec-fixtures.test.ts` executes the pinned
  `references/openspec/bin/openspec.js`, confirms version `1.7.0`, and proves both `list --specs --json` and
  `show platform/auth --type spec --json` preserve `platform/auth` plus requirement content.
- Initial red — Adapter write/read rejected `platform/auth` through the single-segment entity guard, and
  `listSpecs()` enumerated only `platform`; owned detail, Search, and export therefore lost the nested Spec.
- Initial red — `OwnedSpecIdentitySchema` and `ReferencedSpecIdentitySchema` accepted raw and encoded traversal;
  public `spec.save` rejected valid nested ids while allowing encoded traversal such as `%2e%2e%2fescaped`.
- Characterization green — the existing TanStack Router already treats encoded `%2F` as one route parameter for
  both owned and Store-qualified referenced routes. The existing compound key/route helpers, referenced CLI
  lookup, Static Provider lookup, and SSG title mapping required preservation rather than replacement.
- Green — a dedicated recursive Spec guard admits slash-separated canonical ids while keeping Change ids on the
  original single-segment guard. Raw/encoded traversal, empty segments, absolute paths, drive paths, backslashes,
  NUL, `.` and `..` remain rejected before filesystem access.
- Green — Adapter discovery recursively finds directories containing `spec.md`; read/write, DocumentService,
  public Router detail/mutation, owned Search, and owned export now preserve every identity segment.
- Green — live and static Search share `specDocumentDisplayPath`; referenced display paths no longer diverge and
  now use `referenced:<store>:specs/<specId>/spec.md` in both modes.
- Route/static green — real TanStack navigation, detail View Transition preparation, Static Provider lookup,
  search hrefs, SSG manifest/title, and SSR route rendering preserve owned and referenced recursive identity.
- Checked fixtures — dedicated Core, Server, CLI, and Web `tsconfig.nested-spec-tests.json` lanes compile the
  Adapter, schema, public Router, Search, export, route, static provider, and SSG evidence and are included in
  package `typecheck` scripts.
- Focused green — Core 55/55, Server 31/31, CLI 18/18, and Web 34/34; all four nested-Spec typecheck lanes pass.
- Mutation first segment — changing the shared key projection to `split('/')[0]` made the same physical Search
  fixture report `spec:owned:platform` instead of `spec:owned:platform%2Fauth`.
- Mutation last segment — changing it to the final segment made the same fixture report `spec:owned:auth`; the
  production projection was restored and the fixture returned green.
- Static/export gate — after deleting `packages/web/dist-ssg` and `packages/web/.vite`,
  `pnpm --filter @openspecui/web build:ssg` passed. The real `pnpm openspecui export` path generated a snapshot
  with `identity.specId` and `id` equal to `platform/auth`, plus
  `specs/owned/platform%2Fauth/index.html` containing the decoded identity.
- Static-host boundary — Vite preview served `/specs/owned/platform%2Fauth/` with HTTP 200; the generated document
  retained `platform/auth` and the `window.__INITIAL_DATA__` bootstrap. This is non-visual transport evidence, not
  owner browser acceptance.

### Slice 3 Focused Review Corrections (2026-08-01)

Round 1 found no traversal escape or Change-id regression, but identified two major resilience gaps and one
determinism gap; checkpoint 4.11 remained open.

1. **Encoded-input compute budget** — recursively decoding until stability admitted a bounded final rejection but
   had no input-length or decode-depth budget. A remote caller could force repeated synchronous decoding before
   traversal rejection.
2. **Recursive discovery integrity** — `reactiveReadDir` converted every directory read failure into an empty list,
   so `EACCES`, `EIO`, or `ENOTDIR` could silently remove a nested Spec subtree from Search and export.
3. **Cross-runtime ordering** — `localeCompare` made recursive Spec order depend on process ICU locale rather than
   the deterministic code-point order used by OpenSpec 1.7.

Correction evidence:

- The recursive Spec guard now rejects ids longer than 4096 characters and rejects inputs requiring more than
  eight decode passes. Deep encoding and over-length fixtures fail before unbounded synchronous work.
- `reactiveReadDir` now offers an explicit `throwOnError` integrity mode: `ENOENT` retains missing-root semantics,
  while every other filesystem error propagates. Adapter recursive discovery enables it at every depth; the public
  Adapter fixture proves `ENOTDIR` is not converted into an empty Catalog.
- Recursive Spec ids now use plain code-point comparison. The fixture locks `Zed`, `alpha`, and
  `Ångstrom/nested` into deterministic order independent of locale.
- Post-correction focused evidence: Core 58/58, Server 31/31, CLI 18/18, Web 34/34; Core full typecheck and all
  nested-Spec checked lanes pass. Focused lint, format, diff, strict Change validation, clean SSG, real export, and
  HTTP static-host evidence remain green.

Round 2 independently verified the length/decode budgets, non-`ENOENT` error propagation, recursive Adapter use,
the `ENOTDIR` regression test, and code-point comparator. Result: `no findings`; checkpoint 4.11 passed.

### Slice 4 Evidence (2026-08-01)

- Initial red — `packages/core/src/cli-contracts/command-result.test.ts`: the local root-source enum rejected the
  official OpenSpec 1.7 value `global_default` with a contract error.
- Real CLI fixture — `packages/core/src/official-cli-17-default-store-fixtures.test.ts` executes the pinned
  `references/openspec/bin/openspec.js` and proves:
  - registered configured fallback resolves Doctor and Context with `source: global_default` and the same Store id;
  - absent machine fallback produces `no_openspec_root` when no root/store exists;
  - stale configured fallback preserves the upstream Store diagnostic and explicit
    `openspec config unset defaultStore` fix.
- Typed authored-state evidence — Environment projection classifies `defaultStore` only as `absent`, `configured`,
  or `invalid`; Store registry availability does not rewrite that state.
- Project Binding separation — a project YAML `defaultStore` key remains an unrelated custom key. Project Binding
  reads/writes only `store:` and `references:` and preserves the machine-looking custom node byte-semantically.
- Structured mutation — exact freeform ids execute
  `openspec config set defaultStore <id> --string`; explicit clear executes
  `openspec config unset defaultStore`. Both paths preserve unowned fields through the official CLI mutation.
- Settlement law — the Router returns configured Environment evidence plus Environment-file and Root Context
  replacement states. It never returns a fabricated effective Root. External dependency-driven config-file
  settlement keeps a Server-lifetime file observation alive and refreshes both Environment CLI truth and Root
  Context after the file projection reaches `ready`.
- Web ownership — Config → Environment Global now gives direct space to Default Store and feature flags. Registered
  Stores are suggestions only; exact ids remain editable when registry projection fails. Loading, stale authority,
  errors, pending mutation, invalid authored values, and explicit clear are locked/presented independently.
- Agent ownership — Environment no longer exposes a structured Profile tab or structured `profile`/`delivery`/
  `workflows` cards. Raw JSON whole-document editing remains available and preserves those fields plus unknown keys.
- Root evidence — the UI reports effective fallback only when Root Context is current and Doctor/Context have
  converged on `source: global_default` with the exact configured Store id. Blocked/stale diagnostics remain direct.
- Static boundary — `/config/context` static rendering remains sourced only from redacted export metadata and now
  explicitly proves that machine `defaultStore` is absent from generated HTML.
- Focused green — Core 31/31, Server 108/108, and Web 63/63 tests pass across the selected owner files.
- Checked evidence — Core, Server, and Web full package typechecks pass, including dedicated
  `tsconfig.default-store-tests.json` lanes in all three packages.
- Mutation evidence:
  1. Removing `global_default` from `CliRootSourceSchema` fails the checked contract test, command-result parser,
     and real 1.7 fixture; restoration returns all three to green.
  2. Mirroring `raw.defaultStore` into Project Binding's `store` inspection fails the exact owner-isolation test;
     restoration returns it to green.
  3. Removing the Root Context blocked short-circuit and effective-source/id check makes the stale-fallback component
     fixture report `Effective fallback: null`; the strengthened counterexample fails and returns green after restore.
- Focused review findings and corrections:
  1. The config-file bridge was previously activated only by a Config file consumer. A red fixture proved that an
     external `config.json` edit left Environment CLI truth and Root Context stale when no file projection subscriber
     existed. The bridge now has an explicit Server-lifetime `start()` boundary, refreshes Environment plus Root only
     after dependency-driven file settlement, and retires both internal subscriptions during disposal.
  2. A successful set/clear whose current replacement disagreed with the requested value left `pendingValue` locked
     forever. The component now treats a current mismatched replacement as objective conflict evidence, restores the
     authored value, reports the mismatch directly, and unlocks retry.
- Post-review focused green — Core 31/31, Server 114/114, and Web 50/50 across the exact owner matrix; Core, Server,
  and Web full package typechecks, focused lint, changed-file format, repository `format:check`, `git diff --check`,
  and strict Change validation pass.
- Independent review round 2 found no remaining blocking Slice 5 issue; checkpoint 5.11 passed.

### Slice 5 Evidence (2026-08-02)

- Pinned registry evidence — one Core registry fixes all 35 OpenSpec 1.7 entries, including unavailable `agents`,
  exact labels, detection paths, command formats, invocation styles, aliases, setup notes, cleanup declarations,
  and migrations. Runtime command-content fixtures load the pinned CLI generator and fail closed when its JavaScript
  module is not importable.
- Delivery semantics — Codex is skills-invocable with no current command surface; only allowlisted legacy managed
  prompts become cleanup evidence. Windsurf resolves as a retired Devin alias without deleting user-owned content.
  Qwen Markdown commands, CodeArts Agent, Hermes, ZCode, current Kimi paths, and exact adapter content formats are
  represented by the same registry.
- Physical projection — checked fixtures independently prove initialized, partial, stale-version, cleanup-needed,
  migration-required, unavailable, installed/missing/unexpected/legacy workflows, and generated-version facts.
  Commands-only state is current only when physical content exactly matches the running official generator.
- Mutation authority — `agentIntegrations.get/refresh/subscribe/updatePolicy/initStream/updateStream/repairStream`
  is the sole public Agent owner. Generic `cli.init`, `cli.initStream`, `cli.update`, `cli.updateStream`, and the Web
  Planning-root Update transport were removed; Router evidence asserts all four bypasses remain absent.
- Config ownership — `/config/agents` owns structured policy, complete inventory, selection, Init/Update/repair,
  cancellation, and Terminal evidence. Settings renders only a source-distinct read-only summary plus Manage action;
  Environment retains raw JSON whole-document authoring but no structured Agent editor. Static Config neither
  registers nor advertises the live-only Agent route.
- Draft settlement — the policy editor separates authoritative baseline from local draft. Inventory-only replacement
  Push preserves dirty edits; external policy changes advance the baseline while retaining the draft and promoting a
  conflict; authoritative save results replace baseline and draft and clear dirty state.
- Typed mutation evidence — `packages/core/tsconfig.agent-delivery-tests.json` checks the five load-bearing Core
  fixtures and is part of package `typecheck`. Registry mutation fixtures explicitly fail through
  `requireRegistryEntry` rather than using non-null assertions over fabricated state. Server has its own Agent
  delivery checked lane; Web Agent component fixtures are included by package TypeScript configuration.
- Final focused green — Core 5 files / 40 tests, Server 3 files / 18 tests, and Web 8 files / 101 tests pass. Browser
  preparation passes direct Playwright 3/3 and Storybook 12/12; these are preparation evidence only, not owner visual
  acceptance.
- Final gates — Core, Server, and Web package typechecks; repository `format:check`; `lint:ci`; `git diff --check`;
  changed-file header audit; and strict Change validation pass. The final independent reviewer additionally ran Core
  585/585 and Web 1062/1062 while confirming the typed-fixture correction.
- Independent review — the final read-only review reports no blocking findings, no non-blocking suggestions, and
  explicitly authorizes checkpoint `6.16`. The review did not edit files or enter Slice 6 Config Workbench Routes.

### Slice 6 Red Evidence (2026-08-02)

- Live route owner — `src/lib/route-tree.test.ts` fails at the first missing `/config/project` registration while
  requiring focused Project, Root, Environment, Agents, Schema catalog/detail, and canonical Context routes.
- Mixed navigation owner — `src/routes/config.test.tsx` renders the current production Config and fails because no
  `data-testid="config-workbench"` or self-describing `Config sections` navigation exists; the retained DOM shows the
  legacy dynamic `Schema(<id>)` tab surface.
- Static publication owner — `src/ssg/entry-server.test.ts` fails because the manifest omits publication-safe
  `/config/root`, `/config/schemas`, and concrete Schema detail routes. The same fixture forbids Project,
  Environment, and Agent routes and retains `/config/context` as canonical.
- Exact red commands used direct Vitest file selection:
  `pnpm exec vitest run --project unit src/lib/route-tree.test.ts -t 'declares focused live routes'`,
  `pnpm exec vitest run --project unit src/routes/config.test.tsx -t 'renders a narrow-safe self-describing route workbench'`,
  and `pnpm exec vitest run --project unit src/ssg/entry-server.test.ts -t 'enumerates and titles the compound Owned route'`.
- No production code changed to manufacture the initial failures; mutation evidence is recorded separately below.
- Mutation — temporarily restoring a `data-dynamic-schema-tab` button named `Schema(mutant)` inside the shared
  Config owner navigation makes the named narrow-safe workbench test fail at the exact dynamic-tab exclusion
  assertion. Removing the mutant returns the same test to green; no mutant remains in production.

### Slice 6 Green Evidence (2026-08-02)

- Shared route frame — `ConfigWorkbenchPage` owns one self-describing local navigation grid, filters live-only
  owners from static publication, and defers page scrolling to the existing application `.main-content` owner without
  creating nested or horizontal page overflow.
- Owner routes — Project Binding, Active Root, Environment, Agent Delivery, Schema catalog/detail, and Resolved
  Context now use focused route modules; Schema identities no longer produce dynamic fixed-owner tabs.
- Overview — six owner readiness cards retain real geometry through initial load, retained refresh, and direct
  failure presentation. Context remains a direct title action; Guide remains an explicitly disabled placeholder and
  does not enter the later orchestration slice.
- Static boundary — static routing and generation publish only Config overview, read-only Active Root, Schema
  catalog/detail, and canonical Resolved Context. Project, Environment, Agents, and their mutation authority remain
  live-only.
- Focused unit evidence — nine Config/route/Context/SSG files pass 47/47 after formatting. The Web unit suite also
  passes 1060/1060 while exercising the existing static data boundary.
- Browser preparation — the real Chromium narrow-container fixture passes 1/1 at 320×520 against the production
  `.main-content` host, proving seven owner links, no horizontal overflow, and no nested page scroll owner. This is
  preparation evidence only, not owner visual acceptance.
- Package/static evidence — Web typecheck passes; a clean `build:ssg` succeeds. Repository `format:check`,
  `lint:ci`, `git diff --check`, 131-file TS/TSX header audit, and strict Change validation pass. The build retains
  existing CSS `scroll-button` and ineffective dynamic-import warnings without a new Slice 6 failure.
- Independent focused re-review returned no blocking or non-blocking findings and authorizes checkpoint 7.12.

### Slice 6 Focused Review Corrections (2026-08-02)

- Initial independent review blocked checkpoint 7.12 on three facts: `.main-content` and the workbench both owned
  vertical page scrolling; Schema detail returned only to Config overview rather than its catalog; and
  `config-agents.tsx` plus `context.tsx` declared six orthogonal intents.
- Scroll red/green — the revised Chromium fixture uses the real `.main-content` host and initially failed because the
  nested `data-config-page-scroll-owner` still existed. Removing the inner scroll container and using
  `overflow-x-clip` lets content expand into the single outer owner; the same fixture returns to green without page
  horizontal overflow.
- Schema-return red/green — a focused Schema-files test initially failed because `Back to Schemas` was absent.
  `ConfigOwnerHeader` now accepts a typed back target/label, Schema detail points to `/config/schemas`, and the same
  test returns to green.
- Intent correction — the Agent route now declares four actual intents and Context declares five by combining related
  projection/evidence responsibilities; neither exceeds the physical-file hard limit.
- Review suggestion — live route evidence now instantiates `createRouteTree`, asserts exact path-to-component owners,
  and mocks only unrelated Dashboard, Settings, Terminal, and terminal-controller runtime dependencies. Dead source
  text or comments can no longer satisfy the registration test.
- Correction evidence — nine focused unit files pass 47/47, Chromium passes 1/1, Web typecheck passes, Web unit passes
  1060/1060, and the clean SSG build succeeds with only the previously recorded warnings.
- Independent re-review — the same read-only reviewer confirmed every initial finding closed, reported `no findings`
  at both blocking and non-blocking severity, and explicitly authorized checkpoint 7.12. Final visual acceptance
  remains owner-owned.

### Slice 8 Red Evidence (2026-08-02)

- Fixed source — `test-fixtures/openspec-1.7-active-root-config.yaml` places official 1.7 `schema`, `context`,
  artifact `rules`, and `operations.apply/archive.guidance` beside comments, `store`, `references`, top-level team
  keys, an unknown operation, and an unknown field inside official `apply`.
- Projection — the current `readActiveRootConfig` fails to return an opaque revision, official-field projection, or
  diagnostics; the named test fails while the physical source remains objectively present.
- Structured ownership — the current whole-document `writeActiveRootConfig` removes the workflow comment, binding
  nodes, custom keys, unknown operation, and nested team field. The test fails at the first lost comment before any
  green node-patching implementation exists.
- Conflict admission — independent two-editor and external-physical-edit fixtures both fail because the current
  mutation returns no typed result and overwrites without comparing the loaded physical revision.
- Raw and atomic admission — valid custom YAML writes successfully, while syntax-invalid YAML incorrectly resolves
  and replaces the file. A separate inode assertion fails because the current service writes through the existing
  file rather than atomically renaming a same-directory replacement.
- Historical red command: `pnpm --filter @openspecui/server exec vitest run src/active-root-config-red.test.ts`;
  result `1` file failed, `6/6` tests failed for the six named production-boundary reasons above. The temporary red
  file was then promoted into permanent Core/Server/Router green suites and removed; the historical command is
  evidence of the fixed point, not a current reproducible lane.

### Slice 8 Green and Mutation Evidence (2026-08-02)

- Core contract — official projection, diagnostics, opaque revision, node-preserving Structured patching, Raw syntax
  admission, and the new `@openspecui/core/active-root-config` build entry are implemented.
- Physical write — same-directory exclusive temporary file, flush, atomic rename, physical byte comparison, and
  overlapping file/directory/existence/stat settlement complete before terminal success or conflict.
- Server admission — mutations serialize by physical config path, compare owner/file/revision immediately before
  write, and return typed `applied | conflict(latest) | invalid(latest)` results.
- Dependent replacement — successful writes synchronously retire every current-root config-dependent Planning CLI
  Work generation inside the admitted lease, then advance `project/context/schemas` invalidation and refresh the
  independent Root Context Work. `config.yml` is a direct OPSX dependency rather than relying on the Root bridge.
- Web owner — `/config/root` provides mode-local Structured and Raw drafts, exact locator mutation, retained stale
  display, Root/transport/replacement locks, latest-source review, explicit Reload/Retry, direct shared-Store impact,
  diagnostics, and static read-only projection. Change Detail Status and Schema Config Bundle authority can no longer
  re-authorize actions from retained stale CLI data.
- Mutation check: replacing node patching with serialize-from-update made
  `active-root-config.test.ts -t "patches owned nodes..."` fail at the lost schema comment and unowned nodes.
- Mutation check: bypassing revision comparison made
  `active-root-config-service.test.ts -t "rejects a second editor..."` return `applied` instead of `conflict`.
- Mutation check: replacing rename with in-place write made
  `physical-reactive-file-writer.test.ts -t "atomically replaces..."` fail because the inode did not change.
- Mutation check: removing reactive settlement made
  `physical-reactive-file-writer.test.ts -t "rejects externally replaced bytes..."` retain revision-A cache data.
- Mutation check: removing config-dependent Work retirement made
  `router.test.ts -t "keeps launch Project Binding..."` fail because the retirement owner was called zero times.
- Green focused evidence after restoration: Core `22/22`, Server `118/118`, Web `36/36`, narrow Chromium `1/1`;
  Core, Server, and Web package typechecks pass. Core build emits both `active-root-config.mjs` and
  `active-root-config.d.mts`; focused Prettier/Oxlint, strict Change validation, and `git diff --check` pass.
- Final gate rerun after formatting: Core `22/22`, expanded Server `138/138`, expanded Web `38/38`, narrow Chromium
  `1/1`; repository `format:check`, `lint:ci`, affected package typechecks, strict Change validation, Core build, and
  `git diff --check` pass.
- Independent focused review reported no blocking findings, verified the Core/Server/Web mutation and stale-authority
  boundaries, and explicitly authorized checkpoint `8.14`. Final visual acceptance remains owner-owned.

### Slice 9 Initialize Project Evidence (2026-08-02)

- Launch Project fact — `OpenSpecAdapter.readLaunchProjectInitialization()` observes the launch-directory listing and
  exact local `openspec/` path. A focused fixture keeps an external Store-like OpenSpec root usable while the Launch
  Project remains objectively uninitialized, then proves local directory creation produces a reactive replacement.
- Fixed command — `CliExecutor.initProjectStream()` owns exactly
  `openspec init <launch-project> --tools=none`; the public Init Router supplies only `ctx.projectDir` and exposes no
  caller-authored path, Store, Root, tools, profile, or force inputs.
- Explicit confirmation — the root-layout provider opens the Alert from the missing projection but starts no stream
  until `Initialize` is clicked. Config reopens the same owner; no second Settings executor remains.
- Lifecycle — one Dialog preserves JSON argv evidence, stdout, stderr, exit, running lock, cancellation,
  failure/retry, and settled success. A bounded Server request ledger makes early HTTP cancellation and repeated late
  WebSocket subscription replay idempotent; no same-request replay can start a second CLI process. Cancelling retains
  request authority across HTTP or WebSocket transport errors and exposes only same-request `Retry Cancel` until the
  Server returns an objective settlement.
- Replacement barrier — CLI `exit 0` remains internal until local `openspec/`, Root Context, Project Binding, Active
  Root, OPSX Config/Schema bundle, and Agent replacement Pulls settle. Only then may the Web expose `[Ok] [Start Guide]`.
- Runtime-only dismissal — close state exists only in the mounted provider. A same-mount close suppresses automatic
  reopening, Config can reopen explicitly, and a reconstructed provider automatically offers Init again.
- Mutation resistance — removing `--tools=none` fails the Core command-plan test; auto-running after detection fails
  the explicit-confirmation test; exposing success before local/replacement settlement fails; persisting dismissal
  fails provider reconstruction; consuming a pre-start cancellation only once fails the repeated late-WS test;
  unlocking after cancellation transport/subscription error fails the Web authority tests; shell-like command
  formatting fails the `$HOME`, `&`, `;`, and glob argv fixture. Every mutation was restored and rerun green.
- Typed evidence — `project-initialization-router.typecheck.ts` proves the public Init stream/cancel inputs expose only
  `requestId` and retain exact Core event/settlement outputs; the focused lane is part of Server package typecheck.
- Final focused evidence: Core `44/44`; Server Init `6/6`; Web unit `7/7`; narrow Chromium `1/1`; Core, Server, and Web
  package typechecks, focused Router typecheck, repository format/lint, strict Change validation, and diff checks pass.
- Independent focused review reported no blocking findings and explicitly authorized checkpoint `9.14`. Final visual
  acceptance remains owner-owned.

### Slice 10 Adaptive Config Guide Red Evidence (2026-08-02)

- Reducer fixtures classify `ready`, `required`, `warning`, `stale`, `blocked`, `failed`, `active-edit`,
  `target-failed`, cancellation, review, and complete lifecycle. `next` and presentation completion events cannot
  advance an unresolved stage.
- Owner-signal selectors independently prove Project edits/diagnostics, missing or refreshing Active Root,
  Agent edits/repair work, and non-current or unusable Resolved Context remain non-ready.
- Provider fixtures begin without mounted targets, navigate through the typed route owner, wait for semantic anchor
  registration, and fail into a retryable target state after the bounded settlement window.
- Projection replacement, not a presentation callback, establishes readiness for each paused stage. Explicit Continue
  advances only when that current stage is ready; completion requires Continue from ready Resolved Context.
- Driver adapter fixtures prove unresolved stages hide Next, keyboard presentation remains enabled, reduced motion
  disables animation/smooth scrolling, and terminal failure exposes only typed Retry/Cancel callbacks.
- Mutation check: changing `presentation-done` to force `complete` makes the named non-authoritative presentation
  fixture fail with `active → complete`; restoring the reducer returns it green.
- Mutation check: accepting every status except `blocked` as progressable makes the named warning fixture advance from
  Project Binding to Active Root; restoring the exact `status === ready` guard returns it green.

### Slice 10 Adaptive Config Guide Green Evidence (2026-08-02)

- One root-layout `ConfigGuideProvider` persists beneath `ProjectInitializationProvider`; the Init success event and
  live Config overview `Guide`/`Restart Guide` action enter the same runtime. Static mode disables the provider and
  publishes no Guide action.
- Project Binding, Active Root, Agent Delivery, and Resolved Context register stable route-owned semantic anchors and
  consume their existing owner projections. No Guide-specific tRPC query, subscription, or mutation owner exists.
- The typed reducer permits progression only from current `ready` stages. Dirty drafts, pending commands/writes,
  convergence barriers, warnings, stale retained authority, blockers, and failures remain visible until replacement
  projections settle; ready stages still require explicit Continue.
- The orchestrator uses the existing typed/View-Transition navigation owner, waits up to five seconds for the target,
  focuses it, lazy-loads Driver.js/CSS, and restores the original trigger on Escape/cancel. Restart re-evaluates fresh
  projection facts from Project Binding.
- Driver.js owns mask/focus/popover presentation only. OpenSpecUI owns route settlement, Escape cancellation,
  readiness, mutation handoff, target failure, and completion. Complete presentation exposes no Back transition.
- Focused unit evidence currently passes 78/78 across the reducer, owner selectors, orchestrator, Driver adapter,
  Config action, and four production owner regression suites. Web typecheck passes.
- Basic Chromium component preparation passes 2/2 for desktop and narrow containers using the real Provider-to-adapter
  contract, semantic target focus, and no component horizontal overflow. Driver configuration itself is covered by
  the focused adapter unit tests because Driver's live positioning loop is not a reliable Vitest iframe fixture.
- Full Web evidence passes 177/177 files and 1096/1096 unit tests. The package browser CI passes five Chromium files
  with 8/8 tests plus four Storybook browser files with 12/12 tests. Its first integrated run exposed an incomplete
  Active Root `@/lib/trpc` browser mock that omitted `queryClient`; preserving the original typed module exports while
  overriding only `trpcClient.planningConfig.writeActiveRoot` repaired the fixture, and both its focused rerun and the
  complete browser channel returned green.
- `loop/guide-owner-walkthrough.md` contains seven numbered production-boundary cases with exact setup, trigger,
  PASS/FAIL, restore, and pending result ledger. Final visual acceptance remains owner-owned.

### Slice 10 Guide Presentation Generation Correction (2026-08-02)

- Owner repro: clicking Guide caused accelerating flicker, progressively darker masking, a black page, and multiple
  surviving Guide tooltips.
- Exact cause: the Provider dispatched an equivalent observation from inside the presentation effect. The reducer
  always returned a new state, so the effect destroyed/recreated Driver continuously. Concurrent lazy imports could
  resolve after their effect cleanup and install orphaned Driver instances because cancellation was checked before,
  but not after, asynchronous presentation creation.
- Red evidence: the unchanged-stage Provider fixture timed out under continuous re-entry; a separately cancelled
  deferred presentation resolved without invoking its cleanup.
- Green correction: equivalent observations now return the same reducer state; anchors depend on the stable register
  capability rather than changing Context snapshots; presentation effects depend only on relevant lifecycle scalars;
  every async presentation checks its cancelled generation after creation and destroys itself immediately when stale.
- Focused unit evidence passes 4 files and 23 tests. Real Driver.js Chromium evidence passes desktop and narrow
  fixtures 2/2, proving one overlay plus one popover remain stable and both disappear after cancellation.
- Stable-head full evidence on `87d50447c11d5ff2770c9f9064c1db688a2570fd` passes Web Unit `177/177` files and
  `1096/1096` tests, Chromium `5/5` files and `9/9` tests, and Storybook browser `4/4` files and `12/12` tests; the
  validation start and end HEAD are identical.
- Final visual acceptance remains owner-owned; this evidence proves the production lifecycle seam, not visual taste.

### Slice 10 Guide Terminal Presentation Correction (2026-08-02)

- Owner repro: the completion popover used Driver.js default styling, floated from the viewport center, and provided no
  usable next/dismiss action, leaving the page masked and preventing the owner from continuing.
- Exact cause: Driver.js `highlight()` injects step-local `showButtons: []`, so global `showButtons` and callbacks do not
  render. The completion command also omitted the mounted Resolved Context semantic element and fell back to a virtual
  viewport target.
- Red evidence: the adapter fixture proves global controls disappear under `highlight()`, while the completion browser
  fixture requires a connected Resolved Context target and an actionable Done control.
- Green correction: Back, Continue, Retry, Done, Close, labels, and callbacks now live on the exact step popover;
  overlay clicks remain inert; completion reuses the connected Resolved Context anchor; every popover uses the
  OpenSpecUI theme class.
- Real Chromium completion evidence proves Resolved Context remains the active highlighted element, Done is visible,
  and clicking Done removes both the Driver overlay and popover. Final visual acceptance remains owner-owned.

### Slice 10 React-owned Headless Presentation Replacement (2026-08-02)

- New red evidence: Driver's popover and mask remained visible while React replaced the target's complete `className`,
  removing `driver-active-element`. Driver's global pointer-event CSS could therefore make the real highlighted owner
  surface non-interactive even though geometry still appeared correct.
- Ecosystem audit compared Zag Tour, Reactour, NextStep, Floating UI, and the already-installed Base UI. Dedicated Tour
  libraries bring a second step/progression state machine; OpenSpecUI already owns that authority. Base UI provides the
  required headless anchor positioning and focus primitives without duplicating Guide workflow truth.
- Driver.js and its global CSS are removed. One lazy React presentation value now renders inside the persistent Guide
  Provider tree. Base UI positions the Popover; OpenSpecUI renders the Spotlight, standard Button controls, and
  token-native typography, borders, radii, color, focus, and shadows.
- The presentation never adds target classes, `inert`, body state, or global third-party styles. The real semantic target
  remains interactive; resize, capture-phase scroll, and `visualViewport` changes refresh Spotlight geometry.
- The first React-owned implementation exposed a second feedback loop: `useVTHrefNavigate()` returned a new callback
  after presentation state renders, retriggering the effect. Navigation now crosses that effect through a stable ref,
  so presentation updates cannot cause cleanup/recreation.
- Real Chromium passes the desktop, narrow, anchored-completion, and centered target-failure surfaces. The fixtures
  prove one Spotlight/Popover, semantic anchoring, no target `inert`, responsive containment, visible Done/Close,
  focused Retry, and complete cleanup. The desktop, narrow, and completion subset also passed three consecutive runs.
- Final stable-head evidence on `87d50447c11d5ff2770c9f9064c1db688a2570fd`: Web typecheck passes; Web Unit passes
  `177/177` files and `1096/1096` tests; Chromium passes `5/5` files and `9/9` tests; Storybook browser passes `4/4`
  files and `12/12` tests; repository lint passes with zero warnings/errors across `1241` files; strict Change
  validation and `git diff --check` pass; validation begins and ends at the same HEAD.
- Repository `format:check` remains blocked only by unrelated owner-owned untracked files
  `app-icon/gen-icns.deno.ts` and `openspecui-icon-composer.icon/icon.json`; this Apply did not format or modify them.
  Final visual acceptance remains owner-owned.

### Slice 10 Explicit Progression and SVG Spotlight Correction (2026-08-03)

- Owner repro: opening a fully ready Guide flickered through several route targets and reached Configuration complete
  without any user interaction.
- Exact cause: the reducer's `observe(ready)` branch immediately searched for the next non-ready stage, while the
  Provider deliberately suppressed presentation for a ready stage. Four ready observations therefore formed an
  automatic Project Binding → Active Root → Agent Delivery → Resolved Context → complete chain.
- Precise red command:
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/config-guide.test.ts src/components/config/config-guide.test.tsx`.
  The reducer received `complete` instead of active Project Binding, and the Provider rendered Configuration complete
  instead of Project Binding. The same command passes `18/18` after correction.
- Green progression: observations only replace typed signal evidence. Every stage remains visible; ready enables
  Continue, explicit Continue performs the next transition, and non-ready states keep Continue unavailable.
- Spotlight correction: four rectangular blockers are removed. One viewport SVG owns an even-odd mask path whose
  painted exterior uses `visiblePainted` pointer hit testing, while its bevel hole leaves the real target interactive.
  Computed per-corner border radii define each straight cut; browsers without `corner-shape: bevel` use zero-radius
  square corners.
- Focused evidence passes four unit files and `24/24` tests. Real Chromium passes `4/4`: desktop and narrow target
  geometry, explicit Continue through four ready stages before anchored completion, and centered target-failure Retry.
  Chromium `elementFromPoint` evidence hits the semantic target inside the hole and the SVG path outside it.
- Full Web evidence passes `178/178` unit files and `1102/1102` tests. The package browser channel passes Chromium
  `5/5` files and `9/9` tests plus Storybook `4/4` files and `12/12` tests; Web typecheck passes. These final checks,
  repository lint (`0` warnings/errors across `1243` files), strict Change validation, and `git diff --check` ran against
  `353e3d5f94e961bd72abf21e2b729686980e37ed`.
- Repository `format:check` still reports only the unrelated owner-owned untracked files
  `app-icon/gen-icns.deno.ts` and `openspecui-icon-composer.icon/icon.json`; this correction does not modify them.
- Final visual acceptance remains owner-owned; Case 7 in `loop/guide-owner-walkthrough.md` records the exact manual
  progression, interaction, bevel, and unsupported-browser observations.

### Slice 10 Theme, Config NavBar, and Detail Transition Follow-up (2026-08-03)

- Owner finding: the same black veil remained perceptible on light pages but disappeared against the black dark-theme
  surface. The mask now consumes one theme token: a dark veil in light mode and a low-opacity light neutral veil in
  dark mode. Real Chromium proves the computed SVG fill changes with the root theme.
- Owner direction: fixed Config destinations now form one top NavBar rather than a card grid or tab strip. The NavBar
  is the first workbench child, keeps seven equal-width route actions without horizontal scrolling, exposes accessible
  names and Tooltips, hides labels in narrow containers, and reveals labels only when the Config container is wide.
- Root cause for missing owner-to-owner animation: only exact `/config` belonged to the Config route family. Secondary
  routes fell back to `unknown/detail`; route-detail disabled the root snapshot, while Config exposed no
  `.vt-detail-content`, producing no visible transition. Every `/config/**` route now belongs to `config/detail`, and
  only the owner header/content wrapper participates while the NavBar remains stable.
- Red evidence: route semantics returned `unknown/detail`; the narrow fixture found the old header-first card grid and
  no detail wrapper; the dark fixture retained the light-mode mask fill.
- Green evidence: focused route semantics passes `13/13`; real Chromium Config workbench plus Guide passes `2/2`
  files and `7/7` tests, including narrow/wide container geometry, mask hit testing, explicit progression, and theme
  fill. Browser failure screenshots were transient Vitest attachments with no tracked snapshot contract and are
  removed rather than published as product evidence.
- Owner visual correction: the NavBar no longer renders seven outlined cards. One top/bottom rule and thin column
  separators create a table-like row; route actions have square geometry and no shadow. Selection changes only
  foreground/background color. First-level owner headers no longer repeat `<- Config`; only nested pages that explicitly
  declare a direct catalog return, such as Schema detail → Schemas, keep a back action.
- Follow-up evidence passes focused owner-route and Schema-return Unit `2/2` files and `9/9` tests plus real Chromium
  workbench `1/1` file and `2/2` tests.
- Owner border correction: the NavBar top rule is removed. Its single bottom rule uses the full `border` token, while
  internal column separators use a 20% derived border color; Chromium proves the top is `0px`, bottom is `1px`, and
  internal separator color differs from the bottom rule.
- Active Root layout correction: `useViewportConstrainedHeight`, its measured wrapper, the inner Card shell, and the
  Structured editor's internal vertical scrolling are removed. The semantic Guide anchor is now the single natural-flow
  page section; Structured fields expand with document content, and Raw YAML uses only a CSS `clamp()` minimum height.
- Red Chromium evidence observed the old `320px` inline height and missing natural surface. Green Chromium passes
  NavBar plus Active Root `2/2` files and `3/3` tests, proving no height-hook call, no inline height, no card shell,
  visible Structured overflow, subtle dividers, and horizontal containment.

## Decisions Taken

1. OpenSpecUI 7 supports only OpenSpec CLI `>=1.7.0 <1.8.0`.
2. Every other version opens the mismatch Dialog and is blocked by default.
3. `Skip version check` is an explicit user-risk admission bypass held only by the current in-memory page runtime.
4. The complete observable 1.7 workflow, Spec, Root, Schema, and Agent protocol ships in the 7.0 adaptation.
5. Config is a route-backed workbench with one stable top NavBar; dynamic Schema entities no longer share the
   fixed-owner navigation plane, and owner header/content forms the detail-transition surface.
6. `/config/agents` solely owns structured `profile`, `delivery`, and `workflows` mutation.
7. Active Root provides structured official fields and a revision-aware raw YAML whole-document escape hatch.
8. Unknown/custom YAML keys are preserved and not rejected merely for being outside the official model.
9. Missing local setup uses an independent explicit-confirmation Alert running
   `openspec init <launch-project> --tools=none`.
10. The same Alert preserves successful command evidence and then offers `[Ok] [Start Guide]`; it does not open a
    second Dialog, and Agent installation remains a later Guide decision.
11. One adaptive Guide owns Project Binding → Active Root → Agent Delivery → Resolved Context verification.
12. Base UI may position/focus the Popover only; OpenSpecUI owns the theme-aware SVG Spotlight, controls, readiness,
    routing, mutations, completion, and all visual styling.

## Divergence Notes

No divergence from the approved plan is currently authorized.

The following are deliberate clarifications rather than divergence:

- The startup Alert reports Launch Project local initialization independently from effective Root readiness.
- The Init Alert does not select tools or profile; `--tools=none` keeps scaffolding separate from Agent Delivery.
- Raw YAML may modify `store` and `references` because it explicitly owns the complete document; structured mode
  continues to preserve fields owned by other direct-plane editors.

## Loopback Triggers

Pause implementation and return to intake/research-plan if any of the following occurs:

1. Official OpenSpec 1.7 CLI output contradicts the pinned source/report contract.
2. A required behavior can only be implemented by parsing OpenSpec files in parallel with an available CLI command.
3. Route-backed Config requires changing App Workspaces/Stores/OpenTray ownership.
4. `openspec init --tools=none` does not provide a deterministic non-interactive project scaffolding path.
5. Unknown YAML preservation cannot coexist with safe structured mutation without destructive normalization.
6. Agent migration requires deleting artifacts not objectively identified as OpenSpec-managed.
7. Static publication would expose environment-global paths, Agent inventory, mutation authority, or private evidence.
8. A focused red test cannot fail at the named production owner for the intended reason.
9. A slice needs a protocol compatibility concession for OpenSpec CLI 1.6.x beyond the explicit admission bypass.
10. Final browser acceptance is requested from the agent rather than the owner.
