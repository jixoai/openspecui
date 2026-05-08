## Research Findings

- `/opsx-propose` previously sent `/opsx:propose` directly to the selected terminal, so users with skills-only OpenSpec installations could see a broken command even though the OpenSpec workflow was conceptually available.
- Change detail actions already route through `/opsx-compose`, which generates or loads prompt content before terminal dispatch and therefore avoids depending exclusively on a slash command.
- OpenSpec supports multiple delivery styles. Command syntax is convenient when installed, while compose-style prompts are the durable fallback for skills-only or agent-native workflows.
- The existing `ConfigManager` owns project-level OpenSpecUI preferences in `openspec/.openspecui.json` and already prunes default values from disk.
- `continue` and change-page `ff` carry selected artifact context through `/opsx-compose`; the slash commands are not semantically equivalent to that selected-artifact handoff.
- `propose`, `apply`, and `archive` have command forms that are close enough to the current UI action semantics.

## Decision & Plan (For Approval)

- Add `opsx.agentInvocationMode: "compose" | "command"` to the project-level OpenSpecUI config schema with default `compose`.
- Add one Web helper that resolves requested mode to actual mode by action capability and builds either compose prompts or slash commands.
- Make Quick Propose the user-facing mode switch because it is the issue-facing entrypoint; saving the switch updates the global config.
- Make `/opsx-compose` read the global preference and use command mode only for command-equivalent actions.
- Keep action capability resolution separate from tool installation detection. The UI should not guess whether an arbitrary terminal agent has a slash command installed; the persisted preference is the user-controlled rule.
- Keep direct CLI pages outside this preference because they execute OpenSpec CLI operations rather than handing instructions to an agent terminal.

## Capability Impact

### New or Expanded Behavior

- Users can choose compose or command invocation for agent-terminal OPSX handoff.
- Quick Propose now works for skills-oriented setups by defaulting to a self-contained compose prompt.
- `apply` and `archive` can be sent as slash commands when the user prefers command mode.

### Modified Behavior

- Dashboard and change-list start CTAs describe Quick Propose instead of implying `/opsx:propose` command-only behavior.
- Static mode config now includes the same `opsx` defaults as live mode.

## Risks and Mitigations

- Risk: Command mode can still fail if the selected terminal agent lacks slash command files.
  - Mitigation: default to compose and make command mode an explicit persisted user preference.
- Risk: Compose prompt for propose could depend on a missing skill.
  - Mitigation: make the compose prompt self-contained and only use `openspec-propose` as an optional acceleration path.
- Risk: `continue` and `ff` command mode could drop artifact context.
  - Mitigation: keep those actions in compose mode and display the fallback reason.

## Verification Strategy

- Core tests for config defaults, persistence, pruning, schema acceptance, and invalid mode rejection.
- Web unit tests for compose prompt generation, slash command generation, and fallback resolution.
- Static provider tests for config shape parity.
- Run typecheck, format check, and lint after targeted tests.
