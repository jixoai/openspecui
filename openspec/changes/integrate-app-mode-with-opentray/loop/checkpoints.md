<!--
Orthogonal intents (created 2026-07-29 Asia/Shanghai):
1. Sequence independently reviewable production boundaries.
2. Bind every checkpoint to focused evidence and implementation-state updates.
3. Protect credentials, backend ownership, and host-mode invariants.
4. Separate automated preparation from Owner acceptance and release authority.

Original request (2026-07-29): "立项 6.1.x: 我们要继续打磨 app 模式，我们需要将它适配对接 opentray。"
-->

## 1. Research and Planning

- [x] 1.1 Intake preserves the original OpenTray, `--web`, overlay-window-controls, and `appMode` requirements.
- [x] 1.2 Code-backed research distinguishes project Server, Browser/PWA App, OpenTray caller session, daemon, and backend process ownership.
- [x] 1.3 Owner-approved command matrix records `serve`, `start|stop|restart`, bare `--app`/`--web`, TTY prompt, non-TTY fallback, and `--no-open` behavior.
- [x] 1.4 Owner-approved distribution correction removes public `appBaseUrl` and makes the daemon's same-version local App shell authoritative.
- [x] 1.5 Implementation ledger starts honestly at no production code, no automated evidence, no PR, and no release.
- [x] 1.6 Before each implementation checkpoint, record its named production owner and exact fixed-point red evidence in `implementation.md`.

## 2. CLI Command Contract

- [x] 2.1 Extract a type-safe, side-effect-free command planner for `ServePlan | DaemonPlan` while keeping yargs as the only argv parser.
- [x] 2.2 Make bare `openspecui [project]` and explicit `openspecui serve [project]` execute the same foreground project Server owner.
- [x] 2.3 Add daemon-only `start`, `stop`, and `restart`; reject project positional arguments and backend-only flags on those commands.
- [x] 2.4 Implement boolean `serve --app` and `serve --web` as mutually exclusive modes; prove bare `--app` and bare `--web` dispatch through the default `serve` command.
- [x] 2.5 Remove `--app=<url>` parsing, `appBaseUrl` config/schema/router/Settings ownership, and old hosted-shell launch resolution without ignored compatibility fields.
- [x] 2.6 Implement interactive `[Y/n]` App admission only when daemon is absent and stdin/stdout are TTYs; preserve non-TTY Direct Web.
- [x] 2.7 Make `--no-open` short-circuit prompt, daemon probing/start, Workspace registration, and Browser opening.
- [x] 2.8 Return exact daemon mode/version mismatch diagnostics with the corrective `openspecui restart [--web]` command.
- [x] 2.9 Focused parser/planner tests cover every command-matrix row, default answer, explicit no, EOF, non-TTY, conflicts, legacy aliases, and `--no-open`.
- [x] 2.10 Update `implementation.md`, pass CLI focused typecheck/tests, and commit this checkpoint before starting daemon runtime work.

## 3. User-Level Daemon and IPC

- [x] 3.1 Add typed daemon protocol schemas for status, activate, register/unregister Workspace, open Workspace in browser, stop, acknowledgements, and structured errors.
- [x] 3.2 Resolve user-global runtime/log paths under `~/.openspecui`; use a mode-`0600` Unix socket and a home-digest Windows named pipe.
- [x] 3.3 Implement single-instance ownership through successful IPC bind, with liveness-proven stale Unix socket cleanup and no PID-file authority.
- [x] 3.4 Spawn the daemon detached and report success only after a bounded versioned readiness exchange; preserve actionable startup logs and failure diagnostics.
- [x] 3.5 Publish immutable daemon evidence for version, PID, `native | web` host mode, local App endpoint, and capability state without credential-bearing fields.
- [x] 3.6 Implement bounded graceful stop and restart that wait for endpoint release; never signal, adopt, or terminate project backend processes.
- [x] 3.7 Reject explicit host-mode mutation on a running daemon while allowing mode-unspecified activation of the current daemon.
- [x] 3.8 Redaction tests prove credentials, Authorization headers, and private launch fragments do not enter status, logs, files, or error messages.
- [x] 3.9 Race/stale-endpoint tests fail when bind ownership or liveness proof is bypassed and pass for one winner, loser convergence, stop, and restart.
- [x] 3.10 Update `implementation.md`, pass daemon focused typecheck/tests, and commit this checkpoint before adding `serve` leases.

## 4. Serve Registration Leases and Presentation

