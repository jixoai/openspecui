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

Owner: main agent. The alias bump and lockfile already landed in the planning commit
(`packages/core/package.json:260`, `pnpm-lock.yaml`); do not repeat them.

**Red protocol (corrected after Round-A N4).** Bumping an alias alone cannot make
`expectPinnedVersion` fail — it compares the bins-map bin's `--version` against the map _key_,
and the key still says `1.15.0` → `openspec-cli-115`. The reachable red is the admission
classification: assert `classifyOpenSpecCliVersion('1.15.0')` is `unsupported` before rotating
(today it is `supported`), then rotate and watch it pass.

**`packages/core/src/openspec-compat.ts` — all ten version-semantic constants, not five**
(folded after Round-A B4):

- `OPENSPECUI_TARGET_MAJOR` → `16` (it feeds the mismatch copy `${OPENSPECUI_TARGET_MAJOR}.x`)
- `OPENSPEC_CLI_TARGET_SERIES` → `'1.16'`
- `OPENSPEC_CLI_SUPPORTED_SERIES` → `['1.16']`
- `OPENSPEC_CLI_MIN_VERSION` / `OPENSPEC_CLI_TARGET_MIN_VERSION` /
  `OPENSPEC_CLI_RECOMMENDED_MIN_VERSION` → `'1.16.0'`
- `OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION` → `'1.17.0'`
- `OPENSPEC_CLI_ACCEPTED_RANGE` / `OPENSPEC_CLI_RECOMMENDED_RANGE` → `'>=1.16.0 <1.17.0'`
- `OPENSPEC_CLI_REFERENCE_TAG_PATTERN` → `'v1.16.*'`
- header intent / the explanatory comments that name the 1.15 line

**Mirrors that assert against those constants** (a source-text comparison test fails otherwise):

- `packages/core/src/openspec-compat.test.ts` — the `15` / `'1.15'` / `['1.15']` / `'v1.15.*'`
  assertions.
- `scripts/diagnose-cli-runner.mjs` `OPENSPEC_CLI_TARGET_SERIES`.
- `scripts/setup-example.ts` `OPENSPEC_CLI_TARGET_SERIES` (its comment claims to mirror core).
- `scripts/diagnose-cli-runner.test.mjs` — the mirror-equality assertion and the literal.

**Pin guards — four files plus one that was missing** (folded after Round-A B3):

- `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` →
  `27c0515724decc633818c735ee596481eec78a8b`.
- `scripts/check-openspec-reference.mjs` — **fake-green today**: `--match 'v1.15.*'` plus a
  `startsWith('v1.15.')` check, and `git describe` renders a post-tag checkout as
  `v1.15.0-19-g27c05157`, which still matches. Repair it to the `v1.16.*` pattern and prefer
  reusing `OPENSPEC_CLI_REFERENCE_TAG_PATTERN` so this cannot rot silently again (its own
  header records the same recurrence in the v15 rotation).
- `packages/core/src/upstream-contract-regression.test.ts` — pin assertion + title.
- `packages/server/src/root-context-cold-start.integration.test.ts` —
  `PINNED_OPENSPEC_COMMIT` + the two observed `cli.version` expectations.
- `packages/web/scripts/w2-project-binding-playwright.ts` — `PINNED_OPENSPEC_COMMIT` + the
  `--version` assertion.

Then: `references/openspec` gitlink → `v1.16.0`; `CLAUDE.md` session pointer →
`references/openspec-1.16.0-report.md`.

**Gate:** `openspec-compat.test.ts`, `diagnose-cli-runner.test.mjs`, and
`upstream-contract-regression.test.ts` green; the positive fixture suites are still on the old
helper and stay broken until Slice 2 (do not claim a green matrix here — folded from Round-A N3).

### Slice 2 — Fixture suite rotation (mechanical; runs after Slice 1)

Owner: subagent, verified by the main agent's diff review.

1. **First step: rename the helper.** `git mv packages/core/src/__tests__/official-cli-v15-fixtures.ts`
   → `official-cli-v16-fixtures.ts` with `PINNED_OPENSPEC_V16_VERSIONS = ['1.16.0']`, bins key
   `'1.16.0'` → `openspec-cli-116`, and the identity-provenance doc updated. Fifteen files import
   it, so this and the suite rename must land in one batch or the tree is red in between.
2. `git mv` the 14 `official-cli-v15-*.test.ts` files to `official-cli-v16-*.test.ts`; rotate
   every `1.15.0` literal, every `PinnedOpenspecV15Version` type import, and every helper import
   path; update each intent header with the 2026-11-04 request line.
3. `git mv` `official-cli-v14-boundary-fixtures.test.ts` → `official-cli-v15-boundary-fixtures.test.ts`;
   retarget to `openspec-cli-115` (1.15.0 identity), assert 1.15.0 is `unsupported` under the v16
   gate, and replace the now-invalid `update --dry-run` / `install` absence probes with the
   verified config-failure discriminator.
4. Delete `packages/core/src/__tests__/official-cli-v14-fixtures.ts` (its only importer was the
   v14 boundary suite) and remove the `openspec-cli-114` alias.
