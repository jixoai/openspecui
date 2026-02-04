<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# OpenSpec UI - AI Development Guidelines

## Core Architecture: Reactive File System

**All file-based data MUST use the reactive file system (`@openspecui/core/reactive-fs`).**

### Rules

1. **File reads**: Use `reactiveReadFile`, `reactiveReadDir`, `reactiveExists`, `reactiveStat`
2. **Never use**: `fs.existsSync`, `fs.readFileSync`, or non-reactive async fs methods for data that needs real-time updates
3. **Subscriptions**: Every query that reads files should have a corresponding subscription using `createReactiveSubscription`

### Pattern

```typescript
// packages/server/src/router.ts

// Query (for initial load)
getData: publicProcedure.query(async ({ ctx }) => {
  return someReactiveFunction(ctx.projectDir)
}),

// Subscription (for real-time updates)
subscribe: publicProcedure.subscription(({ ctx }) => {
  return createReactiveSubscription(() => someReactiveFunction(ctx.projectDir))
}),
```

### Frontend

```typescript
// packages/web/src/lib/use-subscription.ts
// Use subscription hooks instead of useQuery for reactive data

const { data } = useConfiguredToolsSubscription() // Reactive
// NOT: useQuery(trpc.cli.getConfiguredTools.queryOptions()) // Non-reactive
```

## Project Structure

- `packages/core` - Reactive file system, adapters, schemas
- `packages/server` - tRPC router with HTTP/WebSocket
- `packages/web` - React frontend
- `packages/cli` - CLI entry point
- `references/openspec` - Official OpenSpec CLI reference

## Key Files

- `packages/core/src/reactive-fs/` - Reactive file system implementation
- `packages/server/src/reactive-subscription.ts` - tRPC subscription helper
- `packages/web/src/lib/use-subscription.ts` - React subscription hooks

## CLI Argument Parsing

**Always use `yargs` for CLI argument parsing. Never write custom parseArgs functions.**

- Use `yargs` + `yargs/helpers` for consistent argument handling
- Use `INIT_CWD` environment variable to resolve paths relative to original working directory
- Support both `--option value` and `--option=value` formats (yargs handles this automatically)
- Filter out `--` separator when using with pnpm/tsx (they add `--` before script arguments)

```typescript
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { resolve } from 'node:path'

const originalCwd = process.env.INIT_CWD || process.cwd()

// Filter out '--' separator that pnpm/tsx adds
const args = hideBin(process.argv).filter((arg) => arg !== '--')

const argv = await yargs(args)
  .option('dir', {
    alias: 'd',
    type: 'string',
    default: '.',
  })
  .parse()

const projectDir = resolve(originalCwd, argv.dir)
```

## CLI-First Architecture

**OpenSpec UI is a visual interface for the OpenSpec CLI. Prefer using CLI commands over custom implementations.**

### Rules

1. **Use CLI when available**: For operations like `init`, `archive`, `validate` - call the OpenSpec CLI via `CliExecutor`
2. **Custom logic only when necessary**: Only implement custom logic when CLI doesn't support the operation (e.g., file reading, task toggling)
3. **Reference implementation**: Check `references/openspec/` for the official CLI implementation when building custom logic
4. **Streaming output**: Use `executeStream` for long-running CLI commands to show real-time terminal output

### CLI Commands

```bash
# Check available commands
openspec --help

# Init with tools
openspec init --tools=claude,cursor

# Archive a change
openspec archive -y <change-name> [--skip-specs] [--no-validate]

# Validate
openspec validate [spec|change] [id]
```

### Implementation Pattern

```typescript
// Use CLI for operations
const result = await ctx.cliExecutor.archive(changeId, { skipSpecs: true })

// Use streaming for real-time output
await ctx.cliExecutor.archiveStream(changeId, options, (event) => {
  emit.next(event) // Send to frontend via WebSocket
})
```

## Important Reference Files

**At the start of each session, read `references/openspec-0.16.0-report.md` to understand the OpenSpec domain model and architecture.**

This file contains:
- OpenSpec core concepts and terminology
- File structure and naming conventions
- Workflow patterns (proposal → implementation → archive)
- Relationship between specs, changes, and tasks

## README Versioning Convention

**README files are versioned by OpenSpec CLI version, not openspecui version.**

### Rules

1. **Current README**: `README.md` contains documentation for the current supported OpenSpec CLI version
2. **Historical READMEs**: When OpenSpec CLI has breaking changes, archive the old README as `README-{OPENSPEC_VERSION}.md`
3. **Version reference**: The version number (e.g., `0.16.0`) refers to the **OpenSpec CLI version**, not openspecui version
4. **Links**: New `README.md` should reference historical README files at the bottom

### Example

```
README.md              # Current (for openspec 0.17.x)
README-0.16.0.md       # Archived (for openspec 0.16.x)
README-0.15.0.md       # Archived (for openspec 0.15.x)
```

### When to Create New README Version

- OpenSpec CLI has breaking changes that affect openspecui usage
- Installation or configuration steps change significantly
- API or command interface changes
