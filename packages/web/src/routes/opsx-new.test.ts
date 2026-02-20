import { buildNewChangeArgs } from '@/lib/opsx-new-command'
import { describe, expect, it } from 'vitest'

describe('opsx-new command assembly', () => {
  it('builds minimal command args', () => {
    const args = buildNewChangeArgs({
      changeName: 'add-search',
      schema: '',
      description: '',
      extraArgs: [],
    })

    expect(args).toEqual(['new', 'change', 'add-search'])
  })

  it('appends official and advanced args in order', () => {
    const args = buildNewChangeArgs({
      changeName: 'add-search',
      schema: 'spec-driven',
      description: 'Add search flow',
      extraArgs: ['--schema', 'override', '--flag'],
    })

    expect(args).toEqual([
      'new',
      'change',
      'add-search',
      '--schema',
      'spec-driven',
      '--description',
      'Add search flow',
      '--schema',
      'override',
      '--flag',
    ])
  })
})
