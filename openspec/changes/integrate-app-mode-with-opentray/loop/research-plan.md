<!--
Orthogonal intents (created 2026-07-29 Asia/Shanghai):
1. Record code-backed constraints for the OpenTray App daemon.
2. Define the approved CLI, daemon, presenter, and Workspace state machines.
3. Bound App-shell distribution, titlebar geometry, and native authority.
4. Sequence implementation checkpoints with focused evidence.
5. Preserve owner-only final Browser/OpenTray acceptance.

Original request (2026-07-29): "立项 6.1.x: 我们要继续打磨 app 模式，我们需要将它适配对接 opentray。支持 --web；适配 overlay-window-controls；使用 appMode。"
-->

## Research Findings

### Current ownership

```text
openspecui [project]
  |
  +-- packages/cli/src/cli.ts
      +-- start one project Server in the foreground process
      +-- --app[=<baseUrl>] selects hosted-app URL construction
      +-- BrowserStartCommandPresenter opens every presentation target

app.openspecui.com
  +-- static PWA shell
  +-- BroadcastChannel elects one same-origin browser/PWA leader
  +-- Sessions persists backend locators and embeds backend-owned Project Web
```

- The yargs default command and explicit `start [project-dir]` currently share one handler. `--app` is a string option, `--open` defaults to true, and the handler owns the project Server until SIGINT/SIGTERM.
- `packages/cli/src/start-command-presentation.ts` already separates Server readiness from a host-neutral `project-web | hosted-app` presentation request. `packages/cli/src/browser-start-command-presenter.ts` is the only current materializer. This is the correct boundary to expand rather than moving Server startup into OpenTray code.
- `packages/app/src/lib/launch-relay.ts` coordinates browser/PWA Documents through same-origin storage and BroadcastChannel. It cannot coordinate independent Node processes or own an OpenTray session.
- App credentials are runtime-only facts. Existing launch URLs place them in a private fragment, and App persistence stores backend/session identity without treating credentials as durable state.

### OpenTray constraints

- `../skill-creator-v2` and its locked OpenTray `0.18.0` closure provide the concrete consumer baseline: macOS/Windows use `@opentray/ext-webview`; Linux uses Web mode because the WebView extension has no Linux native package.
- Its production window is created once with `nativeWindowApi: true`, platform-selected `windowControlsOverlay`, and:

```ts
style: {
  appMode: true,
  frameless: false,
  resizable: true,
  autoHide: false,
}
```

- OpenTray's window law is retained-session based. The first `show()` bootstraps width, height, content, style, and native capability. Later activation uses `toVisible()` and `focus()`; `close()` hides while retaining page state; `destroy()` is final teardown.
- OpenTray `App`, `Tray`, and WebView extension state are owned by the live caller session. Disconnect cleanup removes caller-owned visible state. Equal `appId` values do not authorize several `serve` processes to share one WebView session. A separate long-lived App daemon is therefore required.
- `navigator.opentrayWindow.overlay.getTitlebarAreaRect()`, `overlay.listen('geometrychange', ...)`, and `startAppRegionDrag()` are asynchronous OpenTray APIs. Browser/PWA `navigator.windowControlsOverlay` is a different synchronous/event-target API. They require adapters into one App-shell state rather than structural duck typing.
- The reference implementation enables content overlay on macOS and retains the native frame on Windows. Linux/headless cannot load the native WebView extension and must use Web presentation.

### Distribution and configuration

- The published `openspecui` package currently ships `dist` and Project Web assets under `web`; it neither bundles `packages/app/dist` nor depends on `opentray`/`@opentray/ext-webview`.
- `appBaseUrl`, Settings Hosted App configuration, `--app=<baseUrl>`, and the local hosted-App Vite helper all locate the old independently deployed PWA shell. They do not identify a project backend.
- The owner retired that product direction. The daemon will serve App assets built from the same release as the CLI on a loopback endpoint. Each project backend keeps its own port and existing HTTP/RPC/WebSocket/PTY contracts; no backend reverse proxy is required.
- OpenSpecUI already owns user-global state under `~/.openspecui`. The daemon can add a `run/` IPC endpoint and `logs/` diagnostics without putting host state in any project or OpenSpec `XDG_DATA_HOME`.

