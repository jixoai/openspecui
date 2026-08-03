<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Give the owner executable Adaptive Config Guide acceptance cases at the production UI boundary.
2. Separate automated preparation evidence from owner-owned visual and interaction acceptance.
3. Record exact setup, trigger, PASS/FAIL observations, and restoration without credentials or private URLs.

Original request (2026-08-02): the owner performs final visual walkthroughs; the agent supplies development, unit tests, and component Playwright preparation.
Owner correction (2026-08-03): a fully ready Guide must not flicker into completion, and the Spotlight uses one SVG even-odd bevel hole.
-->

# Adaptive Config Guide Owner Walkthrough

## Evidence Boundary

- Prepared against repository HEAD `353e3d5f94e961bd72abf21e2b729686980e37ed` with the uncommitted
  `target-openspec-cli-17-line` Apply worktree.
- Automated evidence proves reducer, owner-signal selection, orchestration, headless presentation ownership, and basic
  Chromium component geometry. It does **not** claim final visual acceptance.
- Automated preparation is green: Web Unit `178/178` files and `1102/1102` tests; component Chromium `5/5` files and
  `9/9` tests; Storybook browser `4/4` files and `12/12` tests.
- The Config Guide Chromium fixture uses the real Base UI Popover plus one SVG even-odd Spotlight mask. It proves the
  hole hits the real target, the painted exterior hits the mask, the target stays free of `inert`, every ready stage
  requires Continue, and cancellation/completion remove the overlay and popover. It also proves missing-target failure
  centers a usable OpenSpecUI surface and focuses Retry.
- Record each case as `PASS` or `FAIL` against the exact tested `git rev-parse HEAD`; do not record credentials,
  Authorization headers, launch fragments, or private backend URLs.

## Shared Setup

```bash
cd /Users/kzf/Dev/GitHub/jixoai-labs/openspecui
git rev-parse HEAD
pnpm exec openspec --version
export GUIDE_TMP="$(mktemp -d /tmp/openspecui-guide-XXXXXX)"
git -C "$GUIDE_TMP" init
pnpm openspecui serve "$GUIDE_TMP" --web --port 3317
```

Expected setup facts:

1. `openspec --version` reports a `1.7.x` release.
2. Direct Project Web opens for the temporary Launch Project.
3. The temporary project initially has no local `openspec/` directory.

Automated preparation commands already executed:

```bash
pnpm --filter @openspecui/web test
pnpm --filter @openspecui/web test:browser:ci
```

## Case 1 — Initialize and Start Guide

**Trigger**

1. Observe the automatic Initialize Project Alert.
2. Confirm that the proposed command is exactly the JSON argv equivalent of
   `openspec init "$GUIDE_TMP" --tools=none`.
3. Click `Initialize` and wait for terminal settlement.
4. Click `Start Guide` from the same successful Alert.

**PASS**

- No command runs before explicit confirmation.
- The successful Alert remains the same surface and exposes `[Ok] [Start Guide]` only after local and dependent
  projections settle.
- `Start Guide` begins the Config Guide without opening a second Dialog.
- Every stage remains visible. A current ready stage enables Continue, while required, warning, stale, blocked, failed,
  or active-edit stages keep Continue disabled.

**FAIL**

- Initialization auto-runs, targets a Store/Active Root, installs Agents, or exposes success before replacement
  projections settle.
- Presentation marks the Guide complete without a current usable Resolved Context.

## Case 2 — Project Binding Active Edit and Replacement Resume

**Setup**

1. Open `Config → Project Binding`.
2. Change the `Planning Store` draft but do not save it.
3. In DevTools Console, start the same page-runtime Guide owner:

```js
window.dispatchEvent(new Event('openspecui:start-config-guide'))
```

**PASS**

- The Guide focuses the Project Binding semantic target and reports an active edit.
- Next/Continue cannot advance while the draft is dirty.
- Restore the original Store value or save a valid replacement; the replacement Project Binding projection unlocks
  Continue but does not advance until clicked.

**FAIL**

- Clicking presentation controls skips the dirty stage.
- Route navigation destroys the Guide runtime or creates a second Project Binding subscription.

## Case 3 — Active Root Required, Raw YAML, and Warning Pause

**Setup**

```bash
cp "$GUIDE_TMP/openspec/config.yaml" "$GUIDE_TMP/openspec/config.yaml.guide-backup"
rm "$GUIDE_TMP/openspec/config.yaml"
```

Open `Config`, click `Guide`, and let filesystem/projection replacement settle.

**PASS**

- Ready Project Binding remains visible and requires Continue; Active Root is then shown as required rather than ready.
- Creating and saving a valid Structured or Raw YAML document leaves the Guide paused until the replacement Active
  Root projection arrives.
