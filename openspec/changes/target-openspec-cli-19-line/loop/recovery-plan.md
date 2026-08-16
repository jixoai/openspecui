<!--
Orthogonal intents (updated 2026-08-16 Asia/Shanghai):
1. Convert the v9 implementation review findings into ordered, independently verifiable recovery gates.
2. Assign one production owner, one true red case, one green case, and one stop condition to every gate.
3. Preserve the Owner-only browser, PR, merge, release, and archive boundary.

Original request (2026-08-15): "这里面很大的问题也是因为你作为架构师，openspec change 文件撰写不够清晰，导致Agent 没有如期完成所有开发，请你改进 change 文件，改进开发计划。"
-->

# OpenSpecUI 9 implementation recovery plan

## Status and operating law

The recovery gates below are historical context. R8.1-R8.5 are closed with final focused, source, distribution, and
independent-review evidence recorded in `loop/implementation.md`. The main-worktree Server timeout is classified as
process-load-sensitive after the same final source passed the complete triple in an isolated worktree. Only Owner
gate 4.1 remains before the separate PR/release/archive decision at 4.2.

```text
R8.1-R8.5 closed -> Owner gate 4.1 browser/App walkthrough -> Owner gate 4.2 PR/release/archive decision
```

Historical red evidence: the exact Server triple in the main worktree reported 119 passed and a 5-second timeout at
`packages/server/src/router.test.ts:2336` while competing browser/build processes were active. The final patched
source passed the same triple `120/120` in an isolated worktree with no timeout override; no production lifecycle or
test timeout change was made. Do not treat the main-worktree observation as a v9 behavior baseline.

```text
feature branch -> reproduce named red case -> change one owner -> named green case
      ^                                                        |
      +------------- focused review passes --------------------+
                                                               |
                                         all R0-R4 pass -> R5 distribution gate
```

Before production edits, create a feature branch from the reviewed local `main`; do not develop or create a PR from
`main`, which is currently ahead of `origin/main`.

```sh
git status --short
git switch -c fix/v9-cli-18-19-recovery
```

The current worktree contains this planning correction. Preserve it when branching, then commit the Change artifacts
as a documentation-only commit before the first production edit. Every gate records its exact command and result in
`loop/implementation.md`, then checks only its matching item in `loop/checkpoints.md`. A failed focused gate stops
work immediately: do not run R5, do not update a later checkbox, and return to this plan plus the affected delta
Spec before widening scope.

## Recovery gates

### R0 - Repair code and test ownership metadata

```text
Production owners: packages/core/src/cli-contracts/workflow.ts
                   new focused schema-resolution contract module
Test owner:        packages/web/src/lib/static-data-provider.opsx.test.ts
```

- **Red case:** `workflow.ts` declares six orthogonal intents, and the changed static-provider test has no
  timestamped `Orthogonal intents` plus `Original request` header.
- **Required change:** physically move the Schema-resolution sum type to a focused CLI-contract module. Retain at
  most five real intents in `workflow.ts`; do not conceal a sixth intent by editing only the comment. Add the
  required header to the test using the current v9 original request.
- **Green case:** each file's header truthfully names at most five intents, imports remain type-safe, and the static
  provider test retains its existing behavioral coverage.
- **Focused verification:**
  `pnpm --filter @openspecui/core exec vitest run src/cli-contracts/workflow.test.ts`
  and
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts`.
- **Stop condition:** any type cycle, a sixth independent responsibility in `workflow.ts`, or a missing required
  test header returns this gate to design; do not begin R1.

### R1 - Make 1.9 Schema resolution reachable through the selected Root

```text
Production owner: packages/core/src/cli-contracts/executor.ts
                  packages/core/src/cli-executor.ts
                  packages/core/src/opsx-kernel.ts
Evidence owner:   packages/core/src/official-cli-19-validation-fixtures.test.ts
```

- **Red case:** an actual OpenSpec 1.9 executable receives `schemas --json --store ghost` through an
  `OpsxKernel` constructed with `{ store: 'ghost' }`; the current product path omits the selector, so it cannot
  produce the selected-Root envelope. In the same fixture family, a 1.8 session must prove that it never receives
  `--store` for schemas.
- **Required change:** pass the Kernel's `CliRootSelector` into the typed and raw schemas execution owners only where
  the admitted CLI declares that selector. Preserve the 1.9 `{ schemas: [], root: null, status }` result as a typed
  CLI projection failure with its actual command evidence. Do not use a mock envelope as proof of the product path.
- **Green case:** the 1.9 ghost-store fixture reaches the typed failure path with `root: null` and diagnostics; a
  valid selected 1.9 Root returns schemas; a 1.8 fixture runs without `--store` and does not report a fabricated
  selected-Root failure.
- **Focused verification:**
  `pnpm --filter @openspecui/core exec vitest run src/cli-executor-contracts.test.ts src/opsx-kernel-cli-projection.test.ts src/official-cli-19-validation-fixtures.test.ts`.
- **Stop condition:** if the official 1.8/1.9 executables expose a different selector contract, stop and amend the
  research plan and CLI delta Spec before adapting code.

### R2 - Gate archived validation by the running CLI capability

```text
Production owner: packages/core/src/openspec-compat.ts
                  packages/server/src/router.ts
                  packages/web/src/routes/change-view.tsx
