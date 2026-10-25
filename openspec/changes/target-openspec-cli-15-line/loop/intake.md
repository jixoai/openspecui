<!--
Orthogonal intents (created 2026-10-25 Asia/Shanghai):
1. Preserve the line decision and Owner-default choices for OpenSpecUI 15.
2. Record the scope of the single hard contract break and the deferred product decisions.

Original request (2026-10-25): "开工" — starting the v1.15.0 → OpenSpecUI 15 line.
-->

# OpenSpecUI 15 intake

## Objective Scope

Ship OpenSpecUI 15 for OpenSpec CLI 1.15.x: pinned reference `v1.15.0` (`8e0288df`), evidence
report (`references/openspec-1.15.0-report.md`), the v15 admission window, the single hard
contract break (`CliVersionSchema.install.scope` gains `'standalone'`), the full pinned fixture
rotation with the just-retired 1.14.3 executable as the boundary negative, pin-guard rotation,
docs/AGENTS/changeset major preparation.

Explicitly recorded: upstream also shipped `update --dry-run`/`--json` (designed for agents and
OpenSpec Desktop) — typed contract + UI preview deferred as a product decision (B1), mirroring the
v14 `version --check` precedent; standalone-aware update display (B2) deferred likewise.

## Owner-default decisions (vetoable in review)

1. **OpenSpecUI 15, single-series window `>=1.15.0 <1.16.0`** (new major). Recorded fallback: a
   widening would be nearly decode-free since 1.14's six JSON contracts are untouched — rejected
   as the default because a new command (`install`), a new flag family (`--dry-run`/`--json`),
   and a distribution-strategy shift exceed patch-bridge reading.
2. **Scope enum gains `'standalone'`** (A2) — the one decode-breaking fact. `update.command`
   stays a free string (no change needed).
3. **Fixture rotation:** `openspec-cli-115` new (1.15.0 positive; 13 test files renamed
   `official-cli-v14-*` → `official-cli-v15-*` with a new helper); `openspec-cli-114` stays
   `1.14.3` and becomes the below-admitted boundary (version unchanged — it is already the last
   1.14 patch); `openspec-cli-113` retires (sole consumer was the old boundary suite);
   `openspec-cli-112`/`111` stay (historical generator-evidence consumers).
4. **Boundary suite asserts:** 1.14.3 identity, v15-gate unsupported classification, and
   1.15-only surfaces absent (`update --dry-run` → unknown option, `install` → unknown command;
   both verified against the real 1.14.3 binary). Never asserts 1.14-era members absent.
5. **CP1 observation order** per the skill: alias+helper first, observe the 1.14.2-era-surviving
   fixtures before touching any assertion literal; identity-guard reds are the plan's own pending
   step, not upstream regressions.
6. **tool-subscription-router.test.ts:684** derives its npm spec from
   `OPENSPEC_CLI_TARGET_SERIES` (the file already claims to track the shared constants).

## Non-Goals

- No dry-run preview (B1), no standalone-aware update display (B2), no feedback entry (B3).
- No mirror of CLI-side containment/template/verify-text changes.
- No widening fallback unless the Owner overrides decision 1.

## Acceptance Boundary

Agents deliver code, fixtures, focused gates, broad gates, and the vision smoke walkthrough; the
Owner performs the final acceptance and release confirmation (2026-07-20 law).