5. **Unclaimed-literal fallback** (folded after Round-A N2): the matrix itself is the authority.
   Any test file that goes red on a stale version literal joins this slice. The three that will
   genuinely fail are `packages/core/src/opsx-kernel-cli-projection.test.ts` (its fake CLI gates
   capability by `version.startsWith('1.15')`), `openspec-compat.test.ts`, and
   `scripts/diagnose-cli-runner.test.mjs`. Clean-up literals that only mock a version (server and
   web router/component tests, `opsx-kernel-schemas-root.fixtures.test.ts`'s local `PINNED_BINS`
   key, `opsx-kernel-status-warnings.test.ts`, `tool-init-state.test.ts`,
   `agent-delivery-registry.test.ts`, `workflow.test.ts`) rotate for honesty only — they must not
   be "fixed" by relaxing an assertion.

**Gate:** full pinned matrix green against 1.16.0 with zero assertion relaxations; boundary
suite green against the retained 1.15.0 executable;
`pnpm --filter @openspecui/core exec vitest run src/opsx-kernel-cli-projection.test.ts` green.

### Slice 3 — Registry series + generator staleness

- `packages/core/src/agent-delivery-registry.ts` (+ its test): series `'1.15'` → `'1.16'`; every
  physical fact carries forward (upstream `AI_TOOLS` byte-identical); header intent updated.
- `packages/core/src/tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION` → `'1.16.0'`; the
  `'1.15.0'` literals in its test rotate with it.
- Gate: `pnpm --filter @openspecui/core exec vitest run src/agent-delivery-registry.test.ts src/tool-init-state.test.ts`.

### Slice 4 — New executable proofs (two files, not one)

- `packages/core/src/official-cli-v16-project-config-failure-fixtures.test.ts` — the config-failure
  envelope: both codes, the `--report findings` variant, and the unchanged healthy report/findings
  shapes.
- `packages/core/src/official-cli-v16-scenario-step-fixtures.test.ts` — the step-coverage WARNING
  class in **change scope** (three incomplete variants, complete clean, plain exit 0, `--strict`
  exit 1, `#### Notes` silent) and in **main-spec scope** (folded after Round-A N7).
- Gate:
  `pnpm --filter @openspecui/core exec vitest run src/official-cli-v16-project-config-failure-fixtures.test.ts src/official-cli-v16-scenario-step-fixtures.test.ts`;
  record the new matrix total.

### Slice 5 — Docs + changeset

- Snapshot the outgoing line first, per the `a0bef65f` precedent: `README-1.15.0.md` /
  `README-zh-1.15.0.md` as verbatim copies.
- `README.md` **and** `README-zh.md`; `packages/cli/README.md`: window tables to
  `>=1.16.0 <1.17.0`, the retired 1.15 row, and the npm Node `>=22.12.0` floor.
- `package.json` root `engines.node` → `>=22.12.0`; `openspec/project.md:39,236`; and the
  `packages/cli/README.md` Node line (intake decision 4).
- `AGENTS.md`: 2026-11-04 architecture decision, live-pin line, historical pins, and the stale
  `(v14 today: CLI >=1.14.0 <1.15.0)` parenthetical in the release-README law (Round-A N11).
- `.changeset/*.md`: **`major`** for `openspecui` / `@openspecui/core` / `@openspecui/server` /
  `@openspecui/web` (intake decision 5).
- Gate: `openspec validate update-openspec-cli-16-line --strict` clean;
  `rg -n "v1\.15|1\.15\.0" README.md README-zh.md packages/cli/README.md AGENTS.md CLAUDE.md` returns
  only intentional historical mentions.

### Slice 6 — Gates, review, delivery

- Broad gates serially on the frozen tree: `pnpm format:check` → `pnpm lint:ci` →
  `pnpm typecheck` → `pnpm test:ci` → `pnpm test:browser:ci`.
- Dual-channel Round-A (Codex 大地三 + research subagent), fold, Round-B approval.
- PR from `target/openspec-cli-16-line`; `pr-quality.yml` green; merged with `mergedAt`
  verified; then archive + release per the skill's P5/P6.

## Focused gate commands (exec form, never `test --`)

```bash
pnpm --filter @openspecui/core exec vitest run src/openspec-compat.test.ts
pnpm --filter @openspecui/core exec vitest run src/upstream-contract-regression.test.ts
pnpm --filter @openspecui/core exec vitest run src/official-cli-v16-version-report-fixtures.test.ts
pnpm --filter @openspecui/core exec vitest run src/official-cli-v15-boundary-fixtures.test.ts
```

## Version-literal audit (corrected token set and scope, Round-A N1)

The first draft's tokens missed the two forms the constants and guards actually use (`'1.15'`
bare series and `v1.15.` describe patterns) and its scope excluded the documents the plan
itself changes. Use these two, whole-repo, and treat a non-empty reverse audit as a failure:

```bash
rg -n "1\.15|v1\.15|8e0288df|openspec-cli-115|PINNED_OPENSPEC_V15" \
  --glob '!**/node_modules/**' --glob '!references/openspec/**' --glob '!**/CHANGELOG.md'
rg -n "1\.16|v1\.16|27c05157|openspec-cli-116|PINNED_OPENSPEC_V16" \
  --glob '!**/node_modules/**' --glob '!references/openspec/**' --glob '!**/CHANGELOG.md'
```

Plus the one gate that must be empty after Slice 1:

```bash
rg -n "v1\.15\." scripts/check-openspec-reference.mjs
```
