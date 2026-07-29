<!--
Orthogonal intents (created 2026-07-29 Asia/Shanghai):
1. Track implementation truth against the approved OpenTray daemon plan.
2. Preserve settled owner decisions that constrain code execution.
3. Record approved divergences without rewriting history.
4. Define evidence-based loopback triggers.

Original request (2026-07-29): "立项 6.1.x: 我们要继续打磨 app 模式，我们需要将它适配对接 opentray。"
-->

## Implementation State

```text
Research and owner decisions     complete
Implementation checkpoints       2-5 complete; checkpoint 6 next
Production code                  CLI daemon, leases, local App control complete
Focused automated evidence       complete through bundled App/control boundary
Owner browser/native acceptance  not started
PR delivery                      not started
6.1.x release                    out of this Change
```

- Approved execution source: `loop/research-plan.md`.
- Current branch: `feat/opentray-app-mode`.
- Current implementation boundary: checkpoint 5 is complete at the bundled local App/control transport boundary; OpenTray packages and native presentation have not started.
- The existing user modification in `openspec/config.yaml` is outside this Change and must not be rewritten or included accidentally.
- Each checkpoint must update this file with the exact production owner, focused red/green evidence, changed package surface, verification result, and any accepted residual risk before it can close.
- Full repository gates remain deferred until all focused checkpoint evidence is accepted. Final Browser/PWA and OpenTray native-window walkthrough remains Owner-only.

### Checkpoints 2-5 implementation result (2026-07-29 Asia/Shanghai)

- Production owners: `cli-command.ts` owns yargs planning; `cli-execution.ts` owns foreground Server dispatch; `daemon-controller.ts` and the versioned Unix/named-pipe protocol own daemon lifecycle; `daemon-transport.ts` owns reconnecting `serve` leases; `local-app-server.ts` plus `daemon-workspace-control.ts` own same-origin Push -> Pull projection.
- CLI contract: bare/explicit `serve`, daemon-only `start|stop|restart`, boolean `--app`/`--web`, TTY admission, non-TTY Direct Web, `--no-open`, exact immutable-mode diagnostics, and retired `--app=<url>` are implemented through the production yargs registry and execution port.
- Distribution contract: project `appBaseUrl`, Hosted App URL Settings, and local hosted-App Vite ownership were deleted. `packages/app` now builds and copies into published `openspecui/app`; repository development may resolve local build output without a public shell-location option.
- Runtime contract: one mode-`0600` user IPC endpoint owns the daemon; one `serve` process owns each backend and a reconnecting lease. Daemon stop/restart never adopts or terminates backend children. Workspace ids are daemon-resolved, and Direct Web URLs materialize only at an external opener boundary.
- App control contract: shared `@openspecui/core/app-daemon-control` schemas type the runtime-only snapshot and invalidation notice. The App performs initial Pull, subscribes to SSE invalidation, serializes replacement Pulls, binds credential to its exact locator in memory, then applies the credential-free tab request. Missing remote/manual endpoints are unsupported without a false error.
- Security correction: external openers may reflect their target in an exception. Browser and daemon presenters now convert those failures to fixed messages so private credential fragments cannot enter CLI or IPC errors.
- Worktree correction: managed project children now launch explicit `serve`, not daemon-only `start`; the real guarded process-child test failed before this correction and passes after it.

### Focused evidence

- Typecheck: Core complete package lane passed; App production plus four checked test lanes passed; CLI production plus `tsconfig.command-tests.json` passed.
- CLI/daemon/lease focused suite: 10 files, 53 tests passed. Added direct controller IPC evidence and the concurrent endpoint race; the final daemon server suite is 5/5.
- App focused suite: daemon control, production launch application, credential registry, launch relay, and shell state: 5 files, 29 tests passed.
- Removal regressions: Core config 53/53 and Web Settings 61/61 passed.
- Local App server: assets/MIME/cache/SPA/path-boundary plus snapshot/SSE evidence: 2 files with daemon server, 6 tests passed. The traversal red exposed and fixed absolute-path normalization that previously returned the SPA document for an encoded parent path.
- Mutation audit: removing `socket.destroy()` from lease close failed the exact host-ledger retirement assertion; removing the disconnect `scheduleReconnect(...)` failed the daemon-replacement registration assertion. Both transitions were restored and the complete daemon suite returned green.
- Real package evidence: clean Core and App builds plus CLI `tsdown` passed. `npm pack --dry-run --json` listed `app/index.html`, hashed App JS/CSS, service worker, and `dist/cli.mjs`. An extracted tarball under isolated `OPENSPECUI_HOME` started a Web daemon at v6.0.0, served its packaged entry and revision-0 Workspace snapshot, then stopped cleanly; its workspace-source candidate did not exist.
- Formatting: touched files use repository Prettier style and `git diff --check` passes. The repository Vite+ pre-commit hook still reports missing `staged` config; spec commit `459330b` therefore used `--no-verify` after documented checks.
- Strict OpenSpec validation remains intentionally open: the generic delta validator reports no `specs/` delta because formal main-spec work is checkpoint 8, not because a completed delta failed validation.

### Checkpoint 2 execution start (2026-07-29 Asia/Shanghai)

