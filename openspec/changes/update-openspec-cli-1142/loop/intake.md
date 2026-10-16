<!--
Orthogonal intents (created 2026-10-16 Asia/Shanghai):
1. Preserve the original request and the in-window patch-rotation decision for the OpenSpecUI 14 line.
2. Record Owner-default decisions, each vetoable in review.

Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.2 patch intake

## Objective Scope

Rotate the OpenSpecUI 14 line to OpenSpec CLI 1.14.2 **inside the unchanged `>=1.14.0 <1.15.0`
single-series window**. Evidence: `references/openspec-1.14.2-report.md` (pin `v1.14.2` @
`f80d860f`). Triaged surface: pure pin rotation — no command/flag/capability change, recognition
mirror untouched upstream, status warnings decode verbatim, validation additions shape-compatible.

```text
P1  brace depth guard (CLI expansion side)   -> report note + optional fixture case
P2  x- extension keys (message behavior)     -> fixture evidence only
P3  validator/archive additions              -> fixture evidence only
P4  CLI-internal robustness                  -> none
```

## Non-Goals

- No window/series/capability change (`src/index.ts` and `docs/agent-contract.md` byte-identical).
- No mirror of the brace-nesting guard: OpenSpecUI never expands artifact globs; recognition is a
  linear scan with no parser backtracking (the GHSA vector does not apply).
- No new fixture infrastructure beyond the existing v14 matrix harness.

## Owner-default decisions (vetoable in review)

1. **In-window patch rotation, OpenSpecUI 14.x patch release** via changesets; window constants,
   registry series, staleness baseline unchanged.
2. **Single pinned positive fixture**: `openspec-cli-114` alias rotates to 1.14.2; the retained
   `openspec-cli-113` (1.13.2) boundary negative stays as-is.
3. **Version-literal audit scope**: grep ALL version literals (`1.14.1`, `1.14.0`, `1.13.2`…) in
   guarded files rather than only the previous version — the 1.13.2 rotation's W2 lesson.
