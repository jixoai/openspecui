# Research Plan — stabilize-windows-ci-gate

Joint analysis session: ZCode (GLM) + Codex (gpt-5.6-terra, xhigh) on 2026-08-19, driven by the
failed-attempt job logs of runs 32179012205 / 32185385304 / 32220283382 / 32255472448 plus
line-level source review. Raw failed-attempt logs archived under `/tmp/openspecui-ci-logs/`.

## Root causes (evidence-backed)

| #   | Family                                                           | Root cause                                                                                                                                                             | Key evidence                                                                                                                                   |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Timed out waiting for worktree server at http://localhost:3100` | Parent probes a preferred port, the child re-scans at bind time, and the manager can register the stale expected URL instead of the worker's actual ready URL          | `worktree-instance-manager.ts:285/640/653/668`, `server.ts:881`; failing jobs 95847559232, 96076187105                                         |
| 2   | Same family — lifecycle leak window                              | Manager registers runtimes only after ready; `close()` iterates ready instances only, so a launching child escapes shutdown and can complete startup after close       | `worktree-instance-manager.ts:668/697`, `index.ts:327`; test at `:476` already skips real worker termination on hosted Windows                 |
| 2b  | Watcher topology leak                                            | `enableWatcher:false` is not part of the worker contract, so handoff children start watchers by default                                                                | `worktree-server-worker.ts:29`, `index.ts:350`, `server.ts:444`                                                                                |
| 3   | Supervisor timeouts (15s/25s)                                    | Root-level scripts tests execute concurrent WMI full-process-table reads and tree kills with no vitest isolation; job wall-clock 25.7s vs ~70.7s accumulated test time | `vitest.root.config.ts`, `scripts/lib/dev-process-supervisor.test.ts:19`, `bun-process-supervisor.test.ts:27`, `core/child-process-tree.ts:43` |
| 4   | Smoke `EBUSY`                                                    | Owned-root deletion after successful daemon stop; single `rm(force)` with no backoff and no lock-holder evidence in logs                                               | `windows-installed-cli-smoke.sh.ts:109`; job 95969399157 line `EBUSY ... rm '...\Temp\openspecui-windows-installed-smoke-BR4gGs'`              |
| 5   | Chronic teardown artifact                                        | Every hosted Windows run (passing included) ends with a swallowed `Worker exited unexpectedly` unhandled error                                                         | `vitest.config.ts` `dangerouslyIgnoreUnhandledErrors: true`; jobs 95847559232/96076187105 attempt-2 logs                                       |

## Fix design (file-level)

1. `packages/cli/src/worktree-instance-manager.ts` — launching→ready→closing→closed runtime
   registry. Runtimes register at creation; `close()` seals admission first, then awaits every
   launching+ready runtime; no ready write-back after close; single launch per slot.
2. `packages/cli/src/worktree-server-worker.ts` + `packages/cli/src/index.ts` — carry
   `enableWatcher` through the worker contract; emit bootstrap-entered / server-started / ready /
   error / closing / closed lifecycle diagnostics.
3. `packages/server/src/server.ts` + manager — the bind owner selects and returns the actual bound
   address; the manager registers the worker's ready URL only (kills the double-scan race) while
   keeping the 3100+ predictable range contract.
4. Startup diagnostics — structured one-line stage records (runtime id, transport, watcher flag,
   candidate/final port, phase timings, probe count, last probe error, worker error/exit, close
   outcome); no credentials; the 15s readiness budget stays unchanged until measured.
5. `vitest.root.config.ts` — dedicated Windows process-topology project
   (`dev-process-supervisor`, `bun-process-supervisor`, `diagnose-cli-runner`) with
   `fileParallelism:false`, `maxWorkers:1`; no vitest retry.
6. `packages/core/src/child-process-tree.ts` — serialize Win32_Process snapshot reads behind one
   in-flight guard per process so concurrent tests cannot stampede WMI.
7. `scripts/windows-installed-cli-smoke.sh.ts` — after daemon stop, log daemon identity, PID
   clearance, and tree-exit evidence; bounded EBUSY/EACCES/EPERM delete backoff reusing the
   existing platform retry constants; on exhaustion print root + ownership + lifecycle report.
8. `packages/server/vitest.config.ts` — remove `dangerouslyIgnoreUnhandledErrors` so teardown
   failures fail loudly with the new structured logs.
9. Tests — red case: `close()` before ready must shut the pending runtime down and reject late
   ready write-back; green case: two worktrees publish distinct actual endpoints and both close;
   product-chain test asserts the actual endpoint and final runtime zero.

## Verification plan

- Focused local lanes: CLI worktree manager tests, server product-chain test, scripts supervisor
  tests, root config project isolation, plus `format:check` / `lint:ci` / `typecheck`.
- CI: the four historical families must not reproduce; the swallowed teardown artifact must be
  gone (or fail loudly with structured evidence).
- Codex diff review with a 0-10 score and iteration until stable.