- Named production owner: the yargs command registry and project `serve` handler currently colocated in `packages/cli/src/cli.ts`.
- Fixed point: `695bdef` (`openspecui@6.0.0`). At that point `start [project-dir]` owns a project Server, `--app` is a string/App-URL selector, and `serve`, daemon-only `stop|restart`, and `serve --web` do not exist.
- Exact red evidence: production-parser cases expecting bare/explicit `serve` equivalence, daemon-only `start|stop|restart`, boolean `--app`/`--web`, URL rejection, TTY/non-TTY admission, and `--no-open` short-circuit cannot pass against that registry. Evidence must invoke the extracted production yargs registry; a hand-authored argv parser is not acceptable.
- Execution order: extract checked parser/plan types, add parser and decision tests, remove obsolete `appBaseUrl` ownership, then wire daemon-dependent effects as their typed port becomes available. Do not claim checkpoint 2 complete while runtime dispatch is still a placeholder.

## Decisions Taken

### Command and process ownership

- Bare `openspecui [project]` is `openspecui serve [project]`; it continues to run one project backend in the foreground caller process.
- `openspecui start|stop|restart` manage only the user-level App daemon. They never adopt, supervise, restart, or terminate project backend processes.
- `openspecui --app` is `openspecui serve --app`; `openspecui --web` is `openspecui serve --web`.
- When no daemon exists, an interactive unqualified `serve` asks `Start OpenSpecUI App? [Y/n]`; non-interactive execution uses Direct Web. `--no-open` performs no presentation work.
- Daemon host mode is immutable for one daemon lifetime. An explicit conflict reports the exact `restart` correction and never mutates a running tray/window in place.

### Daemon and presentation ownership

- One user-isolated daemon owns the bundled local App shell, IPC endpoint, tray, retained OpenTray window, and transient Workspace presentation ledger.
- Each live `serve` owns a reconnecting IPC registration lease. Daemon restart causes active leases to re-register runtime-only backend evidence; daemon shutdown does not stop those backends.
- Native mode uses one retained `@opentray/ext-webview` session with `style.appMode: true`; only first `show()` supplies bootstrap options. Later activation uses `toVisible()` and `focus()`.
- Web mode may use base tray/browser behavior but cannot import or initialize the WebView extension. Linux defaults to Web because the extension has no Linux native package.
- The daemon serves App assets built and packed with the same CLI version on loopback. It does not reverse-proxy project HTTP, RPC, WebSocket, or PTY traffic.

### App and authority boundaries

- Public `appBaseUrl`, Settings Hosted App URL, `--app=<url>`, and local-runtime dependence on an independently deployed App shell are removed without compatibility glue.
- App product language uses `Workspaces`, replacing `Sessions` while preserving backend iframe continuity, reachability, tab persistence, and runtime-only credentials.
- Open in browser dispatches an opaque Workspace id. The daemon resolves its registered backend and materializes the Direct Project Web target only at the external opener boundary.
- Browser/PWA Window Controls Overlay and OpenTray overlay are mutually exclusive titlebar geometry owners. Interactive controls never become native drag regions.
- Credentials, Authorization headers, and private launch fragments remain memory-only and must not enter daemon files, logs, public status, browser history, or persisted Workspace state.

## Divergence Notes

- The inherited dirty candidate crossed checkpoints 2, 3, and 4 before producing their required intermediate commits. Independent review recovered production tests, fixed the Worktree command regression and private-opener error leak, and closes checkpoints 2-5 in one consolidated implementation commit before any checkpoint 6/OpenTray dependency work. The ledger does not fabricate commits that never existed.
- The approved plan intentionally diverges from the previous 6.0 hosted-shell model by removing custom/official App-shell selection and making the daemon's same-version local shell authoritative.
- This approved product correction is not a temporary migration shim: old `appBaseUrl` fields and `--app=<url>` behavior are scheduled for deletion rather than silent acceptance.

## Loopback Triggers

Return to `intake.md` and `research-plan.md` for Owner review before continuing if any of these conditions appears:

1. OpenTray cannot keep one retained `appMode` session alive under a detached caller without also owning project backend children.
2. A supported platform requires importing or initializing `@opentray/ext-webview` in Web mode or Linux installation cannot remain platform-optional.
3. Secure single-user IPC cannot be implemented without persisting credentials, exposing arbitrary URL opening, trusting a PID file as authority, or granting cross-user access.
4. Active `serve` leases cannot re-register after daemon restart without transferring backend process ownership to the daemon.
5. The bundled App shell cannot communicate with independent backend ports through the existing Access Gate/CORS/iframe contracts and would require a backend reverse proxy.
6. OpenTray and PWA titlebar geometry cannot be represented by one exclusive typed state without regressing ordinary Browser/PWA layout.
7. Removing `appBaseUrl` breaks an objective supported workflow beyond the retired App-shell deployment direction approved by the Owner.
8. `Workspaces` or Open in browser would require persisting private credentials or accepting arbitrary external URLs from the page.
9. Focused red/green evidence cannot cross the named production owner, or a test passes only after bypassing parser, IPC, lifecycle, presenter, or App-shell boundaries.
10. Required package artifacts cannot be proven from a real packed CLI, or OpenTray protocol-line packages cannot be locked as one compatible closure.

Ordinary implementation defects, type errors, focused-test failures, and platform-specific styling corrections are not loopback triggers by themselves; fix them inside the approved checkpoint unless they expose one of the ownership contradictions above.
