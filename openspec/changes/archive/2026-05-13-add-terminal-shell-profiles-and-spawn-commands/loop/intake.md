## User Input

The manager wants OpenSpecUI to satisfy GitHub issues #98 and #99 with terminal-centered platform features:

- For #98, OpenSpecUI should support configurable shells. By default, macOS/Linux should offer `/bin/sh` and the user's `SHELL`, Windows should offer `cmd`, PowerShell, and WSL bash where applicable, and users should be able to add custom shell entries such as Git Bash. Users should manage this shell array and choose one default shell.
- For #99, OpenSpecUI should provide configurable shortcut commands. Built-in examples include Claude, Codex, and Gemini. Commands may expose UI fields and toggles, such as a `--dangerously-skip-permissions` toggle for Claude.
- The terminal panel `+` button should create a default-shell terminal. Right-clicking the `+` button should open a menu with two groups: configured shells and configured commands.
- Choosing a shell should directly create a terminal instance for that shell.
- Choosing a command should open a `TerminalSpawnCommandDialog` that renders the command's configuration form, lets the user fill parameters, and creates the terminal after `Create`.
- The same `TerminalSpawnCommandDialog` should be reusable from #99 target-selection flows. The target sender itself should stay simple: a `Select` plus one `Send` or `Create` button. If the user selects `Create`, it should open `TerminalSpawnCommandDialog` with preset values such as the command/compose payload to send to the terminal.

## Objective Scope

- Add a terminal shell profile model that separates configured shells from command presets.
- Add terminal spawn command presets with schema-driven fields and explicit rendering into terminal creation/write behavior.
- Add UI affordances for terminal creation from shell profiles and spawn commands.
- Add a reusable `TerminalSpawnCommandDialog` that can be launched from both Terminal Panel creation and target-selection flows.
- Keep #98 and #99 behavior as terminal platform capabilities rather than OPSX- or agent-specific page logic.

## Non-Goals

- Do not implement a generic plugin bus or broad agent orchestration framework.
- Do not hard-code Claude, Codex, or Gemini behavior into the terminal platform layer.
- Do not persist unsafe executable command configuration into project files by default.
- Do not replace the current PTY session lifecycle or terminal renderer architecture.
- Do not implement #103 markdown preprocessing or translation hooks in this change.

## Acceptance Boundary

- Users can configure multiple shell profiles and choose a default shell.
- The default shell placeholder reflects the effective platform default without persisting a duplicate default value.
- Terminal Panel `+` creates a terminal using the configured default shell.
- Terminal Panel right-click menu can create terminals from shell profiles or open command preset creation dialogs.
- Command presets can render forms, including boolean toggles, and create terminals with the generated invocation.
- Existing send-to-terminal flows can choose an existing terminal or choose creation via the shared spawn dialog.
- Built-in command presets remain configurable atoms, with dangerous flags exposed only through explicit toggles.
