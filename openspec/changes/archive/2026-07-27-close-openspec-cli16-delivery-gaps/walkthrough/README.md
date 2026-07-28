<!--
Orthogonal intents (created 2026-07-27 Asia/Shanghai):
1. Give the manager one reproducible disposable topology for walkthrough checkpoints 6.7-6.12.
2. Map each manual checkpoint to the helper command that prepares or restores its objective evidence.
3. Preserve the manager-only final browser, visual, responsive, and multi-tab acceptance boundary.

Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
-->

# Walkthrough Command Tools

These tools prepare commands and disposable OpenSpec data for the manager walkthrough. They do not inspect the
browser or decide any acceptance checkbox.

## Quick Start

Run from the repository root. Override `LAB` to use another disposable directory.

```bash
export WALK=openspec/changes/close-openspec-cli16-delivery-gaps/walkthrough
export LAB=/tmp/openspecui-cli16-walkthrough

bun "$WALK/lab.sh.ts" prepare --lab "$LAB"
```

Open four terminals and leave the backend terminals visible. `--auth` remains in each backend foreground process,
so generated Access Gate credentials are not redirected into a log file.

```bash
# Terminal 1
bun "$WALK/run.sh.ts" app --lab "$LAB"

# Terminal 2
bun "$WALK/run.sh.ts" backend a --lab "$LAB"

# Terminal 3
bun "$WALK/run.sh.ts" backend b --lab "$LAB"

# Terminal 4
bun "$WALK/run.sh.ts" backend c --lab "$LAB"
```

The backend startup commands open their credential-bearing App targets. Do not copy those fragments into persistent
notes, URLs, or logs.

## Checkpoint Helpers

| Checkpoint | Command                                                          | Purpose                                                               |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| 6.7        | `bun "$WALK/run.sh.ts" status --lab "$LAB"`                      | Shows App reachability and expected unauthenticated health 401s.      |
| 6.8        | `bun "$WALK/run.sh.ts" open a --credential missing --lab "$LAB"` | Opens the no-fragment page.                                           |
| 6.8        | `bun "$WALK/run.sh.ts" open a --credential invalid --lab "$LAB"` | Opens the invalid-fragment page.                                      |
| 6.9        | `bun "$WALK/inspect.sh.ts" stores shared --lab "$LAB"`           | Confirms the shared `mutation-store` is available before selecting B. |
| 6.9/6.10   | `bun "$WALK/inspect.sh.ts" restore-mutation-store --lab "$LAB"`  | Restores only the disposable shared Store after unregister/remove.    |
| 6.11       | `bun "$WALK/inspect.sh.ts" context a --lab "$LAB"`               | Prints A Doctor and Context evidence; repeat for B/C.                 |
| 6.12       | `bun "$WALK/inspect.sh.ts" export-static a --open --lab "$LAB"`  | Rebuilds SSG, then produces and opens A's Reference-bearing output.   |

The `open` command is macOS-specific. Use `--print-only` to print its exact URL instead:

```bash
bun "$WALK/run.sh.ts" open a --credential invalid --print-only --lab "$LAB"
```

## Lab Contents

```
$LAB/
├── project-a/          references shared-reference; shared XDG data home
├── project-b/          references shared-reference; shared XDG data home
├── project-c/          references distinct-reference; distinct XDG data home
├── stores/
│   ├── shared-reference/   Reference-bearing static export fixture
│   ├── mutation-store/    disposable Store Manager mutation target
│   └── distinct-reference/
├── data-shared/        A/B Store registry
└── data-distinct/      C Store registry
```

Reset only this disposable lab:

```bash
bun "$WALK/lab.sh.ts" prepare --reset --lab "$LAB"
bun "$WALK/lab.sh.ts" clean --lab "$LAB"
```

Both commands refuse a directory without the private walkthrough marker. Record each final result in
[`../loop/manager-walkthrough.md`](../loop/manager-walkthrough.md); report a failed checkpoint as the shortest
reproducible defect rather than treating any helper output as acceptance.
