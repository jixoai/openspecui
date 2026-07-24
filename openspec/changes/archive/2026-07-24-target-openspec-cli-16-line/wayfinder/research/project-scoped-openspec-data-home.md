<!--
Orthogonal intents (created 2026-07-15 Asia/Shanghai):
1. Verify the complete OpenSpec state affected by XDG_DATA_HOME.
2. Evaluate project-scoped registry proposals against CLI, terminal, and Agent parity.
3. Separate verified upstream behavior from OpenSpecUI product extensions.
4. Record the resolved scope and trust boundary.

Original request (2026-07-15): "也许应该新建一个 openspec/.env，用它来存储 XDG_DATA_HOME=/tmp/team-a-data。这样几乎就没什么副作用了，我们只需要尊重 openspec/.env 作为 openspecui 的环境变量。"
-->

# Project-scoped OpenSpec data home

## Verified topology

`XDG_DATA_HOME` selects one OpenSpec user-data root. It is not a Store-only setting.

```text
XDG_DATA_HOME=<data-home>
          |
          v
<data-home>/openspec/
├── stores/registry.yaml       Store id -> absolute checkout path
├── worksets/                  personal saved views
└── schemas/                   user-level schema overrides
```

Evidence:

- `references/openspec/src/core/global-config.ts:60-104`
- `references/openspec/src/core/store/foundation.ts:77-82`
- `references/openspec/src/core/worksets.ts:26-71`
- `references/openspec/src/core/artifact-graph/resolver.ts:32-54`

There is one data home per process environment. XDG does not provide an overlay such as "project registry plus global registry". Selecting a project data home hides the default user registry, worksets, and user schema overrides from that process.

## Proposed path outcome

If OpenSpecUI expands the proposal to an absolute project root:

```dotenv
XDG_DATA_HOME=<project-root>
```

OpenSpec writes:

```text
<project-root>/openspec/
├── stores/registry.yaml
├── worksets/
└── schemas/
```

The location calculation is correct, but it merges user data into the canonical project planning tree. `schemas/` is especially ambiguous because the same path is already the project-local schema location.

`XDG_DATA_HOME=$pwd` is not a portable declaration:

- the shell variable is `$PWD`, not `$pwd`;
- dotenv parsing does not imply shell expansion;
- relative values resolve against the child process cwd;
- "project root" is ambiguous when OpenSpecUI launches from a package, worktree, or monorepo root.

## Runtime parity requirement

```text
effective OpenSpec data home
          |
          +--> OpenSpecUI CliExecutor
          +--> workflow command/direct invocation
          +--> embedded terminal `openspec`
          +--> Agent-executed generated commands
          +--> Store setup/register/doctor/context
```

All branches must see the same data home. Otherwise OpenSpecUI can resolve a Store while an Agent following the generated `openspec show --store ...` command reports `unknown_store`.

Current implementation has no shared project environment abstraction:

- `CliExecutor` derives every invocation from `createCleanCliEnv()`.
- PTY sessions independently inherit `process.env`.
- project UI preferences live in `openspec/.openspecui.json`.
- cross-project OpenSpecUI policy lives in `~/.openspecui/settings.json`.

Injecting a generic repo-controlled `.env` into the full PTY is unsafe and broader than OpenSpec: every XDG-aware program launched in that shell would inherit the redirected data home.

## Product boundary

### Rejected as currently stated

```text
~/.openspecui/openspec-stores.json
  global registry + project registries
```

The upstream CLI consumes one registry. OpenSpecUI would have to synthesize a composite registry, resolve Store-id conflicts, rewrite absolute paths, and preserve upstream file locking. That is a new registry implementation, not environment configuration.

```text
openspec/.env
  arbitrary environment variables
```

A cloned repository would gain authority over CLI and terminal process environments. An unrestricted `config env` feature therefore crosses a trust boundary.

## Decision

OpenSpecUI SHALL inherit the launching process's OpenSpec data scope and SHALL NOT introduce a competing scope mechanism.

```text
launch environment
  XDG_DATA_HOME? ------------------------------+
                                                   |
                                                   v
                                      every OpenSpec CLI child
```

The 1.6 adaptation therefore does not add:

- `openspec/.env` loading;
- generic `config env` commands;
- a `StoreRoot` setting;
- project-local registry synthesis;
- global/project registry overlays.

`createCleanCliEnv()` currently preserves `XDG_DATA_HOME`, and PTY sessions inherit `process.env`. Adaptation work should lock this behavior with parity tests rather than add configuration. Any future OpenSpec data-scope manager is a separate product change requiring a new trust and Agent-runtime design.
