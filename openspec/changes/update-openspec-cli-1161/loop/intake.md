<!--
Orthogonal intents (created 2026-11-07 Asia/Shanghai):
1. Record the objective: follow OpenSpec CLI 1.16.1 inside the unchanged v16 window.
2. Separate the identity rotation from the three behavior changes that must be proven.
3. Fix the scope: no projection work, no library swap, no UI change.

Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

# Intake — OpenSpec CLI 1.16.1 (in-window patch)

## What the rotation is

`v1.16.0` → `v1.16.1`, 8 upstream commits. The command surface and the Agent contract are
**zero-diff** (`src/index.ts`, `docs/agent-contract.md`, `AI_TOOLS`, `command-generation/`), so the
admitted window stays `>=1.16.0 <1.17.0` and OpenSpecUI keeps its v16 line. Evidence and per-change
classification: `references/openspec-1.16.1-report.md`.

## Why it still needs a change rather than a version bump

Three behaviors moved, and two of them change a CLI **verdict** we surface:

1. `validate` escalates one existing finding from WARNING to **ERROR** when an orphaned requirement
   sits under an unrecognized `## … Requirements` header, and `archive` now refuses that shape
   (#2207 / #2195). The finding shape is unchanged, so no decode work — but a project that validated
   yesterday can fail today, and that must be an executable fact rather than a release note.
2. The parser accepts ATX closing `#` runs on section headings and masks HTML comments (#2205).
   CLI-internal; our delta specs' comment headers are now masked instead of parsed as prose.
3. `version --check` internals (#2204, #2206) — not consumed by OpenSpecUI.

## Scope

- Rotate the pinned identity everywhere it is stated: alias, fixture matrix, generator baseline,
  contract-regression commit, spec text, AGENTS live pin, worktree gitlink.
- Add executable proofs for the two verdict changes, including their **absence** on the retained
  1.15.0 boundary alias (the escalation is 1.16.1-only).

## Non-goals

- No projection, decoder, UI, or registry change: the typed validate union already carries `level` as an
  open enum, and the registry's `AI_TOOLS` is byte-identical.
- No window change, no new major, no fixture retirement: `openspec-cli-115` stays the boundary.
- No Owner visual acceptance: this rotation ships no interface.
