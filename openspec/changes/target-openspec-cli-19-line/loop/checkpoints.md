<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Track the v9 adaptation in dependency order with evidence-based closure.
2. Preserve focused-review and Owner-only acceptance gates.
3. Prevent release/archive work from being inferred from implementation completion.

Original request (2026-08-15): "完成后，我就会自己开始开发"
-->

# OpenSpecUI 9 checkpoints

## 1. Research and Planning

- [x] 1.1 Pin `references/openspec` to verified OpenSpec v1.9.0.
- [x] 1.2 Record v1.7 -> v1.8 -> v1.9 source and black-box protocol evidence.
- [x] 1.3 Define the v9 supported/current version law and non-goals.
- [x] 1.4 Create owner/red/green implementation plan and delta Specs.
- [x] 1.5 Independent planning review is incorporated and targeted Change validation is re-run.

### Planning review record (2026-08-15 Asia/Shanghai)

- Independent `gpt-5.6-sol` review found no justified correction to the upstream protocol scope, owner mapping,
  red/green evidence, task ordering, fixture requirement, or Change artifact structure.
- Supplemental checks: pinned `references/openspec` is v1.9.0 at `2826b8889e5223a9a8095d4428b60b56597e1020`;
  `git diff --check` passes; targeted `openspec validate target-openspec-cli-19-line --strict --json` passes.
- Review boundary remains unchanged: no production source, release, PR, archive, merge, or Owner browser acceptance
  was performed.

## 2. Core Admission and Contracts

- [x] 2.1 Add the v9 compatibility classifier and public copy.
- [x] 2.2 Prove red: stable 1.8.x blocked or prerelease 1.9.x admitted.
- [x] 2.3 Prove green: 1.8.x supported non-current, 1.9.x current, all excluded versions block.
- [x] 2.4 Decode successful Schema arrays and selected-root failure envelopes distinctly.
- [x] 2.5 Decode v1.9 archived validation reports without treating CLI failure as data absence.
- [x] 2.6 Pass focused Core compatibility/workflow/executor review before downstream consumers change.

### Implementation record (2026-08-15 Asia/Shanghai)

- Red evidence: `openspec-compat.test.ts` previously asserted `1.8.0` blocks; `CliSchemasSchema` was a bare array so
  a valid 1.9 failure envelope became contract drift; `validate` had no `--archived` argv.
- Green evidence: classifier `supported` status with accepted `>=1.8.0 <1.10.0` and recommended `>=1.9.0 <1.10.0`
  (`packages/core/src/openspec-compat.ts`, `packages/web/src/components/cli-health-gate.test.tsx`); schemas sum type
  plus `isCliSchemasFailure` and the Kernel failure-envelope rejection with diagnostics
  (`packages/core/src/cli-contracts/workflow.ts`, `packages/core/src/opsx-kernel.ts`,
  `packages/core/src/opsx-kernel-cli-projection.test.ts`); archived Validate target and report schema
  (`packages/core/src/cli-contracts/executor.ts`, `CliValidateReportSchema`).

## 3. Workflow Projection

- [x] 3.1 Project `isPlanningComplete` as planning readiness only.
- [x] 3.2 Preserve Apply `progress` independently from actionable task-list length.
- [x] 3.3 Prove indented and blank-description checkbox total behavior with real 1.8.0 and 1.9.0 fixtures.
- [x] 3.4 Pass focused Core/Server workflow and task-progress review.

### Implementation record (2026-08-15 Asia/Shanghai)

- `ChangeStatusSchema` carries `isPlanningComplete`; every Web summary reads planning completion or tracked-task
  phase explicitly and the retained `isComplete` alias lives only in the raw CLI contract layer.
- The pinned matrix proves `progress.total = 3` with `tasks.length = 2` (indented sub-task counted, blank-description
  checkbox omitted from the actionable list) on OpenSpec 1.8.0 and 1.9.0
  (`packages/core/src/official-cli-19-workflow-fixtures.test.ts`), and `ApplyInstructionsSchema` preserves the CLI
  denominator (`packages/core/src/opsx-types.test.ts`).

## 4. Agent Delivery