- [x] 4.1 Keep one foreground `serve` process as the sole owner of each project Server and its SIGINT/SIGTERM shutdown.
- [x] 4.2 Register the ready backend locator, backend identity, and runtime-only credential with daemon IPC without persisting or logging private presentation state.
- [x] 4.3 Keep a bounded reconnecting lease that re-registers after daemon restart and retires when its `serve` owner exits.
- [x] 4.4 Prove daemon stop/restart leaves every live project backend reachable and does not transfer child/process ownership.
- [x] 4.5 Implement daemon-present behavior: unqualified `serve` attaches when daemon exists; `serve --app` starts when absent; `serve --web` attaches and also opens Direct Project Web.
- [x] 4.6 Implement daemon-absent behavior: unqualified non-TTY or rejected prompt opens Direct Web; `serve --web` opens Direct Web; `serve --app` starts daemon then attaches.
- [x] 4.7 Materialize private Direct Project Web URLs only inside the external Browser presenter and never print them.
- [x] 4.8 Lifecycle tests cover late daemon start, daemon restart during a live backend, backend exit, duplicate backend registration, and reconnect cancellation.
- [x] 4.9 Mutation-resistance tests fail when exact lease retirement or re-registration transitions are removed, not merely when downstream callbacks are mocked.
- [x] 4.10 Update `implementation.md`, pass focused lifecycle tests, and commit this checkpoint before App-shell integration.

## 5. Bundled Local App Shell and Control Transport

- [x] 5.1 Build `packages/app` as part of CLI packaging and copy its deterministic assets into the published `openspecui` package.
- [x] 5.2 Serve the bundled App shell on a loopback daemon endpoint with SPA fallback, correct assets/MIME/cache policy, and no project backend reverse proxy.
- [x] 5.3 Add a same-origin typed daemon control transport through which App reads the current Workspace ledger and receives invalidation notices.
- [x] 5.4 Preserve the reactive rule `Push notification -> Pull current snapshot`; retain settled sibling Workspaces while one registration changes.
- [x] 5.5 Bind transient credentials to matching backend locators in App memory only; App persistence remains credential-free across reload and restart.
- [x] 5.6 Active `serve` leases restore authenticated Workspace authority after daemon restart without writing credentials into browser storage.
- [x] 5.7 Repository development may inject local `packages/app` dev output through dev tooling, but no public App-shell URL setting or CLI option reappears.
- [x] 5.8 Real built-package tests prove the daemon serves the same-version App entry/assets and cannot fall back to stale workspace output.
- [x] 5.9 Focused App/control tests cover initial Pull, notice-driven replacement Pull, regional failure, credential binding, and daemon restart convergence.
- [x] 5.10 Update `implementation.md`, pass focused build/control tests, and commit this checkpoint before native presentation.

## 6. OpenTray Native and Web Presenters

- [ ] 6.1 Lock `opentray` and `@opentray/ext-webview` to one exact compatible protocol line, following the `../skill-creator-v2` `0.18.0` reference unless current package evidence requires an approved update.
- [ ] 6.2 Native mode dynamically imports OpenTray packages, creates one stable App/tray identity, and creates one WebView session with `style.appMode: true`, `frameless: false`, `resizable: true`, and `autoHide: false`.
- [ ] 6.3 First native `show()` supplies URL, size, style, overlay, and minimal native API bootstrap; later activation uses `toVisible()` then `focus()` without replaying bootstrap options.
- [ ] 6.4 Native close/hide retains page state; explicit daemon stop performs ordered listener cleanup, WebView destroy, tray/session teardown, and endpoint release.
- [ ] 6.5 Web mode may mount base tray/browser behavior but does not import, initialize, mock, or probe `@opentray/ext-webview`.
- [ ] 6.6 Linux defaults to Web; headless or tray failure preserves an explicit browser-capable result instead of reporting false native success.
- [ ] 6.7 Native capability policy admits only the daemon's loopback App shell and only required window/overlay/drag capabilities; wildcard origins are rejected.
- [ ] 6.8 Presenter tests prove one bootstrap, repeated retained activation, ordered teardown, Web import isolation, platform selection, and structured native failure fallback.
- [ ] 6.9 Packed-package verification proves CLI daemon entry, App assets, OpenTray runtime closure, and platform-optional installation are present without direct platform-package imports.
- [ ] 6.10 Update `implementation.md`, pass focused presenter/package tests, and commit this checkpoint before App chrome changes.

## 7. Workspaces and Titlebar Host State

