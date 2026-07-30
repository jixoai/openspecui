<!--
Orthogonal intents (created 2026-07-30 Asia/Shanghai):
1. Give the owner exact production-boundary setup, trigger, PASS/FAIL, and restore steps.
2. Cover managed Workspace lifecycle, path-first presentation, Environment-scoped Stores, and continuity.
3. Record the tested implementation head without credentials or private launch fragments.
4. Preserve the owner-only final browser acceptance boundary.

Original request (2026-07-30): "我让另外一个 Agent 做了个开头，但我觉得它们做偏了，请你直接接手任务，review，并真正完成相关工作，我来做最终的 review"
-->

# Owner Walkthrough: Workspaces and Stores

Implementation head under review: `bb9e82e08dcbc17d80b2d6e9a28b394a14a6768c`.

Automated preparation is green for the Change-owned Core, Server content, App, CLI, and Chromium fixtures. These
cases are the final production walkthrough and remain owner-only acceptance.

## Shared Setup

Run from `/Users/kzf/Dev/GitHub/jixoai-labs/openspecui`:

```bash
test ! -e /tmp/openspecui-owner-home
test ! -e /tmp/openspecui-owner-alias
test ! -e /tmp/openspecui-owner-manual-home
test ! -e /tmp/openspecui-owner-env-a
test ! -e /tmp/openspecui-owner-env-b
test ! -e /tmp/openspecui-owner-store-a
test ! -e /tmp/openspecui-owner-store-b
mkdir -p /tmp/openspecui-owner-home /tmp/openspecui-owner-alias
ln -s /Users/kzf/Dev/GitHub/jixoai-labs/openspecui /tmp/openspecui-owner-alias/openspecui
export OPENSPECUI_HOME=/tmp/openspecui-owner-home
pnpm --filter @openspecui/app build
pnpm openspecui start --web
```

PASS: one Browser-hosted App opens and its primary navigation contains only Workspaces and Stores; Settings remains
secondary. FAIL: Connections or Environment remains primary, the App shell is stale, or startup needs a project URL.

## 1. Home, Favorites, and History

Setup: use the shared App with no running project.

Trigger:

1. Open Workspaces.
2. Confirm Home is the first selected tab.
3. Enter `/Users/kzf/Dev/GitHub/jixoai-labs/openspecui` in the path form and submit.
4. Return to Home, favorite the directory, reload the App, then unfavorite it.

PASS: Home cannot close or reorder; Favorites are above the form and Recent is below; submit locks until admission;
the successful canonical path survives reload; favorite state changes without removing history. FAIL: a project
iframe replaces Home, failed/pending input enters history, credentials/URL/port appear in the catalog, or reload loses
the favorite.

Restore: leave the managed backend running for cases 2-4.

## 2. Canonical Path Dedupe

Setup: case 1 is running and `/tmp/openspecui-owner-alias/openspecui` is the symlink from Shared Setup.

Trigger: submit `/tmp/openspecui-owner-alias/openspecui` from Home.

PASS: the existing Workspace is focused; running navigation and Task Manager still contain one backend for the
physical repository; Recent contains one canonical identity. FAIL: another backend, port, Workspace, or history row
is created.

Restore: none.

## 3. Close, Stop, and Restart

Setup: the managed Workspace from case 1 is open.

Trigger:

1. Close only its project tab.
2. Confirm it remains in running navigation and Task Manager, then reopen it from running navigation.
3. In Task Manager choose Stop and confirm.
4. Start the same path again from Home, then run `pnpm openspecui restart --web` in the setup terminal.

PASS: tab Close preserves the service; explicit Stop removes its backend/Workspace but preserves favorite/history;
restart restores exactly one managed backend and Workspace. FAIL: Close kills the backend, Stop leaves the Server
alive, restart duplicates or loses it, or history/favorite is removed.

Restore: keep the restored backend for case 4.

## 4. Running Navigation, Task Manager, and Labels

Setup: start `/Users/kzf/Dev/GitHub/jixoai-labs/openspecui/references/openspec` from Home as a second managed project.

Trigger: expand Workspaces navigation, switch between both entries, then open Task Manager.

PASS: every running backend appears once; titles prefer verified GitHub `org/repo` and otherwise use the folder name;
available branch is the subtitle; full path is retrievable; host/port is not a title or selector; each managed row has
exact Stop and favorite controls. FAIL: a backend is absent, a port is primary, selection opens the wrong Workspace,
or Task Manager claims an unsupported external process kill.

Restore: Stop the `references/openspec` managed backend in Task Manager.

## 5. Launcher and Manual Connection

Setup: in a second terminal run:

```bash
OPENSPECUI_HOME=/tmp/openspecui-owner-manual-home pnpm openspecui serve /Users/kzf/Dev/GitHub/jixoai-labs/openspecui/example --no-open --port 33101
```

Trigger:

1. Press `+` in Workspaces.
2. Confirm the direct plane is the candidate list, not a URL form.
3. Enter `Connect another backend...`, submit `http://localhost:33101`, then close and reopen that Workspace.
4. Use the row menu to forget the manual candidate.

