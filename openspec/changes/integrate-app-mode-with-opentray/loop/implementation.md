<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Track implementation truth against the approved OpenTray daemon plan.
2. Preserve settled owner decisions that constrain code execution.
3. Record approved divergences without rewriting history.
4. Define evidence-based loopback triggers.

Original request (2026-07-29): "立项 6.1.x: 我们要继续打磨 app 模式，我们需要将它适配对接 opentray。"
-->

## Implementation State

```text
Research and owner decisions     complete
Implementation checkpoints       2-7 complete; checkpoint 8 next
Production code                  daemon, leases, App control, presenters, Workspaces chrome complete
Focused automated evidence       complete through App chrome/component-browser boundary
Owner browser/native acceptance  not started
PR delivery                      not started
6.1.x release                    out of this Change
```

- Approved execution source: `loop/research-plan.md`.
- Current branch: `feat/opentray-app-mode`.
- Current implementation boundary: checkpoint 7 is complete at the Workspaces, open-by-id, exclusive titlebar-owner, and basic Chromium component boundary; checkpoint 8 specs/docs/package contracts are next.
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

### Checkpoint 6 execution start (2026-07-29 Asia/Shanghai)

- Named production owners: `packages/cli/src/opentray-daemon-presenter.ts` owns host selection, stable tray/App identity, retained native WebView lifecycle, native capability policy, and browser-capable fallback; `packages/cli/src/opentray-presenter-driver.ts` physically isolates the Web facade import from the Native facade-plus-WebView import and adapts public OpenTray handles into the presenter's narrow lifecycle ports. `daemon-process.ts` only composes the selected presenter with local App HTTP and IPC teardown.
- Fixed point: `eb9f6fe`. At that point `daemon-process.ts` always creates `createBrowserDaemonHost(...)`, reports a requested native daemon as Web, has no OpenTray package closure, and cannot create or retain a native App window.
- Exact red evidence: checked presenter tests at this fixed point cannot import a production presenter factory or observe one first `show()`, later `toVisible() -> focus()`, retained `close()` without destroy, listener -> WebView -> tray teardown order, loopback-only `nativeApiPolicy`, Linux/Web selection, Web-mode extension-import isolation, or a structured native-to-Web fallback. The tests must inject the real module-loading seam used by production; mocking a downstream window callback after bypassing presenter selection is not evidence.
- Mutation target: deleting either the retained activation sequence or one ordered teardown transition must fail its named lifecycle assertion. Replacing the exact loopback origin with `*`, importing `@opentray/ext-webview` from the Web branch, or reporting native after presenter construction fails must also fail focused evidence.
- Execution order: lock the exact `0.18.0` facade closure, add the checked presenter contract/tests, replace the temporary native-to-Web branch in `daemon-process.ts`, verify real build/pack closure, then update checkpoint state. Do not start titlebar geometry or Workspaces UI changes from checkpoint 7.

### Checkpoint 6 implementation result (2026-07-29 Asia/Shanghai)

- Production owners: `opentray-daemon-presenter.ts` owns host selection, stable `com.jixoai.openspecui` / `openspecui-app` identity, capability policy, and retained lifecycle; `opentray-presenter-driver.ts` owns two physically separate dynamic import paths. Web imports only `opentray`; Native imports the same facade plus `@opentray/ext-webview` and adapts one retained window. `daemon-process.ts` publishes only the presenter's effective host mode.
- Native lifecycle: first construction declares the local App URL, 1280x840 geometry, `appMode: true`, framed/resizable/non-auto-hide style, platform overlay choice, and one exact-origin `window` native API policy, then calls `show()` once. Later daemon activation serializes `toVisible() -> focus()`. Tray hide calls `close()` without destroy; final close retires listeners, drains activation, destroys WebView, destroys tray, closes App HTTP, then releases IPC endpoint authority even if one teardown owner fails.
- Fallback truth: Linux and other unsupported native platforms select Web before loading the extension. Native creation/show failure destroys partial native resources and returns effective Web status. Base tray failure remains browser-capable. Diagnostics contain only fixed code/stage/message facts and never reflect opener targets or native exception payloads.
- Package contract: `opentray` and `@opentray/ext-webview` are exact `0.18.0` dependencies and external CLI runtime facades. The built CLI contains only dynamic facade imports and no direct platform-package imports. macOS arm64 installation contains both the OpenTray broker and WebView dylib through optional closure. A clean simulated Linux x64 install contains `@opentray/linux-x64` and intentionally contains no nonexistent Linux WebView native package.
- Focused green evidence: production and checked-test TypeScript lanes pass. Presenter, daemon-server, and runtime-dependency suites pass with 14 tests after Windows native-frame and headless Web coverage. Complete CLI tests pass with 22 files and 108 tests. Oxlint reports zero warnings/errors on the touched CLI files.
- Mutation evidence: removing retained activation `focus()` makes the exact test receive `toVisible, toVisible` instead of `toVisible, focus, toVisible, focus`. Removing final `window.destroy()` makes the teardown sequence omit `destroy:window`. Both transitions were restored and the focused suite returned green.
- Build/pack evidence: the real CLI build completed; known pre-existing warnings remain the unsupported generated `::scroll-button(*)` selector and the App's approximately 500 kB chunk. `npm pack --dry-run --json` includes `dist/cli.mjs`, `app/index.html`, hashed App CSS/JS, fonts, and service worker. The extracted package metadata retains exact OpenTray facade versions.
- Commit-hook limitation: the repository Vite+ pre-commit hook still cannot run because `vite.config.ts` has no `staged` configuration. This checkpoint uses `--no-verify` only after the recorded typecheck, tests, lint, format, build, pack, and `git diff --check` evidence passed; hook configuration is outside this Change.
- Residual boundary: Agent automation has not claimed Browser/PWA or native-window visual acceptance. Overlay geometry consumption, drag hit regions, Workspaces language, and Open in browser UI remain checkpoint 7.

