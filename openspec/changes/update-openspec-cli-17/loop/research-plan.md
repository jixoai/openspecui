<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. Slice the work so the pin rotation lands first and everything else builds on it.
2. Name the boundary discriminator before writing it, because 1.17 adds no command surface.
3. Make each slice's green gate explicit and mechanically checkable.

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

# Research plan — v17 line

## Slices

1. **S1 — production rotation (serial first).** `openspec-compat.ts` window/series/ranges/tag pattern
   and `OPENSPECUI_TARGET_MAJOR = 17`; `agent-delivery-registry.ts` series `'1.17'`, `'1.16'` joins the
   provenance union, order/parse switches; `tool-init-state.ts` generator baseline `'1.17.0'`.
2. **S2 — fixture matrix rotation.** `official-cli-v16-fixtures.ts` → `official-cli-v17-fixtures.ts`
   (`PINNED_OPENSPEC_V17_VERSIONS = ['1.17.0']`, `openspec-cli-117` bin); rename the 18
   `official-cli-v16-*.test.ts` files to `official-cli-v17-*` and rotate their identity literals;
   retire `official-cli-v15-boundary-fixtures.test.ts` (its line is two series back now).
3. **S3 — boundary + new behavior proof.** `official-cli-v16-boundary-fixtures.test.ts`: identity
   1.16.1, below-admitted for the v17 gate, and the 1.17-only behaviors absent (skills-switch deletes
   the edited command file on 1.16.1; the deprecation notice is absent). New
   `official-cli-v17-update-reconcile-fixtures.test.ts`: 1.17.0 keeps and lists the edited command file
   after `config set delivery skills` + `update`, and prints the deprecation notice while delivery still
   includes commands.
4. **S4 — dependent surfaces.** compat/registry/tool-init-state tests, cli-contracts tests, opsx-kernel
   fixtures, server/web fixtures and scripts that assert the admitted series or version literals.
5. **S5 — truth surfaces.** Living spec deltas (`openspec-cli-integration`, `opsx-workflow-ui`,
   `opsx-config-center`, `projection-contract-truth`), README/README-zh, `packages/cli/README.md`,
   `AGENTS.md`, changeset (major).

## Boundary discriminator (the hard part)

1.17 adds no command, flag, or JSON member — so the discriminator cannot be "unknown option". Measured
on the real binaries, the observable difference is the skills-switch cleanup: with an edited
`.claude/commands/opsx/apply.md`, `config set delivery skills` + `update` deletes **all six** command
files on 1.16.1 and **five plus the kept edited one** on 1.17.0. Secondary: the deprecation notice line
in `update` stdout exists only on 1.17.0.

## Falsifiers

- Before S1, `classifyOpenSpecCliVersion('1.17.0')` must be `unsupported` and
  `parseOpenSpecCliVersion` still covers the window; after S1 it must be `current`.
- The v17 fixture matrix must fail if the alias points at 1.16.1 (`expectPinnedVersion`).
- The reconcile fixture must fail if 1.17's keep-and-list behavior is absent (it asserts the kept file
  on disk and the listing line), and the boundary suite must fail if 1.16.1 starts keeping it.
- The generator-staleness test must fail if the baseline stays 1.16.x.

## Risks

- **Alias consumers.** `openspec-cli-115` has many consumers (web dialogs, server fixtures), so it
  stays as a historical alias; only `official-cli-v15-boundary-fixtures.test.ts` retires.
- **Behavior suites with 1.15 controls.** The two v16-era behavior fixtures assert absence on 1.15.0;
  after renaming they assert the same behavior on 1.17.0 and carry-forward on 1.16.1 instead.
- **Lockfile churn.** One npm alias rewrites `pnpm-lock.yaml`; only the 117 entries are semantic.