Evidence owners:  packages/server/src/router.test.ts
                  packages/web/src/routes/change-view.test.tsx
                  packages/web/src/components/archived-validation-evidence.test.tsx
```

- **Red case:** a supported 1.8 session can render and invoke `validate --archived`, and the official executable
  returns `unknown option`; the same call remains valid for 1.9.
- **Required change:** derive `archived validation` availability from the detected admitted CLI version at the shared
  compatibility boundary. The Server must reject the unsupported request as a typed unavailable capability before it
  starts a CLI process; the Web must not offer an executable action for 1.8 and must show its unavailable reason in
  the Evidence owner.
- **Green case:** the 1.8 route test proves the runner was not called and receives typed unavailability; the 1.9
  route/component path invokes the command and preserves report or failure evidence without automatic repair.
- **Focused verification:**
  `pnpm --filter @openspecui/server exec vitest run src/router.test.ts -t "archived validation"`
  and
  `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/change-view.test.tsx src/components/archived-validation-evidence.test.tsx`.
- **Stop condition:** an availability rule duplicated outside the compatibility owner, an 1.8 CLI spawn, or a
  client-only bypass fails this gate; return to the command-mapping delta Spec.

### R3 - Preserve static Schema failure as typed captured evidence

```text
Production owner: packages/core/src/export-types.ts
                  packages/cli/src/export.ts
                  packages/web/src/lib/static-data-provider.ts
Evidence owner:   packages/web/src/lib/static-data-provider.opsx.test.ts
```

- **Red case:** an export records `{ ok: false, error }` for a Schema failure and `getOpsxSchemas()` returns `[]`,
  falsely authorizing the list-only path as a successful empty catalog.
- **Required change:** make the export payload retain CLI source, selector, `root` (including `null`), diagnostics,
  stdout, stderr, exit code, payload, and contract error when present. The static list and detail accessors must
  propagate the captured typed failure through one shared boundary; they must not turn it into `[]` or synthesized
  schema details.
- **Green case:** a static snapshot made from a selected-Root failure retains every available CLI field, list-only
  reads surface that captured failure, and Config's existing failure state does not grant mutation authority.
- **Focused verification:**
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts`
  plus the focused CLI export test added beside the exporter.
- **Stop condition:** a lossy string-only error, a separate ad hoc list fallback, or invented live provenance returns
  this gate to the projection-contract delta Spec.

### R4 - Select Agent registry and command evidence by CLI line

```text
Production owner: packages/core/src/agent-delivery-registry.ts
                  packages/core/src/agent-command-content.ts
                  packages/core/src/tool-init-state.ts
                  packages/server/src/agent-delivery-projection-service.ts
Evidence owners:  packages/core/src/agent-delivery-registry.test.ts
                  packages/core/src/agent-command-content.test.ts
                  packages/core/src/tool-init-state.test.ts
                  packages/server/src/agent-delivery-projection-service.test.ts
```

- **Red case:** the official 1.8 command-generator has no Command Code adapter; the current fixed 1.9 registry
  requests it, `loadAgentCommandContent()` returns `null`, and unrelated installed command artifacts become stale.
- **Required change:** choose registry entries and adapter expectations from the running 1.8 or 1.9 CLI. Command Code
  is unavailable on 1.8 and available on 1.9. A missing adapter may remove evidence for that one unavailable tool
  only; it must not erase an otherwise valid catalog. Thread the selected inventory into physical state and Server
  projection, preserving current/legacy/global-root scope.
- **Green case:** executable-backed 1.8 evidence omits Command Code while retaining other available command content
  and correct physical status; executable-backed 1.9 evidence includes Command Code; neither line marks unrelated
  command artifacts stale solely because another adapter is absent.
- **Focused verification:**
  `pnpm --filter @openspecui/core exec vitest run src/agent-delivery-registry.test.ts src/agent-command-content.test.ts src/tool-init-state.test.ts`
  and
  `pnpm --filter @openspecui/server exec vitest run src/agent-delivery-projection-service.test.ts src/tool-subscription-router.test.ts`.
- **Stop condition:** a guessed inventory, a hard-coded 1.9-only adapter list, or any global-root mutation causes a
  loopback to the Config delta Spec and upstream source research.

