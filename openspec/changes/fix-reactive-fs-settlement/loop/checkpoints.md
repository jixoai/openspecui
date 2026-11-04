<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. One falsifiable checkpoint per slice, each tied to a named command or artifact.
2. Keep the "fails today for the intended reason" record explicit for every red test.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
-->

# Checkpoints — fix-reactive-fs-settlement

## CP0 — Evidence baseline

- [ ] Two investigations recorded in the change (stack inventory; mature-pattern survey), each with
      file:line or URL evidence.
- [ ] Probe result recorded, including the negative one (`getEventsSince` returns `[]` while the
      watcher is dead on macOS).
- [ ] Linux half explicitly deferred to CI with the reason (podman VM broken; owner's Docker and
      remote contexts untouched).

## CP1 — Settle after (re)arm

- [ ] `settleRootReads(rootPath)` re-reads every cached read under the root; asserted by spying on the
      underlying `readdir`/`readFile`.
- [ ] Red test: a stale cached read surfaces disk truth after a forced reinitialize, with no new event.
- [ ] A settled root emits nothing when nothing changed (equality guard).

## CP2 — Retained-projection start

- [ ] A retained projection created against an already-stale tree converges without waiting for a
      reconciliation pass.
- [ ] Cost: exactly one settle per subscribe (spy count).

## CP3 — Pooled reconciliation

- [ ] One process-level interval; started with the first retained lease, stopped with the last;
      `unref()` proven (process exits with a live lease and no pending work).
- [ ] Query events are injected into the existing dispatch path (no new downstream concept).
- [ ] Rejection / oversize batch escalates to re-arm + settle instead of being applied.
- [ ] Coarse tier re-arms and settles on schedule; driven by the pass counter in tests rather than by
      waiting the real period; residual window documented with its value.
- [ ] Snapshot files live outside watched roots and are removed on release.
- [ ] Red test: retained projection + closed watchers + created file converges once a pass runs.

## CP4 — Laws and costs preserved

- [ ] `tool-init-state`'s zero-timer fanout assertion still passes **unchanged**.
- [ ] A pass with no cached reads does no filesystem reads (spy assertion).
- [ ] Disposal test proves the timer and snapshot files are released.

## CP5 — Delivery

- [ ] Spec delta for `reactive-file-system` states the settlement requirement and its scenarios.
- [ ] AGENTS decision line; changeset for `@openspecui/core` and `@openspecui/server`.
- [ ] Full local gates, independent review folded, PR green (Linux gate carries the S5.3 proof).
- [ ] Archive, release, and residue audit per the repository workflow.
