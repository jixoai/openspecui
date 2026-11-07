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
| same                                      | 16 `official-cli-v16-*.test.ts` files, `root-context-cold-start.integration.test.ts` (version literals **and** its own `PINNED_OPENSPEC_COMMIT`), `w2-project-binding-playwright.ts` | rotate literal `1.16.0` → `1.16.1` / commit `27c05157` → `0fa4a970` |
| same                                      | `packages/core/src/upstream-contract-regression.test.ts`                                                                 | `EXPECTED_COMMIT` → `0fa4a970…`                                                      |
| same                                      | `AGENTS.md` live-pin line + a new dated decision line; `openspec/specs/{opsx-workflow-ui,opsx-config-center}` pins       | rotate the stated baseline to 1.16.1                                                 |
| same                                      | `references/openspec` gitlink                                                                                            | pin `v1.16.1`                                                                        |

`scripts/check-openspec-reference.mjs` needs no **gate** change: it is a series-level guard
(`git describe --tags --match v1.16.*` plus `describe.startsWith('v1.16.')`), so it admits every 1.16.x
tag including 1.16.1 — and, for exactly the same reason, it also admits a post-tag checkout such as
`v1.16.0-19-g…`. Exact-pin truth is owned by the two `EXPECTED_COMMIT` constants
(`scripts/prepare-openspec-reference.mjs` and `packages/core/src/upstream-contract-regression.test.ts`),
which this rotation moves to `0fa4a970`; only that script's prose comment changes. `README.md`/`README-zh.md`
need no change: the supported window is unchanged.

The admission **floor** stays `1.16.0`. `OPENSPEC_CLI_MIN_VERSION`, `OPENSPEC_CLI_TARGET_MIN_VERSION` and
`OPENSPEC_CLI_RECOMMENDED_MIN_VERSION` are window facts (`>=1.16.0 <1.17.0`), not pin facts: raising them
to the newest patch would reject 1.16.0 itself, which is a gate change. No past patch rotation
(1.13.1/1.13.2/1.14.1/1.14.2/1.14.3) touched `openspec-compat.ts`, and this one must not either —
an earlier edit of this branch did, and was reverted in `26528288`.

### P2 — must adapt (CLI verdict changed, so it must be proven)

`fix(validate): reject unrecognized requirement sections in delta specs (#2207)` escalates one existing
finding from WARNING to **ERROR**, and `fix` accompanying `src/core/specs-apply.ts` makes **archive
refuse** the same shape (`#2195`). The finding shape is untouched (`{level, path, line, message}`), so
the typed decode is unaffected — `CliValidateReportSchema` already types `level` as an open enum and the
UI renders it verbatim. The obligation is therefore _executable proof_, not projection work:

- an orphaned requirement under an unrecognized `## … Requirements` header (`## Add Requirements`,
  `## DEPRECATED Requirements`, `## Requirements`) is an **ERROR** in `validate` — so plain validation
  already exits non-zero, not only `--strict` — and makes `archive` fail (measured: exit 1,
  `archive: null`, status code `archive_validation_failed`, `fix` pointing at `validate`; the
  requirement/section detail stays in `validate`, not in the archive envelope);
- the same orphan under prose (`## Notes`) stays a **WARNING** and the change stays valid;
- our own repository stays clean under 1.16.1 — measured, not assumed: `validate --specs` reports
  **20 passed / 0 failed** and `validate --all` **21 passed / 0 failed** with the v1.16.1 binary.

### P3 — parity (CLI-owned, proven rather than adapted)

`fix(parser): accept closing # runs on section headings (#2205)` is scoped to **section** headings
(`## Purpose ##`, `## Requirements ##`, `## ADDED Requirements ##`), which `validate`, `show`, `list`,
`view` and `archive` now read like their unclosed forms. Requirement-name normalization
(`### Requirement: Foo ###` → `Foo`) is **not** new: upstream only extracted the identical regex into
`stripClosingSequence`. The same refactor routes the orphan scan through `maskHtmlComments`, so an
HTML-commented requirement is no longer reported as dropped — that one is a real behavior change
(1.16.0 and 1.15.0 both report the commented draft as an orphan).

No production change is required, and the local mirror is why that sentence is checkable rather than
assumed: `packages/core/src/parser.ts` is a line-based change parser, and its delta-header regex
(`/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/i`) is unanchored, so it already admitted
`## ADDED Requirements ##`; main-spec reads delegate to the remark/mdast projection
(`parseOpenSpecMarkdownToSpec`), where CommonMark strips a closing run. The mirror's requirement-name
capture is the one place that keeps a trailing run, it predates this line, and this rotation changes
neither its regex nor the surface it feeds. A useful side effect of the masking: our delta specs open
with an HTML comment block, so that block is now ignored rather than parsed as content.

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
| spec/change parsers                   | delegated to CLI; local mirror `packages/core/src/parser.ts`                     | no (mirror regexes already admit the closing run) |
| Agent registry (tools, command paths) | `packages/core/src/agent-delivery-registry.ts`                                   | no (`AI_TOOLS` byte-identical) |
| generator staleness baseline          | `packages/core/src/tool-init-state.ts`                                           | **yes** (constant)             |

## Release gate

Patch release (`16.1.x` line). Four independent facts required: main head, remote tags, GitHub Release,
per-package npm; plus the submodule gitlink unchanged by the version commit. No Owner visual acceptance
is needed: this rotation ships no UI surface.

## Diff note — the lockfile is mostly reformatting

`pnpm-lock.yaml` moves 9,446 lines for a two-line semantic change: four keys flip from
`@fission-ai/openspec@1.16.0` to `1.16.1` (the `importers` alias and the package entry), and the rest is
pnpm 10.22.0 expanding main's inline `resolution: {integrity: …}` form into blocks. Semantically it is
only the pin, it is reproduced by the pinned pnpm, and it is called out in the PR notes so the reviewer
does not read it as dependency movement.
