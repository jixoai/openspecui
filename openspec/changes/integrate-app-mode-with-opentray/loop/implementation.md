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
Implementation checkpoints       2-9 complete; Owner acceptance next
Production code                  daemon, leases, App control, presenters, Workspaces chrome complete
Focused automated evidence       complete through integrated package/runtime boundary
Owner browser/native acceptance  prepared; not executed
PR delivery                      not started
6.1.x release                    out of this Change
```

- Approved execution source: `loop/research-plan.md`.
- Current branch: `feat/opentray-app-mode`.
- Current implementation boundary: checkpoint 9 is complete at exact-head full gates, clean package output, installed-tarball lifecycle, and delivery-metadata evidence; checkpoint 10 Owner acceptance is next.
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

### Checkpoint 8 implementation result (2026-07-30 Asia/Shanghai)

- Production contract owners: `openspec/specs/cli-commands/spec.md` now defines foreground `serve`, daemon-only `start|stop|restart`, TTY admission, explicit `--app`/`--web`, `--no-open`, and immutable host mode. `openspec/specs/hosted-app-distribution/spec.md` now defines the same-version bundled shell, Workspaces, daemon Push -> Pull control, opaque-id browser opening, retained OpenTray presentation, and exclusive titlebar geometry. Settings remains free of App-shell location ownership through `opsx-ui-views`.
- Deleted public contracts: current README/package/website guidance no longer offers a URL-valued App flag, project App-shell location setting, or independently deployed PWA as the CLI's runtime target. Historical archived Specs and versioned legacy READMEs remain unchanged. `app.openspecui.com` remains an optional manually addressed standalone Browser/PWA deployment, not a daemon dependency.
- Public command story: English and Chinese root READMEs cover bare and explicit `serve`, project ownership, TTY/non-TTY behavior, `--app`, `--web`, `--no-open`, Workspaces, Open in browser, daemon-only lifecycle commands, and exact restart guidance. The package App README distinguishes the bundled primary runtime from optional static deployment. The website toggle now emits explicit `--app` or `--web`; disabling App mode no longer emits the ambiguous bare command.
- Parser evidence: `cli-documentation.test.ts` reads both current root READMEs and invokes the production `parseCliCommand` for 12 documented forms. Its initial red found that `serve --no-open` was described but not published as a complete copyable command; both READMEs were corrected. The final focused CLI run passed 2 files / 7 tests, and the complete CLI run reached 23 files / 111 tests with only that intentional initial red before correction.
- Website evidence: Website Vitest passed 7 files / 15 tests. `svelte-check` passed with zero errors and warnings. The updated component test directly proves the disabled App toggle emits `pnpx openspecui@latest --web`.
- Spec and package evidence: strict main-spec validation passed 18/18 Specs, including all three changed capabilities. The generic standard-change validator still rejects this repo-local `opsx-collab-pr-loop` Change because it has no standard `specs/` delta directory; this is a schema mismatch, not a failed main Spec, and no duplicate delta was fabricated. A minor Changeset covers `openspecui`, `@openspecui/core`, `@openspecui/server`, and `@openspecui/web`; the private App workspace is not publishable.
- Quality evidence: CLI and Website typechecks passed. Focused Oxlint reported zero errors/warnings. Changed-file `format:check` and `git diff --check` passed. The repository Prettier CLI has no standalone Svelte parser, while the repository format checker accepts the file and Svelte's own checked lane is green.
- Residual boundary: package-impact status from Changesets compares committed history and cannot account for an uncommitted Changeset; it is deferred to checkpoint 9 after this independent commit. No release, final Browser/PWA walkthrough, or native OpenTray visual acceptance is claimed.

### Checkpoint 9 runtime correction (2026-07-30 Asia/Shanghai)

- Real packed-runtime discovery: a daemon-absent Direct Web `serve --web` remained alive after one `Ctrl+C` while a browser-held tRPC WebSocket stayed connected; a second signal force-killed the process. This contradicted the foreground `serve` ownership contract even though daemon, lease, health, and package exercises had passed.
- Production owners: `packages/server/src/server.ts` owns both tRPC/PTY `WebSocketServer` instances, Node HTTP settlement, and ordered runtime teardown. `CliExecutor` owns every buffered child and bounded availability probe; the launch executor belongs to the Server, while each Planning-root record owns and disposes its own executor. The correction does not change daemon, browser, OpenTray, or project-backend ownership.
- Failure chain: active WebSocket clients first prevented `WebSocketServer.close()` settlement. After client retirement, a real Node diagnostic report identified `openspec.js store list --json` as a surviving buffered child. After executor disposal, the process still lasted about 11 seconds with no child, TCP, watcher, or worker handle; a second report showed one referenced timer advancing toward the successful `checkAvailability()` probe's uncleared 10-second deadline. Awaiting the Node HTTP close callback and clearing successful probe timers completes the owner chain without `process.exit()`.
- Exact red/mutation evidence: `server-startup.test.ts` opens production `/trpc`, withholds client close, and requires peer `CLOSED` within 500 ms; a second case starts a non-cooperative buffered `store list --json` child and requires bounded Server settlement. The focused Server file passes 8/8. `cli-executor.test.ts` proves owner disposal escalates `SIGTERM -> SIGKILL`; its new availability case captures both `12_345ms` timeout handles and requires both to be cleared. Removing only the cleanup `finally` made that exact case fail (1 failed / 39 skipped); restoring it passes (1 passed / 39 skipped), and the complete Core suite passes 52 files / 489 tests.
- Real artifact proof: rebuilt Server and CLI workspace outputs pass Direct Web health with a deliberately retained `/trpc` client, then one `SIGINT` exits code 0, closes the socket, emits no stderr, and settles in 136 ms. A new `pnpm pack` tarball at `/tmp/openspecui-opentray-checkpoint9/pack/openspecui-6.0.0.tgz` was installed under `/tmp/openspecui-opentray-checkpoint9/install`; the installed `dist/cli.mjs` repeats the same proof in 327 ms. Both runs use isolated `OPENSPECUI_HOME` and `XDG_DATA_HOME`.
- Focused quality evidence: Core and Server typechecks pass; focused Oxlint reports zero errors/warnings; `git diff --check` passes. The Server startup file passes 8/8 after one sequence-sensitive timeout replay. An accidentally broad Server package invocation also observed one unchanged Git binding test time out at 5 seconds; its exact replay passes 1/1 in 416 ms. No timeout or production contract was widened.
- Commit-hook limitation: the ordinary commit attempt again stopped because `vite.config.ts` has no Vite+ `staged` configuration. Hook configuration remains outside this Change; the independently verified correction uses `--no-verify` rather than changing repository delivery policy incidentally.
- Remaining boundary: commit this runtime correction independently, then run checkpoint 9 full gates and the remaining built-daemon command exercises. No 9.x checkbox is closed early, and final Browser/PWA/OpenTray visual acceptance remains Owner-only.

### Checkpoint 9 integrated verification result (2026-07-30 Asia/Shanghai)

- Exact candidate: `cb434dcfbeba11e892cfd4a55a404de4729b0b1d` on `feat/opentray-app-mode`. The only dirty worktree path throughout verification was the Owner's concurrent `packages/ct2-engine/binding.js`; it was neither read as implementation evidence nor staged, rewritten, or included in this Change.
- Full local gates: `pnpm format:check` passed; Oxlint checked 1,093 files with zero warnings/errors; all 15 workspace typechecks passed. `pnpm test:ci` passed Root 15 files / 64 tests, Core 52 / 489, Server 84 / 545, App 36 / 225, Web 166 / 1,062, CLI 23 / 111, plus every remaining workspace suite. `pnpm test:browser:ci` passed xterm 60 with 1 intentional skip, App 1 / 1, and Web 14 / 14. `git diff --check` passed.
- Clean package chain: Server, Web/SSG, App, and CLI were rebuilt from their current outputs without rebuilding the concurrently modified ct2 package. The final real tarball is `/tmp/openspecui-opentray-checkpoint9/pack/openspecui-6.0.0.tgz` (6.5 MB); it contains `dist/cli.mjs`, bundled App entry/assets, Project Web assets, and the exact `opentray` / `@opentray/ext-webview` `0.18.0` runtime declarations. A fresh `pnpm add` installation lives at `/tmp/openspecui-opentray-checkpoint9/install-final` and executed the installed binary rather than workspace source.
- Installed lifecycle matrix: a stale regular file at the isolated Unix endpoint was recovered by `start --web`; repeated `start --web` activated the same PID; native `start` succeeded; a subsequent `start --web` was rejected with the exact `openspecui restart --web` correction; and `restart --web` replaced the host mode. These are process/API observations only, not Owner visual acceptance.
- Backend ownership matrix: installed `serve --app` registered one project in the daemon ledger. `stop` released the daemon endpoint while `/api/health` on the foreground backend remained `ok`; a new `start --web` caused the live lease to restore exactly that Workspace. Exiting the serve owner retired the Workspace and backend listener. Installed `serve --web` passed both daemon-present attach-plus-Direct-Web and daemon-absent Direct-Web-only paths.
- Shutdown proof: with a real installed Direct Web backend and a deliberately retained `/trpc` WebSocket, one `SIGINT` closed the peer socket, retired the process in 54 ms, and the parent command settled with code 0. Final daemon stop released the isolated endpoint; no credential, Authorization header, or private fragment was printed or recorded.
- Package-tool divergence: pnpm 10.22.0 rejects `pnpm pack --dry-run` with `Unknown option: 'dry-run'`. Completion therefore uses the stronger available chain: real `pnpm pack`, tar member inspection, fresh isolated install, dependency-closure inspection, and installed runtime exercises. The checkpoint text records that executable proof rather than claiming an unsupported pnpm flag ran.
- Delivery metadata: `CHANGESET_CHECK_BASE_SHA=$(git merge-base HEAD main) pnpm changeset:check` reports `Changeset file detected.` The generic `openspec validate --all --strict` passes all 19 standard items except this repo-local `opsx-collab-pr-loop` Change; its standard Change validator requires a `specs/` delta directory and reports `No deltas found`. All main Specs, including `cli-commands`, `hosted-app-distribution`, and `opsx-ui-views`, pass strict validation. No duplicate standard delta was fabricated to satisfy the wrong schema.
- Known non-blocking output remains unchanged: jsdom canvas warnings, the generated `::scroll-button(*)` CSS warning, the App chunk-size warning, and the SSG dynamic-import warning. The Vite+ commit hook still lacks repository `staged` configuration. None changed the exact focused/full result, package contents, or installed lifecycle outcome.
- Owner handoff: `walkthrough/ACCEPTANCE.md` fixes the real packed-CLI setup and nine numbered cases for interactive admission, dual Workspaces, open-in-browser, retained native activation, daemon restart convergence, immutable mode, Browser/PWA state, macOS/Windows chrome, Direct Web, and cleanup. Each case has explicit PASS/FAIL/NOT RUN and restore boundaries; it contains no credential-bearing command.
- Remaining boundary: final interactive prompt, multi-Workspace, Browser/PWA, macOS/Windows native window, overlay hit-region, retained-focus, and visual presentation acceptance belongs to the Owner at checkpoint 10. No PR is opened or updated before that acceptance.

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
