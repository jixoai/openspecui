import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findNearestPackageJson,
  isLocalPackageRange,
  readWebPackageRangeFromPackageJson,
} from './export.js'

const tmpRoots: string[] = []

function makeTempDir(name: string): string {
  const dir = join(tmpdir(), `openspecui-export-${name}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  tmpRoots.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0, tmpRoots.length)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('package resolution for export SSG', () => {
  it('finds package.json by walking upward', () => {
    const root = makeTempDir('find-upward')
    const deep = join(root, 'a', 'b', 'c')
    mkdirSync(deep, { recursive: true })
    const packageJsonPath = join(root, 'package.json')
    writeFileSync(packageJsonPath, JSON.stringify({ name: 'fixture', version: '1.0.0' }))

    expect(findNearestPackageJson(deep)).toBe(packageJsonPath)
  })

  it('reads @openspecui/web version from nearest package.json', () => {
    const root = makeTempDir('read-web-range')
    const deep = join(root, 'dist')
    const fixtureRange = '9.9.9-fixture'
    mkdirSync(deep, { recursive: true })
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'openspecui',
        version: '1.5.0',
        devDependencies: {
          '@openspecui/web': fixtureRange,
        },
      })
    )

    expect(readWebPackageRangeFromPackageJson(deep)).toBe(fixtureRange)
  })

  it('treats workspace protocol as local/dev mode', () => {
    expect(isLocalPackageRange('workspace:*')).toBe(true)
    expect(isLocalPackageRange('file:../web')).toBe(true)
    expect(isLocalPackageRange('link:../web')).toBe(true)
    expect(isLocalPackageRange('1.5.0')).toBe(false)
  })
})
