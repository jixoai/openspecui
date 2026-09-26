<!--
Orthogonal intents (created 2026-09-26 Asia/Shanghai):
1. Convert the verified 1.13.2 patch delta into ordered implementation slices with owners and evidence.
2. Keep every slice red/green case executable against a named fixed point.
3. Record the parallel batch topology and the serial pin-rotation barrier.

Original request (2026-09-26): "Openspec 1.13.2 释放了，更新本地引用。1. 调查变更内容，然后开始规划适配工作，我们将用标准工作流来推进。让 codex 参与 remix。2. 使用 vision 子代理负责端到端的走查验证，使用 ego-browser"
-->

# OpenSpec CLI 1.13.2 patch research plan

Evidence source: `references/openspec-1.13.2-report.md` (pinned `v1.13.2` @ `db23097`). Upstream
references below are verbatim from `references/openspec/src/commands/workflow/shared.ts`,
`src/commands/workflow/instructions.ts`, `src/core/command-generation/adapters/kilocode.ts`,
`src/core/legacy-cleanup.ts`, and `src/core/artifact-graph/outputs.ts` at the pin.

## Research Findings

- The patch adds no command, flag, or capability (`src/index.ts` unchanged); the admission window,
  capability derivation, Agent registry series (`'1.13'`), and series-aware staleness already cover
  1.13.2. Zero window work. `docs/agent-contract.md` is unchanged; the Apply contract text lives in
  `docs-lab/reference/cli.md`.
- The production-facing obligations are the Apply tracking-evidence members (P1: typed contract +
  projection + Change-Detail surface), the Kilo command path rotation (P2: registry physical fact),
  and the widened artifact-glob recognition (P3: dependency-watch parity). All are additive-optional
  at the decode boundary, so nothing breaks at decode; the obligations are projection parity and
  registry truth.
- Validation semantics/message changes (P4) are shape-compatible; fixture expectations updated only
  where the new texts fire against the executable. Line-ending preservation, archive Windows fallback,
  and workflow-template rework (P5) are CLI-owned with no OpenSpecUI mirror.
- Divergence parity risk assessed: the local `trackedTaskProgress` already resolves tracked globs by
  pattern-matching (`opsxPathMatchesPattern`), so the upstream switch from one literal tracks path to
  glob aggregation should not move local counts; the fixture matrix proves it (Slice 5), no code change
  expected.

## Decision & Plan

### CP0 — Planning baseline (before slices)

Worktree `openspecui-worktrees/update-openspec-cli-1132` on branch `target/openspec-cli-1132-patch` off
`main` (`0cfb2c38`); submodule `references/openspec` pinned `v1.13.2`
(`db2309783547a14e150dbcbfc19120e4028446c3`); evidence report written; change artifacts written;
committed before Codex review. Codex change review gates implementation freeze (Round-A expected;
blockers folded back into slices, Round-B expected to approve).

### Slice 1 — Pin rotation (serial barrier; everything else waits on its install)

Owners (single batch):

- `packages/core/package.json` — `openspec-cli-113` npm alias `@fission-ai/openspec@1.13.1` ->
  `@1.13.2`; regenerate `pnpm-lock.yaml` (workspace install, once, before any parallel batch starts).
- `packages/core/src/__tests__/official-cli-v13-fixtures.ts` — `PINNED_OPENSPEC_V13_VERSIONS =
  ['1.13.2']`; the bins map entry stays `openspec-cli-113`.
- `scripts/prepare-openspec-reference.mjs` — `EXPECTED_COMMIT` ->
  `db2309783547a14e150dbcbfc19120e4028446c3`; header intent line for the 2026-09-26 rotation.
- `CLAUDE.md` — session pointer: read `references/openspec-1.13.2-report.md`; `openspec-1.13.1-report.md`
  joins the historical list.

Red: with the alias bumped but the constants file untouched, the fixture identity assertion
(`--version` must equal `1.13.1`) fails — the honest fixed point is the identity assertion itself, which
is the pin's contract. Green: fixture matrix green against the 1.13.2 executable across all
`official-cli-v13-*.test.ts` files (assertion updates limited to version identity and any 1.13.2-visible
behavioral deltas listed below; no assertion may be relaxed).

Fixture-matrix deltas expected with 1.13.2 (verify, do not assume): apply-readiness payloads gain
`taskTrackingConfigured: true` on every standard-schema fixture and no `unavailableTrackingFiles`;
agent-delivery fixtures assert Kilo writes `.kilo/command/opsx-*.md`; validation fixtures may hit the
rephrased MODIFIED-scenario balance text and the TBD/TODO case rules (only where those fixtures
construct such content).

