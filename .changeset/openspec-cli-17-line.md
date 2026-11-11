---
'@openspecui/core': major
'openspecui': major
---

OpenSpecUI 17: adapt to OpenSpec CLI 1.17.x as a new single-series line (`>=1.17.0 <1.18.0`); the
previous 1.16 v16 window, every older line, prereleases, and `>=1.18.0` are blocked by default. The
command surface, the Agent contract, the tool inventory and every consumed JSON envelope are unchanged
(`src/index.ts`, `docs/agent-contract.md`, `profiles.ts`, `command-generation/`, `cli/index.ts` and
`config.ts` are byte-identical to 1.16.1), so this line carries **zero production projection changes**:
it rotates the admission window, the pinned identity, the Agent registry series (now `'1.17'`, with
`'1.16'` joining the provenance union) and the generator staleness baseline (1.17.0), and adds
executable proofs for the one behavior that did change. `openspec update` now reconciles generated
Agent artifacts by release fingerprint: it upgrades from any release since 0.12 in one run, removes only
unedited generated files, keeps and lists edited ones, never writes outside the project, and prints a
command-file deprecation notice (commands go away in OpenSpec 2.0). The same reconcile runs on
`openspec init`, legacy command roots such as `.agent/workflows` now count as configured tools (so
`update --dry-run --json` plans their migration), and an earlier release's untouched leftovers are swept
without `--force`. Because 1.17 adds no command, flag
or JSON member, the below-admitted 1.16.1 boundary is proven behaviorally: with an edited
`.claude/commands/opsx/apply.md`, switching delivery to skills deletes all six command files on 1.16.1,
while 1.17.0 keeps and lists the edited one. The pinned fixture matrix moves to
`@fission-ai/openspec@1.17.0` (`openspec-cli-117`), the retained 1.16.1 executable becomes the
below-admitted boundary (`openspec-cli-116`), and the 1.15.0 alias retires with its only consumer.
