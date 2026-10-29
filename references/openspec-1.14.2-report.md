<!--
Orthogonal intents (created 2026-10-16 Asia/Shanghai):
1. Record the verified OpenSpec 1.14.2 patch delta for the OpenSpecUI 14 line.
2. Separate CLI-owned patch behavior from OpenSpecUI projection obligations.
3. Map each observable change to a production owner, regression case, and release gate.

Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.1 -> 1.14.2 patch adaptation report

## Decision

```text
OpenSpecUI 14 (unchanged line)
  adapted / supported      OpenSpec CLI >=1.14.0 <1.15.0
  current / recommended    OpenSpec CLI >=1.14.0 <1.15.0
  rejected                 <1.14.0, prereleases, >=1.15.0, unparseable
  pinned fixture           openspec-cli-114 rotates 1.14.1 -> 1.14.2
```

1.14.2 is an **in-window patch release**: no new command, no new flag, no capability change
(`git diff v1.14.1..v1.14.2 -- src/index.ts` is empty; `docs/agent-contract.md` unchanged). The v14
single-series window (`OPENSPEC_CLI_TARGET_SERIES = '1.14'`), capability derivation, the Agent
registry series, and generator staleness therefore **do not move**.

## Evidence baseline

```text
Observed                 2026-10-16 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.14.2
Pinned commit            f80d860fc510ba4f51180c8ddde35b91b32de657
Previous pin             v1.14.1 / 87c3595ace6a2e22957f39ebe5b74c2f2316e0cb
Upstream delta           21 commits, src +247/-29 across 13 files (plus tests/docs/website)
```

## Patch delta by contract relevance

### P1. Brace-nesting depth guard in artifact outputs (CLI-side security; mirror unaffected)

Commit for #2061 (`src/core/artifact-graph/outputs.ts`): `resolveArtifactOutputs` now calls
`assertBraceNesting` on glob patterns, rejecting nesting deeper than 16 levels before the pattern
reaches the `braces` parser (upstream cites GHSA-vfj7-8cjw-p6xm — `braces` <=3.0.3 has no depth
guard). The guard mirrors the braces parser's literal-handling semantics (`[…]` and quoted runs are
literal, `(` nests like `{`, a closer only closes the innermost same-kind group) and throws with a
bounded (80-char) pattern excerpt.

**OpenSpecUI surface**: `isGlobPattern` and `hasBraceExpansion` are byte-identical in 1.14.2 — the
recognition mirror (core `opsx-types.ts` + the web artifact-output viewer copy) is untouched, and
recognition itself is a single linear scan with no exponential parse, so the advisory's vector does
not apply to our side. The depth rejection happens at the CLI's expansion step, which OpenSpecUI
never performs. **No production change.** Fixture note: a >16-deep pattern now fails `instructions`
with that error text where the harness can cheaply build one (optional positive evidence).

### P2. `.openspec.yaml` `x-` extension keys stop reporting as unknown (message behavior)

Commit for #2063 (`src/utils/change-metadata.ts`): top-level keys matching `/^x-\S+$/` are extension
keys (someone else's tool metadata, OpenAPI-style) and no longer appear in
`listUnknownChangeMetadataKeys`; the unknown-keys message gains the `x-` hint and a corrective line
when a malformed `x-` key (`x-`, `x- foo`, `X-Foo`) is present. Extensions are top-level only.

**OpenSpecUI surface**: the status payload's advisory `warnings` decode as verbatim strings
(`CliWorkflowStatusFieldsSchema.warnings`) and render verbatim — message-agnostic by design.
**No production change.** Fixture evidence: an `x-tracker` key no longer warns; `X-Foo` still does.

### P3. Validator/archives behavior additions inside unchanged shapes (fixture evidence)

- #2054 (`validator.ts` + `parsers/requirement-blocks.ts`): delta text outside requirement blocks
  now emits a WARNING per unapplied-content span ("… is not carried into the main spec by archive.
  Move it into a requirement, or into proposal.md or design.md."). New findings class riding the
  existing `{level, path, line?, message}` shape; the findings surface renders verbatim.
- #2083 (`templates/workflows/verify-change.ts` + `update-change.ts` + skills docs; validator-side
  unapplied-content belongs to #2054): REMOVED requirements are checked against their baseline (a
  REMOVED requirement that already left the baseline stops fabricating a "still implemented"
  critical), and the verify workflow's glob new-file flow is unblocked. Delivered content; no shape
  change.

### P4. CLI-internal robustness and housekeeping (no OpenSpecUI surface)

- #2052 (`file-system.ts`): `assertPathWithinAllowingLinkedLeaf` lets a project keep a managed
  directory (`openspec/changes`, `specs`) symlinked elsewhere (parent still confined, link must
  resolve). CLI-side confinement; OpenSpecUI delegates archive and never reimplements confinement.
- #2086 (explore template scoping), #2064 (completion perf), #2096/#2085 (website/shell-quote
  security overrides), #981 (CI matrix), dependency bumps, docs/community entries: upstream-internal.

## Current owner map

| Surface | Primary production owner | v1.14.2 obligation |
| --- | --- | --- |
| pinned fixture | `packages/core/package.json` (`openspec-cli-114` alias), `packages/core/src/__tests__/official-cli-v14-fixtures.ts` | rotate alias + `PINNED_OPENSPEC_V14_VERSIONS`/bins to 1.14.2; regenerate lockfile; re-run matrix |
| live pin guards | `scripts/prepare-openspec-reference.mjs`, `packages/core/src/upstream-contract-regression.test.ts`, `packages/server/src/root-context-cold-start.integration.test.ts`, `packages/web/scripts/w2-project-binding-playwright.ts` | rotate every live commit constant (and version literals — audit ALL version literals, not only the previous one) to 1.14.2 / `f80d860f…` |
| artifact-glob mirror | `packages/core/src/opsx-types.ts`, web artifact-output viewer | none (upstream recognition unchanged; depth guard lives in CLI expansion) |
| status warnings | `packages/core/src/cli-contracts/workflow.ts` decode + web render | none (verbatim string evidence) |
| validate findings | decode + `validation-findings-evidence.tsx` | none (shape-compatible); fixture expectations updated only where 1.14.2 texts fire |
| compat window | `packages/core/src/openspec-compat.ts` | none (`>=1.14.0 <1.15.0` already admits 1.14.2) |
| evidence docs | this report, `CLAUDE.md` session pointer, `AGENTS.md` pin line | record the new pin |

## Release gate

- Focused: v14 fixture matrix green against the 1.14.2 executable; pin guards green; core/web
  typecheck.
- `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`
  (or the scoped subset justified in PR notes).
- Changeset for an `openspecui` 14.x patch release; README audit for explicit `1.14.1` runtime
  claims (expected none — range-scoped tables).
- Vision-subagent ego-browser walkthrough prepares the Owner's final browser walkthrough
  (2026-07-20 boundary unchanged).
