/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Diagnose whether native watcher events distinguish timestamp and content updates.
 * 2. Keep the diagnostic temporary path and watcher teardown portable across platforms.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { subscribe, type AsyncSubscription } from '@parcel/watcher'
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const testDir = await mkdtemp(join(tmpdir(), 'openspecui-utimes-watcher-'))
const testFile = join(testDir, 'test.txt')
let subscription: AsyncSubscription | null = null

try {
  await writeFile(testFile, 'initial content')
  console.log('Starting watcher...')

  subscription = await subscribe(testDir, (error, events) => {
    if (error) {
      console.error('Error:', error)
      return
    }
    console.log(
      'Events received:',
      events.map((event) => `${event.type}: ${event.path}`)
    )
  })

  await new Promise((resolveReady) => setTimeout(resolveReady, 500))

  console.log('\n--- Test 1: utimes (only modify mtime) ---')
  const now = new Date()
  await utimes(testFile, now, now)

  await new Promise((resolveEvent) => setTimeout(resolveEvent, 1000))

  console.log('\n--- Test 2: writeFile (same content) ---')
  await writeFile(testFile, 'initial content')

  await new Promise((resolveEvent) => setTimeout(resolveEvent, 1000))
  console.log('\n--- Done ---')
} finally {
  await subscription?.unsubscribe()
  await rm(testDir, {
    recursive: true,
    force: true,
    maxRetries: process.platform === 'win32' ? 20 : 0,
    retryDelay: 50,
  })
}
