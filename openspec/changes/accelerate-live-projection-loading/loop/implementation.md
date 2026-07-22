<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Keep implementation reality synchronized with the approved live-projection performance plan.
2. Preserve the boundary between display continuity and mutation authority while performance work is staged.
3. Record worker entry conditions, deliberate non-goals, and loopback triggers for independent slices.

Original request (2026-07-23): "请你深入调查，给出一份持有客观证据的调查报告，并给出“系统性的解决方案”，并将它整理成 openspec change。"
-->

## Implementation State

- Research and controlled baseline measurement are complete. No production runtime or public protocol has
  been changed by this Change.
- Five read-only benchmark files under `packages/server/bench/` capture the current Server, Root Context,
  Dashboard, Changes, and OPSX paths. The evidence report records the pinned CLI, isolated data scope,
  input inventory, commands, phase timings, and limitations.
- The measured problem is a server-side projection critical path, not a browser spinner problem: same-Server
  Dashboard reload is about 8.84s while an already-cached Dashboard snapshot reads in about 0.12ms; OPSX
  Status waits on a full Kernel warmup even though Status does not require its low-priority artifacts.
- The proposed execution order is P1 observation/resource scheduling, P2 Root Context current-snapshot gateway,
  P3 Dashboard regions, P4 Changes batch stream, P5 OPSX demand planning, P6 measured hash/Worker additions,
  then P7 focused regression and owner acceptance. Each phase remains an independently reviewable slice.
- This artifact is planning evidence only. The worker must not claim a phase complete until its checkpoint has
  a checked red case, green case, mutation-resistance proof, and recorded verification evidence.

## Decisions Taken

- Use one Server-owned `Projection Work` protocol instead of route-local caches. A Work identity includes
  projection kind, planning-root identity/source, effective Store selector, owner generation or Git binding
  token where applicable, explicit selector, input fingerprint or invalidation generation, and protocol version.
- Share same-identity in-flight work and replay only a verified snapshot. Every snapshot carries provenance
  and freshness; stale or reconnecting data can remain visible but cannot authorize a mutation.
- Emit real `snapshot`, `stage`, `batch`, `complete`, and `failed` events with monotonic Work generation.
  Retired Root/Store/Git A work cannot publish to, invalidate, or relabel B.
- Treat Root Context currentness as a gateway. Same-generation reads reuse one validated resolution; refresh,
  invalidation, or root retirement creates the next generation and retains the existing action gate.
- Split Dashboard Summary, Git, trends, and workflow facts; stream Changes rows in bounded batches; make OPSX
  Status independent of full Kernel warmup. These are separate ownership and acceptance surfaces, not one
  aggregate loading flag.
- Keep memory caches bounded and invalidated by explicit reactive causes. Content hashing, persistence, and
  Workers remain conditional optimizations: they require measured ROI, non-sensitive revalidation, and bounded
  I/O/CPU resource classes before entering production.
- Preserve the existing Push invalidation -> Pull projection model, typed CLI evidence envelopes, Static-mode
  unavailable contracts, checked test fixtures, and the owner-only final end-to-end browser walkthrough.

## Divergence Notes

- The intake suggested a broad family of optimizations. The measured plan intentionally starts with shared
  projection ownership and demand separation; it does not add persistence, Worker threads, or an App-wide
  cache without evidence that the preceding slice leaves them as the dominant cost.
- Benchmark timings are controlled observations for the current workspace and pinned OpenSpec CLI, not CI
  pass/fail thresholds. Before/after comparison must report phase distributions and event order as well as
  wall-clock values.
- No existing active Change is modified or folded into this performance Change. Any Root, Git, Static, Store,
  or WebSocket contract change discovered during implementation must be recorded as a new scoped decision or
  looped back before code work continues.
- `pnpm exec openspec status --change accelerate-live-projection-loading --json` reports all four declared loop
  artifacts complete and `applyRequires: ["checkpoints"]`. The formal `specs/live-projection-work/spec.md`
  delta is present, so `pnpm exec openspec validate accelerate-live-projection-loading --type change --strict --json`
  passes. This validates the Change artifacts only; it does not claim runtime implementation.
- `pnpm format:check` passes. The explicit TypeScript check over all five benchmark entrypoints reaches the
  production import graph but exits on pre-existing Server diagnostics (`@huggingface/transformers` resolution,
  existing Router/translation contracts, and related source errors); no diagnostic points at a benchmark file.
  The package Server typecheck has the same unrelated failures. This Change does not widen into repairing them.

## Loopback Triggers

- A proposed Work key cannot prove Root/Store/Reference/Git provenance, or a late A event can reach B state,
  cache, progress, or mutation authority.
- A current-snapshot shortcut weakens the Root action gate, hides CLI/transport evidence, or makes stale data
  look current during refresh, reconnect, or error.
- Resource limits cannot be expressed for CLI, filesystem, Git, or Worker work, or a benchmark shows that
  concurrency increases tail latency, starvation, or memory beyond the declared budget.
- OPSX Status still needs full warmup under the pinned CLI, or a lazy leaf loses raw stdout/stderr, exit,
  diagnostics, Store selector, or planning-root provenance.
- A focused red case does not fail at the named production boundary, a mutation-resistance proof is masked by
  an earlier guard, or a fixture relies on `as any`, fabricated non-null state, or transpile-only type evidence.
- Static export, unrelated active Changes, App multi-project orchestration, or final browser acceptance would
  need to be changed to make a phase appear green; stop and obtain a separately scoped decision.
