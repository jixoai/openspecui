<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Convert the verified 1.13.1 patch delta into ordered implementation slices with owners and evidence.
2. Keep every slice red/green case executable against a named fixed point.
3. Record the parallel batch topology and the serial pin-rotation barrier.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.1 patch research plan

Evidence source: `references/openspec-1.13.1-report.md` (pinned `v1.13.1` @ `634c557`). Upstream pattern
references below are verbatim from `references/openspec/src/utils/task-progress.ts` and
`references/openspec/src/core/list.ts` at the pin.

## Research Findings

- The patch adds no command, flag, or capability; the admission window, capability derivation, Agent
  registry series (`'1.13'`), and series-aware staleness already cover 1.13.1. Zero window work.
- The two production-facing obligations are the change-list `nested`/`warnings` contract (P1) and the
  widened task-line reading (P2). Both are additive-optional at the CLI boundary, so nothing breaks at
  decode; the obligations are projection parity and local-parser parity.
- `schema validate` (P3) and findings content (P4) are shape-compatible; the Web already renders
  `valid:true && issues.length>0` amber and level-generic finding chips. Fixture evidence only.

## Decision & Plan

### CP0 — Planning baseline (before slices)

Worktree `openspecui-worktrees/update-openspec-cli-1131` on branch `target/openspec-cli-1131-patch` off
`main` (`eb2fb118`); submodule `references/openspec` pinned `v1.13.1`
(`634c557bd0470eec37861b46172c3f503d283c1b`); evidence report written; change artifacts written; committed
before Codex review. Codex change review gates implementation freeze (Round-A expected; blockers folded
back into slices, Round-B expected to approve).

### Slice 1 — Pin rotation (serial barrier; everything else waits on its install)

Owners (single batch):

- `packages/core/package.json` — `openspec-cli-113` npm alias `@fission-ai/openspec@1.13.0` ->
  `@1.13.1`; regenerate `pnpm-lock.yaml` (workspace install).
- `packages/core/src/__tests__/official-cli-v13-fixtures.ts` — `PINNED_OPENSPEC_V13_VERSIONS =
  ['1.13.1']`; the bins map entry stays `openspec-cli-113`.
- `scripts/prepare-openspec-reference.mjs` — `EXPECTED_COMMIT` -> `634c557bd0470eec37861b46172c3f503d283c1b`;
  header intent line for the 2026-09-17 rotation.
- `CLAUDE.md` — session pointer: read `references/openspec-1.13.1-report.md`; `openspec-1.13.0-report.md`
  joins the historical list.

Red: with the alias bumped but the constants file untouched, the fixture identity assertion
(`--version` must equal `1.13.0`) fails — the honest fixed point is the identity assertion itself, which
is the pin's contract. Green: fixture matrix green against the 1.13.1 executable across all
`official-cli-v13-*.test.ts` files (assertion updates limited to version identity and any 1.13.1-visible
behavioral deltas listed below; no assertion may be relaxed).

Fixture-matrix deltas expected with 1.13.1 (verify, do not assume): task counts on fixtures using `+` or
ordered markers (none expected in current fixtures — their task files use `-`/`*` only; counts must stay
identical); `list --json` gains no fields on fixtures without namespace folders (absent-when-empty stays).

### Slice 2 — Change-list `nested`/`warnings` contract, projection, and surface

Round-A B1 folded: change-row ids come from local directory listings (`adapter.listChanges()` /
`listChangesWithMeta()`), not from the CLI list; the Store content panel decodes `list --json` through a
second independent schema; search indexes the local listing. Filtering CLI `entries` alone therefore
removes task summaries, not rows. Round-B N2 refined the derivation: **the namespace-name set is
structural — the `name` of every CLI entry carrying `nested`; `warnings` are display evidence only and
their message text is never parsed.** An entry with `nested` filters even when `warnings` are absent; a
warning without a structurally-nested matching entry excludes nothing. Every row builder subtracts the
set from its own id source.

Owners (one batch; files disjoint from Slice 3):

- `packages/core/src/cli-contracts/workflow.ts` — `CliChangeListEntrySchema` gains
  `nested: z.array(z.string()).optional()`; `CliChangeListSchema` gains
  `warnings: z.array(CliChangeListWarningSchema).optional()` with
  `{code: z.string(), name: z.string(), nested: z.array(z.string()), message: z.string()}`.
  `code` is `z.string()` (not a literal) because the upstream contract says "Today the only code is
  `nested_change_directory`" — an in-window patch may add codes, and a literal would fail the whole
  decode; the UI treats unknown codes as generic hygiene warnings (Round-A N2). Absent-when-empty is
  preserved (optional, no defaults) per the typed-CLI-contract law. Red case (Round-B N1, adapted — the
  schema family is `.passthrough()`, verified): pre-change `safeParse` on a `nested`-bearing payload
  succeeds and retains the member untyped; the projection drops it; post-change it is modeled and
  projected.
