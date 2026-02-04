# Project Context

## Purpose

**OpenSpec UI** is a visual web interface for spec-driven development with OpenSpec. The project bridges AI coding assistants and human developers by providing a structured, reviewable format for managing specifications, change proposals, and implementation tasks.

### Core Features
- **Dashboard** - Overview of specs, changes, and task progress
- **Spec Management** - View and edit specification documents with syntax highlighting
- **Change Proposals** - Track change proposals with tasks and deltas
- **Task Tracking** - Interactive task completion with click-to-toggle
- **Realtime Updates** - WebSocket-based live updates when files change
- **AI Integration** - Review, translate, and suggest improvements via API & ACP protocols

### Value Proposition
Provides a visual interface that makes spec-driven development accessible and efficient, with real-time collaboration between AI assistants and human developers.

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TanStack Router (v1.99)** - File-based routing
- **TanStack Query (v5.62)** - Server state management with reactive subscriptions
- **Tailwind CSS v4** - Styling with custom design tokens
- **CodeMirror 6** - Code/markdown editing with syntax highlighting
- **Shiki** - Syntax highlighting for code blocks
- **React Markdown + remark-gfm** - GitHub Flavored Markdown rendering
- **Lucide React** - Icon library
- **Vite (v6)** - Build tool and dev server

### Backend
- **Hono** - Web framework
- **tRPC v11** - Type-safe API layer with WebSocket support
- **WebSocket (ws)** - Real-time bidirectional communication
- **Node.js (>=20.19.0)** - Runtime environment
- **@parcel/watcher** - Native file system watcher

### Build & Development
- **pnpm (10.22.0)** - Package manager with workspaces (strictly enforced)
- **tsdown (0.16.6)** - TypeScript bundler for packages
- **tsx** - TypeScript execution for dev scripts
- **Vitest (v2.1.8)** - Testing framework with V8 coverage

### Type Safety & Validation
- **TypeScript (5.7.2)** - Static typing with strict mode
- **Zod (3.24.1)** - Runtime schema validation

### AI Integration
- **@agentclientprotocol/sdk** - Agent Client Protocol support
- Custom API provider abstraction for OpenAI-compatible APIs

## Project Conventions

### Code Style

**Prettier Configuration**:
- No semicolons
- Single quotes
- 2-space indentation
- 100 character line width
- Auto-organize imports (prettier-plugin-organize-imports)
- Auto-format Tailwind classes (prettier-plugin-tailwindcss)

**TypeScript Standards**:
- Strict mode enabled
- No unused locals/parameters
- Target: ES2022
- Module: ESNext with bundler resolution
- Verbatim module syntax for explicit imports/exports

**Path Aliases**:
- `@/*` - Web package src directory
- Workspace packages imported directly (e.g., `@openspecui/core`)

**File Naming**:
- Components: PascalCase (e.g., `SpecView.tsx`)
- Utilities: kebab-case (e.g., `reactive-fs.ts`)
- Tests: `*.test.ts` alongside source files

### Architecture Patterns

**Monorepo Structure** (pnpm workspaces):
```
packages/
├── cli/          # CLI tool (openspecui command)
├── core/         # File adapter, parser, validator, reactive FS
├── server/       # tRPC HTTP/WebSocket server
├── web/          # React web application
└── ai-provider/  # AI provider abstraction (API & ACP)
```

**Reactive File System** (Core Pattern):
The project uses a unique Signal/Effect-based reactive file system that automatically responds to file changes:
- `ReactiveState` - Similar to signals, tracks file state
- `ReactiveContext` - Manages dependency collection and change notifications
- Reactive operations: `reactiveReadFile`, `reactiveReadDir`, `reactiveExists`, `reactiveStat`
- `@parcel/watcher` - Efficient native file system monitoring

**Query + Subscription Pattern**:
All file-based data uses the reactive file system for automatic updates:
```typescript
// Backend: Query (initial load) + Subscription (real-time updates)
getData: publicProcedure.query(async ({ ctx }) => {
  return someReactiveFunction(ctx.projectDir)
}),
subscribe: publicProcedure.subscription(({ ctx }) => {
  return createReactiveSubscription(() => someReactiveFunction(ctx.projectDir))
}),

// Frontend: Single hook combines both
const { data } = useDataSubscription() // Reactive via WebSocket
```

**CLI-First Design**:
- Delegates to external OpenSpec CLI (`@fission-ai/openspec`) when available
- Falls back to `npx openspec` if not globally installed
- Wraps CLI commands like `init`, `archive`, `validate`, `list`, `show`
- Streams CLI output for real-time terminal feedback

**tRPC Architecture**:
- Split link: WebSocket for subscriptions, HTTP batch for queries/mutations
- Domain-based routers: dashboard, spec, change, archive, project, ai, config, cli
- Context-based DI: adapter, providerManager, configManager, cliExecutor

**Design System**:
- Monospace brutalist aesthetic (JetBrains Mono throughout)
- Hard shadows, no border radius
- Custom Tailwind tokens defined in `app.css`

