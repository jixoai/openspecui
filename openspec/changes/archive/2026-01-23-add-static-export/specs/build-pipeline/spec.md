## ADDED Requirements

### Requirement: Export Build Configuration

The build system SHALL provide a separate configuration for static export builds.

#### Scenario: Separate Vite configuration for export
- **GIVEN** the web package uses Vite for building
- **WHEN** building for static export
- **THEN** a separate Vite configuration SHALL be used
- **AND** the configuration SHALL optimize for static deployment

#### Scenario: Inject static mode flag at build time
- **GIVEN** building for static export
- **WHEN** Vite processes the code
- **THEN** a `STATIC_MODE` environment variable SHALL be set to true
- **AND** the web app SHALL access this at runtime

#### Scenario: Configure base path at build time
- **GIVEN** a base path is specified for export
- **WHEN** building static assets
- **THEN** Vite SHALL use the base path for all asset URLs
- **AND** generated files SHALL reference assets correctly

#### Scenario: Disable code splitting for predictable output
- **GIVEN** building for static export
- **WHEN** bundling JavaScript
- **THEN** code splitting SHALL be minimal or disabled
- **AND** generated files SHALL have predictable names

### Requirement: Multi-Entry Point HTML Generation

The build system SHALL support generating multiple HTML entry points for dynamic routes.

#### Scenario: Generate entry points from route manifest
- **GIVEN** a list of all dynamic routes (specs, changes, archives)
- **WHEN** building static export
- **THEN** a separate HTML file SHALL be generated for each route
- **AND** each file SHALL contain the full React application
- **AND** each file SHALL pre-configure initial route state

#### Scenario: Use HTML template for all entry points
- **GIVEN** the main `index.html` template
- **WHEN** generating route-specific HTML files
- **THEN** all files SHALL use the same base template
- **AND** differ only in metadata (title, meta tags) and initial route

#### Scenario: Handle nested routes
- **GIVEN** routes like `/specs/[id]`, `/changes/[id]`, `/archive/[id]`
- **WHEN** generating HTML files
- **THEN** directory structure SHALL mirror route hierarchy
- **AND** `specs/user-auth.html` SHALL be accessible at that path

### Requirement: Asset Optimization and Bundling

The build system SHALL optimize all assets for static deployment.

#### Scenario: Minify CSS and JavaScript
- **GIVEN** building for static export
- **WHEN** bundling assets
- **THEN** CSS SHALL be minified
- **AND** JavaScript SHALL be minified
- **AND** source maps SHALL be generated for debugging

#### Scenario: Inline critical CSS
- **GIVEN** building for static export
- **WHEN** generating HTML files
- **THEN** critical CSS MAY be inlined in the HTML head
- **AND** full stylesheets SHALL be loaded asynchronously

#### Scenario: Optimize images and fonts
- **GIVEN** the application uses images and custom fonts
- **WHEN** building for static export
- **THEN** images SHALL be optimized for web delivery
- **AND** fonts SHALL be included in the bundle
- **AND** font loading SHALL be optimized

### Requirement: Build Script Integration

The package scripts SHALL support export build targets.

#### Scenario: Add export build script
- **GIVEN** the web package.json
- **WHEN** a developer runs `pnpm build:export`
- **THEN** the system SHALL build the web package for static export
- **AND** use the export-specific Vite configuration

#### Scenario: Export build in CI
- **GIVEN** a CI environment
- **WHEN** running `pnpm build:export`
- **THEN** the build SHALL complete successfully
- **AND** output SHALL be written to a predictable location
- **AND** exit code SHALL indicate success or failure

#### Scenario: Clean build output
- **GIVEN** existing build artifacts
- **WHEN** running export build with clean option
- **THEN** previous build output SHALL be removed
- **AND** fresh build SHALL be created

### Requirement: Route Manifest Generation

The build system SHALL generate a manifest of all available routes.

#### Scenario: Create routes.json manifest
- **GIVEN** the export build process
- **WHEN** enumerating routes
- **THEN** a `routes.json` file SHALL be created
- **AND** contain all spec, change, and archive routes
- **AND** include metadata (title, type, timestamp)

#### Scenario: Use manifest for navigation
- **GIVEN** the generated routes manifest
- **WHEN** the static site loads
- **THEN** navigation menus SHALL be populated from the manifest
- **AND** route validation SHALL use the manifest

#### Scenario: Handle empty project
- **GIVEN** a project with no specs or changes
- **WHEN** generating route manifest
- **THEN** manifest SHALL contain only core routes (dashboard, settings)
- **AND** build SHALL succeed without errors

### Requirement: Build Performance and Caching

The build system SHALL optimize build performance for CI environments.

#### Scenario: Incremental builds with caching
- **GIVEN** repeated builds in CI
- **WHEN** source files have not changed
- **THEN** Vite SHALL use cached build artifacts where possible
- **AND** build time SHALL be reduced

#### Scenario: Display build metrics
- **GIVEN** an export build completes
- **WHEN** displaying results
- **THEN** total build time SHALL be shown
- **AND** bundle size SHALL be reported
- **AND** number of pages generated SHALL be shown

#### Scenario: Fail fast on build errors
- **GIVEN** a build error occurs (TypeScript, bundling)
- **WHEN** running export build
- **THEN** the build SHALL stop immediately
- **AND** display clear error message
- **AND** exit with non-zero code