### R5 - Reopen distribution and delivery review

```text
Prerequisite: R0-R4 focused reviews pass and their evidence is recorded.
Owner:         package/distribution evidence, not a production feature owner.
```

- **Red case:** source-level tests are green while built or packed output retains the v7 gate, an incomplete static
  failure payload, or a fixed 1.9 Agent registry.
- **Required change:** rebuild all affected outputs from the recovery branch, pack and isolated-install the real CLI
  tarball, and verify the installed v9 admission and affected artifacts. Re-review the existing major changeset and
  release documentation only after packaged evidence agrees with source.
- **Green case:** source, built, and isolated installed distributions agree on the 1.8/1.9 law; all focused gates
  remain green; no new failures beyond the recorded macOS symlink canonicalization baseline appear.
- **Required verification:**
  `pnpm run format:check`
  `pnpm run lint`
  `pnpm run typecheck`
  `pnpm run openspec:check-reference`
  `pnpm test:ci`
  `pnpm run build:deps && pnpm run build:packages && pnpm run build:cli`
  followed by `npm pack` in `packages/cli` and an isolated temporary-directory install/start check.
- **Stop condition:** do not call this green when `pnpm test:ci` fails. The currently observed
  `reactive-fs/path-realpath` macOS `/private/var` versus `/var` failure is baseline-only until the Agent proves the
  same result against the recovery branch parent; any new failure or source/dist mismatch reopens its owner gate.

## Boundary after R5

Passing R5 prepares independent review only. It does not authorize browser/App acceptance, PR approval, merge,
publish, release, archive, or mutation of user projects. The Owner alone performs the final 1.8.x and 1.9.x browser
and App walkthrough, then independently decides PR, merge, release, and archive.

## Post-R5 review recovery gates

The R0-R5 entries above are historical closure records. The independent whole-change review performed after the
post-walkthrough package re-verification found the following unimplemented obligations. They execute linearly; each
gate remains unchecked until its exact green evidence and focused review are recorded in `loop/implementation.md`.

```text
R6.1 -> R6.2 -> R6.3 -> R6.4 -> R6.5 -> R6.6 -> (R6.7 + R6.8) -> R6.9
```

### R6.1 - Keep version bypass outside the admitted capability boundary

```text
Primary production owner: packages/core/src/openspec-compat.ts
Dependent owners:         packages/core/src/agent-delivery-registry.ts
                           packages/server/src/agent-delivery-projection-service.ts
Evidence owners:          packages/core/src/openspec-compat.test.ts
                           packages/core/src/agent-delivery-registry.test.ts
                           packages/server/src/agent-delivery-projection-service.test.ts
```

- **Red case:** a current-page bypass is active for `1.9.0-rc.1`, `1.10.0`, or an unparseable version. The current
  code derives 1.9 capabilities for `>=1.9` and/or selects the complete 1.9 registry as a fallback.
- **Required change:** make a stable supported compatibility classification the sole input that can select
  version-specific capabilities or an Agent registry. Unsupported, unknown, and prerelease versions must retain
  their mismatch evidence and expose no admitted registry/capability; UI bypass must not alter this fact.
- **Green case:** stable 1.8 receives only 1.8 inventory/capabilities; stable 1.9 receives only 1.9 facts; each
  bypassed unsupported form has no `archivedValidation`, no `schemasRootSelector`, and no 1.9 inventory.
- **Focused verification:**
  `pnpm --filter @openspecui/core exec vitest run src/openspec-compat.test.ts src/agent-delivery-registry.test.ts`
  and
  `pnpm --filter @openspecui/server exec vitest run src/agent-delivery-projection-service.test.ts`.
- **Stop condition:** any API that accepts a raw version string and infers an inventory for a non-admitted CLI, or a
  bypass persisted outside the mounted page, returns this gate to the CLI-admission delta Spec.

### R6.2 - Preserve the selected registry across retained physical projections

```text
Primary production owner: packages/core/src/tool-init-state.ts
Evidence owners:          packages/core/src/tool-init-state.test.ts
                           packages/server/src/agent-delivery-projection-service.test.ts
```

- **Red case:** a one-shot 1.8 projection receives a 37-tool selected registry, but a retained projection rebuilds
  options without `registry` and reverts to the global `AI_TOOLS` inventory on the next reactive observation.
- **Required change:** clone and retain the selected registry in `createToolInitStateProjection`, with the same
  immutability policy as delivery, workflows, command contents, and unavailable-command facts.
- **Green case:** initial and replacement emissions from a retained 1.8 projection remain 37-tool projections;
  Command Code and 1.9-only restart facts never reappear after filesystem or policy refresh.
