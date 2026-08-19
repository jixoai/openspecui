# Checkpoints

| #   | Check                                                                | Evidence                                                                 | Status  |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| 1   | Worktree registry lifecycle + endpoint truth (red/green cases)       | `close during launch` + `registers bound address` both PASS (CLI 173/184) | pass    |
| 2   | enableWatcher propagation + startup/shutdown diagnostics             | Worker data carries `enableWatcher`; readiness errors embed lifecycle diag | pass    |
| 3   | Root vitest process-topology isolation + WMI in-flight guard         | root tests 70/81 PASS (18 files, 4 skipped — platform skips); `vitest.root.config.ts` projects serialize | pass |
| 4   | Smoke owned-root backoff + lifecycle evidence                        | `removeOwnedTempRoot` retries 6× (EBUSY/EACCES/EPERM) with exponential backoff + ownership/attempt report | pass |
| 5   | Remove dangerouslyIgnoreUnhandledErrors                              | `packages/server/vitest.config.ts` now clean; server 639/641 PASS          | pass    |
| 6   | Local focused lanes green                                            | CLI typecheck + 173 PASS; Core typecheck PASS; server 639 PASS; root 70 PASS; format + lint clean | pass |
| 7   | Codex diff review score stable                                       | pending                                                                  | pending |
| 8   | CI: four families absent on the exact head                           | pending                                                                  | pending |
