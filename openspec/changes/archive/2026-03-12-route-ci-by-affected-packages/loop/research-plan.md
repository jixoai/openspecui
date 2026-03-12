## Research Findings

- The current `PR Quality` workflow still runs the whole `Fast Gate` for any non-changeversion PR, even when only one package changes.
- Workspace package dependencies are declared in `package.json` for most packages, so reverse-dependency closure can be computed from workspace manifests.
- `@openspecui/web` has implicit project-specific dependents not expressed as workspace dependencies: `@openspecui/app` and `@openspecui/website` import `../web/src` through tsconfig/vite aliases.
- Browser validation already has package boundaries: `xterm-input-panel` and `@openspecui/web`.
- Shared root files such as `package.json`, `pnpm-lock.yaml`, workflow files, and CI scripts should still trigger broad coverage because they affect multiple subprojects or the CI machinery itself.

## Decision & Plan (For Approval)

- Add a repository script that computes CI scope from `git diff`, workspace manifests, reverse dependencies, and known implicit edges.
- Use that scope in `PR Quality` so `Fast Gate` can run in one of four modes: `skip`, `reference-only`, `scoped`, or `full`.
- Route browser shards from the same scope object so unrelated browser suites are skipped without changing protected check names.
- Keep `Changeset Gate` unchanged.
- Run full local CI-equivalent checks before opening the PR, then watch CI, archive the loop, and merge.

## Capability Impact

### New or Expanded Behavior

- PR CI can target only the affected workspace packages and browser suites for many package-local changes.

### Modified Behavior

- `Fast Gate` no longer always runs full workspace checks; it switches behavior based on computed affected scope.
- Browser shard routing is driven by the same affected-scope model instead of ad hoc path checks.

## Risks and Mitigations

- Risk: scope detection misses a hidden dependency and under-tests a PR.
  - Mitigation: treat unknown/root/shared files as `full`, include reverse-dependency closure, and encode known implicit edges explicitly.
- Risk: workflow logic becomes hard to reason about.
  - Mitigation: move scope computation into a versioned script with unit tests instead of embedding all logic in shell.
- Risk: protected checks break when jobs are skipped.
  - Mitigation: keep `Fast Gate` and `Browser Gate` as stable aggregate check names that pass explicitly when scope says no work is required.

## Verification Strategy

- Unit-test the CI scope script against representative change sets.
- Workflow parse validation for `.github/workflows/pr-quality.yml`.
- Local repository validation: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`.
- CI acceptance: PR checks must pass, including scoped browser shards and the protected aggregate checks.
