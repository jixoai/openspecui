<!--
Orthogonal intents (created 2026-10-25 Asia/Shanghai):
1. Record the verified OpenSpec 1.15.0 delta and the OpenSpecUI 15 line decision.
2. Separate CLI-owned behavior from OpenSpecUI projection obligations (one hard contract break).
3. Map every obligation to a production owner, fixture, and gate; record the no-obligation evidence.

Original request (2026-10-25): "开工" — starting the v1.15.0 → OpenSpecUI 15 line per the
upstream-rotation skill after the 1.14.3 rotation.
-->

# OpenSpec CLI 1.15.0 line adaptation report (OpenSpecUI 15)

## Decision

```text
OpenSpecUI 15 (new major line)
  adapted / supported      OpenSpec CLI >=1.15.0 <1.16.0
  current / recommended    OpenSpec CLI >=1.15.0 <1.16.0
  rejected                 <1.15.0 (the whole 1.14 v14 window), prereleases, >=1.16.0, unparseable
  pinned fixture           openspec-cli-115 NEW (1.15.0 positive)
  boundary fixture         openspec-cli-114 (1.14.3 — version unchanged, role becomes below-admitted)
  retired                  openspec-cli-113 (sole consumer was the old v13 boundary suite)
  kept (historical)        openspec-cli-112 (two consumers), openspec-cli-111 (one consumer)
```

15.0 is a **new minor line** admitted as a new major per the one-line-per-series cadence
("1.15 not pre-claimed" per the v14 decision). New command surface (`update --dry-run`/`--json`,
`openspec install`), a new legal enum value (`install.scope: 'standalone'`), and a distribution
strategy shift (standalone documented as preferred) exceed any patch-bridge reading. Recorded
alternative: because 1.14's six JSON contracts are untouched, a `>=1.14.0 <1.16.0` widening would
be nearly decode-free — kept as a fallback option, not the default.

## Evidence baseline

```text
Observed                 2026-10-25 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.15.0
Pinned commit            8e0288df12d401b0e183e2f47254d22528c1dffb
Previous pin             v1.14.3 / c794978f4f8845ce59693373c9dd882ee776588c
Upstream delta           13 commits (linear), 85 files +5629/-1373 (src 28 files +1617/-344)
Unchanged (key)          src/index.ts, src/core/config.ts (AI_TOOLS), src/core/command-generation/,
                         src/core/list.ts, src/core/show.ts, src/core/validation/, src/core/parsers/,
                         src/core/change-status-policy.ts, docs/agent-contract.md, openspec/ (0 spec deltas)
```

## Hard contract break (the one must-fix decode obligation)

**`CliVersionSchema.install.scope`**: OpenSpecUI's closed enum is `global|project|temporary|source`
(`packages/core/src/cli-contracts/workflow.ts:579-588`); 1.15.0 legally emits
`"scope": "standalone"` (`version-check.ts:527,588`). A standalone install's `version --json`
would throw the whole decode. No runtime caller today (`rg 'cli\.version\('` finds tests only) but
it is a public executor contract method (`cli-contracts/executor.ts:194-198`) → the enum gains
`'standalone'`.

## Line delta by obligation relevance

### L1. `update --dry-run` / `update --dry-run --json` (new surface, no obligation this line)

Registered at `src/cli/index.ts:330-360` (the update command; earlier "src/index.ts unchanged"
statements referred to the entrypoint file, which is indeed untouched). JSON plan shape from
`src/core/update-plan.ts:17-59`:

```json
{ "changes":  [{ "path": "…", "action": "add|update|delete", "tool": "claude|…" }],
  "notes":    [{ "code": "legacy-tool-directories|legacy-artifacts", "message": "…" }],
  "failures": [{ "tool": "kimi", "error": "…" }] }
```

Verified against the real binary (isolated HOME/XDG): `--dry-run --json` exit 0 single document;
`--dry-run` human text "2 file(s) would change:"; `--json` without `--dry-run` → stderr line +
exit 1, stdout empty; failure adds `status:[{severity,code,message}]` (`update_error`). Path
semantics: project-relative POSIX inside the project, `~/…` inside HOME, absolute otherwise;
`localeCompare` ordering. Contract documentation lives in `docs-lab/reference/cli.md` and
`docs/cli.md` — **not** in `docs/agent-contract.md` (unchanged this release); upstream e2e names
"agents and OpenSpec Desktop" as the audience.

OpenSpecUI consumption today: none (`--dry-run` zero hits); `router.ts:2562-2582` streams
`['update']`/`['update','--force']` for Repair/Update. The non-dry-run path is **behaviorally
equivalent** in 1.15.0 (seven-point audit: optional `view`/`sink` params defaulting to disk;
failure stop-points identical; write contents identical; DISK view equivalence incl. dangling
symlinks; real-run stdout/stderr structure unchanged, no tip under pipes). **Obligation: none.
A dry-run preview (B1) would be a new cross-layer projection (no typed contract exists) —
explicitly out of this line's scope.**

### L2. Standalone distribution (`openspec install`, tip, `scope`)

- `openspec install [version]` (`src/commands/install-standalone.ts:131-169`, registered
  `src/cli/index.ts:454-465`): no prompts, `stdio: inherit`, installer fetched from the upstream
  main branch (URL-overridable, https-checked), no `--json`. OpenSpecUI never invokes it (its
  install path is `npm install -g @fission-ai/openspec@<series>`).
