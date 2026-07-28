<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track verifiable beta release implementation checkpoints.
2. Separate infrastructure PR, version PR, registry publication, and archive gates.
3. Keep stable-channel preservation explicit.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## 1. Research and Planning

- [x] 1.1 Capture the beta-first request and non-goals objectively.
- [x] 1.2 Audit version generation, package publication, tag push, and GitHub Release owners.
- [x] 1.3 Record the current failed-run evidence and retry-safe execution plan.

## 2. Prerelease Contract

- [x] 2.1 Add explicit `--pre <channel>` entry/continuation and `--exit-pre` planning.
- [x] 2.2 Derive npm dist-tag and GitHub prerelease state from validated SemVer versions.
- [x] 2.3 Reject conflicting prerelease state instead of silently changing channel.

## 3. Retry-safe Publication

- [x] 3.1 Publish only registry-missing package versions with their derived channel.
- [x] 3.2 Treat missing package tags as remaining release work after registry success.
- [x] 3.3 Emit an objective workflow output and skip tag/release steps for a true no-op.
- [x] 3.4 Push tag refs only so a concurrent `main` merge cannot reject delivery.

## 4. Infrastructure PR Gates

- [x] 4.1 Add focused unit/mutation-resistant evidence for release-channel and prerelease planning.
- [x] 4.2 Update repository architecture law and canonical Chinese vocabulary.
- [x] 4.3 Pass CI-equivalent local checks and OpenSpec strict validation.
- [ ] 4.4 Merge the infrastructure PR after required checks pass; no package changeset is required for CI-only behavior.

## 5. Beta Version and Release

- [ ] 5.1 Run `pnpm changeversion --pre beta` from clean synchronized `main`.
- [ ] 5.2 Confirm the version PR contains `6.0.0-beta.0`, prerelease state, changelogs, and consumed changesets.
- [ ] 5.3 Merge the version PR only after required checks pass and wait for the exact-head Release workflow.
- [ ] 5.4 Verify public packages at `6.0.0-beta.0` under `beta` while `latest` remains `5.0.0`.
- [ ] 5.5 Verify remote package tags and the `openspecui@6.0.0-beta.0` GitHub prerelease.

## 6. Closure

- [ ] 6.1 Synchronize final workflow, registry, tag, and release evidence into implementation notes.
- [ ] 6.2 Archive this Change through the official OpenSpec flow and merge the archive PR.