- **Focused verification:**
  `pnpm --filter @openspecui/core exec vitest run src/tool-init-state.test.ts`
  and
  `pnpm --filter @openspecui/server exec vitest run src/agent-delivery-projection-service.test.ts`.
- **Stop condition:** a replacement relies on a process-global registry or mutates the captured registry in place.

### R6.3 - Reject unavailable explicit Agent tools before Init can spawn

```text
Primary production owner: packages/server/src/router.ts (agentIntegrations.initStream)
Evidence owner:           packages/server/src/router.test.ts
```

- **Red case:** a direct RPC call in an admitted 1.8 session supplies `['command-code']`. The static full registry
  input schema accepts it, `initStream` starts, and the CLI receives a tool the selected 1.8 registry never offers.
- **Required change:** after loading the current Agent projection and before creating `cliExecutor.initStream`, check
  every explicit tool against `projection.registry`. Reject unavailable entries with typed precondition evidence and
  prove the runner was never called. Preserve `tools: 'all'` as the literal official CLI request.
- **Green case:** explicit 1.8 Command Code is rejected without spawn; explicit 1.8 supported tools and 1.9 Command
  Code stream normally; `'all'` reaches the CLI unchanged.
- **Focused verification:**
  `pnpm --filter @openspecui/server exec vitest run src/router.test.ts -t "Agent integration"`.
- **Stop condition:** a browser-only disablement, validation against `getAvailableTools()` rather than the projection,
  or a rejected request that starts a child process fails this gate.

### R6.4 - Propagate captured static Schema failure through every accessor

```text
Primary production owner: packages/web/src/lib/static-data-provider.ts
Evidence owner:           packages/web/src/lib/static-data-provider.opsx.test.ts
```

- **Red case:** `getOpsxSchemas()` and `getOpsxConfigBundle()` throw `StaticSchemasCaptureError`, while direct
  `getOpsxSchemaDetail`, `getOpsxSchemaResolution`, `getOpsxTemplates`, `getOpsxSchemaFiles`, `getOpsxSchemaYaml`,
  and template-content reads return values from the same failed static capture.
- **Required change:** load the snapshot and assert the one captured failure boundary before every Schema-related
  static accessor; do not create accessor-specific fallback semantics.
- **Green case:** each accessor above throws the same captured error object/type for one failed snapshot; callers
  cannot obtain list, detail, resolution, template, file, YAML, or template content as successful data.
- **Focused verification:**
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts`.
- **Stop condition:** any accessor returns `null`, `[]`, empty text, or partial data for the failed capture.

### R6.5 - Restore CLI Apply as the visible task-progress authority

```text
Primary production owner: packages/web/src/routes/change-list.tsx
Dependent owner:          packages/web/src/components/apply-progress-notice.tsx
Evidence owners:          packages/web/src/routes/change-list.test.tsx
                           packages/web/src/components/apply-progress-notice.test.tsx
                           packages/web/src/routes/change-view.test.tsx
