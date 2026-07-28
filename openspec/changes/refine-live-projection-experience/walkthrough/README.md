<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Give the owner reproducible commands for Web/App loading and retained-content walkthroughs.
2. Separate same-Server refresh, fresh-Server cold computation, and filesystem invalidation evidence.
3. Preserve owner-only final browser, visual, responsive, and multi-tab acceptance.
4. Route the owner to command-exact acceptance cases and a disposable result ledger.

Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
Original request (2026-07-28): "我需要非常具体的验收工具和验收流程"
-->

# Live Projection Walkthrough Tools

These tools prepare a disposable two-project environment and objective command evidence. They do not automate,
interpret, or replace the owner's browser and visual acceptance.

The numbered PASS/FAIL procedure is [`ACCEPTANCE.md`](./ACCEPTANCE.md). `prepare` also creates the owner-owned
result ledger at `$LAB/acceptance-results.md` from [`RESULTS.template.md`](./RESULTS.template.md).

## Prepare

Run from the repository root:

```bash
export WALK=openspec/changes/refine-live-projection-experience/walkthrough
export LAB=/tmp/openspecui-live-projection-walkthrough

bun "$WALK/lab.sh.ts" prepare --lab "$LAB"
bun "$WALK/lab.sh.ts" describe --lab "$LAB"
bun "$WALK/inspect.sh.ts" stores --lab "$LAB"
```

Open three foreground terminals. The backend commands generate Access Gate credentials and open their App targets;
keep those credentials in the terminal/browser session rather than writing them to files.

```bash
# Terminal 1
bun "$WALK/run.sh.ts" app --lab "$LAB"

# Terminal 2
bun "$WALK/run.sh.ts" backend a --lab "$LAB"

# Terminal 3
bun "$WALK/run.sh.ts" backend b --lab "$LAB"
```

Check process reachability without consuming credentials:

```bash
bun "$WALK/run.sh.ts" status --lab "$LAB"
```

## Walkthrough Matrix

| Surface                       | Owner observation                                                                                                                                  | Trigger                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Web Dashboard                 | A same-Server browser refresh may show retained Summary immediately as display-only, then converge locally; Trends/Git remain independent regions. | Refresh backend A's Dashboard without restarting backend A.                      |
| Fresh Server                  | Cold Summary computation may still take about ten seconds; this is an admitted limitation, not a retained-reload pass.                             | Restart backend A, then open its Dashboard.                                      |
| Web lists/details             | Page chrome and retained sibling content stay mounted; only unresolved local regions use stable geometry.                                          | Navigate Dashboard, Changes, Archive, Specs, Context, Git, Config, and Settings. |
| App Connections/Environment   | Checking rows stay present; unresolved environments do not claim an authoritative empty result.                                                    | `bun "$WALK/mutate.sh.ts" config a --lab "$LAB"`                                 |
| App Store Inventory/Inspector | Existing Store data stays visible during revalidation; an initial Pull does not wait for a WebSocket notice.                                       | `bun "$WALK/mutate.sh.ts" store --lab "$LAB"`                                    |
| App Context Matrix            | Settled project evidence remains visible while only the affected Root attempt updates.                                                             | `bun "$WALK/mutate.sh.ts" config b --lab "$LAB"`                                 |
| App Sessions                  | Leaving and returning to Sessions preserves each hosted iframe Document and tab state.                                                             | Navigate between Sessions and any App-native route.                              |
| Web Spec projections          | A project Spec invalidation produces local revalidation rather than a route-wide wait.                                                             | `bun "$WALK/mutate.sh.ts" spec a --lab "$LAB"`                                   |

The owner performs the actual browser and multi-tab observations. Record a failure as the shortest surface/trigger
pair; do not infer acceptance from a successful mutation command.

Exact helpers used by the numbered procedure:

```bash
bun "$WALK/run.sh.ts" open a --credential missing --lab "$LAB"
bun "$WALK/run.sh.ts" open a --credential invalid --lab "$LAB"
bun "$WALK/inspect.sh.ts" restore-responsive-store --lab "$LAB"
bun "$WALK/inspect.sh.ts" export-static a --open --lab "$LAB"
```

## Objective Checks

Replay focused unit evidence:

```bash
bun "$WALK/run.sh.ts" verify --lab "$LAB"
```

Measure isolated cold/reload projection phases. This benchmark starts its own Server and is not browser evidence:

```bash
bun "$WALK/run.sh.ts" benchmark a --scenario dashboard --lab "$LAB"
bun "$WALK/run.sh.ts" benchmark a --scenario dashboard-page --lab "$LAB"
bun "$WALK/run.sh.ts" benchmark a --scenario changes-page --lab "$LAB"
```

Inspect or restore mutation sources:

```bash
bun "$WALK/mutate.sh.ts" status --lab "$LAB"
bun "$WALK/mutate.sh.ts" reset --lab "$LAB"
```

## Cleanup

Only the marker-owned disposable lab can be reset or removed:

```bash
bun "$WALK/lab.sh.ts" prepare --reset --lab "$LAB"
bun "$WALK/lab.sh.ts" clean --lab "$LAB"
```

The scripts refuse cleanup when the walkthrough marker is absent or invalid.