- `packages/core/src/planning-cli-projection.ts` — `opsx-change-list` projection payload gains optional
  `warnings`; `entries` remain the actionable-only change set.
- `packages/core/src/opsx-kernel.ts` (`fetchChangeListProjection`) — exclude entries carrying `nested`
  from `entries` AND from the compat `value` name array (both stay the actionable set); project
  top-level `warnings` through.
- `packages/server/src/planning-root-service.ts` — `readCliChangeListEntriesFor` (or its caller) also
  exposes the structurally-derived namespace-name set alongside the entries Map it already returns.
- `packages/server/src/changes-projection-service.ts` — when building rows from
  `adapter.listChanges()`, subtract the namespace-name set (it already joins CLI entries there);
  degradation: no CLI projection -> today's behavior (row kept, summary absent).
- `packages/server/src/dashboard-summary.ts` — subtract the namespace-name set from its local listing
  before building Active Changes inputs (Kanban inherits via the same inputs).
- `packages/server/src/search-documents.ts` — change-document enumeration must not index namespaced
  directories when the namespace-name set is available (consume the changes projection or accept the set
  via its options); degradation identical.
- `packages/core/src/store-content-projection.ts` (+ server service) — the independent Store content
  `list --json` decode excludes entries carrying `nested` from its projected change list.
- `packages/web/src/routes/change-list.tsx` — amber direct-plane warnings region (known-code label,
  directory name, nested names, upstream message verbatim, generic fallback for unknown codes); no row,
  no `Tasks 0/0`, no detail-route link for namespaced directories.

Red (structural, today): a fixture repository with `changes/area/alpha/` — (a) CLI payload decode keeps
`warnings` but the projection drops it (assert); (b) `area` renders as a normal Changes row from the
local listing (TestingLibrary red); (c) `area` is indexed by search and present in Store content
changes (service-level red); (d) no warnings surface exists. Round-B N3 additions: (e) a namespace
directory whose name collides with a real change name must not leak a `0/0` summary onto the real
change via the entries Map join; (f) a namespace wrapping two or more nested changes stays excluded on
every surface; (g) nested-present-but-warnings-absent still filters (structural derivation); (h)
warnings-present-without-matching-nested-entry excludes nothing (no message-text parsing). Green: all
invert. Degradation red: with the CLI projection unavailable, rows remain (assert the contract is
preserved).

Fixture construction constraint (Round-A N3): the namespace root must not contain a `tasks.md` — the
upstream `list.ts` computes task fields for namespace dirs through the same code path, so 0/0 is the
typical shape, not a guarantee.

Spec deltas: `openspec-cli-integration` ADD `Change List Nested Directory Contract`;
`opsx-workflow-ui` ADD `Change List Hygiene Warning Projection` (surfaces enumerated: change rows,
CLI task summaries, Kanban inputs, change-detail navigation, search documents, Store content
projection).

### Slice 3 — Task-line reading parity

Owners (one batch; files disjoint from Slice 2):

- `packages/core/src/task-progress.ts` — replace `CHECKBOX_TASK_LINE`
  (`/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/`) with the CLI-mirroring pattern
  `/^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/` semantics: every CommonMark
  marker plus ordered `1.`/`1)` (<= 9 digits), leading indentation, single-token markers (`[ ]` `[x]` `[X]`
  `[~]` `[]` `[1]` …), whitespace-only boxes, closing `]` not followed by `(`/`[`, done iff marker
  lowercases to `x`, CRLF-tolerant (no `$` anchor). `toggleMarkdownTask` write-back operates on the widened
  forms and writes canonical `[x]`/`[ ]` while preserving marker/indent/description bytes.
