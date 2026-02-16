import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read web package version for build-time replacement
const webPkgPath = resolve(__dirname, '../web/package.json')
const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'))
const webVersion = webPkg.version

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  // Generate .d.ts without sourcemaps
  // Note: dts generation is disabled due to tRPC type inference complexity
  dts: false,
  // Bundle all dependencies into the output
  noExternal: [/.*/],
  // Keep Node.js built-in modules and native dependencies external.
  // Native bindings must be resolved from installed runtime dependencies.
  external: [/^node:/, '@parcel/watcher', '@lydell/node-pty'],
  // No minification for better debugging
  minify: false,
  // Clean output directory before build
  clean: true,
  // Disable sourcemaps for smaller package size
  sourcemap: false,
  // Replace version placeholder at build time
  define: {
    '__WEB_PACKAGE_VERSION__': JSON.stringify(webVersion),
  },
})
