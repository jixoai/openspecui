import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/ssg/cli.ts'),
      formats: ['es'],
      fileName: () => 'ssg-cli.mjs',
    },
    outDir: 'dist',
    rollupOptions: {
      external: [/^node:/],
    },
    minify: false,
    emptyOutDir: false,
  },
})