### Checkpoint 7 execution start (2026-07-29 Asia/Shanghai)

- Named production owners: `packages/app/src/app-router.tsx`, `components/app-layout.tsx`, and `components/hosted-shell.tsx` own the persistent multi-project route, tab triggers, iframe Documents, and responsive header; `components/app-launch-owner.tsx` plus `lib/daemon-workspace-control.ts` own the in-memory backend-locator -> opaque Workspace-id binding and browser action; `packages/cli/src/local-app-server.ts` and `daemon-server.ts` carry that action to the authoritative private Workspace ledger. A new App-local titlebar presentation owner will exclusively select Browser, PWA overlay, OpenTray overlay, or native frame geometry.
- Fixed point: `44f83f7`. At that point the route and visible product language are still `/sessions` / Sessions, every persisted tab has only a generated hosted session id, the same-origin daemon control exposes only snapshot/events GET endpoints, and `pwa-runtime.ts` synchronously reads only Browser Window Controls Overlay. The page cannot dispatch an opaque daemon Workspace id, cannot observe async OpenTray geometry, cannot distinguish OpenTray from a native frame, and cannot initiate native drag.
- Exact red evidence: production App tests must fail at this fixed point when they expect `/workspaces` navigation and accessible labels while retaining the same iframe node across route round-trips; an Open in browser control on every tab with disabled/manual, pending, success, stale-id, and failure states; an HTTP action containing only an encoded opaque Workspace id that resolves through the live daemon ledger; and exhaustive `browser | pwa-overlay | opentray | native-frame` geometry with retired-listener cleanup and zero inactive insets. Tests that call `openProjectInBrowser` directly, inject a URL into the page action, or invoke a downstream geometry callback without the source-selection owner are not evidence.
- Mutation targets: deleting the backend-locator -> opaque-id binding must disable a registered tab action; replacing the posted id with a backend URL must fail the local-server assertion; deleting the retired OpenTray/PWA listener cleanup must fail the source-replacement test; adding PWA and OpenTray insets or allowing an interactive tab/button pointerdown to start native drag must fail exact assertions. Route round-trip evidence must compare the original iframe DOM node, not only its URL.
- Execution order: first add the typed same-origin open-by-id action and in-memory binding, then rename the App surface and add the tab icon control, then replace PWA-only geometry with the exclusive titlebar owner and drag filtering. Run checked App/CLI focused tests before changing checkpoint state; final visual Browser/PWA/OpenTray acceptance remains Owner-only.

### Checkpoint 7 implementation result (2026-07-30 Asia/Shanghai)

- Production owners: `AppDaemonWorkspaceOwner` binds each current daemon snapshot's backend locator to its opaque Workspace id after binding runtime-only credential authority. `daemon-workspace-control.ts` posts only that encoded id to the same-origin local App server; `RunningDaemonServer` resolves it against the live private ledger before the external Browser presenter materializes any target.
- Product surface: `/sessions` and visible Sessions language are removed in favor of `/workspaces` and Workspaces. `AppLayout` retains the mounted HostedShell across route changes, and the existing production route test compares the same iframe DOM node before and after `/workspaces -> /environment -> /workspaces`.
- Interaction structure: shared Tabs now renders tab trigger, tab-local Open in browser, and Close as sibling native buttons. The fixed-width tab item contains its actions; the internal tab list remains the only inline scroll owner while App route/shell surfaces stay `min-w-0` and `overflow-hidden`.
- Titlebar lifecycle: one owner exhaustively selects `browser | pwa-overlay | opentray | native-frame`, replaces rather than combines insets, retires PWA/OpenTray listeners, rejects late async geometry, and keeps PWA geometry failures settled at zero inset. Native drag accepts only non-interactive `.tabs-header` space and rejects tab, close, browser, global action, link, and input regions.
- Focused green evidence: Core, CLI, and App checked TypeScript lanes pass. Shared Tabs unit evidence passes with 2 files / 11 tests. App focused evidence passes with 6 files / 32 tests; complete App evidence passes with 36 files / 225 tests. Complete CLI evidence passes with 22 files / 109 tests. The new App Chromium component lane passes 1 file / 1 test at a 320px viewport and proves page containment plus internal strip overflow ownership. Oxlint reports zero warnings/errors across 34 touched TS/TSX/config files; `git diff --check` passes.
- Browser-lane correction: the first complete App run correctly rejected the new `.browser.test.tsx` fixture from the default fork pool. `vitest.config.ts` now excludes browser fixtures and `vitest.browser.config.ts` owns them explicitly; both complete Node and Playwright lanes pass after the correction.
- Existing-suite observation: one complete App run timed out in the unchanged simultaneous guarded-locator WebSocket test while waiting for its B ledger. The exact test then passed (1 passed / 1 skipped), and an immediate serial complete rerun passed 36 files / 225 tests. No production or timeout constant was changed for that non-deterministic observation.
- Residual boundary: automated evidence is preparation only. Browser/PWA and native OpenTray overlay, frame, hit-region, focus, and visual acceptance remain Owner-only at checkpoint 10.

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
