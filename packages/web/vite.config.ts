import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

function resolveBackendTarget(): string {
  const explicit =
    process.env.VITE_API_URL || process.env.OPENSPEC_SERVER_URL || process.env.API_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const port = process.env.OPENSPEC_SERVER_PORT || process.env.SERVER_PORT || process.env.PORT
  const targetPort = port ? Number(port) : 3100
  return `http://localhost:${targetPort}`
}

export default defineConfig(() => {
  const backendTarget = resolveBackendTarget()
  console.log(`[dev-proxy] backend target => ${backendTarget}`)

  return {
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
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