- `packages/core/src/task-progress.test.ts` (or nearest existing test owner) — cases verified against
  the upstream pattern by node execution (Round-A B2 corrections applied): `+ [ ] a` (not-done),
  `1. [ ] a` (not-done), `1) [x] a` (done), `  - [~] a` (indented, not-done), `* [x]done` (done),
  `[ x] a` — padded box captures marker `x`, **done**; `[]` and `[  ]` — whitespace-only, not-done;
  `- [1] a` (single-token marker, not-done — the documented over-count trade); `- [WIP] note` —
  **multi-token marker, never a task** (upstream-accepted residue); `- [doc](./d.md)` excluded;
  CRLF line counted; empty description counted; toggle on `+ [ ] a` -> `+ [x] a`, on `1. [~] a` ->
  `1. [x] a`, done->undone writes `[ ]`.
- Divergence consumers (`createApplyInstructionProgress`) inherit parity: a change whose tasks use `+`
  markers no longer produces a false tracked-task-mismatch badge. Add the regression case at
  `packages/web/src/routes/change-view.test.tsx` or the core-side owner, wherever the divergence
  projection is tested today.

Red (today): the widened lines parse as zero tasks locally while the CLI counts them (unit red on the new
cases); toggle misses `+`/ordered forms. Green: new cases pass; existing narrow-syntax cases unchanged
(`[ xX]` on `-`/`*` lines keep parsing identically — the CLI pattern is a superset); CLI-progress
authority tests stay green (local reading never redefines CLI denominators, per the 2026-08-18 law).

Spec delta: `openspec-cli-integration` ADD `Task Line Reading Parity`.

### Slice 4 — Fixture-matrix extension, docs, changeset (after Slices 1-3)

Owners:

- `packages/core/src/official-cli-v13-workflow-fixtures.test.ts` (or the fittest v13 fixture owner) —
  executable-evidence additions: a namespace-folder fixture repository asserting `list --json` `warnings`
  + `nested` (P1) and a `+`/ordered-marker tasks fixture asserting CLI counts match the parity semantics
  (P2). Findings-content classes (P4) join the validation-findings fixture only where the existing harness
  builds such repositories cheaply; otherwise record them as report-level evidence, not fixture debt.
- Decode-regression evidence (Round-B N5): contract-level tests proving the new error codes and exit
  semantics ride existing generic diagnostics without decode failure — `store_remove_contains_registered_store`
  and `invalid_item` codes survive decode as open strings, non-zero exits preserve structured
  stdout/stderr evidence, and the generic renderer never downgrades an unknown code to a decode failure.
- `openspec/specs/**` deltas applied via this change; `AGENTS.md` evidence-map line for the 1.13.1 pin;
  README untouched (tables already range-scoped) unless review finds an explicit `1.13.0` runtime claim —
  the known mentions are historical narrative and stay.
- `.changeset/*.md` — `openspecui` patch bump note summarizing the rotation, nested/warnings projection,
  and task parity.

## Risks and Mitigations

- **Lockfile churn**: the alias bump rewrites `pnpm-lock.yaml`; install happens once in Slice 1 before any
  parallel batch starts (known monorepo hazard: parallel installs corrupt the store).
- **Over-counting optics**: single-token non-task markers such as `- [1] a` now count as unfinished
  tasks locally and in CLI counts.
  Upstream accepts this as loud-and-correctable; OpenSpecUI mirrors rather than forks the semantics
  (documented in the parity requirement's scenario).
- **Fixture flakiness on version identity**: only the two files in Slice 1 own version strings; every
  other `1.13.0` in tests is contract-decode data and must stay (grep-audit in review).
- **Kanban/dashboard double-filtering**: filtering at the kernel keeps one truth; server tests must assert
  inheritance, not re-filter, to avoid a second divergent copy (projection-single-truth law).

## Verification Strategy

Focused (per slice, `pnpm --filter <pkg> exec vitest run <files>` — exec direct, never `test --`):

1. Slice 1: `packages/core/src/__tests__/official-cli-v13-fixtures.ts` + all
   `official-cli-v13-*.test.ts`.
2. Slice 2: `cli-contracts/workflow.test.ts`, `planning-cli-projection.test.ts`,
   `opsx-kernel-cli-projection.test.ts`, `changes-projection-service.test.ts`,
   `dashboard-summary` owner tests, `change-list` web tests.
3. Slice 3: `task-progress` tests, `parser` shared-parse tests, server `tracked-task-mutation` tests
   (Round-A N1: `parseMarkdownTasks` and `toggleMarkdownTask` are shared-function changes),
   `opsx-types`/divergence tests, `change-view` evidence tests.
4. `pnpm --filter @openspecui/core exec tsc --noEmit` after each core-touching slice.

Broad (integrator): `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
`pnpm test:browser:ci` before PR; headers audited on every changed TS/TSX file; browser walkthrough stays
Owner-only.
