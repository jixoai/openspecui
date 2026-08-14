<!--
Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
1. Give the Owner a command-exact Windows procedure against a real installed CLI tarball.
2. Separate daemon, backend, Workspace, native-window, and Browser presentation observations.
3. Verify PWA retirement instead of requiring the obsolete PWA installation flow.
4. Define PASS, FAIL, NOT RUN, evidence, and guarded cleanup without retaining credentials.

Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
Owner boundary (2026-07-20): final browser and native-window walkthroughs are performed by the Owner.
-->

# OpenTray App Mode Owner Acceptance

This walkthrough validates `integrate-app-mode-with-opentray` on Windows against the real packaged
CLI. Automated Vitest, browser-component, build, and installed-package smoke evidence prepares this
walkthrough but does not replace Owner judgment.

Record only:

- `PASS`, `FAIL`, or `NOT RUN` for each case;
- the exact Git commit, Windows version, and OpenTray availability;
- the shortest reproduction plus redacted screenshots or Console evidence.

Never record credentials, Authorization headers, private URL fragments, or complete daemon logs.

## 0. Build and install the candidate

Run from the repository root in PowerShell:

```powershell
$ErrorActionPreference = 'Stop'
$Repo = (Get-Location).Path
$Head = (git rev-parse HEAD).Trim()
$Lab = Join-Path $env:TEMP ("openspecui-owner-acceptance-" + [guid]::NewGuid().ToString('N'))
$PackRoot = Join-Path $Lab 'pack'
$InstallRoot = Join-Path $Lab 'install'
$Home = Join-Path $Lab 'home'

New-Item -ItemType Directory -Path $PackRoot,$InstallRoot,$Home | Out-Null
$env:OPENSPECUI_HOME = $Home
$env:OPENSPEC_SPAWN_MODE = 'worker'

pnpm --filter openspecui build
pnpm --filter openspecui pack --pack-destination $PackRoot
$Tarball = Get-ChildItem -LiteralPath $PackRoot -Filter 'openspecui-*.tgz' | Select-Object -First 1
if (-not $Tarball) { throw 'The candidate tarball was not created.' }

Push-Location $InstallRoot
try {
  pnpm init
  pnpm add --ignore-workspace --offline $Tarball.FullName
} finally {
  Pop-Location
}

$Cli = Join-Path $InstallRoot 'node_modules\.bin\openspecui.cmd'
if (-not (Test-Path -LiteralPath $Cli)) { throw 'The installed openspecui.cmd shim is missing.' }

& $Cli --version
if ($LASTEXITCODE -ne 0) { throw 'The installed CLI did not report its version.' }
& $Cli stop

Write-Output "HEAD=$Head"
Write-Output "LAB=$Lab"
Write-Output "CLI=$Cli"
Write-Output "PROJECT_A=$Repo"
Write-Output "PROJECT_B=$(Join-Path $Repo 'references\openspec')"
```

PASS:

- build, pack, and offline installation exit with code `0`;
- `$Cli` points into `$InstallRoot`, never repository source output;
- installed `dist/cli.mjs`, `app/index.html`, `web/index.html`, and Windows `.ico` assets exist;
- the reported version is the candidate package version;
- the printed `$Head` is recorded with the final result.

The pnpm warning that build scripts for `@parcel/watcher` or `better-sqlite3` were ignored is not by
itself a failure. The installed runtime cases below remain the authority.

### Terminal bootstrap

Keep the setup terminal as `T0`. Paste the following block into `T0` and each additional PowerShell
terminal (`T1`, `T2`, `T3`), using the values printed above:

```powershell
$Repo = '<PROJECT_A>'
$Lab = '<LAB>'
$Cli = '<CLI>'
$Home = Join-Path $Lab 'home'
$env:OPENSPECUI_HOME = $Home
$env:OPENSPEC_SPAWN_MODE = 'worker'

function Test-BackendHealth([int]$Port) {
  try {
    return (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 5).StatusCode -eq 200
  } catch {
    return $false
  }
}

function Assert-BackendHealth([int]$Port) {
  if (-not (Test-BackendHealth $Port)) { throw "Backend $Port is not healthy." }
}
```

Project identities used below:

```text
A = <PROJECT_A>
B = <PROJECT_A>\references\openspec
```

Both backend commands remain foreground processes. Do not convert them into background services.

