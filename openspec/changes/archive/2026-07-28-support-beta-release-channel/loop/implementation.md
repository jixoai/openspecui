<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track implementation state against the approved beta release plan.
2. Record owner and recovery decisions as code lands.
3. Preserve divergences and loopback triggers without rewriting history.

Original request (2026-07-28): "我想先发布一个beta版本"
-->

## Implementation State

Status: `6.0.0-beta.0` published and independently verified; main spec synchronized and Change archived at `2026-07-28-support-beta-release-channel`.

```text
release-channel projection   implemented
changeversion prerelease     implemented
retry-safe publication       implemented
workflow tag-only delivery   implemented
real beta publication        published
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

Production parser correction evidence:

```text
pnpm exec vitest run scripts/lib/changeversion/prerelease-mode.test.ts
1 file / 9 tests passed

pnpm typecheck:scripts
passed

pnpm changeversion --pre beta
parsed the beta intent and reached the feature-branch safety guard
```

## Divergence Notes

- The first `pnpm changeversion --pre beta` attempt failed before Changesets mutation because Yargs 18 treated the boolean option's default `false` as present for `.conflicts('pre', 'exit-pre')`. The typed prerelease planner already distinguishes a real `exitPre: true` conflict, but the production argument parser was not directly covered. The correction moved production parsing behind checked evidence and removed the duplicate Yargs-level conflict owner; the same real command now crosses parsing and stops at the expected non-main branch guard.
- The first corrected retry hit a transient `LibreSSL SSL_ERROR_SYSCALL` during the initial `git fetch origin main`. It occurred before Changesets mutation, left `main` clean, and the unchanged retry succeeded.

## Final Delivery Evidence

```text
Infrastructure PR   #214 -> 5240de2
Parser fix PR       #215 -> 8ffc603
Version PR          #216 -> b4c6b41
Release workflow    30350027385, exact head b4c6b41, success
GitHub prerelease   openspecui@6.0.0-beta.0, published 2026-07-28T10:40:08Z
GitHub latest       openspecui@5.0.0
```

The version PR persisted `.changeset/pre.json` with `mode=pre`, `tag=beta`, and all seven accepted OpenSpec 6 changesets. It generated `6.0.0-beta.0` package versions and changelog sections for the fixed OpenSpecUI family while leaving unrelated `ctranslate2` and `xterm-input-panel` versions unchanged.

Registry verification:

```text
openspecui          beta=6.0.0-beta.0  latest=5.0.0
@openspecui/core    beta=6.0.0-beta.0  latest=5.0.0
@openspecui/search  beta=6.0.0-beta.0  latest=5.0.0
@openspecui/server  beta=6.0.0-beta.0  latest=5.0.0
@openspecui/web     beta=6.0.0-beta.0  latest=5.0.0
```

The workflow log independently recorded `npm notice Publishing ... with tag beta` for all five packages, created the five corresponding Changesets tags, pushed tag refs only, and created the GitHub prerelease. Every annotated tag dereferences to exact release head `b4c6b41f4a695065a7d37fb5a6373d30d90e649d`.

## Loopback Triggers

- Changesets cannot produce `6.0.0-beta.0` from the current major ledger.
- npm requires a channel mapping that cannot be derived from the generated SemVer version.
- A retry after registry success cannot reconstruct missing tags from repository state.
- Required CI or real registry verification exposes a broader release contract defect.
