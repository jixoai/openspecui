import { describe, expect, it } from 'vitest'

import { orderPackagesForPublish, type PublishablePackage } from './workspace'

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
})
