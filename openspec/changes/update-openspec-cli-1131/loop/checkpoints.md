<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Define the acceptance checkpoints and their evidence for the 1.13.1 patch rotation.
2. Keep every checkpoint falsifiable against a named command or artifact.
3. Record the Owner-only acceptance boundary.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.1 patch checkpoints

## CP0 — Planning baseline (planning)

- [x] Worktree `openspecui-worktrees/update-openspec-cli-1131`, branch
      `target/openspec-cli-1131-patch` off `main` (`eb2fb118`).
- [x] `references/openspec` submodule pinned `v1.13.1`
      (`634c557bd0470eec37861b46172c3f503d283c1b`).
- [x] `references/openspec-1.13.1-report.md` written with source-diff evidence.
- [x] Change artifacts (specs deltas + loop docs) written.
- [x] Round-A change review (2026-09-17): 6.5/10 REVISE — 3 blockers (B1 kernel-filter/row-source
      mismatch; B2 `[ x]`/`[WIP]` test expectations contradicted the pattern; B3 commit count 40->38).
      All folded into report/intake/research-plan/spec deltas this round. Codex channel was down (local
      proxy 502); super-thinker executed Round-A per the RemixCode fallback; Codex Round-B pending proxy
      recovery.
- [x] Codex Round-B review (2026-09-17, gpt-5.6-terra via herdr, 12m29s): **6.5/10 REVISE** — its
      section-1 "no blockers" applied to factual accuracy only ("未发现证据报告与 pinned 上游源码相冲突
      的事实性论断"); its sections 3-4 kept the plan below freeze standard with four conditions, all now
      resolved: (1) precisely define the namespace filter set — resolved by the Round-B N2 structural
      fold (`entries[].nested` presence + `name`; warnings display-only; both boundary red cases
      specified); (2) spec degradation contradiction ("never appear on any surface" vs "local rows remain
      on CLI loss") — fixed by qualifying the never-appear guarantees with CLI-projection availability
      and naming the degraded namespace-row behavior explicitly; (3) landable data interfaces + red/green
      tests per consumer — carried by the Slice 2 owner list and red-case enumeration (implementation
      in flight); (4) P5 config output-shape claim — corrected after source verification
      (`refuseUnreadableConfig` emits plain stderr + exit 1, no JSON envelope). Also folded: N1 (schema
      family IS `.passthrough()`, verified `workflow.ts:36-53`; its tolerate-then-strip red case
      adopted), N3 (collision/multi-nested red cases), N4 (pin+manifest+lockfile same-commit baseline —
      satisfied by `c0dacb0e`; later slices forbid installs), N5 (decode-regression evidence in Slice 4),
      N6 (read-alignment vs write-normalization split kept explicit in Slice 3).
      Slice 2/3 dispatch proceeded on the conditions being resolved in the same round; Round-C reviews
      the landed implementation against these conditions.

## CP1 — Pin rotation (implementation)

- [x] `packages/core/package.json` alias `openspec-cli-113` -> `@fission-ai/openspec@1.13.1`;
      lockfile regenerated (5-line delta); workspace install clean.
- [x] `PINNED_OPENSPEC_V13_VERSIONS = ['1.13.1']`; fixture identity assertions green against the
      1.13.1 executable across all 9 `official-cli-v13-*.test.ts` (29/29, same count as the recorded
      1.13.0 baseline — executable proof the patch is behavior-compatible with every pinned assertion).
- [x] `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` =
      `634c557bd0470eec37861b46172c3f503d283c1b`; header intent updated; script ran clean and built the
      reference dist.
- [x] `CLAUDE.md` session pointer reads `references/openspec-1.13.1-report.md` (1.13.0 report moved to
      the historical list).
- [x] Red recorded: with the alias bumped and constants stale, all 4 workflow-fixture identity
      assertions failed `expected '1.13.1' to be '1.13.0'`; green after the constants rotation (commit
      `c0dacb0e`).

## CP2 — Change-list nested/warnings (implementation)

- [ ] Contract: `nested?: string[]` on entries; top-level `warnings?` typed (`code: z.string()` per
      Round-A N2); absent-when-empty preserved; `workflow.test.ts` green with new cases.
- [ ] Kernel projection: entries with `nested` excluded from actionable `entries` AND compat `value`;
      `warnings` projected; `planning-cli-projection.test.ts` + `opsx-kernel-cli-projection.test.ts`
      green; red recorded (warnings dropped + nested actionable today).
- [ ] Nested-name set subtraction at every row source (Round-A B1): Changes projection, Dashboard
      summary inputs, search change documents, Store content projection — namespaced directory never
      renders as a change row, CLI task summary, search document, or Store content entry; no second
      divergent derivation.
- [ ] Degradation contract: CLI list unavailable -> local rows remain visible with absent summaries
      (row visibility never CLI-gated); regression test recorded.
- [ ] Web: Changes page amber warnings region, verbatim upstream message, unknown-code fallback, no
      row/no `Tasks 0/0`/no detail link for namespaced directories; TestingLibrary red recorded.
- [ ] Spec deltas applied (`openspec-cli-integration`, `opsx-workflow-ui`).

## CP3 — Task-line reading parity (implementation)

- [x] `task-progress.ts` pattern mirrors the CLI semantics verbatim (markers, ordered, indentation,
      single-token markers incl. padded `[ x]`=done, whitespace-only boxes, link guard, multi-token
      `[WIP]` excluded, CRLF, no `$` anchor); done iff `x`/`X` (`(m[1] ?? '').toLowerCase() === 'x'`).
- [x] `toggleMarkdownTask` operates on widened forms via a prefix/box/tail-grouped pattern, writing
      canonical `[x]`/`[ ]` and preserving indentation, marker, and CRLF bytes (`[\s\S]*` tail).
- [x] New unit cases green (5 red -> green; link-guard case already green as guard); existing
      narrow-syntax cases unchanged; gates: core task/parser 29/29, opsx-types 9/9, server
      tracked-task-mutation 1/1 (Round-A N1).
- [x] Divergence regression covered (`+`-marker document no longer mismatches); upstream-vs-local
      32-line corpus differential run by the implementing agent — marker+description semantics
      identical.
- [x] CLI-progress authority tests stay green (web change-view 23/23).
- Implementation-agent self-caught defect: initial write-back doubled `[` (prefix group already
      contained it) — caught by an existing toggle test, fixed before delivery; recorded as evidence the
      narrow-syntax guard works.

## CP4 — Fixture extension, docs, changeset (implementation)

- [ ] Namespace-folder fixture repository asserts executable `list --json` `warnings` + `nested`.
- [ ] `+`/ordered-marker tasks fixture asserts CLI counts; parity confirmed against local reading.
- [ ] `AGENTS.md` evidence-map pin line updated to 1.13.1 (`634c557`); README verified untouched (or
      explicit-runtime-claim audit recorded).
- [ ] `.changeset/*.md` for `openspecui` patch release.

## CP5 — Gates and delivery (implementation)

- [ ] `pnpm --filter @openspecui/core exec tsc --noEmit` green after each core slice.
- [ ] Focused suites per slice green; broad gates `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`,
      `pnpm test:ci`, `pnpm test:browser:ci` green (or scoped subset justified in PR notes).
- [ ] Changed-file header audit complete (every changed TS/TSX file, tests included).
- [ ] Codex implementation review approved; score recorded.
- [ ] PR open from `target/openspec-cli-1131-patch`; Owner walkthrough boundary stated in PR notes.