```

- **Red case:** Change List renders `trackedTaskProgress` as `n/m`, percent, and `task completion` although the list
  has no Apply Instructions. Change Detail hides ordinary Apply progress when tracked and Apply happen to agree.
- **Required change:** remove task-count/percent/completion claims from Change List; retain only objective planning
  and artifact phase. Render Apply progress in Change Detail whenever Apply Instructions are present, with tracked
  data only as a clearly secondary divergence comparison.
- **Green case:** a list with tracked data but no Apply data never claims implementation completion; a detail with
  matching Apply/tracked counts still shows the source-attributed Apply count; divergence adds comparison, not the
  only visibility path.
- **Focused verification:**
  `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/change-list.test.tsx src/components/apply-progress-notice.test.tsx src/routes/change-view.test.tsx`.
- **Stop condition:** local tracked totals again become user-facing implementation progress, or Apply display depends
  on divergence.

### R6.6 - Parse archived validation at the evidence boundary

```text
Primary production owner: packages/web/src/components/archived-validation-evidence.tsx
Evidence owner:           packages/web/src/components/archived-validation-evidence.test.tsx
```

- **Red case:** a malformed `report.data` that contains shallow `items`, `summary`, and `root` fields passes the
  local type guard and is asserted into `ArchivedValidationReport`, allowing invalid nested totals/items to render.
- **Required change:** import the Core `CliValidateReportSchema` and use `safeParse` for report data. A parse failure
  renders typed CLI failure evidence and retains transport/contract diagnostics without assertion casts.
- **Green case:** valid nonzero-exit reports still render their archived failure facts; malformed report payloads
  show `CLI failure evidence` and never render a pass/fail report surface.
- **Focused verification:**
  `pnpm --filter @openspecui/web exec vitest run --project unit src/components/archived-validation-evidence.test.tsx`.
- **Stop condition:** a shallow shape guard, `as ArchivedValidationReport`, or a fabricated fallback report remains.

### R6.7 - Bring every v9-touched TypeScript file to the repository intent-header standard

```text
Primary production owner: all TypeScript/TSX files changed after reviewed parent 79c41a02
Evidence record:          loop/implementation.md (file inventory and audit result)
```

- **Red case:** the reviewed v9 diff contains 37 changed TypeScript/TSX files and at least 41 missing/stale intent
  headers in the broader review inventory; several retain only pre-v9 dates/original requests despite carrying v9
  behavior.
- **Required change:** audit every changed source/test/script file against the reviewed parent, including the 37
  currently enumerated by `git diff --name-only 79c41a02..HEAD -- 'packages/**/*.ts' 'packages/**/*.tsx'`. Each
  eligible file must have a truthful top-level `Orthogonal intents` header with the v9 timestamp and original
  request. Split files that exceed five actual intents; do not cosmetically inflate a comment to hide a sixth.
- **Green case:** the implementation record lists the audited paths/count and each target file either has an updated
  truthful header or a documented, review-approved non-applicability reason. No changed v9 owner silently retains a
  stale scope claim.
- **Focused verification:** inspect the saved inventory plus each file header, then run
  `pnpm run format:check` and the affected package typechecks.
- **Stop condition:** a production or test owner remains undocumented, a header exceeds five intentions, or a file
  needs a split not covered by its owner gate.

### R6.8 - Remove assertion-cast Router fixture boundaries

```text
Primary production owner: packages/server/src/router.test.ts
Evidence owner:           packages/server/src/router.test.ts
```

- **Red case:** archived-validation tests use `unknown as ReturnType<typeof vi.fn>` to reach
  `context.cliExecutor.contracts.validate`, weakening the `CliExecutor` fixture contract at the exact capability
  boundary under review.
- **Required change:** expose a typed mock/spy from the shared Router test context or a narrowly typed fixture helper;
  remove both double assertions without weakening production types.
- **Green case:** the 1.8 no-spawn and 1.9 validation assertions compile from the typed fixture and retain their
  behavioral coverage.
- **Focused verification:**
  `pnpm --filter @openspecui/server exec vitest run src/router.test.ts -t "archived validation"`
  followed by the Server typecheck.
- **Stop condition:** `any`, `unknown as`, `@ts-nocheck`, or a mock detached from the production Router context is
  introduced to make the test compile.

### R6.9 - Re-establish distribution evidence after all R6 repair gates

```text
Prerequisite: R6.1-R6.8 green evidence recorded and focused review passed.
Owner:         source/distribution agreement, not a feature owner.
```

- **Red case:** R5/post-walkthrough tarball proof predates R6 source edits and therefore cannot prove the repaired
  admission boundary, retained registry, static accessor closure, UI progress, or payload parsing.
- **Required change:** run the full source gates, rebuild all affected outputs, pack the real CLI, isolated-install
  it, and inspect installed code/assets for the R6 laws. Run an independent whole-change code review only after the
  package result agrees with source.
- **Green case:** focused R6 evidence, build output, packed tarball, and isolated install agree; no new failures are
  hidden under a known baseline; the review finds no remaining R6 blocker.
- **Required verification:**
  `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run openspec:check-reference`,
  `pnpm test:ci`, `pnpm run build:deps && pnpm run build:packages && pnpm run build:cli`, then `npm pack` in
  `packages/cli` and an isolated temporary-directory install/start inspection.
- **Stop condition:** any R6 focused failure, source/dist disagreement, or unclassified full-gate failure returns to
  its owner gate. R6.9 does not authorize Owner acceptance, PR, merge, release, or archive.

## Independent-review correction after the claimed R6 closure

The R6 implementation record is retained as historical Agent evidence. It does not establish closure: an
independent review of `79c41a02...b5c64f7f` found two residual assertion casts at the R6.6 evidence boundary, an
incomplete R6.7 inventory, and 28 trailing-whitespace violations. Therefore R6.6, R6.7, and R6.9 are reopened and
must be repaired in the following order.

```text
R7.1 typed archived-validation boundary
  -> R7.2 complete dynamic source inventory + diff hygiene
    -> R7.3 fresh focused/source/distribution evidence + independent review
      -> Owner-only browser/App walkthrough and delivery decision
