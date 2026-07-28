<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Record current prerelease and release-workflow facts.
2. Define the procedural beta publication and recovery topology.
3. Separate mandatory registry evidence from optional product work.
4. Bound failure modes before implementation.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## Research Findings

Current facts on `main@ef36400`:

- Public OpenSpecUI packages and npm `latest` are `5.0.0`; no 6.x package or beta tag exists.
- Existing major changesets resolve the fixed OpenSpecUI family to 6.x and name OpenSpec CLI 1.6 as its target.
- `scripts/changeversion-auto.ts` runs only `changeset version`; it cannot enter, continue, or exit prerelease mode explicitly.
- `scripts/publish-packages.ts` hard-codes `npm publish --tag latest`, so a prerelease version would incorrectly move the stable channel.
- `scripts/create-github-release.ts` creates an ordinary GitHub Release and does not project SemVer prerelease state.
- `.github/workflows/release.yml` always runs tag/release steps and uses `git push --follow-tags`.
- Release runs `30273200732` and `30341874768` built successfully, found no unpublished package, then failed because the long-running checkout tried to push its stale `main` branch. No registry version changed.

Current release topology:

```text
package.json change
       |
       v
build all native targets
       |
       v
publish unpublished packages --tag latest
       |
       v
push current main + tags  ---- race with a later main merge
       |
       v
rewrite current GitHub Release even after a registry no-op
```

## Decision & Plan (For Approval)

Adopt an explicit prerelease channel and a retry-safe release decision:

```text
pnpm changeversion --pre beta
       |
       +-- no pre.json ------> changeset pre enter beta
       +-- beta pre.json ----> continue same channel
       +-- other channel ----> fail closed
       |
       v
changeset version -> 6.0.0-beta.0 version PR
       |
       v
release plan = unpublished package OR missing release tag
       |
       +-- false -----------> stop; no old Release rewrite
       |
       v
npm publish --tag beta
       |
       v
changeset tag -> git push origin --tags
       |
       v
GitHub Release --prerelease
```

Implementation order:

1. Add a checked prerelease-mode planner for `--pre <channel>` and `--exit-pre`.
2. Add one shared SemVer release-channel projection used by npm and GitHub release owners.
3. Make publication idempotent across registry-published/tag-missing recovery.
4. Gate tag and GitHub Release steps on an objective release-created output; push tags only.
5. Merge the infrastructure PR before generating the beta version PR.
6. Run the automated beta changeversion and verify registry/tag/release truth.

## Capability Impact

### New or Expanded Behavior

- Operators can explicitly enter or continue a named prerelease channel.
- Prerelease package versions publish under their SemVer channel instead of `latest`.
- GitHub represents prerelease versions as prereleases.
- A rerun can restore missing tags after package publication.

### Modified Behavior

- Stable versions continue to publish under `latest`.
- Registry no-op runs no longer push refs or rewrite release notes.
- Tag delivery no longer pushes the workflow checkout's branch.

## Risks and Mitigations

- **Accidental stable publication:** derive the npm tag from each validated package version; never accept a caller-authored tag beside it.
- **Mixed prerelease channels:** reject a requested channel that differs from `.changeset/pre.json`.
- **Partial publication:** query each package/version independently and publish only missing versions; missing tags still keep the release plan active.
- **Moving `latest`:** assert npm `latest=5.0.0` after beta publication.
- **Concurrent main merges:** push only `refs/tags`, never the checked-out branch.
- **False completion:** require registry, Git tag, GitHub prerelease, and workflow success as separate terminal evidence.

## Verification Strategy

- Unit-test stable/beta/rc channel projection and invalid prerelease identifiers.
- Unit-test prerelease mode entry, continuation, conflict, and exit planning.
- Unit-test release-needed decisions for unpublished packages and missing tags.
- Run focused release-helper tests, root typecheck, lint, format, and `git diff --check`.
- Let required PR CI independently validate the infrastructure change.
- Execute `pnpm changeversion --pre beta` only after that PR merges.
- Verify `npm view`, remote Git tags, GitHub Release metadata, and a clean synchronized `main`.
