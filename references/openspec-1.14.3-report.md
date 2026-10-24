<!--
Orthogonal intents (created 2026-10-24 Asia/Shanghai):
1. Record the verified OpenSpec 1.14.3 patch delta for the OpenSpecUI 14 line.
2. Separate CLI-owned patch behavior from OpenSpecUI projection obligations.
3. Record the v1.15.0 two-step decision context (patch now, new line assessed separately).

Original request (2026-10-24): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.2 -> 1.14.3 patch adaptation report

## Decision

```text
OpenSpecUI 14 (unchanged line)
  adapted / supported      OpenSpec CLI >=1.14.0 <1.15.0
  current / recommended    OpenSpec CLI >=1.14.0 <1.15.0
  rejected                 <1.14.0, prereleases, >=1.15.0, unparseable
  pinned fixture           openspec-cli-114 rotates 1.14.2 -> 1.14.3
```

1.14.3 is an **in-window patch release**: `src/index.ts` and `docs/agent-contract.md` are
byte-identical to 1.14.2. The v14 single-series window, capability derivation, Agent registry
series, and generator staleness do not move.

**Two-step context**: upstream also released **v1.15.0** (13 commits, a new minor that breaks the
`<1.15.0` bound: `update --dry-run` + standalone-binary distribution + perf reworks). Per the
one-line-per-series cadence, 1.15 admission is a **separate OpenSpecUI 15 line decision**, not
widened here. This change delivers the 1.14.3 rotation; the 1.15 line is assessed after it ships.

## Evidence baseline

```text
Observed                 2026-10-24 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.14.3
Pinned commit            c794978f4f8845ce59693373c9dd882ee776588c
Previous pin             v1.14.2 / f80d860fc510ba4f51180c8ddde35b91b32de657
Upstream delta           6 commits, src +442/-98 across 15 files (plus tests/docs)
```

## Patch delta by contract relevance

### P1. glob engine swap + guards retained + new expansion budget (mirrors unaffected)

Commit `e33245d2` (#2103): the artifact-glob engine drops `fast-glob` (and transitively `braces`)
for `tinyglobby`. **`assertBraceNesting`/`MAX_BRACE_NESTING=16` survives in 1.14.3** (definition +
call site verified in the pinned outputs.ts), and **1.14.3 adds a second guard**:
`MAX_BRACE_EXPANSIONS=1024` with `assertExpansionBudget` ("Artifact output pattern expands to more
than 1024 patterns"). Our recognition mirrors (`opsx-types.ts` + web viewer copy) consume neither
library and are unchanged upstream-side. `file-system.ts` (1-line) and
`completions/completion-provider.ts` are comment-only changes (library-name strings). **No
production change**; the 1.14.2 brace-depth fixture keeps its exact semantics (16 accepted /
17 rejected with the same message). Optional new evidence: a >1024-expansion pattern fixture.

### P2. Glob containment wiring + delivered-template text (attribution corrected per research review)

The runtime confinement wiring (+132-line `src/utils/spec-path-containment.ts`,
`assertDiscoveredSpecFile` replacing `assertPathWithin` in the validator, and the
specs-apply/spec-discovery/spec/change hooks pinning `verifiedTarget` against link re-pointing
during `beforeMutate`) belongs to **`87a69a2b` (#2101)** — see P3. The delivered-template rewording
(choose the output path before creating, verify containment after symlink resolution, invoke
delegated skills only if they can write the chosen path) belongs to **`276d0150` (#2104)** and
covers `propose`/`ff-change` **plus `continue-change`/`explore`**. All CLI-side; OpenSpecUI mirrors
neither. **No production change.**

### P3. Remaining behavior fixes inside unchanged shapes (fixture evidence at most)

- `87a69a2b` (#2101): a `spec.md` symlink to a file elsewhere in the project is accepted (extends
  the 1.14.2 linked-leaf allowance to the spec file itself).
- `5251f2ef` (#2108): validate's spinner no longer floods a zero-width TTY (`canRenderSpinner()`
  added to the existing `src/utils/interactive.ts`). JSON output untouched.
- `c9a8adef` (#2110): website preview without a server dependency. Upstream-internal.

## Current owner map

| Surface | Primary production owner | v1.14.3 obligation |
| --- | --- | --- |
| pinned fixture | `packages/core/package.json` (`openspec-cli-114` alias), `packages/core/src/__tests__/official-cli-v14-fixtures.ts` | rotate alias + versions/bins to 1.14.3; regenerate lockfile; re-run matrix |
| live pin guards | `scripts/prepare-openspec-reference.mjs`, `packages/core/src/upstream-contract-regression.test.ts`, `packages/server/src/root-context-cold-start.integration.test.ts`, `packages/web/scripts/w2-project-binding-playwright.ts`, `packages/core/src/official-cli-v13-boundary-fixtures.test.ts`, `packages/core/src/opsx-kernel-schemas-root.fixtures.test.ts` | rotate every live commit constant AND version literal (whole-repo audit per the skill; the two files the 1.14.2 Round-A caught stay in the explicit list) |
| artifact-glob mirrors | `packages/core/src/opsx-types.ts`, web artifact-output viewer | none (upstream recognition unchanged; braces dependency removed upstream) |
| docs | `CLAUDE.md` pointer, `AGENTS.md` pin line + clean-build law + new architecture decision | record the new pin |
| release | `.changeset/*.md`, README audit | four-package changeset naming (the fixed group propagates to search/translators — expected per `changeset.config.json`); README audit for explicit `1.14.2` runtime claims |
| verified no-change | `openspec-compat.ts`, status `warnings` (`change-metadata.ts` not in the delta), validate findings texts (`validator.ts` only containment swaps) | none — these three are why the 1.14.2 fixtures stay valid |

## Release gate

- Focused: whole v14 matrix green against the 1.14.3 executable (zero assertion relaxations);
  pin guards green; core/server typecheck.
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`.
- Changeset (four-package patch); README audit.
- Vision-subagent walkthrough per the skill's scale-appropriateness (zero-production-change →
  smoke level); Owner boundary unchanged.
