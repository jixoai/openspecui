import { createServer as createNetServer } from 'node:net'

/**
 * Check if a port is available by trying to listen on it.
 * Uses default binding (both IPv4 and IPv6) to detect conflicts.
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createNetServer()
    server.once('error', () => {
      resolve(false)
    })
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port)
  })
}

/**
 * Find an available port starting from the given port.
 * Will try up to maxAttempts ports sequentially.
 *
 * @param startPort - The preferred port to start checking from
 * @param maxAttempts - Maximum number of ports to try (default: 10)
 * @returns The first available port found
 * @throws Error if no available port is found in the range
 */
export async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    if (await isPortAvailable(port)) {
      return port
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`)
}