## AT-01 Interactive App admission

In `T0`:

```powershell
& $Cli stop
```

In interactive terminal `T1`:

```powershell
& $Cli serve $Repo --port 33101
```

The terminal must display:

```text
Start OpenSpecUI App? [Y/n]
```

Press Enter.

PASS:

- one native App daemon starts before backend A;
- A appears once in `Workspaces`;
- `T1` stays in the foreground and displays the backend URL;
- no second App shell appears and the daemon does not adopt the backend process.

FAIL: no prompt, obsolete `Sessions` copy, duplicate App windows, or daemon-owned backend lifetime.

Restore: press `Ctrl+C` once in `T1`, then run `& $Cli stop` in `T0`.

Repeat the same `serve` command and answer `n`.

PASS: Direct Project Web opens, no App daemon starts, and one `Ctrl+C` stops the foreground Server.

## AT-02 Two Workspaces and Open in browser

In `T0`:

```powershell
& $Cli start
```

In `T1`:

```powershell
& $Cli serve $Repo --app --port 33101
```

In `T2`:

```powershell
& $Cli serve (Join-Path $Repo 'references\openspec') --app --port 33102
```

In `T0`:

```powershell
Assert-BackendHealth 33101
Assert-BackendHealth 33102
```

PASS:

- one OpenTray App window contains A and B as separate Workspaces;
- tab changes preserve both Project Web documents and current state;
- clicking each `Open in browser` icon opens the matching Direct Project Web target;
- the icon has an accessible name/tooltip and never removes or reconstructs the App tab;
- no arbitrary URL input or private credential fragment is exposed.

Keep `T1` and `T2` running for AT-03 through AT-06.

## AT-03 Repeated activation and retained native window

In `T0`:

```powershell
& $Cli start
& $Cli start
```

PASS: both commands focus the same native window; A/B tabs and current selection remain stable; no
additional daemon, native window, or App document is created.

Hide the native window with its close control, then run:

```powershell
& $Cli start
```

PASS: the retained window becomes visible and focused with A/B state intact; first-launch size and
position are not replayed and no blank reconstruction flash occurs.

## AT-04 Daemon restart does not own backends

In `T0`:

```powershell
Assert-BackendHealth 33101
Assert-BackendHealth 33102
& $Cli stop
Assert-BackendHealth 33101
Assert-BackendHealth 33102
& $Cli start
```

PASS:

- A and B remain healthy while the daemon is stopped;
- the restarted App restores both live-lease Workspaces without restarting `T1` or `T2`.

FAIL: daemon stop kills a backend, permanently loses a Workspace, or requires a backend refresh.

## AT-05 Host mode is immutable

With the native daemon running, execute in `T0`:

```powershell
& $Cli start --web
if ($LASTEXITCODE -eq 0) { throw 'Native-to-Web start unexpectedly succeeded without restart.' }
```

The diagnostic must state:

```text
OpenSpecUI App daemon is running in native mode. Run openspecui restart --web to change startup mode.
```

Then execute:

```powershell
& $Cli restart --web
Assert-BackendHealth 33101
Assert-BackendHealth 33102
```

PASS: the native window settles before the Browser-hosted bundled App opens; A/B backends never stop
and reappear as two Workspaces. FAIL: host mode mutates in place, a stale native window remains, or a
backend is terminated.

Keep the Web daemon for AT-06.

## AT-06 Web host and PWA retirement

In `T0`:

```powershell
& $Cli start --web
& $Cli start --web
```

PASS:

- both commands activate the same-version bundled Browser App;
- A/B Workspaces remain stable;
- the page has no native bridge and uses ordinary Browser titlebar presentation with zero native inset;
- no PWA install action, web manifest, service-worker update owner, or launch-handler flow is exposed;
- the Console contains no `@opentray/ext-webview` initialization error.

Optional Console checks in the bundled App document:

```javascript
document.querySelector('link[rel="manifest"]') === null
await navigator.serviceWorker.getRegistrations()
```

Expected: the manifest expression is `true` and the registration list is empty for this loopback App
origin. The removed PWA flow must be recorded as retired, not `NOT RUN` and not replaced by component
test evidence.

Restore native mode in `T0`:

```powershell
& $Cli restart
```

Wait for the native App and A/B Workspaces to return.

