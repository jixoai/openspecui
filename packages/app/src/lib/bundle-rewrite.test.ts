import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { rewriteHostedBundlePaths } from './bundle-rewrite'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('rewriteHostedBundlePaths', () => {
  it('rewrites absolute asset references and base path into version-scoped values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openspecui-bundle-rewrite-'))
    tempDirs.push(dir)
    const file = join(dir, 'index.html')
    await writeFile(
      file,
      '<script>window.__OPENSPEC_BASE_PATH__ = \'/\';</script><script src="/assets/index.js"></script><link href="/logo.svg" />',
      'utf8'
    )

    await rewriteHostedBundlePaths(dir, 'v2.0')

    const content = await readFile(file, 'utf8')
    expect(content).toContain("window.__OPENSPEC_BASE_PATH__ = '/versions/v2.0/'")
    expect(content).toContain('/versions/v2.0/assets/index.js')
    expect(content).toContain('/versions/v2.0/logo.svg')
  })
})
