import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveSsgTemplatePath } from './template-path'

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'openspecui-ssg-template-'))
}

describe('resolveSsgTemplatePath', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (!dir) continue
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers index.ssg.html when present', () => {
    const dir = makeTempDir()
    tempDirs.push(dir)

    const ssgPath = join(dir, 'index.ssg.html')
    writeFileSync(ssgPath, '<html></html>')
    writeFileSync(join(dir, 'index.html'), '<html>legacy</html>')

    expect(resolveSsgTemplatePath(dir)).toBe(ssgPath)
  })

  it('falls back to index.html when index.ssg.html is missing', () => {
    const dir = makeTempDir()
    tempDirs.push(dir)

    const legacyPath = join(dir, 'index.html')
    writeFileSync(legacyPath, '<html></html>')

    expect(resolveSsgTemplatePath(dir)).toBe(legacyPath)
  })

  it('throws when neither template exists', () => {
    const dir = makeTempDir()
    tempDirs.push(dir)

    expect(() => resolveSsgTemplatePath(dir)).toThrow(/No SSG template found/i)
  })
})
