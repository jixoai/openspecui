import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  // Generate .d.ts without sourcemaps
  // Note: dts generation is disabled due to tRPC type inference complexity
  dts: false,
  // Bundle all dependencies into the output
  noExternal: [/.*/],
  // Keep Node.js built-in modules external
  external: [/^node:/],
  // No minification for better debugging
  minify: false,
  // Clean output directory before build
  clean: true,
  // Disable sourcemaps for smaller package size
  sourcemap: false,
})
