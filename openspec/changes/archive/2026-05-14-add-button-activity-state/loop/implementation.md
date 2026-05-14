## Implementation State

- Approved path: create a shared Button primitive with an independent `activity` state, then migrate clear fulfilled-action call sites.
- Current phase: implementation complete and scoped verification passed.

## Completed Work

- OpenSpec intake captured objective user requirement.
- Research plan recorded the key API decision: `activity` is a Button state, not a `variant`.
- Added `packages/web/src/components/button.tsx` with `variant`, `size`, and orthogonal `activity` props.
- Added focused Button tests covering activity semantics, ordinary click behavior, and native disabled behavior.
- Migrated `Settings > Terminal > Shells` default action to a Button activity state.
- Migrated `Enable System Notifications` `Enabled` action to a Button activity state.
- Migrated fulfilled Save/Apply states in Settings for terminal, dashboard, git, CLI command, API URL, and app base URL controls.
- Migrated fulfilled Save/Apply states in Config for schema file save, project config save, global config editor save, and profile apply.
- Added focused tests for notification and shell-profile activity behavior.

## Verification Run

- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/button.test.tsx src/components/notifications/notification-settings.test.tsx src/components/terminal/terminal-invocation-settings/shell-profile-settings.test.tsx`
- `pnpm --filter @openspecui/web exec tsc --noEmit --pretty false`
- `pnpm --filter @openspecui/web exec prettier --check src/components/button.tsx src/components/button.test.tsx src/components/notifications/notification-settings.tsx src/components/notifications/notification-settings.test.tsx src/components/terminal/terminal-invocation-settings/shell-profile-settings.tsx src/components/terminal/terminal-invocation-settings/shell-profile-settings.test.tsx src/routes/settings.tsx src/routes/config.tsx`

## Decisions Taken

- Keep `disabled` for real blocking states: pending, invalid input, permission denied, unsupported browser, static/read-only mode, running command.
- Use `activity` for fulfilled states: already default, already enabled, no unsaved changes, already applied.
- Activity buttons stay in the tab order by default because they remain discoverable status actions, but Button guards against firing `onClick`.

## Divergence Notes

- `packages/web/src/components/terminal/terminal-invocation-settings.test.tsx` still times out at Vitest's 5s default when run directly. The activity behavior was moved to a focused `shell-profile-settings.test.tsx` test instead of adding more assertions to that broad integration test.
- `CHAT.md` had unrelated existing/local edits and was left untouched.

## Loopback Triggers

- If migration reveals that a target button's disabled state encodes both fulfilled and blocked states without a clean split, pause and update the research plan before changing it.
- If activity styling conflicts with existing ButtonGroup or tab active states, keep the Button primitive scoped and avoid rewriting segmented controls in this loop.
