<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track implementation state against the approved beta release plan.
2. Record owner and recovery decisions as code lands.
3. Preserve divergences and loopback triggers without rewriting history.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## Implementation State

Status: infrastructure implementation and full local gates complete; PR delivery remains pending. No registry state has changed.

```text
release-channel projection   implemented
changeversion prerelease     implemented
retry-safe publication       implemented
workflow tag-only delivery   implemented
real beta publication        pending
```

## Decisions Taken

- SemVer package versions are the only authority for npm dist-tag and GitHub prerelease state.
- `.changeset/pre.json` is the only persisted prerelease-mode authority.
- The publish owner decides whether registry or tag work remains; the workflow consumes one objective output.
- Git pushes from release automation carry tag refs only.
- `release_created` is emitted only after package publication or tag recovery; a registry-and-tag-complete run skips downstream release mutation.
- Release scripts and their focused tests now have an explicit TypeScript lane instead of transpile-only evidence.

## Focused Evidence

Green fixed point:

```text
pnpm exec vitest run <six release files>
6 files / 33 tests passed

pnpm typecheck:scripts
passed

bun ./scripts/publish-packages.ts
[publish] registry versions and release tags are already complete
```

Mutation resistance:

```text
Mutation: prerelease distTag returned latest instead of the SemVer channel
Result: beta and rc channel assertions failed

Mutation: release work ignored missing tags after registry publication
Result: expected required=true, received false
```

Both exact transitions were restored and the focused suite returned green.

CI-equivalent local evidence:

```text
pnpm format:check
passed

pnpm lint:ci
passed with 0 warnings and 0 errors

pnpm typecheck
release scripts and all 15 workspace package lanes passed

pnpm test:ci
all root and workspace suites passed

pnpm test:browser:ci
Web and xterm component/browser fixtures passed

pnpm install --frozen-lockfile
passed

openspec validate support-beta-release-channel --strict
19/19 passed
```

The release script's real registry probe remained a safe no-op against the stable `5.0.0` state.

## Divergence Notes

None.

## Loopback Triggers

- Changesets cannot produce `6.0.0-beta.0` from the current major ledger.
- npm requires a channel mapping that cannot be derived from the generated SemVer version.
- A retry after registry success cannot reconstruct missing tags from repository state.
- Required CI or real registry verification exposes a broader release contract defect.