## AT-07 macOS OpenTray overlay and hit regions

Run only on an available macOS native App host. Record `NOT RUN` on Windows; Windows evidence cannot
substitute for this case.

1. Resize the window to approximately 700 px, then back to desktop width.
2. Confirm traffic-light controls never overlap AppHeader or Workspace tabs.
3. Drag from non-interactive titlebar space.
4. Press and drag from Workspace tabs, Open in browser, Close, navigation controls, and inputs.

PASS: blank titlebar space drags the window; interactive controls remain clickable/selectable and do
not become caption regions; resize creates no double inset, page-level horizontal scrolling, or
occluded control; late geometry cannot mutate layout after its source retires.

## AT-08 Windows native-frame baseline

Run only when the Windows OpenTray native host is available. Otherwise record `NOT RUN`; do not infer
PASS from browser or component automation.

In `T0`:

```powershell
& $Cli start
```

PASS:

- the window uses the Windows system native frame and never imitates macOS overlay behavior;
- the window resizes normally and does not show duplicate titlebars or stale frames;
- repeated `start` focuses the retained window;
- App controls never enter the system caption region;
- unsupported overlay capability is not loaded.

## AT-09 Direct Web and foreground Server shutdown

Keep `T1` and `T2` running. In `T0`:

```powershell
& $Cli stop
Assert-BackendHealth 33101
Assert-BackendHealth 33102
```

In `T3`:

```powershell
& $Cli serve $Repo --web --port 33103
```

PASS: Direct Project Web opens and no App daemon starts. Press `Ctrl+C` once in `T3`.

In `T0`:

```powershell
if (Test-BackendHealth 33103) { throw 'Direct Web Server 33103 is still listening.' }
Assert-BackendHealth 33101
Assert-BackendHealth 33102
```

PASS: one foreground interrupt releases `33103`; A/B remain healthy. FAIL: a second interrupt is
required, a daemon starts implicitly, or stopping one foreground Server affects another backend.

## 1. Cleanup and result

Press `Ctrl+C` once in `T1` and `T2`. Then run in `T0`:

```powershell
& $Cli stop
if (Test-BackendHealth 33101) { throw 'Backend 33101 is still listening.' }
if (Test-BackendHealth 33102) { throw 'Backend 33102 is still listening.' }
git status --short
```

Record results before removing the lab. When no reproduction evidence remains necessary:

```powershell
$ResolvedLab = (Resolve-Path -LiteralPath $Lab).Path
$ResolvedTemp = (Resolve-Path -LiteralPath $env:TEMP).Path
$ExpectedPrefix = 'openspecui-owner-acceptance-'

if (-not $ResolvedLab.StartsWith($ResolvedTemp + [IO.Path]::DirectorySeparatorChar)) {
  throw "Refusing to remove a path outside TEMP: $ResolvedLab"
}
if (-not [IO.Path]::GetFileName($ResolvedLab).StartsWith($ExpectedPrefix)) {
  throw "Refusing to remove a non-acceptance directory: $ResolvedLab"
}

Remove-Item -LiteralPath $ResolvedLab -Recurse -Force
Remove-Item Env:OPENSPECUI_HOME -ErrorAction SilentlyContinue
Remove-Item Env:OPENSPEC_SPAWN_MODE -ErrorAction SilentlyContinue
```

Result template:

```text
HEAD:
Windows version:
OpenTray native host available: yes/no

AT-00 Build/install: PASS | FAIL
AT-01 Interactive admission: PASS | FAIL | NOT RUN
AT-02 Workspaces/Open in browser: PASS | FAIL | NOT RUN
AT-03 Retained native window: PASS | FAIL | NOT RUN
AT-04 Daemon/backend ownership: PASS | FAIL | NOT RUN
AT-05 Immutable host mode: PASS | FAIL | NOT RUN
AT-06 Web host/PWA retirement: PASS | FAIL
AT-07 macOS overlay: PASS | FAIL | NOT RUN
AT-08 Windows native frame: PASS | FAIL | NOT RUN
AT-09 Direct Web shutdown: PASS | FAIL

Failures and shortest reproductions:
```

Any `FAIL` keeps Owner acceptance open. `NOT RUN` never becomes `PASS`. Only the Owner may close tasks
10.2-10.4; Agent automation must not update those checkboxes.
