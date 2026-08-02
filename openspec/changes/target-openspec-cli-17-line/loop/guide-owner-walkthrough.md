<!--
Orthogonal intents (created 2026-08-02 Asia/Shanghai):
1. Give the owner executable Adaptive Config Guide acceptance cases at the production UI boundary.
2. Separate automated preparation evidence from owner-owned visual and interaction acceptance.
3. Record exact setup, trigger, PASS/FAIL observations, and restoration without credentials or private URLs.

Original request (2026-08-02): the owner performs final visual walkthroughs; the agent supplies development, unit tests, and component Playwright preparation.
-->

# Adaptive Config Guide Owner Walkthrough

## Evidence Boundary

- Prepared against repository HEAD `5c08136edb478a2433e67fa94149a61b2fac4dab` with the uncommitted
  `target-openspec-cli-17-line` Apply worktree.
- Automated evidence proves reducer, owner-signal selection, orchestration, Driver adapter configuration, and basic
  Chromium component geometry. It does **not** claim final visual acceptance.
- Automated preparation is green: Web Unit `177/177` files and `1093/1093` tests; component Chromium `5/5` files and
  `7/7` tests; Storybook browser `4/4` files and `12/12` tests.
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
- The Guide skips only objectively ready stages and stops at the first required, warning, stale, blocked, failed, or
  active-edit stage.

**FAIL**

- Initialization auto-runs, targets a Store/Active Root, installs Agents, or exposes success before replacement
  projections settle.
- Driver presentation marks the Guide complete without a current usable Resolved Context.

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
- Restore the original Store value or save a valid replacement; only the replacement Project Binding projection
  resumes the Guide.

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

- Ready Project Binding is skipped; Active Root is shown as required rather than ready.
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
- Saving policy or completing Init/Update/Repair resumes only after the Agent replacement projection arrives.

**FAIL**

- Driver callbacks authorize policy mutation, command execution, or readiness.
- Inventory-only Push discards the dirty policy draft.

## Case 5 — Resolved Context Completion Barrier

**Trigger**

1. Let Project Binding, Active Root, and Agent Delivery reach objective ready states.
2. In Chrome DevTools Network, select `Offline` before Resolved Context refresh settles.
3. Restore `Online` and wait for the replacement Context projection.

**PASS**

- Retained Context is classified stale/failed, remains visible, and does not complete the Guide.
- Completion appears only after authority is current, OpenSpec CLI is available, and `planningRoot` is usable.
- The completion popover has no Back action that could fabricate a completed-to-review transition.

## Case 6 — Keyboard, Focus, Reduced Motion, and Restart

**Trigger**

1. In DevTools Rendering, emulate `prefers-reduced-motion: reduce`.
2. Focus the Config `Guide` button and start the Guide.
3. Exercise Driver `Back`/`Continue` with keyboard focus where those actions are available.
4. Press `Escape` while the Guide is active.
5. Start again, navigate back to Config overview, and click `Restart Guide`.

**PASS**

- Reduced-motion presentation has no animated/smooth-scroll transition.
- `Escape` cancels through OpenSpecUI and restores focus to the original Guide trigger.
- Restart re-evaluates current projections and begins at the first unresolved stage; it does not reuse a stale stage
  index or fabricate readiness.

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
| 1. Initialize and Start Guide       | PENDING | `5c08136edb478a2433e67fa94149a61b2fac4dab` | Owner walkthrough required |
| 2. Project Binding active edit      | PENDING | `5c08136edb478a2433e67fa94149a61b2fac4dab` | Owner walkthrough required |
| 3. Active Root required/raw/warning | PENDING | `5c08136edb478a2433e67fa94149a61b2fac4dab` | Owner walkthrough required |
| 4. Agent Delivery replacement       | PENDING | `5c08136edb478a2433e67fa94149a61b2fac4dab` | Owner walkthrough required |
| 5. Resolved Context barrier         | PENDING | `5c08136edb478a2433e67fa94149a61b2fac4dab` | Owner walkthrough required |
| 6. Keyboard/focus/restart           | PENDING | `5c08136edb478a2433e67fa94149a61b2fac4dab` | Owner walkthrough required |
