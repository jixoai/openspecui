## Research Findings

- The server already resolves PTY defaults in `packages/server/src/pty-manager.ts`: Windows uses `ComSpec` or `cmd.exe`; other platforms use `SHELL` or `/bin/sh`.
- The current terminal context exposes `createSession` and `createDedicatedSession`, so new creation flows can build on the existing PTY lifecycle instead of replacing it.
- The current Quick Propose route sends prepared payloads only to existing live terminals. Its target model is page-local and can be generalized behind a terminal sender primitive.
- The terminal settings config is currently synced from `.openspecui.json` into `terminalController.applyConfig`, but shell paths and command presets are user-machine execution preferences and should not be treated as project truth by default.
- Node `child_process.spawn` supports a `shell` option, but OpenSpecUI's interactive terminal creation currently uses node-pty. The user-facing model should therefore be named shell profiles and spawn commands, not Node child_process options.
- VS Code task/input-style variable substitution is the closest mature precedent for command presets with user-provided inputs. JSON Schema form ideas are useful for rendering fields, but command rendering needs its own typed invocation model.

## Decision & Plan (for approval)

Implement a platform-level terminal invocation model with two orthogonal atoms:

- Shell profiles: named, selectable interactive shell definitions with platform-aware built-ins and user-managed custom entries.
- Spawn commands: named command presets with typed fields, optional shell profile selection, and explicit invocation rendering.

Preferred architecture:

1. Add shared type/schema definitions for terminal shell profiles, spawn commands, command fields, and rendered invocations.
2. Add configuration read/write support for shell profile arrays, default shell selection, and command presets.
3. Expose effective platform defaults to the frontend so placeholders reflect the real default without persisting it.
4. Update terminal creation APIs so sessions can be created from shell profiles and command presets through a single platform path.
5. Add `TerminalSpawnCommandDialog` as the reusable UI for spawn command forms.
6. Keep the target sender small: existing terminal target sends immediately; create target launches the shared spawn dialog with preset values.
7. Add Terminal Panel `+` default-shell behavior and right-click menu grouping shells and commands.

## Risks and Mitigations

- Risk: Shell and command presets could become project-level executable configuration with supply-chain risk.
  Mitigation: Default to local user configuration for custom executable entries; project config should not be the default persistence layer for user command paths.
- Risk: String template rendering may introduce shell injection behavior.
  Mitigation: Prefer typed `argv`/`stdin` invocation models. Any shell-line template must be explicit and documented as shell-evaluated.
- Risk: Built-in agent presets could pollute terminal platform logic.
  Mitigation: Treat Claude/Codex/Gemini as preset data only. The platform consumes schema and invocation definitions, not agent-specific branches.
- Risk: The dialog may become a complex nested form inside existing OPSX dialogs.
  Mitigation: Launch `TerminalSpawnCommandDialog` as a separate dialog and pass preset values into it.
- Risk: Windows shell discovery and WSL availability may vary by machine.
  Mitigation: Provide conservative built-ins and validate availability before showing or before creation with actionable errors.

## Verification Strategy

- Unit-test shell profile default resolution for macOS/Linux/Windows inputs.
- Unit-test spawn command field rendering into typed invocation payloads without `any` or unsafe casts.
- Unit-test terminal sender target behavior for existing-session send and create-dialog launch.
- Component-test `TerminalSpawnCommandDialog` with built-in Claude/Codex/Gemini-style presets and preset payload values.
- Browser-test Terminal Panel `+` and right-click menu behavior after implementation.
- Run scoped CI gates for touched packages, including format, lint, typecheck, and relevant web tests.