- One-time tip (`src/core/standalone-tip.ts`): stderr-only, silent when stderr is not a TTY / CI /
  non-global / already-seen, recorded before printing. Triple-isolated from OpenSpecUI's piped
  spawns.
- `setPackageSchemasDir` hook (`resolver.ts`): called only by `scripts/binary/entry.mjs`; npm
  installs keep the `import.meta.url` resolution (verified: `schemas --json` → `source:"package"`
  on the 1.15.0 npm package).
- **Obligation: A2 (scope enum) only.** A standalone-aware update-method display (B2: show
  `openspec install` for scope `standalone`, never push `npm install -g` — upstream
  `install.md:24` "Never switch an install to a different method on your own") is a product
  decision, deferred like the v14 `version --check` precedent.

### L3. Behavior fixes / perf inside unchanged shapes (no obligation)

- `verify` REMOVED-baseline exact normalized-name matching (`6b156199`): template text only; the
  rule matches the existing `normalizeRequirementName` parser and the long-standing
  `docs/agent-contract.md` "exact name" wording. No OpenSpecUI copy exists.
- `new change` progress line names the resolved schema (`832e2cf8`): ora spinner text on stderr;
  `--json` output verified identical to 1.14.
- `ora` lazy-loading (`15b3b50f`): upstream changelog states output unchanged; our JSON discipline
  unaffected.
- `feedback.ts` rework, `available-tools.ts` FileView injection, `file-view.ts`, completions
  registry, `version-check.ts` install-dir resolution: no OpenSpecUI consumption surface (each
  verified by zero-hit greps or equivalence audit).

## Fixture matrix prediction (to be observed, not assumed)

No fixture executes `update`; no existing JSON codec changed; the JSON-discipline stderr guard
already forbids `tip`. Version-report fixture verified green against the real 1.15.0 binary
(schemaVersion 1, install.location regex still matches the pnpm-alias layout, stderr empty).
Expected reds are **identity/literal/role reds only**: fixture helper identity, the ten pin
surfaces, `openspec-compat.test.ts` (hardcoded TARGET_SERIES/RANGE/NEXT_SERIES/TAG_PATTERN),
`tool-subscription-router.test.ts:684` (`@1.14` hardcoded where production derives from the
constant). The old v13 boundary suite is rewritten (role red), not patched.

## Current owner map

| Surface | Primary production owner | v1.15.0 obligation |
| --- | --- | --- |
| compat window | `packages/core/src/openspec-compat.ts` (+ `openspec-compat.test.ts` literals) | A1: full constant rotation to `'1.15'` / `>=1.15.0 <1.16.0` / `v1.15.*` |
| agent registry series | `packages/core/src/agent-delivery-registry.ts` (+ registry/projection/router tests) | series rotation to `'1.15'`: every physical fact carried forward (upstream AI_TOOLS byte-identical, no new/removed tools); retired-line sessions project no v15 inventory; registry tests that assert the 1.15 gap (`selectAgentDeliveryRegistry('1.15.0') → []`) are rewritten as the rotation's observation |
| generator staleness | `packages/core/src/tool-init-state.ts` (+ init-state tests) | pinned generator baseline rotates to `1.15.0`; replacement label and fallback follow; historical generated-version evidence retained |
| version contract | `packages/core/src/cli-contracts/workflow.ts` | A2: `install.scope` enum gains `'standalone'` |
| pinned fixture | `packages/core/package.json`, `__tests__/official-cli-v15-fixtures.ts` (new helper), 13 renamed `official-cli-v15-*.test.ts` | A3 |
| boundary suite | `official-cli-v14-boundary-fixtures.test.ts` (rewritten from v13-boundary) | A4: 1.14.3 identity, v15-gate rejection, 1.15-only surfaces absent (`update --dry-run` unknown option, `install` unknown command); never asserts 1.14-era members absent |
| pin guards | prepare script, upstream-contract-regression, cold-start integration, w2 playwright | A5: `8e0288df…` / `1.15.0` |
| tool subscription | `packages/server/src/tool-subscription-router.test.ts:684` | A6: derive from `OPENSPEC_CLI_TARGET_SERIES` (preferred) or `@1.15` |
| docs/release | CLAUDE.md pointer, AGENTS.md pin + clean-build law + 2026-10-25 decision, README audit, settings.tsx "unpublished 1.15" comment + `1.15.x` fallback semantics, changeset (major) | A7 |
| optional (deferred) | dry-run preview (B1), standalone-aware update display (B2), feedback entry (B3) | product decisions, not this line |
| spec deltas | `openspec/changes/target-openspec-cli-15-line/specs/` | four MODIFIED window-level requirements (cli-integration window, config-center inventory RENAME, workflow-ui fixtures, projection-contract-truth generator evidence) + the Kilo-scenario 113-fixture update + the standalone-scope ADD — per the v14-line precedent |

## Release gate

- Focused: new v15 fixture matrix green against the 1.15.0 executable (zero relaxations, CP1
  observation order per the skill); rewritten boundary suite green; compat unit tests; pin guards;
  core/server typechecks.
- Broad: `format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`.
- Changeset: **major** bump (`openspecui` 15.0.0 + workspace packages per fixed group); README
  support-range update + `packages/cli/README.md` per the release README law; settings copy.
- Vision walkthrough; Owner boundary unchanged. Release pending Owner confirmation.
