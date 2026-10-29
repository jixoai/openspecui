<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Record the verified OpenSpec 1.15.0 minor delta for the OpenSpecUI 15 line,
   including the unshipped in-window patches 1.14.2 and 1.14.3 the v15 pin absorbs.
2. Separate CLI-owned protocol facts from OpenSpecUI projection obligations.
3. Map each observable change to a production owner, regression evidence, and gate.
4. Record the one-hop rotation decision (1.14.1 -> 1.15.0) and its obligation carry-forward.

Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新"
-->

# OpenSpec CLI 1.14.1 -> 1.15.0 minor adaptation report (OpenSpecUI 15 line)

## Decision

```text
OpenSpecUI 15 (new major line)
  adapted / supported      OpenSpec CLI >=1.15.0 <1.16.0
  current / recommended    OpenSpec CLI >=1.15.0 <1.16.0
  rejected                 <1.15.0 (including the whole 1.14 v14 window),
                           prereleases, >=1.16.0, unparseable
  pinned fixture           openspec-cli-115 = 1.15.0 (new positive line)
  boundary fixture         openspec-cli-114 rotates 1.14.1 -> 1.14.3
```

1.15.0 is a **new minor release** with a genuinely new typed contract
(`update --dry-run --json` UpdatePlan) and a new distribution shape (standalone
binaries, `InstallScope: 'standalone'`, `install [version]`). Per the
one-line-per-series cadence (v12 -> v13 -> v14), admission is a **new major
line**: OpenSpecUI 15. `1.15` was not pre-claimed by the v14 decision; this
report is that separately verified admission decision, based on the full source
diff below.

One-hop rotation: upstream shipped two v14-window patches (1.14.2 on 2026-10-15,
1.14.3 on 2026-10-17) before 1.15.0. The v14 line shipped its own 1.14.2 rotation on main (OpenSpecUI 14.0.2,
`references/openspec-1.14.2-report.md`) while this line was in flight; this line
**skips a separate 1.14.3 rotation release** but does not skip any 1.14.x protocol
obligation: the v15 pin (v1.15.0) contains every 1.14.2/1.14.3 commit, the boundary
fixture is the newest retired-line patch (1.14.3), the 1.14.2 fixture evidence ports
onto the 1.15.0 executable unchanged, and the 1.14.2/1.14.3 deltas are inventoried
below with their own projection obligations. (Same shape as the v9 line's
"skips a separate v8 release, but does not skip any 1.8 protocol obligation".)

Vetoable in review: shipping without a separate v14-line 1.14.3 patch rotation
first. The v14 line is retired upstream the day 1.15.0 exists; 1.14.2 already
shipped as 14.0.2, so a further 14.1.x patch for 1.14.3 would publish another
release with no consumer-facing delta before the v15 major.

## Evidence baseline

```text
Observed                 2026-10-29 Asia/Shanghai
Package                  @fission-ai/openspec
Reference repository     references/openspec
Pinned tag               v1.15.0
Pinned commit            8e0288df12d401b0e183e2f47254d22528c1dffb
Previous pin             v1.14.2 / f80d860fc510ba4f51180c8ddde35b91b32de657
                         (the v14 line shipped its own 1.14.2 rotation as
                         OpenSpecUI 14.0.2 while this line was in flight;
                         1.14.1 / 87c3595 preceded it)
npm timeline             1.14.2 2026-10-15, 1.14.3 2026-10-17, 1.15.0 2026-10-24
Upstream delta           v1.14.1..v1.15.0: 40 commits total
                         (21 in 1.14.2, 6 in 1.14.3, 13 in 1.15.0)
                         v1.14.3..v1.15.0 src/: 28 files, +1617/-344
```

Sources inspected: the full `v1.14.1..v1.15.0` source diff of
`references/openspec` (every commit read against `src/`), the upstream
`CHANGELOG.md` sections for 1.14.2 / 1.14.3 / 1.15.0, and executed-CLI evidence
against the `openspec-cli-115` 1.15.0 npm executable (positive matrix) and the
rotated `openspec-cli-114` 1.14.3 executable (boundary negatives).