- [ ] 7.1 Rename App product language, route/navigation, accessible labels, and tests from Sessions to Workspaces without changing project backend session semantics.
- [ ] 7.2 Preserve Workspace iframe DOM identity, reachability generation, tab persistence, and runtime-only credential ownership across App route changes.
- [ ] 7.3 Add a tooltip-labelled Open in browser icon button to every Workspace tab using the existing icon system and stable control dimensions.
- [ ] 7.4 Dispatch only an opaque Workspace id; daemon resolves the current registered backend and refuses stale, missing, or arbitrary URL requests.
- [ ] 7.5 Replace PWA-only titlebar state with an exhaustive `browser | pwa-overlay | opentray | native-frame` presentation state.
- [ ] 7.6 Ensure exactly one titlebar geometry owner writes CSS inset variables; source changes unsubscribe the retired owner and reset inactive insets to zero.
- [ ] 7.7 Adapt async OpenTray overlay geometry and `geometrychange` events; retain existing PWA Window Controls Overlay behavior when the native bridge is absent.
- [ ] 7.8 Enable macOS overlay avoidance and designated native drag surface while keeping buttons, tabs, inputs, and other interactive hit regions outside drag/caption regions.
- [ ] 7.9 Keep the verified Windows native-frame baseline unless separate capability evidence and Owner acceptance authorize Windows overlay expansion.
- [ ] 7.10 Component tests cover container/narrow layouts, Open in browser states, no horizontal overflow, every titlebar variant, geometry replacement, and zero double-inset.
- [ ] 7.11 Update `implementation.md`, pass App focused Vitest/basic component Playwright, and commit this checkpoint before broad gates.

## 8. Specifications, Documentation, and Package Contract

- [ ] 8.1 Update main OpenSpec CLI-command and hosted-App requirements for daemon/serve ownership, local App shell, Workspaces, and OpenTray presentation.
- [ ] 8.2 Remove obsolete OpenSpec requirements for configurable/self-hosted App launch from the local CLI while preserving objective historical records in archives.
- [ ] 8.3 Rewrite README command documentation for `serve`, bare aliases, `start|stop|restart`, prompt/non-TTY behavior, daemon mode mismatch, `--app`, `--web`, Workspaces, and Open in browser.
- [ ] 8.4 Update CLI help, package App README, website launch examples, Settings copy, and localized terminology so they match the production parser exactly.
- [ ] 8.5 Add Changesets for every affected publishable package; do not publish 6.1.x in this Change.
- [ ] 8.6 Run strict OpenSpec validation and tests that compare documented command examples against parser behavior.
- [ ] 8.7 Update `implementation.md` with deleted public contracts, package impact, and residual limitations; commit this checkpoint.

## 9. Integrated Automated Verification

- [ ] 9.1 All checkpoint-focused tests remain green at the exact candidate head; no focused failure is deferred into the full gate.
- [ ] 9.2 Build the App and CLI from clean outputs, run the real packed CLI under an isolated home/runtime directory, and record artifact paths without credentials.
- [ ] 9.3 Built CLI exercises pass for daemon start/activate/stop, restart `--web`, stale endpoint recovery, project serve registration, Direct Web, and active lease re-registration.
- [ ] 9.4 `pnpm format:check` and `git diff --check` pass.
- [ ] 9.5 `pnpm lint:ci` passes with zero errors and warnings.
- [ ] 9.6 All workspace typechecks pass, including every new test file and public protocol fixture.
- [ ] 9.7 `pnpm test:ci` passes.
- [ ] 9.8 `pnpm test:browser:ci` passes as basic automated preparation evidence, not final acceptance.
- [ ] 9.9 Package builds and `pnpm pack --dry-run` prove daemon, bundled App, and OpenTray artifacts from clean outputs.
- [ ] 9.10 Synchronize exact command outputs, counts, candidate commit, known limitations, and all divergence decisions into `implementation.md`.

## 10. Owner Acceptance, PR, and Merge

- [ ] 10.1 Provide numbered acceptance cases with exact isolated setup, trigger, expected observation, and restore commands for native and Web modes.
- [ ] 10.2 Owner accepts interactive prompt, multiple Workspaces, Open in browser, daemon restart convergence, and immutable-mode diagnostics.
- [ ] 10.3 Owner accepts macOS/Windows OpenTray window lifecycle, overlay/native-frame hit regions, retained focus, and visual presentation on supported available platforms.
- [ ] 10.4 Owner accepts Web daemon browser/PWA behavior; Agent automation is not recorded as final browser acceptance.
- [ ] 10.5 Confirm `openspec/config.yaml` and all unrelated user changes are excluded from commits and PR scope.
- [ ] 10.6 Open or update the feature-branch PR only after local gates and Owner acceptance; required CI checks pass on the exact head.
- [ ] 10.7 Archive this Change only after implementation and Owner acceptance are complete; preserve exact acceptance and residual-risk evidence.
- [ ] 10.8 Merge only after archive/PR checks pass and Manager authorizes or the Manager-mode policy permits auto-merge.
- [ ] 10.9 Stop after merge and ask separately whether to prepare a 6.1.x release.
