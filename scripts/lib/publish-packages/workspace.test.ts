import { describe, expect, it } from 'vitest'

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  orderPackagesForPublish,
  readPublishablePackages,
  type PublishablePackage,
} from './workspace'

function pkg(name: string, dependencies: string[] = [], version = '1.0.0'): PublishablePackage {
  return {
    access: 'public',
    dependencies,
    dir: `/tmp/${name}`,
    name,
    publishDirectory: null,
    version,
  }
}

describe('orderPackagesForPublish', () => {
  it('orders internal dependencies before dependents', () => {
    const ordered = orderPackagesForPublish([
      pkg('openspecui', ['@openspecui/server']),
      pkg('@openspecui/server', ['@openspecui/core', '@openspecui/search']),
      pkg('@openspecui/search'),
      pkg('@openspecui/core'),
    ])

    expect(ordered.map((item) => item.name)).toEqual([
      '@openspecui/core',
      '@openspecui/search',
      '@openspecui/server',
      'openspecui',
    ])
  })

  it('throws on dependency cycles', () => {
    expect(() => orderPackagesForPublish([pkg('a', ['b']), pkg('b', ['a'])])).toThrow(/cycle/)
  })

  it('ignores private workspace packages when building the publish graph', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'openspecui-publish-graph-'))
    const packagesDir = join(rootDir, 'packages')
    mkdirSync(packagesDir, { recursive: true })

    const privateDir = join(packagesDir, 'local-translator')
    mkdirSync(privateDir, { recursive: true })
    writeFileSync(
      join(privateDir, 'package.json'),
      JSON.stringify(
        {
          name: '@openspecui/local-translator',
          private: true,
          version: '1.0.0',
        },
        null,
        2
      )
    )

    const publicDir = join(packagesDir, 'server')
    mkdirSync(publicDir, { recursive: true })
    writeFileSync(
      join(publicDir, 'package.json'),
      JSON.stringify(
        {
          name: '@openspecui/server',
          version: '1.0.0',
          dependencies: {
            '@openspecui/local-translator': 'workspace:*',
          },
        },
        null,
        2
      )
    )

    const publishable = readPublishablePackages(rootDir)
    expect(publishable.map((item) => item.name)).toEqual(['@openspecui/server'])
    expect(publishable[0]?.dependencies).toEqual([])
  })
})