PASS: manual input is secondary; successful connect creates one Workspace; the closed candidate can reopen without a
duplicate; Forget is distinct from tab Close; concrete offline/authentication/compatibility states remain direct.
FAIL: URL input is primary, credentials persist, one candidate creates multiple tabs, or unavailable state becomes a
generic silent failure.

Restore: press Ctrl+C in the second terminal, then run `rm -rf /tmp/openspecui-owner-manual-home`.

## 6. Multiple Environments and Same Store Id

Setup stores:

```bash
XDG_DATA_HOME=/tmp/openspecui-owner-env-a node references/openspec/bin/openspec.js store setup shared --path /tmp/openspecui-owner-store-a --no-init-git --json
XDG_DATA_HOME=/tmp/openspecui-owner-env-b node references/openspec/bin/openspec.js store setup shared --path /tmp/openspecui-owner-store-b --no-init-git --json
```

Start two external backends in separate terminals:

```bash
XDG_DATA_HOME=/tmp/openspecui-owner-env-a OPENSPECUI_HOME=/tmp/openspecui-owner-home pnpm openspecui serve /Users/kzf/Dev/GitHub/jixoai-labs/openspecui --app --no-open --port 33111
```

```bash
XDG_DATA_HOME=/tmp/openspecui-owner-env-b OPENSPECUI_HOME=/tmp/openspecui-owner-home pnpm openspecui serve /Users/kzf/Dev/GitHub/jixoai-labs/openspecui/references/openspec --app --no-open --port 33112
```

Trigger: open Stores, select each Environment, and open Store `shared` in each.

PASS: multiple Environments require explicit selection; each has its own `shared` row/detail and opaque Environment
identity; backend URL is not the product selector; the two Store routes never merge. FAIL: the first Environment is
silently selected, one `shared` row replaces the other, or Store id alone survives route reload as identity.

Restore: keep both foreground backends for cases 7-8.

## 7. Store Detail and Cleanup Semantics

Setup: select Environment A and open `shared` Store Detail.

Trigger:

1. Inspect health, observed-only Usage, readonly Specs/active Changes, repository facts, and diagnostics disclosure.
2. Choose Unregister, type `shared`, and confirm. Verify `/tmp/openspecui-owner-store-a` still exists.
3. Re-register it with:
   `XDG_DATA_HOME=/tmp/openspecui-owner-env-a node references/openspec/bin/openspec.js store register /tmp/openspecui-owner-store-a --id shared --json`
4. Open Detail again, choose Remove store files, type `shared`, and confirm.

PASS: errors/blockers are direct and healthy raw evidence is collapsed; content regions settle independently;
Unregister removes only registry membership; Remove deletes `/tmp/openspecui-owner-store-a`; each Dialog remains
locked until its exact Server-ledger terminal record. FAIL: Doctor health hides cleanup, both commands delete files,
the Dialog closes on admission alone, or editable OPSX actions appear in Store Detail.

Restore: none for Store A; it was intentionally removed.

## 8. Authority Retirement and Retained Reads

Setup: select Environment B, open `shared`, and open its Unregister Dialog without submitting.

Trigger: stop the Environment B foreground backend with Ctrl+C, then try to submit the still-open Dialog. Restart the
same Environment B command from case 6 and return to Store Detail.

PASS: the stale Dialog cannot dispatch and reports authority retirement; retained readonly evidence may remain labelled
but does not authorize mutation; after the source returns, current Store data converges without cross-Environment
fallback. FAIL: the stale action runs through Environment A, retained data becomes current authority, or the page
fabricates an empty Store as success.

Restore: keep the restarted Environment B backend for case 9.

## 9. Responsive Surfaces

Setup: use browser responsive mode at 320px, 640px, and 1024px widths.

Trigger: inspect Home, Launcher, running navigation, Task Manager, Stores index, Store Detail, and the overlay titlebar
at each width.

PASS: no page-level horizontal overflow or incoherent overlap; controls retain stable dimensions; Store rows move from
one readable column to denser alignment; long paths wrap/truncate with retrievable full values. FAIL: nested cards,
double inline scroll owners, clipped commands, overlapping labels, or titlebar controls cover App content.

Restore: return the browser to its normal size.

## 10. Workspace Document Continuity

Setup: open a managed Workspace and wait for its Project Web iframe to settle.

Trigger: create a visible in-iframe state (route, scroll position, or open panel), navigate Workspaces -> Stores index
-> Store Detail -> Workspaces, then select the same Workspace.

PASS: the exact iframe Document remains mounted and its visible state survives; Stores observation does not recreate
the Workspace. FAIL: the iframe reloads, returns to Dashboard root, loses state, or a duplicate tab/frame appears.

## Final Restore

Stop both foreground backend terminals, then run:

```bash
OPENSPECUI_HOME=/tmp/openspecui-owner-home pnpm openspecui stop
rm -rf /tmp/openspecui-owner-home
rm -rf /tmp/openspecui-owner-alias
rm -rf /tmp/openspecui-owner-env-a
rm -rf /tmp/openspecui-owner-env-b
rm -rf /tmp/openspecui-owner-store-b
```

Record PASS/FAIL per case against implementation head `bb9e82e08dcbc17d80b2d6e9a28b394a14a6768c`. Do not
record credentials, Authorization headers, private launch fragments, or daemon runtime snapshots in the result ledger.
