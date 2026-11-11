<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. Record the objective: follow OpenSpec CLI 1.17.0 as a new admission line.
2. Separate the window/identity rotation from the one behavior change that needs a proof.
3. Fix the scope: no projection work, no decode work, no UI change.

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

# Intake — OpenSpec CLI 1.17.0 (new line)

## What the rotation is

`v1.16.1` (`0fa4a970`) → `v1.17.0` (`579fcac5`), 5 upstream commits, 46 files +7518/−672,
`src/` 14 files +4980/−145. `src/index.ts`, `docs/agent-contract.md`, `src/core/profiles.ts`,
`src/core/command-generation/`, `src/cli/index.ts` and `src/core/config.ts` are **zero-diff**, so the
command surface, the Agent contract, the tool inventory and every consumed JSON envelope are unchanged.

## Admission decision

Admit 1.17 as a **new major line (OpenSpecUI 17)**, window `>=1.17.0 <1.18.0`. The alternative
(`16.x` widening to `>=1.16.0 <1.18.0`) remains a fallback and would be nearly decode-free too; the
cadence (one line per series) and the recorded "1.17 admission is a separately verified decision" law
select the new major.

## What actually changes for users

`openspec update` is reworked to reconcile generated Agent artifacts by release fingerprint: it upgrades
from any release since 0.12 in one run, removes only unedited generated files, keeps and lists edited
ones, never writes outside the project, and prints a command-file deprecation notice (commands go away
in OpenSpec 2.0). OpenSpecUI never writes or deletes Agent artifacts, so this is CLI-owned behavior that
our projections observe only through the already-existing inventory/staleness surfaces.

## Scope boundary

In: window/identity rotation, Agent registry series `'1.17'`, generator baseline, fixture matrix
rotation (`openspec-cli-117` positive, `openspec-cli-116` boundary), one new reconcile fixture, living
spec deltas, READMEs, governance line, changeset.
Out: any decode/projection change (none needed), any UI change, any new capability gate.

## Evidence

`references/openspec-1.17.0-report.md` (classification, owner map, measured probes).
