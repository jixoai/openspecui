<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Record the objective requirement: land the dry-run plan preview deferred by the 15.0.0 line (B1).
2. State the acceptance boundary in verifiable gates.
-->

## User Input

Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新" — the follow-up
discovered the 15.0.0 line had already landed on main (PR #312-#314, released 2026-10-25) with the
dry-run preview explicitly deferred ("B1 … a new cross-layer projection (out of scope)"); this loop
lands that deferred projection using the independently built implementation from the superseded
duplicate line (PR #315).

## Objective Scope

1. `updateDryRun` capability in `deriveOpenSpecCliCapabilities`.
2. Typed `UpdatePlan` contract (`changes`/`notes`/`failures`, closed enums, no rename action,
   failures-as-data beside exit 0, `update_error` envelope beside exit 1) + gated executor method.
3. `agentIntegrations.updatePlanPreview` read transport + Config Agents Update/Repair plan preview
   (unavailability never gates the real mutation).
4. Real-binary positive fixture (corrupt/delete → update/add rows → disk unwritten → settle → empty)
   and UpdatePlan first-party source anchors.
5. Repair the stale v9-era `check-openspec-reference.mjs` assertion to the v1.15 line.

## Non-Goals

- No standalone install surface projection (B2 stays deferred on main's recorded path).
- No changes to the real `updateStream`/`repairStream` mutation semantics.

## Acceptance Boundary

1. Focused lanes green: compat, workflow-contract (incl. UpdatePlan + real-binary fixture),
   upstream-contract (incl. UpdatePlan source lock), preview router (4 tests), dialog browser (4),
   config-agents/cli-runner unit lanes.
2. Core full suite green; core/server/web/cli typecheck green; format/lint green.
3. `check-openspec-reference.mjs` prints `OK: v1.15.0`.
