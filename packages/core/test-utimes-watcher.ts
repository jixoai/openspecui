import { subscribe } from '@parcel/watcher'
import { writeFileSync, utimesSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const testDir = '/tmp/utimes-watcher-test'
const testFile = join(testDir, 'test.txt')

// 准备测试目录
if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
writeFileSync(testFile, 'initial content')

console.log('Starting watcher...')

const subscription = await subscribe(testDir, (err, events) => {
  if (err) {
    console.error('Error:', err)
    return
  }
  console.log('Events received:', events.map((e) => `${e.type}: ${e.path}`))
})

// 等待 watcher 稳定
await new Promise((r) => setTimeout(r, 500))

console.log('\n--- Test 1: utimesSync (only modify mtime) ---')
utimesSync(testFile, new Date(), new Date())

await new Promise((r) => setTimeout(r, 1000))

console.log('\n--- Test 2: writeFileSync (same content) ---')
writeFileSync(testFile, 'initial content')

await new Promise((r) => setTimeout(r, 1000))

console.log('\n--- Done ---')
await subscription.unsubscribe()
process.exit(0)
