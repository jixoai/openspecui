## Implementation Notes

No implementation has been performed yet. This artifact records the approved architecture boundary before code changes.

## Key Decisions

- Shell configuration and command configuration are separate platform atoms.
- `TerminalSpawnCommandDialog` is the shared command-form UI. It should be opened from terminal creation menus and send-target creation flows rather than embedded as a nested complex form.
- Dangerous command flags, such as Claude `--dangerously-skip-permissions`, must be explicit UI toggles.
- Built-in agent command presets are data. The terminal platform must not branch on specific agent names.
- The persisted custom executable configuration should default to a local user preference layer, not project `.openspecui.json`.

## Loopback Triggers

- If implementation requires executable project config by default, return to research-plan for approval.
- If command rendering requires shell-line interpolation of arbitrary user input, return to design for a safer invocation model.
- If terminal session creation needs a new backend lifecycle beyond PTY manager options, return to research-plan before changing server boundaries.
