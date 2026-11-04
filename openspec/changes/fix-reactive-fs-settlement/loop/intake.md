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
   already reinit on those. Upstream separately has an open in-process delivery race
   (parcel-bundler/watcher#265 / #272, fix PR #266 unreviewed): #265's reporter measured one dropped
   create per 6000 on Linux arm64 stock binaries, while #272 reports 1–2% locally and roughly a
   quarter of CI tasks. Our own CI symptom is the same shape but has not been reproduced locally or
   instrumented, so this change does not claim it is the same defect — only that no mechanism
   currently covers either.
4. **Executed probe** (`/tmp/watcher-probe/probe.mjs`, macOS/FSEvents):

   | step                      | observation                                                            |
   | ------------------------- | ---------------------------------------------------------------------- |
   | create while subscribed   | event delivered, diff reports `create:a.txt`                           |
   | watcher dead, then create | **diff reports `[]`** — the query path is not independent ground truth |
   | re-subscribe, then diff   | `create:b.txt` — the diff becomes useful again                         |

   Recorded as one observed sequence on one platform, not as a general law: macOS replay throws on
   failure rather than returning `[]`, so the more likely reading is that the baseline was simply
   written after the loss. The conclusion the design takes from it is narrow and safe — **a direct
   re-read is ground truth no matter what any query returns** — plus one platform fact: re-arm
   re-crawls the tree on Linux/Windows but on macOS merely starts a new FSEvents stream from now.

## Scope

- Settle silent loss by re-reading from disk: after every (re)arm, at retained-observation start, and on
  a pooled low-frequency cadence while any root lease is held — for reads that are registered and under
  a leased root (that scoping is the honest form of the promise; reads nobody leased are listed as
  outside it).
- Replace the one-shot path's registry-tearing `clearCache` invalidation with settle-then-read, so a
  retained projection in the same process cannot be orphaned.
- Keep the missing-path fallback and the native event path as they are.

## Non-goals (explicitly not this change)

- Switching libraries (chokidar polling), adding Watchman, or changing the native backend.
- Waiting for upstream #265/#266: Linux overflow is silent today and would stay silent even with that
  race fixed, so the net is needed regardless.
- Relying on the library's `writeSnapshot`/`getEventsSince` as a loss detector. Round 1 showed it does
  not serve that purpose, and it drags in baseline lifecycle, ignore alignment, escalation storms and
  upstream query defects. The rejected design is recorded in the plan so it is not re-litigated.
- Turning the probe into a general law about the library. It is one observed sequence; the design stands
  without it.
- Changing what `tool-init-state` projects, or the UI.

## Owner-visible decisions this change carries

1. **The fanout contract is stated in the narrow form that is true.** One pooled settlement interval per
   process — never per read, directory, or root — while the pre-existing per-missing-path polls and
   per-watcher liveness probes stay as they are. `tool-init-state.test.ts`'s zero-timer assertion keeps
   passing today only because its root lease precedes the spy; the test will assert the actual contract
   instead (spy first: exactly one pooled interval, zero per-path polls), and `AGENTS.md` records the
   narrowed sentence rather than a false broad one.
2. **The one-shot freshness mechanism changes** from "delete cache entries by substring prefix" to
   "settle then read". Same freshness, no destruction of another consumer's registrations.
3. A pooled settlement timer exists at all (cost: registered reads under leased roots × 45 s cadence,
   `unref`'d, skipped when idle), and convergence is bounded by that cadence plus jitter and pass
   duration — there is no fast bound.
