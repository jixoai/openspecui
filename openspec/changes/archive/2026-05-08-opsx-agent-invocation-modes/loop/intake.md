## User Input

- User requirement: "我们应该融合二者，实现 compose 模式和 command 模式，我们会全局记住用户的偏好（新增配置字段），你深入调研一下，给出一份优雅的计划"
- User request: "Implement the plan."

## Objective Scope

- Add a project-level OpenSpecUI preference for OPSX agent invocation mode.
- Support both compose-mode prompt handoff and command-mode slash command handoff.
- Make Quick Propose honor and update the global preference.
- Make change actions honor the global preference only when the action is command-equivalent.
- Keep artifact-specific actions in compose mode when slash commands cannot preserve selected artifact context.
- Preserve existing direct CLI pages such as `/opsx-new` and `/opsx-verify`.

## Non-Goals

- Do not infer slash command availability from the active terminal process.
- Do not change OpenSpec CLI global profile, delivery, or workflow installation behavior.
- Do not make `/opsx:continue` or change-page fast-forward replace selected-artifact compose flows.
- Do not archive unrelated active change `upgrade-vite-8`.

## Acceptance Boundary

- `.openspecui.json` supports `opsx.agentInvocationMode` with default `compose` and prunes default values from persistence.
- Settings exposes the preference and saves it reactively.
- Quick Propose can dispatch a self-contained compose prompt or `/opsx:propose` command, and remembers the selected preference globally.
- Change-page compose entrypoints use command mode for `apply` and `archive` when requested, and explain compose fallback for `continue` and `ff`.
- Static UI config preserves the same default config shape as live mode.
- Targeted tests cover config persistence, helper resolution, slash command generation, and static config behavior.
