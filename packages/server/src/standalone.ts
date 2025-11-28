import { serve } from '@hono/node-server'
import { createServer, createWebSocketServer } from './server.js'

// Parse --dir argument
function parseArgs(): { projectDir: string; port: number } {
  const args = process.argv.slice(2)
  let projectDir = process.env.OPENSPEC_PROJECT_DIR ?? process.cwd()
  let port = parseInt(process.env.PORT ?? '3100', 10)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      projectDir = args[i + 1]
      i++
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10)
      i++
    }
  }

  return { projectDir, port }
}

const { projectDir, port } = parseArgs()

const server = createServer({ projectDir, port, enableWatcher: true })

console.log(`OpenSpecUI server starting...`)
console.log(`Project directory: ${projectDir}`)
console.log(`Server: http://localhost:${port}`)
console.log(`WebSocket: ws://localhost:${port}/trpc`)
console.log(`File watcher: enabled`)

const httpServer = serve({
  fetch: server.app.fetch,
  port,
})

// Enable WebSocket for realtime subscriptions
createWebSocketServer(server, httpServer)
