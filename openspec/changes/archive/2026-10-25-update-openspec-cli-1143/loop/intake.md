<!--
Orthogonal intents (created 2026-10-24 Asia/Shanghai):
1. Record the two-step upstream decision (1.14.3 patch now; 1.15.0 as a separate line decision).

Original request (2026-10-24): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.3 patch intake

## Objective Scope

Rotate the v14 line to CLI 1.14.3 inside the unchanged window (evidence:
`references/openspec-1.14.3-report.md`, pin `v1.14.3` @ `c794978f`). Triage: pure pin rotation —
braces removed upstream (our mirrors unaffected), glob containment + symlink acceptance +
zero-width-TTY fix all CLI-side, `src/index.ts`/`agent-contract.md` unchanged.

**Upstream also released v1.15.0** (new minor breaking `<1.15.0`: `update --dry-run`,
standalone-binary distribution, ora lazy-load perf). Per the one-line-per-series cadence that is a
separate OpenSpecUI 15 line decision — deliberately NOT bundled here. Assessed after this ships.

## Non-Goals

- No window/series change; no mirror of CLI-side containment or template text.
- No 1.15.0 work in this change.

## Owner-default decisions (vetoable in review)

1. In-window patch rotation, OpenSpecUI 14.x patch release, per the upstream-rotation skill flow
   (first run of `.agents/skills/upstream-rotation/` since its PR #307).
2. Single pinned fixture: `openspec-cli-114` -> 1.14.3; `openspec-cli-113` (1.13.2) boundary stays.
3. Whole-repo version-literal audit before freeze (the ten-surface list from 1.14.2 + grep for
   strays); release-period incidents recorded into the archived log (the skill's new P6 obligation).
