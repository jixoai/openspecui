# Implementation Tasks

## 1. Design & Planning

- [x] 1.1 Research static site generation approaches for React SPA
- [x] 1.2 Design data snapshot mechanism for specs/changes enumeration
- [x] 1.3 Define export output structure and file naming conventions
- [x] 1.4 Plan fallback behavior for WebSocket-dependent features

## 2. Core Export Infrastructure

- [x] 2.1 Create `packages/cli/src/export.ts` with export orchestration logic
- [x] 2.2 Implement snapshot data generation from project directory
- [x] 2.3 Build HTML generation for each route
- [x] 2.4 Copy static assets (CSS, JS, fonts, images) to output directory
- [x] 2.5 Generate index.html files for SPA fallback routing

## 3. CLI Command Integration

- [x] 3.1 Add `export` subcommand to yargs CLI in `packages/cli/src/cli.ts`
- [x] 3.2 Implement command-line options (output-dir, base-path, etc.)
- [x] 3.3 Add progress reporting and error handling
- [x] 3.4 Support both absolute and relative output paths

## 4. Web Application Modifications

- [x] 4.1 Create static rendering mode detection in web app
- [x] 4.2 Implement graceful degradation for WebSocket features
- [x] 4.3 Add data snapshot loading for static mode
- [x] 4.4 Update routing to support base path configuration
- [x] 4.5 Add build configuration for static export target
- [x] 4.6 Disable WebSocket client creation in static mode
- [x] 4.7 Create static data provider for subscription hooks
- [x] 4.8 Update all subscription hooks to support static mode
- [x] 4.9 Disable health check polling in static mode
- [x] 4.10 Hide non-relevant settings in static mode (show only Appearance)

## 5. Build Pipeline & Tooling

- [x] 5.1 Create separate Vite build configuration for static export
- [x] 5.2 Add npm script for export build
- [x] 5.3 Implement route enumeration at build time
- [x] 5.4 Generate manifest file for available pages

## 6. Testing & Validation

- [x] 6.1 Test export command with sample project
- [x] 6.2 Verify all routes are accessible in static output
- [x] 6.3 Test navigation between pages
- [x] 6.4 Validate asset loading and styling
- [x] 6.5 Test with different base paths (/, /docs/, etc.)
- [x] 6.6 Write unit tests for export logic

## 7. Documentation

- [x] 7.1 Add export command to CLI help text
- [x] 7.2 Create usage guide in README
- [x] 7.3 Document CI workflow examples (GitHub Actions, GitLab CI)
- [x] 7.4 Add troubleshooting section for common export issues
- [x] 7.5 Document limitations (no live updates, no task toggling)

## 8. CI Integration Example

- [x] 8.1 Create example GitHub Actions workflow
- [x] 8.2 Add example for deploying to GitHub Pages
- [x] 8.3 Add example for deploying to Netlify
