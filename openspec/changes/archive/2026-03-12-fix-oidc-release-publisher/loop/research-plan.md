## Research Findings

- The failed workflow authenticated successfully enough to generate provenance and reach npm publish.
- All packages except `@openspecui/web` were already published; the failure only affected the unpublished package.
- `changeset publish` in this repository delegates to `pnpm publish` for workspace packages.
- npm official Trusted Publishing documentation centers on `npm publish --provenance` rather than `pnpm publish`.
- `@openspecui/web` exists on npm, is public, and the local maintainer account has read-write access.
- The failure mode is therefore more consistent with publisher/tooling path mismatch than with missing package ownership.

## Decision & Plan (For Approval)

- Replace the release publish executor with a custom script that:
  - discovers public workspace packages
  - filters to versions not yet present on npm
  - publishes them in dependency order using `npm publish --provenance`
  - runs `changeset tag` after successful publish
- Keep `release.yml` as the GitHub executor, but point it at the new publish script instead of `changeset publish`.
- Re-run the GitHub release workflow on `main` after merging the fix.

## Capability Impact

### New or Expanded Behavior

- GitHub release automation will use the npm CLI directly for actual package publication.

### Modified Behavior

- `release:packages` will no longer rely on `changeset publish` for publication.
- Tags will still be generated from Changesets after the npm publish step succeeds.

## Risks and Mitigations

- Risk: publish order could be wrong when multiple packages are unpublished.
  - Mitigation: compute internal dependency order before publishing.
- Risk: tag generation could diverge from prior behavior.
  - Mitigation: continue using `changeset tag` after successful publishes.
- Risk: no-op releases could still fail if npm view logic is wrong.
  - Mitigation: treat npm 404 on `npm view <name>@<version>` as “unpublished”, and otherwise fail loudly.

## Verification Strategy

- Local: type-check the new publish script and run existing local gates for changed files.
- Runtime: verify the script correctly identifies only `@openspecui/web@2.1.0` as unpublished.
- Real validation: rerun `release.yml` on `main` and confirm npm shows `@openspecui/web@2.1.0`.
