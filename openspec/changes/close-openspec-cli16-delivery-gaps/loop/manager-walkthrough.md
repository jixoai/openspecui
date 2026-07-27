<!--
Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
1. Provide the manager-owned final browser walkthrough topology and commands.
2. Record pass/fail evidence for checkpoints 6.7-6.12 without treating automation as acceptance.
3. Preserve manager-reported blockers and their exact retest boundary.

Original request (2026-07-20): "以后任何需要最终端到端的浏览器走查，就交给我来做。"
-->

# Manager Walkthrough: OpenSpec CLI 1.6 Delivery Gaps

The P6 candidate is currently a local, uncommitted worktree; the earlier PR #207 evidence does not prove this
candidate. Run this ledger against the local candidate before any delivery commit. This is the remaining product
acceptance boundary. The Agent does not execute or pre-check these browser steps.

## Environment Topology

Use three disposable OpenSpec 1.6 projects. A and B share one effective data home; C uses another. Start one App
surface, then launch all three backends into it:

```bash
pnpm --filter @openspecui/app dev --host 127.0.0.1 --port 13005 --strictPort

XDG_DATA_HOME="$LAB/data-shared" pnpm openspecui -- "$LAB/project-a" \
  --port 3111 --app=http://127.0.0.1:13005 --auth
XDG_DATA_HOME="$LAB/data-shared" pnpm openspecui -- "$LAB/project-b" \
  --port 3112 --app=http://127.0.0.1:13005 --auth
XDG_DATA_HOME="$LAB/data-distinct" pnpm openspecui -- "$LAB/project-c" \
  --port 3113 --app=http://127.0.0.1:13005 --auth
```

Keep each backend terminal visible. Use only disposable Stores for mutation checks.

## Acceptance Ledger

### 6.7 Gated auto-launch

- [ ] A opens as the intended App tab and reaches current health, RPC data, WebSocket updates, and Terminal.
- [ ] The credential fragment disappears before normal use and is absent from the visible URL and persisted tabs.
- Result / defect:

### 6.8 Gate rejection and reconnect

Open `http://127.0.0.1:3111` without a fragment, then with `#credential=invalid`. Also stop and restart A while its
App tab remains open.

- [ ] Missing and invalid credentials are visibly `authentication-required`, never `offline` or current success.
- [ ] Valid A reconnects to current data; invalid/missing WebSocket admission does not expose stale success.
- Result / defect:

### 6.9 Multi-environment targeting

Keep A, B, and C running. In Store Manager, use the `Backend` selector to choose
`http://localhost:3112` (B); this changes the same active tab used by Sessions and does not disconnect A. In
Inspector, select `mutation-store`, run `Unregister`, and inspect the lifecycle evidence before navigating away.

- [ ] Select B while A remains online; a Store action is dispatched only to B.
- [ ] A and B group under one opaque `envUri`; C is a distinct environment.
- [ ] Duplicate or replaced same-locator tabs do not inherit a retired tab's mutation authority.
- Result / defect:
  - Blocked on 2026-07-26: opening B made A report `authentication-required`; opening C then made B report it,
    and C failed after its next background health refresh. Diagnostics proved the three backend credentials
    remained stable, but each App window held only the credential it directly consumed.
  - Candidate correction: the relay is now App-root-owned across every route; all live windows absorb each new
    locator credential and the leader ACK returns its existing in-memory binding snapshot to the source window.
    Focused Vitest and typecheck evidence are green. Manager must restart this A/B/C step from fresh App windows;
    6.9 remains unchecked until the complete grouping, selection, and Store-action behavior passes.
  - Blocked again on 2026-07-26: Store Inspector requested all-Store Doctor as
    `/trpc/stores.doctor?input=null`; the optional Router accepts absent input or an object and rejected `null` with
    HTTP 400. The corrected client omits `input` for all-Store Doctor and retains object input for an explicitly
    supplied id. Store Manager now visibly selects the same global `activeTabId` used by Sessions, so B can be
    chosen without disconnecting A. Focused client/route tests and App typecheck are green; manager must retest the
    real B `mutation-store` Unregister lifecycle before 6.9 closes.

### 6.10 Store lifecycle

Register or set up one disposable Store, then run one unregister/remove action. During one operation, disconnect and
rejoin the selected backend. Separately submit one request with rejected authentication.

- [ ] The UI exposes `accepted -> running -> terminal` and retains evidence across disconnect/rejoin.
- [ ] A rejected pre-admission request shows its concrete error and does not fabricate `indeterminate` completion.
- Result / defect:

### 6.11 Context Matrix

- [ ] A, B, and C show only observed Root and direct Reference relationships with exact source/Store provenance.
- [ ] Root errors remain errors, retained evidence is visibly stale, and no text claims machine-wide completeness.
- Result / defect:

### 6.12 Static and responsive App

Export a Reference-bearing disposable project with an explicit policy, then inspect desktop and mobile widths:

```bash
pnpm openspecui -- export "$LAB/project-a" --format static \
  --output "$LAB/static-a" --references include --open
```

- [ ] Static Reference list/detail states present published snapshot policy without invented live CLI evidence.
- [ ] App desktop/mobile layouts remain readable, operable, non-overlapping, and visually accepted by the manager.
- Result / defect:

## Return Boundary

Report each checkpoint as `pass` or provide the shortest reproducible defect. The reviewer will update the Change,
reopen only the failed production owner, and will not merge, archive, or release before all six manager checkpoints
are explicitly accepted.