### Slice 2 — Apply tracking-evidence contract, projection, and surface

Owners (one batch; files disjoint from Slices 3-4):

- `packages/core/src/cli-contracts/workflow.ts` — `CliApplyInstructionsSuccessSchema` gains
  `taskTrackingConfigured: z.boolean().optional()` (upstream always emits from 1.13.2, but the window
  admits 1.13.0/1.13.1 which never emit; absence means unknown, never synthesized) and
  `unavailableTrackingFiles: z.array(z.object({ path: z.string(), reason: z.string() })).optional()`
  (absent-when-empty per the upstream contract). Both ride the existing `.passthrough()` envelope as
  typed members now.
- `packages/core/src/opsx-types.ts` — `ApplyInstructionsInputSchema` and
  `ApplyInstructionsProjectionSchema` gain the same two optional members as verbatim evidence; the
  transform already spreads `...instructions`, so projection needs no extra wiring. They never gate
  apply state or CLI progress authority.
- `packages/web/src/routes/change-view.tsx` — `hasDirectStatus` additionally mounts when
  `unavailableTrackingFiles` is non-empty (partial-unreadable case: state may already be `ready`; the
  CLI instruction text carries the evidence but the typed region keeps it scannable).
- `packages/web/src/components/apply-progress-notice.tsx` — render the unavailable-tracking evidence as
  an amber region beside the existing `warnings`/`missingPrerequisites` treatment: one line per
  `{path, reason}` with the reason verbatim; and a compact note when
  `taskTrackingConfigured === false` that the schema tracks no tasks (so empty `tasks` is not missing
  evidence). Absent members render nothing (no fabricated 0/0 semantics).

Red (structural, today): a decode fixture payload carrying both members (a) succeeds `safeParse` on the
`.passthrough()` CLI schema but is dropped by the strict `ApplyInstructionsInputSchema` (assert the
projection omits them); (b) the Web `ApplyProgressNotice` has no evidence region for unavailable
tracking files (TestingLibrary red); (c) `taskTrackingConfigured === false` fixtures still describe
empty tasks as if tracking were configured. Green: all invert; 1.13.0/1.13.1-shaped payloads (members
absent) decode and project identically to today (regression guard).

Spec deltas: `openspec-cli-integration` ADD `Apply Task Tracking Evidence Contract`;
`opsx-workflow-ui` ADD `Apply Tracking Evidence Surface`.

### Slice 3 — Kilo Code registry path rotation

Owners (one batch; files disjoint from Slice 2):

- `packages/core/src/agent-delivery-registry.ts` — Kilo Code entry:
  `command('.kilo/command/opsx-{workflow}.md', plainMarkdown, { legacyPathTemplates: ['.kilocode/workflows/opsx-{workflow}.md'] })`;
  `cleanup: projectCleanup('.kilocode/workflows/opsx-*.md', '.kilocode/workflows/openspec-*.md')`
  (upstream `LEGACY_KILOCODE_COMMAND_FILES` covers both generations in the old folder; the new
  `.kilo/command/` folder is the live delivery target, not cleanup-owned). Header intent line updated.
- `packages/core/src/agent-delivery-registry.test.ts` — the snapshot assertions rotate
  (`.kilo/command/opsx-{workflow}.md` current; `.kilocode/workflows/opsx-{workflow}.md` legacy; cleanup
  patterns both generations).

Red (today): the registry test asserts `.kilocode/workflows/opsx-{workflow}.md` as the current command
path — the rotation inverts that fixed point; upstream `docs/supported-tools.md` and the pinned
executable are the truth sources. Green: rotated assertions pass; `agent-delivery-projection-service`
and `agent-integrations-router` tests stay green (they consume the registry, not literal Kilo paths —
verify by grep before claiming).

Spec delta: `openspec-cli-integration` ADD `Agent Registry Kilo Command Path Rotation`.

### Slice 4 — Artifact-glob recognition parity

Owners (one batch; single file plus tests):

- `packages/core/src/opsx-types.ts` — `isGlobPattern` ports the upstream widening verbatim: POSIX
  separator normalization first, then the original wildcards (`*`, `?`, `[`) plus the extglob regex
  `/[!*+?@]\([^(]*\)/u` and the brace-expansion scanner (a `{…}` group containing `,` or `..`). Used
  only by `touchArtifactOutputDeps` for dependency-watch granularity.
