<!--
Orthogonal intents (created 2026-11-07 Asia/Shanghai):
1. Record the in-window patch rotation v1.16.0 → v1.16.1 with measured numbers.
2. Classify every upstream change against a local owner (or state that it has none).
3. Separate what changes for OpenSpecUI from what stays CLI-internal.

Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

# OpenSpec CLI 1.16.1 — rotation evidence

## Decision

**In-window patch rotation** for the unchanged `>=1.16.0 <1.17.0` v16 window. No new command, flag,
contract, or Agent-delivery surface: `src/index.ts` (command surface), `docs/agent-contract.md`
(contract surface), `src/core/profiles.ts`, `src/core/command-generation/` and the tool inventory are
all **zero-diff** (`git diff --quiet` per path). Therefore this line carries **no production projection
change**; it rotates the pinned identity and adds executable proofs for the three behavior changes that
did land.

## Evidence baseline

| Fact                   | Value                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tag                    | `v1.16.1`                                                                                                                                                    |
| Commit                 | `0fa4a9705c20ef1c571fe3ded74435733e4b73a1`                                                                                                                   |
| Previous pin           | `v1.16.0` (`27c05157`)                                                                                                                                       |
| Commits in range       | **8** (`git rev-list --count v1.16.0..v1.16.1`)                                                                                                              |
| Whole diff             | 25 files, +1332/−372                                                                                                                                         |
| `src/` diff            | **9 files, +205/−71**                                                                                                                                        |
| Upstream tests touched | `unrecognized-delta-section`, `archive`, `closed-requirement-heading`, `closed-section-heading`, `markdown-parser`, `orphaned-requirements`, `version-check` |

## Classification

### P1 — must adapt (identity and pins)

| Upstream                                  | Local owner                                                                                                              | Action                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Release commit `Version Packages (#2212)` | `packages/core/package.json` alias `openspec-cli-116`                                                                    | rotate to `npm:@fission-ai/openspec@1.16.1`                                          |
| same                                      | `packages/core/src/__tests__/official-cli-v16-fixtures.ts` (`PINNED_OPENSPEC_V16_VERSIONS`)                              | `['1.16.1']`                                                                         |
| same                                      | `packages/core/src/tool-init-state.ts` (`PINNED_AGENT_GENERATOR_VERSION`)                                                | `'1.16.1'` (series-aware staleness baseline rotates per patch, as 1.13.2/1.14.2 did) |
| same                                      | 14 `official-cli-v16-*.test.ts` files, `root-context-cold-start.integration.test.ts`, `w2-project-binding-playwright.ts` | rotate literal `1.16.0` → `1.16.1`                                                   |
| same                                      | `packages/core/src/upstream-contract-regression.test.ts`                                                                 | `EXPECTED_COMMIT` → `0fa4a970…`                                                      |
| same                                      | `AGENTS.md` live-pin line + a new dated decision line; `openspec/specs/{opsx-workflow-ui,opsx-config-center}` pins       | rotate the stated baseline to 1.16.1                                                 |
| same                                      | `references/openspec` gitlink                                                                                            | pin `v1.16.1`                                                                        |

`scripts/check-openspec-reference.mjs` needs **no** change: its `v1.16.*` describe pattern already
admits 1.16.1 (and still rejects `v1.16.0-19-g…` style post-tag checkouts). `README.md`/`README-zh.md`
need no change: the supported window is unchanged.

### P2 — must adapt (CLI verdict changed, so it must be proven)

`fix(validate): reject unrecognized requirement sections in delta specs (#2207)` escalates one existing
finding from WARNING to **ERROR**, and `fix` accompanying `src/core/specs-apply.ts` makes **archive
refuse** the same shape (`#2195`). The finding shape is untouched (`{level, path, line, message}`), so
the typed decode is unaffected — `CliValidateReportSchema` already types `level` as an open enum and the
UI renders it verbatim. The obligation is therefore _executable proof_, not projection work:

- an orphaned requirement under an unrecognized `## … Requirements` header (`## Add Requirements`,
  `## DEPRECATED Requirements`, `## Requirements`) is an **ERROR** in `validate` and makes `archive` fail;
- the same orphan under prose (`## Notes`) stays a **WARNING**;
- our own repository stays clean under 1.16.1 — measured, not assumed: `validate --specs` and
  `validate --all` on this worktree both report **20 passed / 0 failed** with the v1.16.1 binary.

### P3 — parity (CLI-internal, delegated)

`fix(parser): accept closing # runs on section headings (#2205)` normalizes ATX closing runs
(`### Requirement: Foo ###` → `Foo`) and accepts `## Requirements ##`, and masks HTML comments so a
commented-out draft is not reported as an orphan. OpenSpecUI delegates parsing, validation and archive
merging to the CLI and re-implements none of it, so there is no local owner. A useful side effect: our
delta specs all open with an HTML comment block, which is now masked rather than parsed as content.

### P5 — no surface here

`fix(version): run an explicit --check even when telemetry is off (#2204)` and `fix(version): only offer
standalone updates that have been released (#2206)` change `version --check`, which OpenSpecUI does not
consume (deferred since the v14 line). `fix(deps): force minimatch >=11.0.1 (#2192)`,
`chore(deps): consolidate root bumps (#2194)` and `chore(deps): website dependency group (#2189)` are
inside the CLI package and the upstream website.

### P6 — non-obligations

`flake.nix`, `docs-lab/reference/cli.md`, upstream's own `openspec/specs/cli-version/spec.md`.

## Owner map (for review)

| Upstream surface                      | Local production owner                                                           | Touched this rotation?         |
| ------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------ |
| `version`/`update`/`install` commands | —                                                                                | no (unconsumed)                |
| `validate` report shape               | `packages/core/src/cli-contracts/workflow.ts`                                    | no (shape unchanged)           |
| `validate` finding severity           | `packages/web/src/components/validation-findings-evidence.tsx` (renders `level`) | no (renders verbatim)          |
| `archive` merge algorithm             | delegated to CLI                                                                 | no                             |
| spec/change parsers                   | delegated to CLI                                                                 | no                             |
| Agent registry (tools, command paths) | `packages/core/src/agent-delivery-registry.ts`                                   | no (`AI_TOOLS` byte-identical) |
| generator staleness baseline          | `packages/core/src/tool-init-state.ts`                                           | **yes** (constant)             |

## Release gate

Patch release (`16.1.x` line). Four independent facts required: main head, remote tags, GitHub Release,
per-package npm; plus the submodule gitlink unchanged by the version commit. No Owner visual acceptance
is needed: this rotation ships no UI surface.
