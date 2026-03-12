## Research Findings

- `release.yml` run `22981997263` now uses `node: v24.14.0` and `npm: 11.9.0`; the earlier Node 20/npm 10 Trusted Publishing failure mode is resolved.
- The new npm failure is `E422 Unprocessable Entity` with explicit provenance validation output: `package.json: "repository.url" is "", expected to match "https://github.com/jixoai/openspecui" from provenance`.
- All publishable workspace packages currently have `repository: null` in their source `package.json` files.
- The repository has a strict changeset gate: any non-test file change under `packages/*` requires a changeset. Adding metadata directly to `packages/web/package.json` would force a new version bump and would not publish the still-pending `2.1.0`.
- The current publish script already centralizes package publishing under `scripts/publish-packages.ts`, so publish-time manifest patching is available without touching package source files.

## Decision & Plan (For Approval)

- Extend the publish script to derive the canonical repository URL from CI environment or git remote.
- Before publishing a package, stage it into a temporary publish directory when its manifest lacks `repository.url`, inject the repository metadata there, and publish from that staged directory.
- Add unit tests for repository URL normalization and temporary manifest staging.
- Re-run local CI-equivalent checks, open/update a PR, merge after checks pass, and watch the next `release.yml` run until `@openspecui/web@2.1.0` is published.

## Capability Impact

### New or Expanded Behavior

- Publish tooling will be able to supply provenance-compatible repository metadata even when package source manifests omit it.

### Modified Behavior

- `pnpm release:packages` may publish from a generated temporary directory for packages that need manifest metadata completion.

## Risks and Mitigations

- Risk: repository URL derivation fails for non-GitHub or unusual remotes.
  - Mitigation: prefer explicit CI environment values (`GITHUB_SERVER_URL` + `GITHUB_REPOSITORY`) and fall back to normalized git remote parsing.
- Risk: temporary staging changes publish contents unexpectedly.
  - Mitigation: copy the existing publish directory byte-for-byte and patch only `package.json` repository metadata.

## Verification Strategy

- Local: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`.
- Targeted: publish-tool unit tests covering repository URL normalization and manifest injection.
- Real validation: merged `release.yml` run must succeed and publish `@openspecui/web@2.1.0`.