- `packages/core/src/opsx-types.test.ts` (or the nearest existing owner) — cases: `docs/{api,cli}.md`
  and `specs/**/{spec,info}.md` are globs; `!(a|b).md`, `+(x).md` are globs; `C:\path` backslash
  normalization; literal `report[1].md`-shaped strings stay literal only when they genuinely contain no
  wildcard syntax (bracket without valid class stays a glob per the original rule — keep upstream
  semantics, do not fork).

Red (today): brace/extglob outputs are watched as literal single files (unit red on the recognition
cases). Green: widened recognition; existing wildcard/literal cases unchanged (superset).

Spec delta: `openspec-cli-integration` ADD `Artifact Glob Recognition Parity`.

### Slice 5 — Fixture-matrix extension, docs, changeset (after Slices 1-4)

Owners:

- `packages/core/src/official-cli-v13-apply-readiness-fixtures.test.ts` — executable-evidence additions:
  a fixture change whose `apply.tracks` matches multiple files (glob) asserts aggregated
  `tasks`/`progress` and `taskTrackingConfigured: true`; where the harness can cheaply make a matched
  file unreadable (chmod 000 on POSIX), assert `unavailableTrackingFiles` with the absolute path and
  the `blocked` state — otherwise record the unreadable case as contract-test evidence (Slice 2 red
  fixtures) and keep the executable matrix to the positive shape.
- `packages/core/src/official-cli-v13-agent-delivery-fixtures.test.ts` — assert the pinned 1.13.2
  executable generates `.kilo/command/opsx-<id>.md` for `kilocode` (and that legacy cleanup offers the
  `.kilocode/workflows/` generations where the fixture harness already exercises cleanup).
- `packages/core/src/official-cli-v13-validation-*.test.ts` — update message-text expectations only
  where the 1.13.2 texts fire (MODIFIED scenario balance suffix; TBD/TODO case rules); no level/shape
  changes expected.
- `openspec/specs/**` deltas applied via this change; `AGENTS.md` evidence-map line for the 1.13.2 pin;
  README audit: grep for explicit `1.13.1` runtime claims (expected none — tables are range-scoped).
- `.changeset/*.md` — `openspecui` patch bump note summarizing the rotation, apply tracking evidence,
  Kilo path rotation, and glob parity.

## Risks and Mitigations

- **Lockfile churn**: the alias bump rewrites `pnpm-lock.yaml`; install happens once in Slice 1 before
  any parallel batch starts (known monorepo hazard: parallel installs corrupt the store).
- **Optional-member honesty**: `taskTrackingConfigured` must never be defaulted to `false` — absence is
  "unknown (pre-1.13.2 CLI)", a distinct fact from "schema tracks no tasks"; tests must cover both.
- **Kilo cleanup over-reach**: cleanup patterns must stay within what upstream legacy-cleanup owns (the
  old `.kilocode/workflows/` folder); marking the live `.kilo/command/` folder cleanup-owned would
  invite deleting live delivery artifacts.
- **Fixture flakiness on version identity**: only the two files in Slice 1 own version strings; every
  other `1.13.1` in tests is contract-decode data and must be audited (grep in review) rather than
  blanket-replaced.
- **Parallel subagent resource discipline**: Slice 1 completes (install) before Slices 2-4 dispatch;
  fixture-matrix and broad gates run serially in Slice 5 (single-owned) to avoid dist/target contention
  (2026-09-14 law).

## Verification Strategy

Focused (per slice, `pnpm --filter <pkg> exec vitest run <files>` — exec direct, never `test --`):

1. Slice 1: `packages/core/src/__tests__/official-cli-v13-fixtures.ts` identity lane + all
   `official-cli-v13-*.test.ts`.
2. Slice 2: `cli-contracts/workflow.test.ts` (apply cases), `opsx-types.test.ts`,
   `opsx-kernel-cli-projection.test.ts`, web `apply-progress-notice.test.tsx` + `change-view.test.tsx`.
3. Slice 3: `agent-delivery-registry.test.ts`, `agent-delivery-projection-service.test.ts`,
   `agent-integrations-router.test.ts`.
4. Slice 4: `opsx-types.test.ts` recognition cases; kernel dependency-watch tests if any assert literal
   vs glob watching.
5. `pnpm --filter @openspecui/core exec tsc --noEmit` after each core-touching slice.

Broad (integrator, serial): `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
`pnpm test:browser:ci` before PR; headers audited on every changed TS/TSX file; agent-run vision
walkthrough with ego-browser prepares the Owner's final browser walkthrough (boundary unchanged).