- [x] 4.1 Rebuild the registry from official 1.8/1.9 metadata.
- [x] 4.2 Prove Codex `.agents` current root and `.codex` legacy evidence.
- [x] 4.3 Prove MiniMax global skills, Rovo Dev, Shared `.agents`, Command Code, and IDE restart metadata.
- [x] 4.4 Preserve migration/cleanup evidence while the official CLI remains the sole mutation owner.
- [x] 4.5 Pass focused registry, state, Server projection, and Config-owner review.

### Implementation record (2026-08-15 Asia/Shanghai)

- Registry mirrors official 1.9 inventory (38 entries) with `legacySkillsDirs`, `globalSkillsDir`,
  `requiresIdeRestart`; Codex sits at `.agents` with `.codex` detection/migration and a consent-free migration;
  MiniMax skills are observed at the user-global `~/.minimax/skills` inventory (acquired as an observation root by
  the Server projection) and never cleaned or migrated locally.
- Evidence: `packages/core/src/agent-delivery-registry.test.ts`, `packages/core/src/tool-init-state.test.ts`,
  `packages/server/src/agent-delivery-projection-service.test.ts`, `packages/server/src/tool-subscription-router.test.ts`.

## 5. Archive and Evidence Surfaces

- [x] 5.1 Preserve archive retirement/scenario-loss/duplicate-requirement warning and failure facts.
- [x] 5.2 Present archived validation as typed CLI evidence without local repair or automatic archive.
- [x] 5.3 Prove static projections do not fabricate live validation/archive/Agent evidence.
- [x] 5.4 Pass focused Change Evidence and Config Web review.

### Implementation record (2026-08-15 Asia/Shanghai)

- `CliArchiveSchema` preserves upstream `warnings` (retirement/scenario-loss) and failure payloads with `archive:
null` diagnostics; the Archive stream remains the CLI-owned destructive boundary.
- `cli.validate` gains the archived target; the Change Evidence tab renders the typed report (items, issues,
  totals, root, exit) with archived failures as report content, a no-repair action set, and an explicit
  static-snapshot unavailability state (`packages/web/src/components/archived-validation-evidence.tsx`).

## 6. Fixture and Distribution Gates

- [x] 6.1 Run the pinned 1.8.0 and 1.9.0 executable fixture matrix.
- [x] 6.2 Run affected typecheck, lint, and unit/component tests after focused owners pass.
- [x] 6.3 Build Web, App, and CLI outputs; inspect generated compatibility artifacts.
- [x] 6.4 Pack and isolated-install the real `openspecui` tarball; prove installed v9 admission behavior.
- [x] 6.5 Add one OpenSpecUI 9 major Changeset and release/changelog preparation only.

### Implementation record (2026-08-15 Asia/Shanghai)

- Matrix: `official-cli-19-workflow-fixtures.test.ts`, `official-cli-19-nested-spec-fixtures.test.ts`,
  `official-cli-19-default-store-fixtures.test.ts`, `official-cli-19-validation-fixtures.test.ts` run the official
  `openspec-cli-18`/`openspec-cli-19` npm executables pinned as Core devDependencies, including the 1.8 boundaries
  (schemas root selector and `validate --archived` rejected).
- Gates: `pnpm run typecheck`, `pnpm run lint`, per-package suites green except two pre-existing unrelated
  environment failures (Core `reactive-fs/path-realpath` on the macOS symlinked temp root and Server
  `translation-cache-adapter` sqlite), which fail identically on `main` before this Change.
- Distribution: `pnpm run build:deps && pnpm run typecheck && pnpm run build:packages && pnpm run build:cli`,
  `npm pack` of the CLI, isolated `npm install` of the tarball, and grep evidence that the installed bundle carries
  the v9 admission constants (`1.8.0`/`1.9.0` ranges, `recommended` copy), `isPlanningComplete`,
  `CliSchemasFailure`, and the MiniMax registry facts; the installed CLI starts successfully.
- Release prep: `.changeset/openspecui-9-cli-18-19.md` (major) with the 8.0.0 base version consumed across the
  fixed group so the bump publishes as 9.0.0; 1.7 READMEs archived; no publish/release action performed.

## 7. Owner Gates

- [ ] 7.1 Owner performs final browser/App walkthrough for 1.8.x and 1.9.x projects.
- [ ] 7.2 Owner reviews PR, authorizes merge, release, and archive independently.
