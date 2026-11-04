<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Record the objective requirement and the evidence that produced it.
2. Separate what is proven from what is still an open verification item.
3. Fix the scope: settle silent event loss; do not swap the watcher library.

Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
  — use the library's own mechanism instead of a hand-rolled timer per directory.
-->

# Intake — settle silent watcher event loss

## Objective requirement

When a filesystem change happens inside a directory that is already being watched, the reactive
projection SHALL converge to the on-disk truth without requiring an unrelated later change. Today it
does not: if the native event is lost, the cached snapshot stays wrong until some other event in the
same subtree happens to arrive.

## Why this exists (evidence)

Two read-only investigations and one executed probe, all recorded here rather than cited from memory:

1. **Stack inventory.** `@parcel/watcher@2.5.1` (both `@openspecui/core` and `openspecui` declare
   `^2.5.1`). macOS runs FSEvents; Linux inotify (unless Watchman is installed — it is not, on our
   CI and on this machine); Windows `ReadDirectoryChangesW`. There is exactly one production
   `watcher.subscribe` call, in `project-watcher.ts`, and `recursive`/`watchChildren` are our own
   in-process filters, not library options.
2. **Fallback coverage.** `MISSING_PATH_POLL_MS` protects `reactiveReadFile`, `reactiveExists` and
   `reactiveStat`, and only while the cached value is _missing_. `reactiveReadDir` has no fallback at
   all — and `tool-init-state`'s discovery (`existingPaths`) is pure directory-listing membership, so
   the most loss-sensitive consumer is the one with no net.
3. **Failure classes.** Linux `IN_Q_OVERFLOW` is discarded silently by the library (`continue`, no
   error, no rescan) so our reinit path never fires; macOS and Windows do report drops, and we
   already reinit on those. Upstream additionally has an open in-process delivery race
   (parcel-bundler/watcher#265 / #272, fix PR #266 unreviewed) measured at ~1 dropped create per
   6000 — the same class we saw on CI.
4. **Executed probe** (`/tmp/watcher-probe/probe.mjs`, macOS/FSEvents):

   | step                      | observation                                                            |
   | ------------------------- | ---------------------------------------------------------------------- |
   | create while subscribed   | event delivered, diff reports `create:a.txt`                           |
   | watcher dead, then create | **diff reports `[]`** — the query path is not independent ground truth |
   | re-subscribe, then diff   | `create:b.txt` — **the re-crawl recovers it**                          |

   So `writeSnapshot`/`getEventsSince` is a _detector entangled with subscription state_, while
   "re-arm the subscription, then re-read" is the recovery primitive. Our `refresh()` reads the
   disk directly (never the library's in-memory tree), which is why re-reading after re-arm is sound.

## Scope

- Settle silent loss for long-lived (retained) projections: re-read after every (re)arm, one fresh
  read at subscription start, and a pooled low-frequency reconciliation with escalation.
- Keep the missing-path fallback as-is.

## Non-goals (explicitly not this change)

- Switching libraries (chokidar polling), adding Watchman, or changing the native backend.
- Waiting for upstream #265/#266. The reconciliation layer is needed regardless: Linux overflow is
  silent today and would stay silent even with the race fixed.
- Changing what `tool-init-state` projects, or the UI.

## Owner-visible decisions this change carries

1. Amending the "observation fanout is bounded by physical inventory" law's _letter_ only if needed:
   the design below starts its timer with the first retained subscription, so the existing
   one-shot-projection assertion (`setInterval` count `0`) is preserved rather than relaxed.
2. A pooled reconciliation timer exists at all (cost model: one `unref`'d interval per process,
   not per root, directory, or path).