```

### R7.1 - Remove assertion casts from the archived-validation evidence boundary

```text
Primary production owner: packages/web/src/components/archived-validation-evidence.tsx
Evidence owner:           packages/web/src/components/archived-validation-evidence.test.tsx
```

- **Red case:** `parseValidationReport()` uses `CliValidateReportSchema.safeParse`, but then casts
  `parsed.data` to `ArchivedValidationReport`; the RPC result is separately cast to
  `CliCommandResult<CliValidate>`. Both casts remain at the exact external-evidence boundary.
- **Required change:** use the schema's inferred report type directly after successful `safeParse`, and preserve the
  actual typed tRPC mutation result through local state without an assertion. If the client result is not statically
  available, establish a runtime-checked transport result before state assignment; do not move either cast into a
  helper or weaken the state to `any`.
- **Green case:** valid nonzero-exit reports still render item/root/total facts; malformed `data` still renders
  `CLI failure evidence`; neither `as ArchivedValidationReport` nor `as CliCommandResult<CliValidate>` exists in
  the component or a replacement boundary.
- **Focused verification:**
  `pnpm --filter @openspecui/web exec vitest run --project unit src/components/archived-validation-evidence.test.tsx`
  followed by the Web package typecheck.
- **Stop condition:** any assertion cast, shallow report guard, fabricated fallback, or loss of transport/contract
  diagnostics returns this gate to the projection-contract delta Spec.

### R7.2 - Complete the dynamic v9 TypeScript/TSX audit and restore diff hygiene

```text
Primary production owner: every TypeScript/TSX path changed since reviewed parent 79c41a02
Evidence record:          loop/implementation.md (exact final inventory and audit result)
```

- **Red case:** the current inventory command returns 44 paths while the R6 record says 42;
  `packages/server/src/agent-integrations-router.test.ts` was changed by R6.9 but retains its
  `2026-08-06` header and pre-v9 original request. `git diff --check 79c41a02...HEAD` reports 28
  trailing-whitespace violations in header-edited TypeScript/TSX files.
- **Required change:** start from the exact command below, record all paths in the implementation evidence, and
  update every applicable top-of-file header with a truthful current v9 intent, timestamp, and original request.
  Preserve the five-intent maximum: physically split a sixth real owner rather than hiding it in prose. Remove every
  change-introduced whitespace violation. Re-run the inventory after every R7 source change; it is dynamic, so a
  newly touched TypeScript/TSX file joins the audit rather than becoming an undocumented exception.

  ```sh
  git diff --name-only 79c41a02...HEAD -- 'packages/**/*.ts' 'packages/**/*.tsx' | sort
  git diff --check 79c41a02...HEAD
  FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run format:check
  ```

- **Green case:** the final recorded inventory is complete, every member has either a current truthful header or a
  review-approved non-applicability explanation, `git diff --check 79c41a02...HEAD` exits zero, and the scoped
  formatter command exits zero. The untracked user-owned `pb.html` must not be used to judge this changed-file gate.
- **Stop condition:** an inventory count is asserted without its actual path list, an R7-touched owner lacks a
  header, a header exceeds five independent intents, or any diff-hygiene failure remains.

### R7.3 - Re-establish all post-R6 evidence and obtain a fresh independent review

```text
Prerequisite: R7.1 and R7.2 have exact green evidence and focused review records.
Owner:         source/distribution agreement and independent-review boundary, not a feature owner.
```

- **Red case:** the R6.9 build/pack/isolated-install record predates the R7 source corrections and its claimed clean
  gate is false; it cannot prove the corrected evidence boundary or audit state.
- **Required change:** after R7.1-R7.2, rerun every R6 focused suite affected by the change, then rerun the scoped
  formatter, lint, typecheck, reference check, CI, clean build, pack, and isolated-install inspection. A non-green
  CI result may be classified as a baseline only after the exact failure is reproduced unchanged at `79c41a02`.
  Request a fresh independent whole-change review only after source and installed distribution evidence agree.
- **Required verification:**

  ```sh
  pnpm --filter @openspecui/core exec vitest run src/openspec-compat.test.ts src/agent-delivery-registry.test.ts src/tool-init-state.test.ts
  pnpm --filter @openspecui/server exec vitest run src/agent-delivery-projection-service.test.ts src/agent-integrations-router.test.ts src/router.test.ts -t "Agent integration|archived validation"
  pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts src/routes/change-list.test.tsx src/components/apply-progress-notice.test.tsx src/routes/change-view.test.tsx src/components/archived-validation-evidence.test.tsx
  FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run format:check
  pnpm run lint
  pnpm run typecheck
  pnpm run openspec:check-reference
  pnpm test:ci
  pnpm run build:deps && pnpm run build:packages && pnpm run build:cli
  git diff --check 79c41a02...HEAD
  openspec validate target-openspec-cli-19-line --strict
  openspec instructions apply --change target-openspec-cli-19-line --json
  ```

  Then pack `packages/cli`, install the tarball into an isolated temporary directory, and inspect the installed CLI
  version, command help, admission/registry markers, and rebuilt Web asset facts. Record the exact commands and
  results before requesting the independent review.

- **Green case:** all focused R7/R6 evidence, source gates, packed output, isolated install, and independent review
  agree. There are no unclassified failures and no reuse of pre-R7 build/pack/review evidence.
- **Stop condition:** a failed focused suite, source/dist mismatch, incomplete baseline reproduction, failed
  independent review, or later source edit reopens the responsible owner gate and invalidates R7.3 evidence.

## Boundary after R7

R7.3 prepares but does not perform acceptance. Only after its independent review is accepted may the Owner personally
perform checkpoint 4.1. Agents may run component/browser preparation evidence, but cannot check 4.1 or 4.2, open a
PR, merge, publish, release, or archive the Change.

## Independent-review correction after the claimed R7 closure

The R7 record is historical Agent evidence, not an accepted closure. The next review of
`79c41a02...2b3146e3` found runtime bypasses, lost evidence, an untyped config boundary, an incomplete 45-path
header audit, and four unclassified Server timeouts. R7.1-R7.3 are reopened and R8 executes linearly:

```text
R8.1 static accessor terminality
  -> R8.2 archived payload preservation
    -> R8.3 typed static-export selector
      -> R8.4 complete 45-path header proof
        -> R8.5 source/distribution re-verification + independent review
          -> Owner-only browser/App walkthrough