- Invalid YAML or official diagnostics remain failed/warning and cannot be skipped.
- Unknown team keys remain writable through Raw YAML.

**Restore**

```bash
mv "$GUIDE_TMP/openspec/config.yaml.guide-backup" "$GUIDE_TMP/openspec/config.yaml"
```

## Case 4 — Agent Delivery Edit and Replacement Resume

**Trigger**

1. Open `Config → Agents`.
2. Change `Profile`, `Delivery`, or workflow selection without saving.
3. Start the Guide from DevTools Console using the Case 2 event.

**PASS**

- The Guide pauses at Agent Delivery while the policy draft or command is active.
- A partial, cleanup, drift, or migration issue remains a warning and does not auto-skip.
- Saving policy or completing Init/Update/Repair unlocks Continue only after the Agent replacement projection arrives;
  it does not advance automatically.

**FAIL**

- Driver callbacks authorize policy mutation, command execution, or readiness.
- Inventory-only Push discards the dirty policy draft.

## Case 5 — Resolved Context Completion Barrier

**Trigger**

1. Let Project Binding, Active Root, and Agent Delivery reach objective ready states and explicitly Continue each stage.
2. In Chrome DevTools Network, select `Offline` before Resolved Context refresh settles.
3. Restore `Online` and wait for the replacement Context projection.

**PASS**

- Retained Context is classified stale/failed, remains visible, and does not complete the Guide.
- Completion appears only after authority is current, OpenSpec CLI is available, and `planningRoot` is usable.
- Completion remains anchored to the mounted Resolved Context semantic target instead of floating from viewport center.
- Done and Close are both visible, themed, and usable; clicking Done removes both overlay and popover and restores normal
  page interaction.
- The completion popover has no Back action that could fabricate a completed-to-review transition.

**FAIL**

- Completion uses a virtual-center target while Resolved Context is mounted.
- Done/Close are missing, clipped, unthemed, or cannot dismiss both the overlay and popover.

## Case 6 — Keyboard, Focus, Reduced Motion, and Restart

**Trigger**

1. In DevTools Rendering, emulate `prefers-reduced-motion: reduce`.
2. Focus the Config `Guide` button and start the Guide.
3. Exercise `Back`/`Continue` with keyboard focus where those actions are available.
4. Press `Escape` while the Guide is active.
5. Start again, navigate back to Config overview, and click `Restart Guide`.

**PASS**

- Reduced-motion presentation has no animated/smooth-scroll transition.
- `Escape` cancels through OpenSpecUI and restores focus to the original Guide trigger.
- Restart re-evaluates current projections and begins at Project Binding; it does not reuse a stale stage index,
  fabricate readiness, or auto-skip ready stages.

## Case 7 — Fully Ready Explicit Progression and SVG Bevel Mask

**Setup**

1. Ensure Project Binding, Active Root, Agent Delivery, and Resolved Context all report current ready state.
2. Open `Config` and click `Guide` once.

**PASS**

- Project Binding remains the first visible step without flickering through routes or opening Configuration complete.
- Each ready stage exposes Continue and remains stable until Continue is explicitly clicked.
- Configuration complete appears only after Continue is clicked on ready Resolved Context.
- DevTools Elements shows one `[data-config-guide-overlay]` SVG and one
  `[data-config-guide-overlay-mask]` path, not four overlay block elements.
- Pointer input inside the bevel hole reaches the real semantic target; pointer input in the painted exterior is blocked.
- Supporting browsers mirror the target's computed bevel radii. Safari and any browser without `corner-shape: bevel`
  use square hole corners rather than simulated round corners.

**FAIL**

- Any projection observation advances a stage, the Guide reaches completion without Continue, or route/popover flicker
  returns.
- The mask uses multiple blocking rectangles, captures the hole, draws round corners, or diverges from the square
  unsupported-browser fallback.

## Shared Restore

```bash
# Stop the foreground server with Ctrl-C, then:
test ! -f "$GUIDE_TMP/openspec/config.yaml.guide-backup" || \
  mv "$GUIDE_TMP/openspec/config.yaml.guide-backup" "$GUIDE_TMP/openspec/config.yaml"
rm -rf "$GUIDE_TMP"
unset GUIDE_TMP
```

## Result Ledger

| Case                                | Result  | Exact HEAD                                 | Observation                |
| ----------------------------------- | ------- | ------------------------------------------ | -------------------------- |
| 1. Initialize and Start Guide       | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
| 2. Project Binding active edit      | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
| 3. Active Root required/raw/warning | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
| 4. Agent Delivery replacement       | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
| 5. Resolved Context barrier         | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
| 6. Keyboard/focus/restart           | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
| 7. Ready steps and SVG bevel mask   | PENDING | `353e3d5f94e961bd72abf21e2b729686980e37ed` | Owner walkthrough required |
