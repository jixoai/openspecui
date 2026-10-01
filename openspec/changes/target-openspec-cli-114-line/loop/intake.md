<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Preserve the original request and version-line decision for OpenSpecUI 14.
2. Record Owner-default decisions, each vetoable in review.
3. State the planning-plus-delivery boundary for implementation agents.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 intake

## Objective Scope

Ship OpenSpecUI 14 for OpenSpec CLI 1.14.x: pinned reference `v1.14.0` (`94ca9c1e`), evidence report, v14
admission window, typed contracts for the six moved JSON surfaces (version command, apply task source
locations, the new list `archived` member — nested/list-warnings are 1.13.1 regression items that only
migrate fixtures, status warnings, show spec requirement/scenario names, store edit roots), the ten-entry Agent registry
rotation (shared `.agents` root now also `amp`/`gsd`; Kilo commands → `.kilo/command/`; IBM Bob label),
generator staleness to 1.14.0, the full pinned fixture matrix with the just-retired 1.13.2 executable as the boundary negative, and README /
AGENTS / Changeset major preparation.

## Owner-default decisions (vetoable in review)

1. **OpenSpecUI 14, single-series window `>=1.14.0 <1.15.0`** (new major, not a 13.x widening) — six moved
   JSON contract surfaces plus a ten-entry registry delta exceed any patch-bridge reading; the
   one-line-per-series cadence continues; `1.15` is not pre-claimed. No 1.13 widening debt exists (the v13
   gate already admits all stable 1.13.x, including 1.13.1/1.13.2).
2. **No new capability flags.** Inside the single-series window every admitted CLI carries the new members;
   contracts gain optional typed members instead (this line's new members: list `archived?`, status
   `warnings?`, task `sourcePath?`/`line?`, show spec `name?`; `nested?`/list-`warnings?` are 1.13.1
   members whose fixtures merely migrate), mirroring the v13 missingPrerequisites/warnings precedent.
3. **Archive list keeps the reactive-filesystem adapter as its projection owner this line.** Switching the
   archive inventory to `list --archived` is an architectural follow-up (reactive-model change), explicitly
   out of scope; the typed list contract still carries the new members so CLI evidence is never lossy.
4. **No UI integration for `openspec version --check` this line** — typed contract only; update UX is a
   product decision.
5. **Status `warnings` render on the direct plane following the v13 summary-row law** (one collapsible
   summary row, verbatim expansion, CLI attribution) — advisory, never a gate.
6. **Fixture rotation:** `openspec-cli-114` positive line; the **just-retired 1.13.2 executable
   (`openspec-cli-113` alias) becomes the below-admitted boundary line** proving the v14 gate rejects the
   series it revoked (Round-A B4: a two-generations-old 1.12.0 proves only that "an old version is
   rejected", not the v13 boundary). The boundary asserts `--version` = 1.13.2 identity, the unsupported
   classification, and that the **1.14-only members** (task `sourcePath`/`line`, list `archived`, show
   names, status `warnings`) are absent from 1.13.2 output — it never claims v13-era members are absent.
   The v12 boundary suite and the v12 fixture helper retire; the `openspec-cli-112` npm alias STAYS
   installed (Round-B B2: `tool-init-state.test.ts` and `agent-command-content.test.ts` consume it as
   historical generator evidence). Compat unit tests still cover 1.13.0/1.13.2 rejection and 1.14.0
   acceptance directly.

## Constraints

- CLI-first: no UI-side replication of upstream validate/parser/archive fixes (fixture-scoped only).
- Focused gates per package (`pnpm --filter <pkg> exec vitest run <file>`); the recursive `test:ci` aborts at
  the first failing package and is not evidence of later packages.
- Header law on every touched TS/TSX file (original request dated 2026-10-02).
- GitHub issues handled after delivery with objective links only.

## Delivery steps

Worktree → report → change → Codex review rounds → subagent batches (A: window/contracts/registry; B:
projection/web/fixtures/alignment) → full gates → PR → CI → merge → issue sweep. Release is a separate Owner
decision, as in v13.
