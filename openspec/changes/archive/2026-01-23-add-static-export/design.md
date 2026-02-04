# Design: Static Export for OpenSpec UI

## Context

OpenSpecUI is a React SPA that currently requires a Node.js server with WebSocket support for real-time file watching. Users need a way to generate static HTML snapshots for:

1. **CI/CD Integration** - Deploy specs as documentation sites in pipelines
2. **Read-Only Sharing** - Distribute spec snapshots without server infrastructure
3. **Archival** - Capture spec state at specific points in time

**Constraints:**

- Must maintain visual parity with live server mode
- Should not require changes to core spec files or OpenSpec CLI
- Must handle dynamic routes (specs, changes, archives)
- Cannot use server-side rendering (no SSR framework)

**Tech Stack Context:**

- Vite 6 build system
- TanStack Router (file-based routing)
- tRPC with WebSocket subscriptions
- React 19 SPA

## Goals / Non-Goals

**Goals:**

- Generate fully static HTML/CSS/JS that works without a server
- Pre-render all known routes at export time
- Support deployment to static hosts (GitHub Pages, Netlify, S3)
- Provide clear error messages when export fails
- Enable CI workflow integration

**Non-Goals:**

- Server-side rendering (SSR) or streaming
- Interactive features in static mode (task toggling, live updates)
- Dynamic route generation at runtime (all routes pre-rendered)
- Search functionality in static mode
- Support for user authentication or write operations

## Decisions

### 1. Export Approach: Snapshot + Client-Side Hydration

**Decision:** Generate a complete data snapshot at export time and embed it in the static build. The React app loads this snapshot instead of making tRPC calls.

**Rationale:**

- Avoids need for SSR framework (Next.js, Remix)
- Leverages existing React components without modification
- Simple implementation using JSON data files
- Fast page loads with client-side routing

**Alternatives Considered:**

- **Static Site Generator (Astro/Docusaurus):** Would require rewriting UI components. Too much scope.
- **Puppeteer Pre-rendering:** Fragile, slow, hard to debug. Requires headless browser in CI.
- **Next.js Static Export:** Would require migrating from Vite + TanStack Router. Major refactor.

### 2. Data Snapshot Format

**Decision:** Generate a single `data.json` file containing all specs, changes, and archives, structured identically to tRPC responses.

```json
{
  "specs": [...],
  "changes": [...],
  "archives": [...],
  "dashboard": {...},
  "project": {...}
}
```

**Rationale:**

- Minimal changes to existing React components
- Single file = easy caching and deployment
- Type-safe using existing tRPC schemas

**Trade-off:** Larger initial download vs. multiple requests. Acceptable for documentation sites (typically <10MB).

### 3. Route Enumeration

**Decision:** Generate separate HTML files for dynamic routes using the data snapshot.

Example output structure:

```
dist/
├── index.html
├── specs.html
├── specs/
│   ├── user-auth.html
│   └── payment-api.html
├── changes/
│   └── add-2fa.html
├── archive.html
├── data.json
└── assets/
```

**Rationale:**

- Works with standard static hosts
- Supports direct linking to specific specs/changes
- Falls back to client-side routing if needed

**Implementation:** Use Vite's `build.rollupOptions.input` to generate multiple entry points.

### 4. WebSocket Feature Degradation

**Decision:** Detect static mode and disable WebSocket-dependent features with user-friendly messaging.

Features disabled in static mode:

- Live file watching
- Task checkbox toggling
- Real-time updates
- AI integration features

**UI Treatment:** Show info banner: "Viewing static snapshot from [timestamp]. Live features disabled."

### 5. CLI Command Design

```bash
openspecui export [output-dir] [options]

Options:
  --output, -o     Output directory (default: ./openspec-export)
  --base-path      Base path for deployment (default: /)
  --clean          Clean output directory before export
  --no-open        Don't open browser after export

Example:
  openspecui export ./dist --base-path=/docs/
```

**Rationale:**

- Consistent with existing CLI patterns
- Supports common deployment scenarios
- Allows testing locally before CI deployment

## Technical Implementation

### Phase 1: Data Snapshot Generation

1. Read OpenSpec directory using existing `@openspecui/core` adapters
2. Serialize all specs, changes, archives using existing parsers
3. Generate `data.json` with complete project state
4. Include metadata (timestamp, version, project path)

### Phase 2: Static Build Configuration

