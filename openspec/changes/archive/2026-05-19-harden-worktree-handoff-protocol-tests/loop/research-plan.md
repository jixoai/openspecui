## Research Findings

- The current worktree handoff readiness gate lives in `packages/cli/src/worktree-instance-manager.ts`.
- `waitForServerReady()` currently accepts a sibling server when `/api/health` is reachable and `payload.projectDir === targetPath`.
- `/api/health` already returns `openspecuiVersion`, `hostedShellProtocolVersion`, and `embeddedUiUrl`, but the worktree manager does not validate protocol compatibility before returning a handoff.
- `packages/core/src/hosted-app.ts` defines `HOSTED_SHELL_PROTOCOL_VERSION` and validates hosted backend health for hosted app launch, but worktree handoff uses a weaker local readiness check.
- `packages/web/src/lib/server-handoff.ts` preserves route/search/hash during handoff; that behavior must remain unchanged for compatible targets.
- `packages/web/src/lib/use-subscription.ts` directly subscribes to `trpcClient.notifications.subscribe`.
- Current source has `notifications.subscribe`, but stale built `packages/server/dist` / `packages/cli/dist` may not. A newer Web bundle can therefore connect to an older sibling backend after worktree switch.
- Main-checkout runtime testing confirmed the source/dist drift can still exist after the source fix lands: `http://127.0.0.1:3100/api/health` advertised `runtimeCapabilities`, while stale child/target processes on `3102` and `3103` still returned project health without `runtimeCapabilities`.
- The root startup cause is command selection, not notification rendering: when the parent CLI runtime is `packages/cli/src`, child worktree servers must not prefer an existing `packages/cli/dist/cli.mjs`, because that dist entry can lag behind the current source runtime.
- `NotificationProvider` reads `config?.notifications.systemNotificationsEnabled`; this protects `config` but not a missing `notifications` section.
- Existing tests cover command selection and router `git.switchWorktree`, but there is no reusable fixture that models healthy-compatible, healthy-incompatible, and stale-runtime worktree handoff behavior.
- Prior handoff recovery work established route preservation and real-browser handoff acceptance as important evidence; this change extends that law from liveness to protocol/capability compatibility.

## Decision & Plan (For Approval)

Adopt a worktree runtime compatibility law.

- A sibling worktree server is not ready merely because it is alive and points at the requested project directory.
- A sibling worktree server is ready only when it exposes a compatible OpenSpecUI runtime protocol and the capabilities required by the current Web shell.
- The compatibility contract belongs to the runtime/platform layer, not to the Git page or notification feature.
- Worktree handoff tests become a reusable test platform and a required verification gate for changes that alter runtime protocols, subscriptions, config schema, server startup, or bundled CLI-served UI.

Execution plan:

1. Add BDD tests first:
   - compatible target passes readiness and returns handoff;
   - projectDir-only healthy target with incompatible or missing protocol is rejected;
   - stale runtime simulation rejects a target that lacks required capability advertisement;
   - `NotificationProvider` does not crash when config lacks `notifications`;
   - route/search/hash preservation remains unchanged for compatible handoff.
2. Add a shared worktree handoff test harness:
   - local HTTP health fixture;
   - typed health payload builders;
   - compatible/incompatible scenario helpers;
   - reusable assertions for handoff result and rejection.
3. Extend the platform health/capability model:
   - define runtime capabilities in core;
   - include them in `/api/health`;
   - reuse the same validation in hosted health and worktree readiness.
4. Refactor worktree manager readiness and startup to validate compatibility through the shared contract and keep child runtime mode aligned with the parent runtime mode.
5. Harden notification/config atom defaults without making notifications a special handoff case.
6. Update OpenSpec specs/checkpoints to make worktree handoff verification explicit for future feature classes.

## Capability Impact

### New or Expanded Behavior

- `/api/health` advertises runtime capabilities needed by cross-runtime Web shells.
- Worktree handoff rejects servers that do not satisfy the runtime compatibility contract.
- Source-mode worktree handoff starts child servers through the workspace dev command instead of stale local dist artifacts.
- Tests can simulate sibling worktree runtime compatibility without spawning a full real worktree server for each case.
- Future feature changes that add runtime subscriptions/config/capabilities have an explicit worktree handoff verification path.

### Modified Behavior

- `WorktreeInstanceManager` readiness checks become stricter: legacy or stale servers that only match `projectDir` are no longer accepted.
- Notification UI defaults tolerate missing `config.notifications` during startup and compatibility edges.
- Compatible handoff continues to preserve route/search/hash.

## Risks and Mitigations

- Risk: strict compatibility rejects old but otherwise usable local worktree servers.
  Mitigation: reject before navigation with an actionable error rather than loading a broken Web shell.
- Risk: runtime capability lists become a second local truth.
  Mitigation: define capability constants in core and have the server advertise them from the same module consumed by validators/tests.
- Risk: tests become slow if every case spawns real CLI/server processes.
  Mitigation: encapsulate most BDD cases in lightweight HTTP health fixtures and keep real process/browser checks scoped to acceptance gates.
- Risk: new feature teams forget worktree handoff verification.
  Mitigation: encode the rule in OpenSpec spec/checkpoints and expose a reusable harness so the cost is low.
- Risk: optional feature degradation hides protocol mismatches.
  Mitigation: handoff compatibility fails at platform readiness; atom-level fallback only protects already-rendering trees from missing optional sections.

## Verification Strategy

- Run the new BDD tests and observe failure before implementation.
- Focused unit tests:
  - `packages/cli/src/worktree-instance-manager.test.ts`
  - new shared handoff harness tests if placed separately
  - `packages/web/src/lib/notifications/context.test.tsx`
  - `packages/web/src/lib/git-panel.test.ts` or `server-handoff` route preservation tests
- Focused server/core tests for health payload capability shape.
- Run package typechecks for touched packages.
- Run `openspec validate --all --strict --no-interactive`.
- If runtime/static bundle behavior changes materially, run the relevant browser or SSG gate and document any scoped skip.