## 1.15.0 delta by contract relevance

Two headline tracks: the `update --dry-run [--json]` typed plan (PR #2109) and
the standalone binary distribution (PR #2137). Everything else is
behavior-preserving seam refactoring, two small bug fixes, and tooling. **The
`AI_TOOLS` agent registry (`src/core/config.ts`) has a zero diff — 1.15.0 adds,
removes, and modifies no Agent tool.** The npm package shape (`bin`, `engines`,
`exports`, `files`, `type`) is unchanged, so OpenSpecUI's importable-CLI-JS
resolution is unaffected.

### C1. `update --dry-run [--json]` — new typed contract (capability-gated P0)

Dry run and real update share one code path (`UpdateFileOps` write seam +
`FileView` read seam); upstream's own e2e comment says the JSON is "read by
agents and OpenSpec Desktop through a pipe". Contract:

```json
{
  "changes": [
    { "path": ".claude/skills/openspec-explore/SKILL.md", "action": "update", "tool": "claude" },
    {
      "path": "~/.minimax/skills/openspec-propose/SKILL.md",
      "action": "add",
      "tool": "minimax-code"
    }
  ],
  "notes": [],
  "failures": []
}
```

- **Three keys always present, always arrays, never null/undefined**; empty plan
  is `{changes: [], notes: [], failures: []}` (executed evidence).
- `changes` sorted by `path.localeCompare`; deduped by display path (last
  touching tool wins); a legacy directory move appears as a **delete+add pair —
  there is no `rename`/`move` action**; a write-identical byte set produces no
  entry.
- `action` closed enum `add | update | delete`. `path` three display forms:
  project-relative POSIX inside the project; `~/…`-folded under home; absolute
  POSIX otherwise (executed evidence: the machine-global config file planned by
  a one-time profile migration shows as an absolute path with
  `tool: 'openspec'`).
- `tool` is the configured tool id or `'openspec'` for OpenSpec's own files
  (global config, legacy-artifact cleanup, `--force` legacy removals).
- `notes` closed enum `legacy-tool-directories | legacy-artifacts` (deduped by
  code, first message wins): dry run plans consent-gated steps as a
  non-interactive run would make them and says so.
- **`failures` are data, not errors**: one broken tool does not cost the rest of
  the plan; the plan stops exactly where the real update would throw (verified
  by upstream property tests); **exit code stays 0** with non-empty failures.
- CLI behavior matrix (source + executed evidence):
  - `update --dry-run` → human text, exit 0 (failures render as
    `Would fail: <tool> (<error>)` lines).
  - `update --dry-run --json` → exactly one JSON document on stdout, exit 0.
  - `update --json` without `--dry-run` → **empty stdout**, stderr
    `--json is only available with --dry-run.`, exit 1.
  - Plan failure → exit 1 and the global agent-contract envelope with the plan
    keys empty plus `status: [{severity, code: 'update_error', message}]`
    (`diagnostic.fix` replaces the message when present); exit happens via
    `return` so piped stdout drains.
  - The dry-run branch skips the version network check, upgrade prompt, and
    standalone tip, and never prompts interactively.

### C2. Standalone distribution (evidence-only for the npm consumption shape)

- New command `install [version]`: validates a semver-ish version, downloads
  the platform install script from the upstream repo (https-enforced URL
  checks), installs to `OPENSPEC_INSTALL_DIR` / the existing binary's directory
  / `%LOCALAPPDATA%\Programs\openspec` / `~/.local/bin`. Never removes a
  package-manager copy.
- `InstallScope` gains `'standalone'`; `getCliInstallInfo()` short-circuits to
  `{location: dirname(binary), packageManager: null, scope: 'standalone'}`;
  `getCliUpdateCommand()` returns `openspec install` (or the quoted binary
  path), never a package-manager command; `canSelfUpgrade` is false.
- `getInstallDir()` switches from `require.resolve` to `import.meta.url`
  resolution (bundler-safe; behavior-equivalent for node_modules spawns).
- `standalone-tip.ts`: fires only at the end of a **real** `update`, only when
  stderr is a TTY, only for `scope: 'global'` package installs, once per
  machine (`standaloneTipSeen: true` in the global config, written before
  printing). **OpenSpecUI's piped spawns are silent and consume nothing**; the
  new global-config key is passthrough-tolerated.
- Binary-only machinery (`scripts/binary/entry.mjs`, embedded schemas, 8-target
  release matrix) never activates for the npm package.

### C3. Refactoring and small fixes (no projection obligations)

| area                                                                                                                             | change                                                               | conclusion                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `file-view.ts` (new) + threading through tool-detection / available-tools / shared-skill-target / profile-sync-drift / migration | read-seam abstraction, `DISK_VIEW` default                           | behavior-preserving for real runs; two dry-run-only knobs (`options.delivery`, `options.view`)                               |
| `migration.ts` (+155), `legacy-cleanup.ts` (+39)                                                                                 | split into compute/apply + ops seams                                 | same legacy roots, same consent gating, byte-identical physical behavior                                                     |
| `github-copilot/cloud-agent.ts` (+38)                                                                                            | `CopilotCloudFileOps` seam                                           | dry-run counts copilot cloud writes/deletes in the plan (`tool: 'github-copilot'`)                                           |
| `new-change.ts` (+18)                                                                                                            | schema resolution moved earlier                                      | bug fix: progress line names the schema actually created; JSON output unchanged                                              |
| `verify-change.ts` template (+8)                                                                                                 | REMOVED baseline matched by exact normalized name                    | SKILL.md content change → pinned-CLI refresh lists `openspec-verify` as drifted next update (**expected, not a regression**) |
| schema/validate/instructions/status/templates, feedback, completions                                                             | ora lazy-loading, feedback issue-form, completion registry additions | output surfaces unchanged; completion registry gains `install` and the new `update` flags                                    |
| `package.json`                                                                                                                   | version + devDeps only                                               | no consumer-visible packaging change                                                                                         |

## 1.14.2 / 1.14.3 in-window deltas (obligations carried by the v15 pin)

**No JSON shape changes anywhere in either patch window**: no added/removed/renamed
fields, no new structured error codes, no severity-enum extension, no exit-code
semantics change. `src/commands/list.ts` and `src/commands/status.ts` are
untouched across the entire range. Everything below lands inside surfaces
OpenSpecUI already types as passthrough evidence.

### Per-commit inventory (src/-relevant only)

| commit     | PR    | semantics                                                             | JSON contract                                                                                                                                                           | behavior change                                                                                                                                                                  | OpenSpecUI obligation                                                                                             |
| ---------- | ----- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `e0a2f00f` | #2063 | metadata: `x-` extension keys no longer reported unknown              | none; three warning surfaces stop producing entries for `x-` keys; near-miss warning message gains remediation + `x-`-near-miss sentences                               | `validate --strict` flips 1→0 for changes carrying valid `x-` keys; pattern `/^x-\S+$/`                                                                                          | evidence only — all three surfaces are typed `warnings: string[]` passthrough                                     |
| `3fea2a96` | #2083 | workflows: verify REMOVED baseline / update glob exception            | none (prompt-template text)                                                                                                                                             | `/opsx:verify` recovers REMOVED baseline from main spec or git history; unverifiable reports "not verified" instead of pass                                                      | none — SKILL.md content, never the `instructions --json` surface                                                  |
| `7acf2820` | #2061 | artifact-graph: reject brace nesting > 16 levels                      | none — plain `Error`, not a structured diagnostic                                                                                                                       | schema `generates`/`apply.tracks` patterns nesting >16 now make `instructions`/`status` exit non-zero with stderr text (previously possible stack overflow)                      | evidence only — modeled as the existing "stdout is not one JSON document" failure class                           |
| `9cb5ba8c` | #2086 | explore: capture table scoped to default schema                       | none (template text)                                                                                                                                                    | custom-schema explore no longer steers toward fixed `design.md` files                                                                                                            | none                                                                                                              |
| `1bce87f8` | #2054 | archive/validate: warn when a delta holds text archive will not carry | none — new WARNING _instances_ in the existing `ValidationIssue{level,path,line?,message}` shape; archive `warnings?: string[]` (existing field) gains the same strings | `validate --strict` tightens: delta text outside delta `##` sections / before the first requirement now fails strict; archive carries unchanged content                          | none — but any fixture/snapshot pinning validate/archive warning strings must be refreshed                        |
| `76d49a1d` | #2064 | perf(completion): Tab completion drops telemetry/heavy imports        | none ("Completion output is unchanged")                                                                                                                                 | `__complete` no longer triggers telemetry or first-run notice                                                                                                                    | none — OpenSpecUI does not consume `__complete`                                                                   |
| `90c95c2a` | #2052 | archive: accept symlinked `openspec/changes` and `specs`              | none; rejection code stays `archive_path_outside_root`                                                                                                                  | `openspec/`, `openspec/changes`, `openspec/specs` may each be project-owned symlinks (parent confined, target exists); `archive/` must stay physical                             | evidence only — verified `packages/core/src/spec-catalog.ts` has no own containment logic; UI parity is automatic |
| `e33245d2` | #2103 | fast-glob → tinyglobby (braces leaves the tree)                       | none; new plain-Error texts (1024-expansion budget, NUL byte)                                                                                                           | glob rewrite: absolute patterns keep absolute base; non-expanding brace groups stay literal; wide patterns no longer OOM `status`                                                | evidence only; dependency note: 1.14.3 no longer transitively depends on `braces`/`fast-glob`                     |
| `5251f2ef` | #2108 | validate: spinner no longer floods a zero-width TTY                   | none — `opts.json` short-circuits before spinner; JSON surface untouched                                                                                                | `columns===0`, `OPEN_SPEC_INTERACTIVE=0`, and `CI` now disable the spinner like `--no-interactive`                                                                               | none                                                                                                              |
| `276d0150` | #2104 | workflows: glob artifact paths kept inside the change directory       | none (template text)                                                                                                                                                    | propose/ff/continue/explore templates validate resolved paths stay in changeRoot before writing                                                                                  | none                                                                                                              |
| `87a69a2b` | #2101 | specs: accept `spec.md` symlink to a file elsewhere in the project    | none; new race-guard error text `Spec target for '<id>' changed before it could be written: <path>`                                                                     | `list --specs`/`show`/`validate`/`archive` accept in-project symlinked spec files (planning-root anchor: sibling names must be `specs`/`changes`); merge writes through the link | evidence only — same parity conclusion as `90c95c2a`                                                              |

Excluded as non-src: two Version Packages commits, five docs commits,
`eb315c9d` (upstream's own dogfooding spec text), CI matrix, dependency bumps,
and four security/website-only commits (lockfile/workspace overrides).

### Executed-CLI boundary evidence (1.14.3)

- `update --dry-run` → `error: unknown option '--dry-run'` (rejected; proves the
  capability is 1.15-only for the boundary fixture).
- `version --json` → schemaVersion-1 envelope with `install` info (1.14.0 fact
  carried forward, `scope: 'project'`).

### Net obligation for the v15 line from 1.14.2/1.14.3

Zero schema projections. Two soft obligations land in the fixture matrix:
refresh any validate/archive warning-string expectations (the `x-` extension-key
and unapplied-content warnings change message text), and keep the symlink
acceptance behaviors as recorded parity facts (no UI divergence exists).

## Agent registry and staleness

`src/core/config.ts` (the `AI_TOOLS` registry) is byte-unchanged across
`v1.14.3..v1.15.0`: **no new tools, no changed delivery paths, no changed
`minCliSeries` facts**. The v15 registry rotation is therefore constants-only,
mirroring the 1.14.1 precedent ("zero agent-delivery-surface commits ⇒ zero
registry-content changes"):

- `AgentCliSeries` rotates `'1.14'` → `'1.15'`; `'1.14'` joins the historical
  provenance union (`'1.9' | … | '1.14' | '1.15'`).
- `agentCliSeriesOrder` gains 15; `parseOpenSpecCliSeries` maps minor 15.
- All ten `minCliSeries: '1.14'` tool entries (Amp, AtomCode, dsh, Code Studio,
  EasyCode, GigaCode, Grok Build, GSD, Veai, Warp) and the five shared
  `.agents` skills-root writer candidates stay as-is — they are provenance
  facts, not current-line claims.
- Generator staleness baseline rotates `1.14.0` → `1.15.0` in
  `tool-init-state.ts`; the series-aware staleness logic itself needs no edit.
- `standaloneTipSeen` appears in the global config only after a human runs
  `update` on a TTY; every structured reader already tolerates unknown keys
  (unchanged law).

## Executed-CLI evidence (1.15.0 positive line)

Run against a fresh `npm install @fission-ai/openspec@1.15.0` in an isolated
temp prefix with isolated `XDG_CONFIG_HOME`/`XDG_DATA_HOME`:

- `version --json` → schemaVersion-1 envelope, `install.scope: 'project'`.
- `update <empty project> --dry-run --json` →
  `{changes: [], notes: [], failures: []}`, exit 0.
- After `init --tools claude`: plan lists the machine-global config as
  `add | openspec | <absolute path>`; corrupting a managed skill file plans
  `update | claude | .claude/skills/openspec-apply-change/SKILL.md`; deleting
  it plans `add`; after a settled real update the plan is empty again.
- `update --json` (no `--dry-run`) → empty stdout, stderr rejection text,
  exit 1.
- Boundary executable `openspec-cli-114` (1.14.3): `update --dry-run` →
  `error: unknown option '--dry-run'`; `version --json` still proves the
  schemaVersion-1 envelope (1.14.0 fact carried forward).

## Projection obligations for OpenSpecUI 15

P0 (typed, end-to-end):

1. **Compat window rotation**: `>=1.15.0 <1.16.0` single-series; constants,
   ranges, tag pattern, messages, and every mirrored constant (setup-example,
   core fallback spec) rotate together; classification tests translate.
2. **`updateDryRun` capability** in `deriveOpenSpecCliCapabilities`
   (target-series gated like `findingsReport`), with a typed `UpdatePlan`
   schema in `cli-contracts` encoding: three keys always arrays;
   `action` closed enum; `notes` closed two-code enum; `tool` open string;
   `path` open string with the documented three display forms; failure
   envelope = plan keys empty + `status[]` with `code: 'update_error'`;
   **exit 0 with non-empty `failures` is a successful plan**.
3. **Agent-facing update preview**: the Agents config Update flow gains a
   dry-run plan preview (readable, path-wrapping, move-pairs recognized as
   delete+add of the same tool) before the real `update`; capability-absent
   ⇒ preview unavailable with the standard Tooltip reason, real update
   unchanged.
4. **`CliVersionSchema.install.scope`** enum gains `'standalone'` (fixture
   evidence only; no production consumer projects install facts today).
5. **Fixture rotation**: `openspec-cli-115` = 1.15.0 positive line;
   `openspec-cli-114` → 1.14.3 boundary line; v13 boundary suite retires;
   positive matrix migrates to the v15 helper; pin guards
   (`prepare-openspec-reference.mjs`, `upstream-contract-regression.test.ts`,
   server cold-start integration, W2 playwright probe) rotate to
   `8e0288df12d401b0e183e2f47254d22528c1dffb`; the stale v9-era
   `check-openspec-reference.mjs` assertion is repaired or retired in the
   same PR.

P1 (recorded, no code): standalone surface (C2), migration/cleanup seam
refactors (C3), 1.14.2/1.14.3 behavior fixes outside warning strings,
`verify-change` template drift being an expected refresh consequence.

P2 (fixture-string refresh only): validate/archive warning-message text
changes from `e0a2f00f`/`1bce87f8` if any snapshot pins them.
