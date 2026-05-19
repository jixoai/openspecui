## Research Findings

- `evaluate-vite-node-runtime-build` established that `tsx` does not automatically select the `development` export condition; explicit `NODE_OPTIONS=--conditions=development` is required for source resolution.
- Local experiments from that research showed `tsx` with explicit development conditions can resolve workspace-symlink packages to source `.ts` entries, while default resolution falls back to built `dist` entries.
- Current Node-facing package builders remain `tsdown`; this change should not replace the builder.
- `packages/cli/src/index.ts`, `packages/cli/src/export.ts`, and `packages/cli/src/worktree-instance-manager.ts` import `@openspecui/server` by package name.
- `packages/server/src/*` imports `@openspecui/core` and several `@openspecui/core/*` subpaths by package name.
- `packages/cli/tsconfig.json` already maps `@openspecui/server` and `@openspecui/core` to source for TypeScript typechecking, but runtime execution follows package exports unless a runtime loader/condition changes resolution.
- `packages/core/package.json` has many subpath exports. Adding `development` branches must cover at least the subpaths consumed by CLI/server runtime paths, not only the root entry.
- `packages/server/package.json` currently exports only `"."` to `./dist/index.mjs`.
- `packages/cli/package.json` currently exports `"."` and `"./hooks"` to dist outputs, and `bin.openspecui` points to `./dist/cli.mjs`.
- `bin` entries cannot be conditional exports. Published CLI startup must continue to use built `dist/cli.mjs`.
- Worktree handoff command selection currently has source-vs-dist logic in `createWorktreeServerCommand`; that logic can be simplified later, but the immediate law should ensure source-mode child processes inherit the development condition.
- The active checkout contains unrelated handoff and document translation changes. Implementation must touch only files owned by this change.

## Decision & Plan (For Approval)

Proceed with a narrow implementation:

1. Add a CLI test fixture for package export condition resolution.
   - It should model workspace-style package self-reference.
   - It should prove default mode resolves `dist`.
   - It should prove explicit `development` conditions resolve source.
2. Add BDD coverage for OpenSpecUI package exports.
   - Check `openspecui`, `@openspecui/server`, and `@openspecui/core` expose `development` branches for needed entries.
   - Check default exports remain present and point to built artifacts.
3. Add BDD coverage for worktree child runtime environment.
   - Source-mode worktree command should carry `NODE_OPTIONS=--conditions=development` while preserving existing `NODE_OPTIONS` content.
   - Built/package-mode command should not force the development condition unless explicitly inherited from the parent.
4. Implement conditional exports.
   - Add `development` branches to root and required subpath exports in `packages/core/package.json`.
   - Add `development` root export to `packages/server/package.json`.
   - Add `development` branches to `packages/cli/package.json` root and `./hooks`.
5. Implement dev runtime condition propagation.
   - Update dev scripts that run source TypeScript to set the development condition.
   - Update worktree command creation so source-mode child commands inherit the condition through `NODE_OPTIONS`.
6. Verify focused tests and OpenSpec validation.

## Capability Impact

### New or Expanded Behavior

- Workspace development can resolve OpenSpecUI package self-references to source TypeScript through an explicit runtime condition.
- Worktree child servers spawned from a source-mode parent inherit the development runtime condition.
- Package exports become the source of truth for dev-vs-published runtime resolution instead of ad hoc path detection alone.

### Modified Behavior

- Development scripts that run `tsx` source entries will include explicit development export conditions.
- Package export maps for `openspecui`, `@openspecui/server`, and `@openspecui/core` will include `development` branches.
- Published/default package behavior should remain unchanged.

## Risks and Mitigations

- Risk: Existing `NODE_OPTIONS` may be overwritten.
  - Mitigation: append `--conditions=development` only when missing, preserving existing options.
- Risk: TypeScript source exports could be selected by unsupported runtimes.
  - Mitigation: only dev scripts opt into the `development` condition; default exports remain built JS.
- Risk: Conditional export ordering can accidentally prefer `default` before `development`.
  - Mitigation: add tests that inspect export maps and resolve with explicit conditions.
- Risk: Adding only root `development` exports leaves subpath imports on dist.
  - Mitigation: cover required `@openspecui/core/*` and `openspecui/hooks` subpaths.
- Risk: Changes overlap with the active worktree handoff fix in `worktree-instance-manager.ts`.
  - Mitigation: keep edits additive and focused on environment condition propagation.

## Verification Strategy

- Red/green BDD:
  - `pnpm --filter openspecui test -- src/worktree-instance-manager.test.ts`
  - Add/run package export condition tests in the CLI package.
- Focused runtime smoke:
  - Run a source-mode worktree handoff child and confirm health capabilities are advertised.
  - Confirm no stale `packages/cli/dist/cli.mjs` child is used in source mode.
- Type checks:
  - `pnpm --filter openspecui typecheck`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/core typecheck`
- Metadata checks:
  - package export maps preserve default published entries.
  - package scripts preserve existing commands while adding explicit dev condition.
- OpenSpec:
  - `openspec validate --all --strict --no-interactive`
