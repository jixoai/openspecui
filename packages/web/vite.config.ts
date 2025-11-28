import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/trpc': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        // Enable WebSocket proxy for tRPC subscriptions
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
})
