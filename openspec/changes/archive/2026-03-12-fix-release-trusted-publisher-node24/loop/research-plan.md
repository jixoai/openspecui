## Research Findings

- The post-merge `release.yml` run `22981029227` reached the actual publish step and failed only on `@openspecui/web@2.1.0` with `npm error code E404` during `PUT https://registry.npmjs.org/@openspecui%2fweb`.
- The same runner log shows `actions/setup-node@v4` configured `node: v20.20.0`, `npm: 10.8.2`, and exported `NPM_CONFIG_USERCONFIG=/home/runner/work/_temp/.npmrc` because the workflow sets `registry-url`.
- Local npm checks confirm `@openspecui/web` already exists, is owned by `kezhaofeng`, and has `public` access, so the failure is not package ownership or visibility.
- `npm/cli#8730` reports repeated Trusted Publishing `E404` failures when using older npm/Node combinations and when setup introduces `.npmrc`-based auth precedence. Reported fixes include Node 24/npm 11.5+ and avoiding `registry-url`-generated `.npmrc` during publish.

## Decision & Plan (For Approval)

- Update `.github/workflows/release.yml` to use Node 24 instead of Node 20.
- Remove `registry-url` from `actions/setup-node@v4` so the workflow no longer injects a temporary `.npmrc` that can interfere with Trusted Publishing.
- Keep the Bun setup and publish script unchanged.
- Re-run local CI-equivalent checks, open a PR, merge after checks pass, and watch the next `release.yml` run until `@openspecui/web@2.1.0` is published.

## Capability Impact

### New or Expanded Behavior

- The release workflow will run on a Trusted Publishing compatible Node/npm runtime.

### Modified Behavior

- The release workflow will stop configuring npm registry auth through `setup-node`, leaving npm Trusted Publishing to negotiate credentials directly.

## Risks and Mitigations

- Risk: `E404` is caused by an npm-side Trusted Publisher typo rather than the runner runtime.
  - Mitigation: this workflow fix addresses the two concrete runner-level incompatibilities exposed by the failure log; if the next run still fails, the remaining cause is narrowed to npm-side publisher configuration.
- Risk: changing Node version affects install or script behavior.
  - Mitigation: keep the change minimal and rerun the full local CI-equivalent checks before updating the PR.

## Verification Strategy

- Local: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`.
- CI: PR checks must pass on the workflow-only diff.
- Real validation: merged `release.yml` run must succeed and publish `@openspecui/web@2.1.0`.
