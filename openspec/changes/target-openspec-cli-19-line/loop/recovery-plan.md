<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Convert the v9 implementation review findings into ordered, independently verifiable recovery gates.
2. Assign one production owner, one true red case, one green case, and one stop condition to every gate.
3. Preserve the Owner-only browser, PR, merge, release, and archive boundary.

Original request (2026-08-15): "这里面很大的问题也是因为你作为架构师，openspec change 文件撰写不够清晰，导致Agent 没有如期完成所有开发，请你改进 change 文件，改进开发计划。"
-->

# OpenSpecUI 9 implementation recovery plan

## Status and operating law

The candidate source at `79c41a02` is review-rejected for the gates below. Existing passing focused tests are
characterization evidence only; they do not close a gate when the reported production path is untested.

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