### Testing Strategy

**Framework**: Vitest (v2.1.8) with Node.js environment and V8 coverage

**Test Coverage**:
- 11 test files, ~2,961 lines of test code
- Tests located in `*.test.ts` files alongside source
- Coverage reporters: text, json, html

**Test Distribution**:
- `packages/core/` - adapter, parser, validator, config, cli-executor, reactive-fs
- `packages/server/` - router integration tests
- `packages/ai-provider/` - api-provider, manager

**Testing Focus**:
- Unit tests for core business logic (parser, validator, reactive file system)
- Integration tests for tRPC router endpoints
- Schema validation and file parsing edge cases
- Reactive state management and change detection

**No E2E tests** currently in place.

**Run tests**: `pnpm test` (from workspace root)

### Git Workflow

**Commit Convention**: Emoji-prefixed conventional commits with Chinese descriptions

**Common prefixes**:
- `✨` - New features (e.g., "✨ 新版Change/Archive的渲染视图")
- `🐛` - Bug fixes (e.g., "🐛 阻止归档未解析ID时误判成功")
- `♻️` - Refactoring (e.g., "♻️ 重构cliTerminal相关的逻辑")
- `💄` - UI/Style updates (e.g., "💄 优化样式和动画")
- `💪` - Improvements (e.g., "💪 修复文件系统的稳定性")
- `🔧` - Configuration changes (e.g., "🔧 重构dev脚本")
- `🚧` - Work in progress
- `chore:` - Maintenance tasks

**Branching**:
- Main branch for production-ready code
- Development with direct commits or short-lived branches
- No explicit CI/CD configuration

**Git Ignore**: node_modules, dist, build, bundle, coverage, example/, provider.json

## Domain Context

**Spec-Driven Development**:
OpenSpec promotes a workflow where specifications drive implementation. Changes are proposed in structured markdown documents before implementation begins.

**Key Concepts**:
- **Spec** - Authoritative design documents in `@openspec/*.md`
- **Change Proposal** - Proposed modifications with tasks and code deltas (`@openspec/changes/*.md`)
- **Archive** - Completed changes moved to `@openspec/archive/`
- **Tasks** - Checkboxes in specs/changes that track implementation progress
- **Deltas** - Code diffs showing proposed or completed changes

**File Structure**:
```
@openspec/
├── project.md          # This file - project context
├── *.md               # Specification documents
├── changes/           # Active change proposals
│   └── *.md
└── archive/           # Completed changes
    └── *.md
```

**Reactive Philosophy**:
The entire UI is built around reactive file system updates. When files change on disk (via editor, git, or CLI), the UI automatically reflects those changes without manual refresh. This enables seamless collaboration between AI assistants (editing files directly) and humans (viewing in UI).

**AI Integration Model**:
- AI assistants read/write spec files directly in the file system
- UI provides visual feedback and structured editing
- Changes can be reviewed, approved, and archived through UI or CLI
- Supports both API-based AI (OpenAI-compatible) and ACP protocol agents

## Important Constraints

**Runtime Requirements**:
- Node.js >= 20.19.0 (strictly enforced)
- pnpm 10.22.0 (strictly enforced via packageManager field)
- Native module: `@parcel/watcher` must be available at runtime

**Platform**:
- Cross-platform (Windows, macOS, Linux)
- Native file system watching requires platform-specific binaries

**Performance Considerations**:
- File watching may impact performance in very large projects
- WebSocket connections required for real-time updates
- CodeMirror editor may be memory-intensive for very large files

**Browser Requirements**:
- Modern browsers supporting ES2022
- WebSocket support required for subscriptions

**Design Constraints**:
- Monospace-only design system (JetBrains Mono)
- Brutalist aesthetic (hard shadows, no rounded corners)
- Mobile support is not a priority

**Licensing**:
- MIT License - permissive open source

## External Dependencies

**Critical Runtime Dependencies**:
- `@parcel/watcher` (v2.5.1) - Native C++ module for file system watching
- `@agentclientprotocol/sdk` (v0.5.1) - Agent Client Protocol for AI communication

**External CLI**:
- **OpenSpec CLI** (`@fission-ai/openspec`) - External tool that UI wraps
  - Detection: `npx openspec --version` or global `openspec --version`
  - Fallback to `npx` if not globally installed
  - Commands used: `init`, `archive`, `validate`, `list`, `show`

**AI APIs** (Optional, user-configured):
- OpenAI-compatible API endpoints (configured via `provider.json`)
- Agent Client Protocol (ACP) agents

**Internal APIs**:
- tRPC over HTTP: `http://localhost:3100/trpc` (queries/mutations)
- tRPC over WebSocket: `ws://localhost:3100/trpc` (subscriptions)

**Development Tools**:
- Prettier with plugins (organize-imports, tailwindcss)
- tsx for TypeScript execution
- Vitest for testing

**No External Services**:
The application runs entirely locally. No cloud services or external databases required.
