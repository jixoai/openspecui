import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'
import { CLI_NATIVE_RUNTIME_DEPENDENCIES } from './src/native-runtime-dependencies.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read web package version for build-time replacement
const webPkgPath = resolve(__dirname, '../web/package.json')
const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'))
const webVersion = webPkg.version

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: 'esm',
    // Note: dts generation is disabled for main entries due to tRPC type inference complexity.
    dts: false,
    // Bundle all dependencies into the output
    noExternal: [/.*/],
    // Keep Node.js built-in modules and native dependencies external.
    // Native bindings must be resolved from installed runtime dependencies.
    external: [/^node:/, ...CLI_NATIVE_RUNTIME_DEPENDENCIES],
    // No minification for better debugging
    minify: false,
    // Clean output directory before build
    clean: true,
    // Disable sourcemaps for smaller package size
    sourcemap: false,
    // Replace version placeholder at build time
    define: {
      __WEB_PACKAGE_VERSION__: JSON.stringify(webVersion),
    },
  },
  {
    entry: ['src/hooks.ts'],
    format: 'esm',
    dts: true,
    noExternal: [/.*/],
    external: [/^node:/],
    minify: false,
    clean: false,
    sourcemap: false,
  },
])