### Accepted command contract

```text
Command                              Daemon absent                         Daemon present
------------------------------------------------------------------------------------------------
openspecui [project]                 interactive [Y/n]; non-TTY Direct Web attach Workspace
openspecui serve [project]           same as bare command                  attach Workspace
openspecui serve --app               start daemon, attach Workspace        attach Workspace
openspecui --app                     same as serve --app                   same as serve --app
openspecui serve --web               Direct Project Web                    attach + Direct Project Web
openspecui --web                     same as serve --web                   same as serve --web
openspecui start [--web]             start and activate daemon             activate or report mismatch
openspecui stop                      report not running                    stop App daemon only
openspecui restart [--web]           start daemon                          replace daemon host mode
```

- `[Y/n]` is emitted only for an interactive TTY when no daemon exists and neither `--app` nor `--web` selects presentation. The default answer is App. Non-interactive invocation preserves Direct Web.
- `--no-open` is presentation-free: no prompt, daemon start, Workspace dispatch, or browser opening.
- `--web` has command-local meaning. On `start/restart` it selects immutable daemon Web mode. On `serve` it requests Direct Web and, when a daemon already exists, also retains the Workspace projection.
- A running daemon's explicit startup mode is immutable. A conflicting explicit `start` request reports the current mode and the exact `openspecui restart [--web]` correction; it never mutates tray/window behavior in place.
- `openspecui --app` remains a legacy abbreviation for `openspecui serve --app`, not an alias for daemon-only `start`.

## Decision & Plan (For Approval)

### 1. Separate command parsing from execution

Create a type-safe command planner before side effects:

```text
argv + TTY + daemon probe
          |
          v
  ServePlan | DaemonPlan
          |
          +-- serve owner: project Server lifecycle
          +-- daemon owner: App host lifecycle
          +-- presenter owner: Workspace and/or Direct Web effects
```

- Make `serve [project-dir]` the explicit project command and retain the bare command as its yargs alias.
- Add daemon-only `start`, `stop`, and `restart` commands.
- Parse `serve --app` and `serve --web` as mutually exclusive booleans. Preserve the bare `--app` and `--web` aliases through the default `serve` command.
- Remove the string form `--app=<baseUrl>`. Remove `appBaseUrl` from project config, Settings, typed routers, tests, and documentation instead of retaining ignored compatibility fields.
- Model prompt admission separately from presentation. Prompt cancellation and non-TTY fallback select Direct Web; `--no-open` selects no presentation before daemon probing.

### 2. Build the user-level App daemon kernel

```text
~/.openspecui/
  +-- run/openspecui.sock       Unix, mode 0600
  +-- logs/daemon.log
  +-- daemon App state          memory + existing App browser storage

Windows
  +-- \\.\pipe\openspecui-<home-digest>
```

- Spawn `start` detached and return only after a versioned health/status exchange proves readiness. The IPC bind is the single-instance lock; stale Unix socket cleanup occurs only after a liveness probe fails.
- Expose versioned, schema-validated commands for `status`, `activate`, `registerWorkspace`, `unregisterWorkspace`, `openWorkspaceInBrowser`, and `stop`. Restrict IPC to the current OS user and bound every request/ack timeout.
- Keep an active `serve` registration lease for each backend process. On daemon loss it retries with bounded backoff; after daemon restart it re-registers the backend locator and current runtime-only credential. Disconnect retires that live registration without killing either process.
- The daemon never starts, stops, restarts, or adopts project Server children. `stop/restart` affects only App shell, tray, and native window.
- Publish daemon status as immutable startup evidence including version, PID, host mode (`native | web`), App endpoint, and capability state. Do not persist credentials, Authorization headers, or private launch fragments in files or logs.
- `restart` sends graceful stop, waits for IPC release, starts the replacement mode, and allows active `serve` leases to converge by reconnecting.

### 3. Serve one local App shell and two host presenters

```text
                 +-----------------------+
serve leases --->| App daemon ledger     |
                 +-----------+-----------+
                             |
                   Push notice -> Pull snapshot
                             |
                 +-----------v-----------+
                 | bundled App shell     |
                 +-------+-----------+---+
                         |           |
                  Native presenter   Web presenter
                  OpenTray WebView    tray + browser/PWA
```

