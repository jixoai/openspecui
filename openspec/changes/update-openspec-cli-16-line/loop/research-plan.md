<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Convert the verified 1.16.0 delta into ordered, file-disjoint slices with red/green points.
2. Record the serial pin barrier and the mechanical-rename boundary.
3. Name every gate command in exec form so a subagent brief cannot silently run the wrong scope.

Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
-->

# OpenSpec CLI 1.16.0 research plan

Evidence source: `references/openspec-1.16.0-report.md` (pin `v1.16.0` @ `27c05157`). Upstream
references below are verbatim from `references/openspec` at the pin.

## Research findings

- **No command/contract surface moved.** `src/index.ts`, `docs/agent-contract.md`,
  `src/core/config.ts` (AI_TOOLS), `src/core/profiles.ts`, and `src/core/command-generation/`
  are all unchanged between v1.15.0 and v1.16.0 (verified individually with
  `git diff --quiet`). Zero window-capability work; the only gate work is admitting the new
  series.
- **Both validate transports already accept the new failure envelope.** `CliValidateSchema` and
  `CliValidateFindingsResultSchema` are already unions over a diagnostic-failure branch whose
  `code` is an open string with `.passthrough()`. Executed 1.16.0 evidence confirms both new
  codes decode; the obligation is fixture proof, not typing.
- **The step-coverage warning rides the existing finding shape** (`level: 'WARNING'`), which the
  findings schema already types as an open level enum and the Web surface renders verbatim.
- **The boundary discriminator had to be chosen empirically.** `update --dry-run` exists on
  1.15.0 (exit 0), so the previous line's boundary assertions cannot carry over. The
  config-failure envelope is the first genuinely 1.16-only observable surface, verified on both
  binaries against the same fixture.
- **The fixture file set is named per line.** The repository keeps one `official-cli-v<N>-*`
  suite per admitted line plus one boundary suite. Admitting 1.16 therefore renames the v15
  suite to v16 and rotates the boundary suite from `openspec-cli-114` to `openspec-cli-115`.

## Slices

### Slice 1 — Window + pin rotation (serial barrier)

Owner: main agent. Red first: bump the alias and reinstall, then run the version-report fixture
against the stale `['1.15.0']` constant — the identity assertion must fail before the rotation.

- `packages/core/src/openspec-compat.ts`: `OPENSPEC_CLI_MIN_VERSION` /
  `TARGET_MIN_VERSION` / `RECOMMENDED_MIN_VERSION` → `1.16.0`; `NEXT_SERIES_MIN_VERSION` →
  `1.17.0`; both ranges → `>=1.16.0 <1.17.0`; header intent updated.
- `packages/core/package.json`: alias `openspec-cli-116` → `npm:@fission-ai/openspec@1.16.0`;
  lockfile regenerated.
- `packages/core/src/__tests__/official-cli-v16-fixtures.ts`: renamed from the v15 helper with
  `PINNED_OPENSPEC_V16_VERSIONS = ['1.16.0']`, bins key `'1.16.0'` → `openspec-cli-116`,
  identity-provenance doc updated.
- Pin guards: `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` →
  `27c0515724decc633818c735ee596481eec78a8b`; `upstream-contract-regression.test.ts`;
  `root-context-cold-start.integration.test.ts` (`PINNED_OPENSPEC_COMMIT` + observed
  `cli.version`); `packages/web/scripts/w2-project-binding-playwright.ts` (`PINNED_OPENSPEC_COMMIT`
  - `--version` assertion).
- `references/openspec` gitlink → `v1.16.0`.
- `CLAUDE.md` session pointer → `references/openspec-1.16.0-report.md`.
- Gate: identity fixture green; matrix still runs (renames land in Slice 2).

### Slice 2 — Fixture suite rotation (mechanical, file-disjoint from Slice 3)

Owner: subagent, verified by the main agent's diff review.

- `git mv` the 14 `official-cli-v15-*.test.ts` files to `official-cli-v16-*.test.ts`; rotate
  every `1.15.0` version literal, `PinnedOpenspecV15Version` type import, and helper import path;
  update each intent header with the 2026-11-04 request line.
- `git mv` `official-cli-v14-boundary-fixtures.test.ts` →
  `official-cli-v15-boundary-fixtures.test.ts`; retarget it to `openspec-cli-115` (1.15.0
  identity), assert 1.15.0 is `unsupported` under the v16 gate, and replace the
  `update --dry-run`/`install` absence probes with the verified config-failure discriminator.
- Remove the `openspec-cli-114` alias.
- Gate: full pinned matrix green against 1.16.0 with zero assertion relaxations; boundary suite
  green against 1.15.0.

### Slice 3 — Registry series + generator staleness (file-disjoint from Slice 2)

- `packages/core/src/agent-delivery-registry.ts`: series `'1.15'` → `'1.16'`; every physical fact
  carries forward (upstream AI_TOOLS byte-identical); header intent updated.
- `packages/core/src/tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION` → `'1.16.0'`; the v15
  version literals in that file's fixtures rotate with it.
- Gate: registry + tool-init-state suites green.

### Slice 4 — New executable proofs

- `official-cli-v16-validation-full-fixtures.test.ts` (or a dedicated file): the config-failure
  envelope for both codes, the findings-transport variant, and the unchanged healthy shapes.
- `official-cli-v16-validation-full-fixtures.test.ts`: the step-coverage WARNING class — three
  incomplete variants, the complete one clean, plain exit 0 and `--strict` exit 1; plus the
  `#### Notes` non-scenario child staying silent.
- Gate: both files green; matrix total recorded.

### Slice 5 — Docs + changeset

- `README.md` + `packages/cli/README.md`: window tables to `>=1.16.0 <1.17.0`, the retired 1.15
  row, and the npm Node `>=22.12.0` floor note.
- `AGENTS.md`: 2026-11-04 architecture decision + live-pin line + historical pins.
- `.changeset/*.md`: patch for `openspecui` / `@openspecui/core` / `@openspecui/server` /
  `@openspecui/web`.
- Gate: `openspec validate` clean; format/lint pass on touched files.

### Slice 6 — Gates, review, delivery

- Broad gates serially: `pnpm format:check` → `pnpm lint:ci` → `pnpm typecheck` →
  `pnpm test:ci` → `pnpm test:browser:ci`.
- Dual-channel Round-A (Codex 大地三 + research subagent), fold, Round-B approval.
- PR from `target/openspec-cli-16-line`; `pr-quality.yml` green; merged with `mergedAt`
  verified; then archive + release per the skill's P5/P6.

## Focused gate commands (exec form, never `test --`)

```bash
pnpm --filter @openspecui/core exec vitest run src/official-cli-v16-version-report-fixtures.test.ts
pnpm --filter @openspecui/core exec vitest run src/official-cli-v15-boundary-fixtures.test.ts
pnpm --filter @openspecui/core exec vitest run src/upstream-contract-regression.test.ts
```

Version-literal audit (full-repo mechanical grep, both old and new tokens):

```bash
rg -n "1\.15\.0|8e0288df|openspec-cli-115|PINNED_OPENSPEC_V15" packages scripts --glob '!**/node_modules/**'
rg -n "1\.16\.0|27c05157|openspec-cli-116|PINNED_OPENSPEC_V16" packages scripts --glob '!**/node_modules/**'
```