```

### R8.1 - Make the captured Schema failure terminal before optional identity handling

```text
Primary production owner: packages/web/src/lib/static-data-provider.ts
Evidence owner:           packages/web/src/lib/static-data-provider.opsx.test.ts
```

- **Red case:** `getOpsxSchemaDetail`, `getOpsxSchemaResolution`, `getOpsxSchemaYaml`, and
  `getOpsxTemplateContent` return `null` before `assertSchemasCaptureCaptured()` when their optional identity is
  absent. A failed capture therefore becomes a normal null result instead of the one typed
  `StaticSchemasCaptureError` boundary.
- **Required change:** load the snapshot and assert the captured failure before any optional-identity/default-schema
  branch in every Schema accessor: list, bundle, detail, resolution, templates, files, YAML, template content, and
  template contents. Keep ordinary absent-identity behavior only after a successful capture or an omitted snapshot.
- **Green case:** one failed capture throws the same `StaticSchemasCaptureError` for every accessor, including calls
  with `undefined` names/ids; no accessor returns `null`, `[]`, empty text, or partial data for that failed capture.
- **Focused verification:** extend `static-data-provider.opsx.test.ts` with undefined-identity cases, then run
  `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts`.
- **Stop condition:** any optional argument can bypass the capture assertion or a test accepts a successful fallback
  from a failed static Schema observation.

### R8.2 - Preserve archived-validation payload and contract diagnostics

```text
Primary production owner: packages/web/src/components/archived-validation-evidence.tsx
Evidence owner:           packages/web/src/components/archived-validation-evidence.test.tsx
```

- **Red case:** the transport envelope is validated, then state assignment sets `payload: null` even when the CLI
  supplied a payload. A malformed report also loses the `CliValidateReportSchema.safeParse` diagnostic and displays
  only a generic failure.
- **Required change:** retain the validated payload and all transport fields in state; report the typed schema error
  alongside the existing stderr/contract diagnostics. Do not reintroduce assertion casts, shallow guards, or an
  untyped fallback.
- **Green case:** valid non-zero reports render their items and retain payload/diagnostics; malformed payloads render
  `CLI failure evidence` with the schema path/message; no report surface is rendered as valid.
- **Focused verification:** add payload-retention and malformed-schema-diagnostic assertions, then run
  `pnpm --filter @openspecui/web exec vitest run --project unit src/components/archived-validation-evidence.test.tsx`.
- **Stop condition:** payload is nulled, schema diagnostics disappear, or the transport boundary is weakened.

### R8.3 - Read the static-export Store selector through the typed config owner

```text
Primary production owner: packages/cli/src/export.ts
Evidence owner:           packages/cli/src/export.test.ts
                  packages/core/src/planning-config.ts (existing typed config owner)
```

- **Red case:** `generateSnapshot()` extracts `store` from `openspec/config.yaml` with a line regex. Valid YAML such
  as `store: "shared" # selected root` forwards the quotes or truncates a legal scalar, so the exported selector is
  not the selector understood by the official CLI/config owner.
- **Required change:** use the existing typed YAML/config parser and its declared/invalid/absent Store state. Forward
  a selector only for an admitted 1.9 CLI and a valid declared Store; preserve the exact selector in the capture and
  keep 1.8/no-store behavior unchanged. Do not add a second ad hoc YAML parser in the CLI package.
- **Green case:** quoted, commented, invalid, absent, and plain Store values each produce the expected selector or
  explicit no-selector evidence; a 1.8 executor never receives `--store`; a 1.9 executor receives the parsed Store id.