- Build `packages/app` with the release and copy its assets into the published CLI package under a deterministic path. The daemon serves those immutable assets and a same-origin typed control endpoint on loopback.
- Use the daemon ledger as transient launch authority. The App shell subscribes to invalidation notices and pulls Workspace snapshots; credentials enter only the in-memory binding used by the matching backend locator.
- Native mode dynamically imports `opentray` and `@opentray/ext-webview`, creates one stable app/tray identity, and creates exactly one retained WebView session. Repeated `start`/Workspace registration invokes `toVisible()` then `focus()` without replaying bootstrap options.
- Web mode may create the base OpenTray tray but must not import or initialize `@opentray/ext-webview`. Activation opens or best-effort focuses the daemon's local App URL. Linux defaults to Web; headless/tray failure retains an explicit browser-capable fallback.
- Keep OpenTray packages on one exact compatible protocol line and include their runtime/native artifacts in packed-package verification. Native packages remain platform-optional so Linux installation succeeds.
- App development uses repository-owned tooling to point the daemon at the local `packages/app` dev output. This is not a user-facing App URL configuration.

### 4. Unify titlebar geometry and Workspace interaction

- Replace PWA-only shell state with a discriminated presentation state:

```text
AppTitlebarPresentation
  +-- browser       insets = 0
  +-- pwa-overlay   source = navigator.windowControlsOverlay
  +-- opentray      source = navigator.opentrayWindow.overlay
  +-- native-frame  insets = 0
```

- Only the active variant supplies CSS inset variables. PWA and OpenTray measurements are alternatives and can never be added.
- macOS OpenTray enables overlay geometry and native drag; Windows retains its native frame unless verified OpenTray capability and owner acceptance explicitly expand the matrix. Browser/PWA behavior remains unchanged without an OpenTray bridge.
- Keep buttons, tabs, and other interactive hit regions outside the caption-control exclusion area. Only the designated non-interactive titlebar surface invokes `startAppRegionDrag()`.
- Rename the App's `Sessions` product language and route/navigation surface to `Workspaces`. Preserve iframe continuity, reachability state, credential ownership, tab persistence, and multi-backend behavior.
- Add a tooltip-labelled `Open in browser` icon button to each Workspace tab. It calls the daemon using a Workspace id; the daemon resolves the registered backend locator and opens its credential-safe Direct Project Web target. The UI cannot submit an arbitrary external URL.
- `serve --web` uses the same Direct Web presenter after Workspace registration when a daemon exists. Without a daemon it invokes only Direct Web.

### 5. Documentation and delivery

- Rewrite the root README command section around `serve`, `start`, `stop`, `restart`, bare aliases, the interactive prompt, non-TTY behavior, immutable `--web` startup mode, and Workspace delivery matrix.
- Update CLI help, website installation/launch copy, package READMEs, Settings content, and main OpenSpec delta specs together. Remove Hosted App URL configuration and self-hosted shell launch claims that no longer describe the product.
- Add a Changeset for every publishable package affected by CLI, App asset distribution, shared contracts, or UI changes. Do not publish 6.1.x as part of this Change.

## Capability Impact

### New or Expanded Behavior

- User-level App daemon lifecycle and versioned local IPC.
- `serve`, `start`, `stop`, and `restart` command ownership with interactive App admission.
- Native OpenTray App presenter using `appMode`, retained session activation, and minimal native authority.
- Web daemon presenter that keeps tray/browser behavior without loading the WebView extension.
- Bundled, daemon-served App shell and live Workspace registration ledger.
- Host-neutral titlebar geometry and Workspace-level Open in browser action.

### Modified Behavior

- Bare `openspecui` remains project serving but can offer or discover App delivery.
- Bare `--app` and `--web` become `serve` presentation aliases.
- `Sessions` becomes `Workspaces` while preserving the existing multi-backend iframe model.
- Hosted App base URL selection, Settings configuration, CLI URL override, and independent shell deployment cease to be local runtime contracts.
- Browser/PWA leader relay remains useful for Web presentation, but native process convergence is owned by daemon IPC.

