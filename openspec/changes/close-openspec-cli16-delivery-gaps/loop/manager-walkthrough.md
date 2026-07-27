<!--
Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
1. Provide the manager-owned final browser walkthrough topology and commands.
2. Record pass/fail evidence for checkpoints 6.7-6.12 without treating automation as acceptance.
3. Preserve manager-reported blockers and their exact retest boundary.
4. Transfer accepted follow-up debt and failed checkpoints to one named successor Change.

Original request (2026-07-20): "以后任何需要最终端到端的浏览器走查，就交给我来做。"
Original request (2026-07-27): "我已经全面走查了，结果是指的肯定的，绝大部分功能基本都通过了，更多的问题是在一些 UI/UX 的问题上，这属于后续需要打磨的问题，我个人觉得可以收尾 change，然后另外开 change 来专门打磨。"
-->

# Manager Walkthrough: OpenSpec CLI 1.6 Delivery Gaps

The manager completed this ledger against PR #207 candidate `5a4d2d0`. The core CLI 1.6 delivery is accepted. Failed
or accepted-with-follow-up experience work transfers to `refine-live-projection-experience`; automation does not
override the manager's observations.

## Environment Topology

Use three disposable OpenSpec 1.6 projects. A and B share one effective data home; C uses another. Prepare the
lab, start one App surface, then launch all three backends into it:

```bash
export WALK=openspec/changes/close-openspec-cli16-delivery-gaps/walkthrough
export LAB=/tmp/openspecui-cli16-walkthrough

bun "$WALK/lab.sh.ts" prepare --lab "$LAB"

# One foreground terminal each
bun "$WALK/run.sh.ts" app --lab "$LAB"
bun "$WALK/run.sh.ts" backend a --lab "$LAB"
bun "$WALK/run.sh.ts" backend b --lab "$LAB"
bun "$WALK/run.sh.ts" backend c --lab "$LAB"
```

Keep each backend terminal visible. Use only disposable Stores for mutation checks.

## Acceptance Ledger

### 6.7 Gated auto-launch

- [x] A opens as the intended App tab and reaches current health, RPC data, WebSocket updates, and Terminal.
- [x] The credential fragment disappears before normal use and is absent from the visible URL and persisted tabs.
- Result / defect:
  - **Accepted with follow-up.** The embedded iframe does not declare the Clipboard permission. Terminal paste through
    `navigator.clipboard.readText()` is blocked by the iframe Permissions Policy and logs `NotAllowedError`.

### 6.8 Gate rejection and reconnect

Open `http://127.0.0.1:3111` without a fragment, then with `#credential=invalid`. Also stop and restart A while its
App tab remains open.

- [ ] Missing and invalid credentials are visibly `authentication-required`, never `offline` or current success.
- [x] Valid A reconnects to current data and its iframe observes the disconnect/reconnect.
- Result / defect:
  - **Failed and transferred.** `open a --credential missing|invalid` remains in a Loading state while health and
    tRPC requests return 401 and PTY repeatedly reports `UNAUTHORIZED`. Rejection is objective, but the presentation
    never converges to `authentication-required` and the repeated work produces console noise.
  - **Follow-up.** On one disconnect the iframe changed immediately while SessionTabs retained its prior icon; a
    later replay changed to Offline immediately. Treat this as an intermittent observation-to-tab convergence defect,
    not evidence that reconnect itself failed.

### 6.9 Multi-environment targeting

Keep A, B, and C running. In Store Manager, use the `Backend` selector to choose
`http://localhost:3112` (B); this changes the same active tab used by Sessions and does not disconnect A. In
Inspector, select `mutation-store`, run `Unregister`, and inspect the lifecycle evidence before navigating away.

- [x] Select B while A remains online; a Store action is dispatched only to B.
- [x] A and B group under one opaque `envUri`; C is a distinct environment.
- [x] Duplicate or replaced same-locator tabs do not inherit a retired tab's mutation authority.
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
  - **Passed on 2026-07-27.** The manager's full replay accepted targeting, grouping, and retained-tab authority.

### 6.10 Store lifecycle

Register or set up one disposable Store, then run one unregister/remove action. During one operation, disconnect and
rejoin the selected backend. Separately submit one request with rejected authentication.

- [x] The UI exposes `accepted -> running -> terminal` and retains evidence across disconnect/rejoin.
- [x] A rejected pre-admission request shows its concrete error and does not fabricate `indeterminate` completion.
- Result / defect:
  - **Accepted with follow-up.** Operations settle correctly, but feedback is delayed and visually abrupt. Blurring
    and refocusing the document appears to reconstruct the Inspector panel, so presentation continuity and request/
    focus ownership require separate investigation.

### 6.11 Context Matrix

- [x] A, B, and C show only observed Root and direct Reference relationships with exact source/Store provenance.
- [x] Root errors remain errors, retained evidence is visibly stale, and no text claims machine-wide completeness.
- Result / defect:
  - **Passed on 2026-07-27.** No completeness or provenance defect was reported.

### 6.12 Static and responsive App

Export a Reference-bearing disposable project with an explicit policy, then inspect desktop and mobile widths:

```bash
bun "$WALK/inspect.sh.ts" export-static a --open --lab "$LAB"

# Equivalent direct CLI invocation; rebuild instead of relying on old dist-ssg output.
pnpm --filter @openspecui/web build:ssg
pnpm openspecui -- export --dir "$LAB/project-a" --format html \
  --output "$LAB/static-a" --references include --open
```

- [ ] Static Reference list/detail states present published snapshot policy without invented live CLI evidence.
- [ ] App desktop/mobile layouts remain readable, operable, non-overlapping, and visually accepted by the manager.
- Result / defect:
  - **Failed and transferred.** The walkthrough export cannot import
    `packages/web/dist-ssg/server/entry-server.js`, so the static result cannot be accepted even though clean SSG build
    previously passed as preparation evidence.
  - **Failed and transferred.** Store Inspector overflows horizontally on mobile. Sessions also overflows vertically:
    `AppHeader + SessionTabs + TabIframe` exceeds the viewport because the Sessions surface budgets its own `100vh`
    instead of consuming the App shell's remaining block size.

## Return Boundary

Manager closure decision: accept the CLI 1.6 delivery baseline, preserve `6.8` and `6.12` as failed, and transfer all
listed follow-ups to `refine-live-projection-experience`. PR #207 may merge after its closure-doc checks pass. This
Change may then archive with the explicit incomplete-task warning; no release is implied.