- **Focused verification:** add export tests for quoted/commented/invalid config and run
  `pnpm --filter @openspecui/cli exec vitest run src/export.test.ts`.
- **Stop condition:** regex/string slicing remains the source of selector truth, invalid YAML is treated as a Store id,
  or the exporter diverges from `planning-config.ts` semantics.

### R8.4 - Reconcile the complete 45-path header inventory

```text
Primary production owner: every TypeScript/TSX path changed since reviewed parent 79c41a02
Evidence record:          loop/implementation.md (full sorted path list and per-file audit result)
```

- **Red case:** the current inventory command returns 45 paths, while the R7 record only records 44. The import at
  line 1 of `packages/core/src/agent-delivery-registry.ts` precedes its intent header; duplicate/non-orthogonal
  intents remain in `agent-command-content.ts` and `agent-delivery-projection-service.test.ts`.
- **Required change:** move every import below the top-level intent header, rewrite duplicate or merged entries into
  truthful orthogonal intents, preserve the five-intent limit, and record the exact sorted 45-path inventory. Re-run
  the command after every R8 source edit so newly touched files cannot escape the audit.
- **Green case:** every final path has a top-level truthful header and current v9 request/date (or an explicitly
  reviewed exception), no duplicate numbering or merged sentence remains, and `git diff --check` plus scoped format
  check pass.
- **Focused verification:** inspect all 45 headers, run
  `git diff --name-only 79c41a02...HEAD -- 'packages/**/*.ts' 'packages/**/*.tsx' | sort`,
  `git diff --check 79c41a02...HEAD`, and
  `FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run format:check`.
- **Stop condition:** inventory count/path list mismatch, any header before the header, stale v9 owner, duplicate
  intent, or unclassified whitespace violation.

### R8.5 - Re-establish source/distribution evidence and resolve Server timeouts (historical gate specification)

R8.5 is closed. The red case, required change, and verification commands below are retained to explain the gate's
original entry conditions; the 2026-08-16 closure and final re-verification in `loop/implementation.md` supersede them
as the current execution state.

```text
Prerequisite: R8.1-R8.4 have exact green evidence and focused review records.
Owner:         source/distribution agreement and independent-review boundary.
```

- **Red case:** the R7 record claims Server 120/120 and no unclassified failures. An earlier current-branch run
  recorded 116 passed and four 5-second timeouts; the fresh current run records 118 passed and two 5-second
  timeouts, and the same two cases still time out when rerun alone. The R7 package proof also predates R8 source
  edits, so the timeout cases remain unclassified.
- **Required change:** reproduce each timeout at the current revision and at `79c41a02` without widening test
  timeouts; classify only an identical baseline or fix the owning lifecycle/fixture boundary. Then rerun all R8/R7
  focused tests, source gates, clean builds, CLI pack, isolated install, and a fresh independent review.
- **Required verification:**

  ```sh
  pnpm --filter @openspecui/core exec vitest run src/openspec-compat.test.ts src/agent-delivery-registry.test.ts src/tool-init-state.test.ts src/official-cli-19-validation-fixtures.test.ts src/opsx-kernel-schemas-root.fixtures.test.ts
  pnpm --filter @openspecui/server exec vitest run src/agent-delivery-projection-service.test.ts src/agent-integrations-router.test.ts src/router.test.ts
  pnpm --filter @openspecui/web exec vitest run --project unit src/lib/static-data-provider.opsx.test.ts src/components/archived-validation-evidence.test.tsx src/routes/change-list.test.tsx src/components/apply-progress-notice.test.tsx src/routes/change-view.test.tsx
  pnpm --filter openspecui exec vitest run src/export.test.ts
  FORMAT_CHECK_BASE_SHA=79c41a02 pnpm run format:check
  pnpm run lint
  pnpm run typecheck
  pnpm run openspec:check-reference
  pnpm test:ci
  pnpm run build:deps && pnpm run build:packages && pnpm run build:cli
  git diff --check 79c41a02...HEAD
  openspec validate target-openspec-cli-19-line --strict
  openspec instructions apply --change target-openspec-cli-19-line --json
  ```

  Pack `packages/cli`, install it in an isolated temporary directory, and inspect CLI help/version plus the rebuilt
  Web asset and selector/evidence markers. Record every result after the last source edit.

- **Green case:** all focused tests, the timeout classification, source gates, package evidence, isolated install,
  and a fresh independent review agree with the delta Specs. No failure is hidden as a baseline without reproduction.
- **Stop condition:** any timeout remains unclassified, any source/dist mismatch appears, or any later source edit
  occurs after the independent review.

## Boundary after R8

R8.5 only prepares Owner acceptance. The Owner alone performs checkpoint 4.1, then decides PR review, merge, release,
and archive through checkpoint 4.2. Agents must not run browser acceptance as a substitute or check either Owner gate.