## Risks and Mitigations

| Risk                                                     | Mitigation                                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two CLI processes race to start daemon                   | Treat successful IPC bind as the only winner; losers connect to the winner and validate version/mode.                                                            |
| Stale socket or PID causes unsafe takeover               | Probe the endpoint before Unix cleanup; never kill a PID solely from a stale file.                                                                               |
| Daemon restart loses authenticated Workspaces            | Keep credentials only in `serve` memory; reconnecting live leases re-register and rebind them.                                                                   |
| `serve` scripts hang on the App prompt                   | Prompt only when stdin/stdout are interactive TTYs; non-TTY defaults to Direct Web.                                                                              |
| `--web` ambiguity changes daemon unexpectedly            | Resolve meaning within the selected command and reject only explicit immutable-mode conflicts with an exact restart command.                                     |
| OpenTray import breaks Linux/headless                    | Dynamic import only in native presenter; focused tests fail if Web mode touches the extension.                                                                   |
| Native overlay and PWA overlay double inset              | One discriminated titlebar owner computes all CSS variables; inactive sources unsubscribe and contribute zero.                                                   |
| Open in browser leaks credential or opens arbitrary URLs | Resolve by registered Workspace id in daemon memory; materialize private URL only at the external opener boundary and never log it.                              |
| Bundled App assets drift from CLI                        | Build/copy in the package pipeline and assert exact packed files plus same-version health evidence.                                                              |
| App daemon expands into backend supervisor/proxy         | Keep IPC verbs presentation-only; forbid backend child ownership and HTTP/RPC/WebSocket forwarding in types and tests.                                           |
| Existing custom-shell users lose a feature               | Treat removal as the approved 6.1 product correction, update specs/docs/UI together, and keep separately deployed App usable manually without CLI configuration. |

## Verification Strategy

### Focused checkpoint evidence

1. CLI planner tests cover every row of the command matrix, TTY/non-TTY prompt outcomes, `--no-open`, mutually exclusive flags, legacy aliases, and exact mismatch diagnostics.
2. Daemon tests cover single-instance races, stale endpoints, version/mode status, bounded stop/restart, registration lease disconnect, restart re-registration, and credential/log redaction.
3. Presenter tests prove native bootstrap occurs once, repeat activation uses `toVisible()`/`focus()`, Web mode never imports WebView, Linux chooses Web, and packed native artifact resolution is valid.
4. App unit/component tests cover daemon Push -> Pull convergence, Workspaces terminology, iframe identity retention, Open in browser dispatch by Workspace id, and credential-free persisted state.
5. Titlebar adapter tests cover browser, PWA overlay, OpenTray overlay, native frame, geometry changes, source retirement, zero double-inset, and drag exclusion for interactive controls.
6. Config/docs tests prove `appBaseUrl`, `--app=<url>`, and Hosted App URL Settings are removed while CLI help and README examples match the parser.

Do not run full gates while a checkpoint's focused red/green evidence is unresolved.

### Package and CI evidence

- Run affected package typechecks and focused Vitest/component Playwright first.
- Build `packages/app`, build the CLI package, and inspect `pnpm pack --dry-run` for App assets, daemon entry, OpenTray closure, and platform-optional behavior.
- Exercise the real built CLI in an isolated home/runtime directory for start/status-equivalent activation, serve registration, stop, restart `--web`, and stale endpoint recovery without exposing credentials.
- Then run `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`, package builds, `git diff --check`, and strict OpenSpec validation.
- Open/update a feature-branch PR only after local gates pass; merge only after required CI passes.

### Owner acceptance boundary

The Agent provides exact setup, trigger, expected observation, and restore commands for:

- macOS/Windows native App first start, repeat activation, hide/show/focus, overlay hit regions, and daemon restart;
- Web daemon start and browser/PWA activation;
- multiple project Workspaces, Open in browser, backend exit, and daemon restart convergence;
- interactive prompt and immutable-mode mismatch diagnostics.

The Owner performs and records final Browser/PWA and OpenTray native-window acceptance. Automated Vitest and component Playwright evidence is preparation only.
