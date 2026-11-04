---
'@openspecui/core': minor
'@openspecui/server': minor
---

Settle silent watcher event loss instead of waiting for the next unrelated change. A native watcher can drop a create inside an already-watched directory without reporting anything (Linux discards inotify queue overflow silently), which left agent-delivery projections stale indefinitely — the one loss-sensitive consumer, `tool-init-state`, depends only on directory listings and had no fallback.

Every reactive cache registration now records a normalized path at registration (roots are realpath-tracked while keys are `resolve()`-built, and macOS `TMPDIR` lives under a symlink, so a matcher in the wrong space covers zero reads on a developer machine while passing on Linux CI). Settlement re-reads from disk — never trusting the watcher library's loss-query, which returns `[]` while the watcher is dead — at four points: after every arm, at the observation environment's memoized acquire, at one declared Agent-delivery subscriber start, and on a single pooled process-level cadence that exists only while a root lease does (unref'd, jittered per tick, skipped when idle). Passes coordinate per root: requests arriving before a pass reads join it, later requests get exactly one trailing pass, and a per-registration commit version bumped by all four publisher classes keeps a pass from publishing older data.

One-shot reads now settle their inputs and then read, instead of discarding cache registrations by substring prefix — that deletion could orphan a live retained projection in the same process. The missing-path fallback, per-watcher liveness probes, and the native event path are unchanged. The convergence guarantee is scoped to registered reads under leased roots and bounded by the settlement cadence plus jitter and pass duration.
