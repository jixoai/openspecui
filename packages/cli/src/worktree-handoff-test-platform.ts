import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface TestHealthServer {
  url: string
  close: () => Promise<void>
}

export async function createTestHealthServer(payload: unknown): Promise<TestHealthServer> {
  const server = createServer((request, response) => {
    if (request.url !== '/api/health') {
      response.writeHead(404)
      response.end()
      return
    }

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(payload))
  })

  await listen(server)
  const address = server.address()
  if (!isAddressInfo(address)) {
    throw new Error('Test health server did not expose a TCP address.')
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => close(server),
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolvePromise()
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolvePromise()
    })
  })
}

function isAddressInfo(value: string | AddressInfo | null): value is AddressInfo {
  return typeof value === 'object' && value !== null
}
