<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Keep implementation reality synchronized with the approved 1.13.1 patch plan.
2. Record scope updates, key decisions, and loopback triggers per slice.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.1 patch implementation log

## Status: planning — Round-A folded, awaiting Codex Round-B (proxy down), implementation not started

| Slice | Scope | Status | Evidence |
| --- | --- | --- | --- |
| CP0 | worktree + pin + report + change artifacts | done | submodule `v1.13.1` @ `634c557`; report + this change |
| CP0-R1 | Round-A review + blocker fold | done | super-thinker 6.5/10 REVISE -> B1/B2/B3 folded (see checkpoints) |
| 1 | fixture alias + identity constants + reference guard + CLAUDE pointer | pending | — |
| 2 | change-list nested/warnings contract + projection + Changes surface | pending | — |
| 3 | task-line reading parity + toggle parity | pending | — |
| 4 | fixture-matrix extension + docs + changeset | pending | — |

## Decisions taken during implementation

- 2026-09-17 Round-A (super-thinker substitute; Codex proxy `BNUI-01deiMac.local:20002` returning 502):
  - B1 folded: kernel `entries`-only filtering cannot remove change rows because row ids come from local
    directory listings (`adapter.listChanges()`/`listChangesWithMeta()`), and Store content + search are
    independent paths. Design changed to: kernel projects `warnings` (single nested-name derivation);
    `entries`/`value` stay actionable-only; Changes/Dashboard/search/Store-content row builders subtract
    the set; degradation keeps today's behavior on CLI loss.
  - B2 folded: `[ x]` is a padded single-token box -> done; `[WIP]` (multi-token) never matches. Test
    expectations corrected after node-verified pattern runs.
  - B3 folded: upstream delta is 38 commits, not 40.
  - N1/N2/N3 adopted: extra focused gates (`parser`, `tracked-task-mutation`); `warnings.code` typed
    `z.string()` (in-window codes may grow; literal would break decode); fixture namespace root must not
    contain `tasks.md`.

## Loopback triggers

- Codex proxy recovery -> submit Round-B review of the folded plan (background watcher armed).
