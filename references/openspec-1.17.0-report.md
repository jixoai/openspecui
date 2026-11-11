<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. Record the v1.16.1 → v1.17.0 rotation with measured numbers and an explicit admission decision.
2. Classify every upstream change against a local owner (or state that it has none).
3. Separate what changes for OpenSpecUI from what stays CLI-internal, and name the boundary discriminator.

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

# OpenSpec CLI 1.17.0 — rotation evidence

## Decision

**New minor line admitted as a new major: OpenSpecUI 17**, window `>=1.17.0 <1.18.0`. `1.16.x` (and
everything below) becomes below-admitted; `1.18` is not pre-claimed.

Why a new major rather than a `16.x` widening to `>=1.16.0 <1.18.0`:

- the repo's cadence is one line per series (11/12/13/14/15/16 all opened as new majors);
- the v16 decision recorded 1.17 as "not pre-claimed — admission is a separately verified decision",
  so this is that decision, and it is backed by the probes below;
- the `update`/`init` behavior change is user-visible even though no JSON contract moved.

The widening remains a defensible fallback: **zero decode work is required either way**, because the
command surface, the Agent contract, the tool inventory, and every JSON envelope we consume are
unchanged (evidence below).

## Evidence baseline

| Fact                   | Value                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Tag                    | `v1.17.0`                                                                                      |
| Commit                 | `579fcac57ae00c2dff38f971b6d88b6f1f098b8a`                                                     |
| Previous pin           | `v1.16.1` (`0fa4a970`)                                                                         |
| Commits in range       | **5** (`git rev-list --count v1.16.1..v1.17.0`)                                                |
| Whole diff             | 46 files, +7518/−672                                                                           |
| `src/` diff            | **14 files, +4980/−145**                                                                       |
| Zero-diff surfaces     | `src/index.ts`, `docs/agent-contract.md`, `src/core/profiles.ts`, `src/core/command-generation/`, `src/cli/index.ts`, `src/core/config.ts` |
| New internal modules   | `released-output-sweep.ts`, `shared/command-reconcile.ts`, `shared/generated-fingerprint.ts`, `shared/released-generated-fingerprints.ts` (4,010 lines of release fingerprints) |

## Classification

### P1 — must adapt (window, identity, fixtures)

| Upstream                          | Local owner                                                                 | Action                                          |
| --------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Release commit `Version Packages` | `packages/core/package.json` alias `openspec-cli-117`                        | add `npm:@fission-ai/openspec@1.17.0`            |
| same                              | `packages/core/src/openspec-compat.ts`                                       | window `>=1.17.0 <1.18.0`, series `'1.17'`       |
| same                              | `packages/core/src/__tests__/official-cli-v1*-fixtures.ts`                    | new v17 positive helpers; v16 becomes boundary   |
| same                              | `packages/core/src/tool-init-state.ts` (`PINNED_AGENT_GENERATOR_VERSION`)     | `'1.17.0'`                                      |
| same                              | `upstream-contract-regression.test.ts`, `scripts/prepare-openspec-reference.mjs` | `EXPECTED_COMMIT` → `579fcac5…`              |
| same                              | `references/openspec` gitlink                                                 | pin `v1.17.0`                                  |
| same                              | `AGENTS.md`, READMEs, living specs                                            | rotate the stated baseline to 1.17              |

### P2 — must adapt (Agent registry series)

`src/core/command-generation/`, `src/cli/index.ts`, and `AI_TOOLS` are **zero-diff**, so no tool is
added or removed. The registry therefore rotates its series to `'1.17'` with every physical fact
carried forward and `'1.16'` joining the provenance union. `tool-detection.ts` changed (+34/−?), but the
upstream tool inventory did not: the change is detection robustness, not a new tool.

### P3 — behavior change, proven by fixture (no projection change)

`feat(update): upgrade safely from any release, and warn that commands go away in 2.0 (#2213)`:

1. **Skills-switch cleanup is fingerprint-aware.** Measured on the real binaries: with a project
   initialized as `--tools=claude` and `.claude/commands/opsx/apply.md` locally edited, then
   `openspec config set delivery skills` + `openspec update`:
   - 1.16.1 → `Removed: 6 command files`; the edited file is **deleted** (`commands left: []`);
   - 1.17.0 → `Removed: 5 command files`, then `Kept 1 command file that does not match what OpenSpec
     generated (likely edited): .claude/commands/opsx/apply.md`; the file **remains**.
2. **Command files are deprecated** (console only, every `update` while delivery includes commands):
   `Command files are deprecated and go away in OpenSpec 2.0…` — absent on 1.16.1.
3. **Cross-release upgrade sweep**: `update` removes unedited generated files left by any release since
   0.12 without `--force`, keeps edited ones, and never writes outside the project.

Item 1 is the boundary discriminator (filesystem-observable on a fresh fixture); item 2 is a stable
stdout assertion. Item 3 is exercised by the same reconcile path and is covered by item 1's evidence
shape (plan rows + kept-file reporting).

### P4 — parity (verified by probe, no local owner)

Probed both binaries side by side on clean and edited projects:

- `update --dry-run --json` → identical `{changes, notes, failures}` and identical
  `add|update|delete` actions / note enums;
- `config list --json`, `list --json`, `validate --all --json`, `doctor --json`, `context --json` →
  byte-identical shapes (modulo the scratch root path);
- `init --tools=claude` → identical artifact tree (6 skills under `.claude/skills/`, 6 command files
  under `.claude/commands/opsx/`);
- `init`/`update` human output differs only by the deprecation notice above.

The new fingerprint/command-reconcile modules are CLI-internal: OpenSpecUI never writes, deletes, or
fingerprints Agent artifacts, and the projection observes paths this line did not move.

### P5 — no surface here

`fix(install): detect the CPU when Windows PowerShell reports none (#2222)` is install/standalone-only
and not observable on macOS; the dependency bumps (`#2219`, `#2221`) and upstream website changes have
no local consumer.

### P6 — non-obligations

`website/` dependency and lockfile churn, upstream docs-lab, flake files.

## Owner map (for review)

| Upstream surface                    | Local production owner                                        | Touched this rotation?              |
| ----------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| command surface (`src/index.ts`)    | —                                                             | no (zero-diff)                      |
| Agent contract (`docs/agent-contract.md`) | —                                                       | no (zero-diff)                      |
| tool inventory (`AI_TOOLS`, `command-generation/`) | `packages/core/src/agent-delivery-registry.ts` | no (upstream zero-diff; series only) |
| `update --dry-run` JSON plan        | `packages/core/src/cli-contracts/workflow.ts` (`UpdatePlan`)  | no (shape proven identical)         |
| validate/list/doctor/context JSON   | `packages/core/src/cli-contracts/*`                           | no (shape proven identical)         |
| generated artifact layout           | `packages/core/src/tool-init-state.ts` (observation only)      | **yes** (generator baseline)        |
| compat window                       | `packages/core/src/openspec-compat.ts`                        | **yes** (window + series)           |

## Release gate

Major release (`17.0.0`). Four independent facts required: main head, remote tags, GitHub Release,
per-package npm; plus the submodule gitlink unchanged by the version commit. No Owner visual acceptance
is needed: no UI surface changes.

## Diff note — expected lockfile churn

Adding one npm alias rewrites `pnpm-lock.yaml` (pnpm 10.22.0's expanded `resolution` blocks), so the
lockfile diff will be large. Only the `openspec-cli-117` importer/package entries are semantic.