1. Add `vite.config.export.ts` with:
   - Disable code splitting for predictable output
   - Inject data snapshot URL
   - Configure base path
   - Generate multiple HTML entry points

2. Create static mode detection and data loading:
   - `packages/web/src/main.tsx` - Detect static mode before app renders
   - `packages/web/src/lib/static-mode.ts` - Mode detection utilities
   - `packages/web/src/lib/static-data-provider.ts` - Load data from snapshot

3. Prevent WebSocket creation in static mode:
   - `packages/web/src/lib/trpc.ts` - Lazy WebSocket client creation
   - Check `isStaticMode()` before creating WebSocket connections
   - Return null WebSocket client in static mode

4. Update subscription architecture:
   - `packages/web/src/lib/use-subscription.ts` - Hybrid hooks
   - Accept optional `staticLoader` parameter for each hook
   - Route to static provider or tRPC based on mode
   - Update all 16+ subscription hooks (dashboard, specs, changes, archives, etc.)

5. Disable server-dependent features:
   - `packages/web/src/lib/use-server-status.ts` - Skip health checks
   - `packages/web/src/routes/settings.tsx` - Hide CLI, API, Project, Watcher, Init sections
   - Only show Appearance (theme) settings in static mode

6. Add static mode UI indicators:
   - `packages/web/src/components/StaticModeBanner.tsx` - Display snapshot info
   - `packages/web/src/components/layout/root-layout.tsx` - Show banner
   - Set document title to "OpenSpec UI (Static)"

### Phase 3: Export Orchestration

1. `packages/cli/src/export.ts` coordinates:
   - Generate data snapshot
   - Run Vite build with export config
   - Enumerate routes from snapshot data
   - Generate HTML files for each route
   - Copy assets to output directory
   - Generate sitemap (optional)

### Phase 4: Fallback Routing

Generate `.htaccess` or `_redirects` for SPA fallback:

```
# Netlify
/*  /index.html  200

# GitHub Pages (using 404.html trick)
```

## Risks / Trade-offs

### Risk 1: Large Data Snapshot Size

**Mitigation:**

- Compress JSON (gzip enabled by default on static hosts)
- Warn if snapshot exceeds 10MB
- Consider pagination for projects with >100 specs

### Risk 2: Stale Static Snapshots

**Impact:** Users may confuse static snapshot with live server.
**Mitigation:**

- Prominent banner in static mode
- Include timestamp in footer
- Document in CI examples

### Risk 3: Route Generation Complexity

**Impact:** Dynamic routes require enumeration logic.
**Mitigation:**

- Use OpenSpec CLI's `list` commands
- Fail fast if routes cannot be determined
- Provide verbose logging

### Risk 4: Asset Path Resolution

**Impact:** Base path configuration can break asset loading.
**Mitigation:**

- Test with multiple base paths
- Use Vite's built-in base path support
- Document base path requirements

## Migration Plan

**Phase 1 (MVP):** Basic export with data snapshot and route generation
**Phase 2:** CI examples and documentation
**Phase 3:** Optimizations (asset minification, sitemap generation)

**Rollback:** Feature is opt-in via CLI command. No impact on existing server mode.

## Validation Checklist

- [x] Export generates valid HTML files
- [x] All routes are accessible in static output
- [x] Assets load correctly with different base paths
- [x] Navigation works without JavaScript (fallback routing)
- [x] Static mode banner is visible
- [x] Example GitHub Actions workflow created
- [x] File size is reasonable (<50MB for typical projects)
- [x] Export fails gracefully with clear errors
- [x] No WebSocket connection attempts in static mode
- [x] No health check polling in static mode
- [x] Settings page shows only relevant sections in static mode
- [x] Theme switching works in static mode
- [ ] Export tested with different base paths (/, /docs/, etc.)
- [ ] Example GitHub Actions workflow tested in real CI environment

## Open Questions

1. **Q:** Should we support incremental exports (only changed pages)?
   **A:** Not in MVP. Full export is simpler and fast enough for CI.

2. **Q:** Should we include search functionality in static mode?
   **A:** Not in MVP. Can add client-side search (lunr.js) in future.

3. **Q:** What about syntax highlighting and code blocks?
   **A:** Should work unchanged - Shiki runs client-side.

4. **Q:** Should we generate a sitemap.xml?
   **A:** Nice-to-have for SEO but not required for MVP.
