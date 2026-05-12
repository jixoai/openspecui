## Checklist

- [x] 1. Define terminal shell profile and spawn command schemas.
- [x] 2. Add platform default shell profile resolution and expose effective defaults to the frontend.
- [x] 3. Add local/user configuration persistence for shell profiles, default shell selection, and command presets.
- [x] 4. Update terminal session creation to accept selected shell profile and command preset invocations through the terminal platform path.
- [x] 5. Implement `TerminalSpawnCommandDialog` with typed fields, boolean toggles, preset values, and `Create`.
- [x] 6. Update Terminal Panel `+` to create the default shell and right-click menu to show shells and commands.
- [x] 7. Update send-to-terminal target flows to support existing-session `Send` and create-target `Create` via the shared dialog.
- [x] 8. Add built-in Claude, Codex, and Gemini command presets as data, with dangerous flags exposed only as explicit toggles.
- [x] 9. Add focused unit/component tests for defaults, schema rendering, sender behavior, and dialog behavior.
- [x] 10. Run local verification gates and record results before PR.
