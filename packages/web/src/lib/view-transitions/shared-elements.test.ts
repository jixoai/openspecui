/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove stable shared-element names and DOM collection.
 * 2. Prove navigation handoff state preserves valid presentation fields.
 * 3. Prove Git binding provenance is preserved only when nonblank.
 * 4. Prove Git handoff validation binds origin token and canonical selector entity.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 carries Git origin tokens through VT.
 */
import type { GitEntrySelector } from '@openspecui/core'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  collectSharedElementEntries,
  getSharedElementBinding,
  getSharedElementName,
  readGitSharedElementHandoffState,
  readSharedElementHandoffState,
  withSharedElementHandoffState,
} from './shared-elements'

describe('getSharedElementName', () => {
  it('sanitizes family and entity segments into stable VT names', () => {
    expect(
      getSharedElementName(
        { family: 'Changes List', entityId: 'Extract Svelte / Layout Foundation' },
        'title'
      )
    ).toBe('vt-changes-list-extract-svelte-layout-foundation-title')
  })
})

describe('collectSharedElementEntries', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('collects only the shared elements declared by a descriptor', () => {
    const descriptor = { family: 'changes', entityId: 'extract-layout' } as const
    const iconName = getSharedElementName(descriptor, 'icon')
    const titleName = getSharedElementName(descriptor, 'title')

    document.body.innerHTML = `
      <div id="root">
        <span ${toDataAttribute(getSharedElementBinding(descriptor, 'icon'))}></span>
        <span ${toDataAttribute(getSharedElementBinding(descriptor, 'title'))}></span>
        <span data-vt-shared="vt-changes-other-title"></span>
      </div>
    `

    const root = document.getElementById('root')
    const entries = collectSharedElementEntries(root, descriptor)

    expect(entries).toHaveLength(2)
    expect(entries.map(([, name]) => name)).toEqual([iconName, titleName])
  })

  it('includes the root element itself when it carries the shared-element binding', () => {
    const descriptor = { family: 'changes', entityId: 'extract-layout' } as const
    const containerName = getSharedElementName(descriptor, 'container')

    document.body.innerHTML = `
      <a id="root" ${toDataAttribute(getSharedElementBinding(descriptor, 'container'))}>
        <span>child</span>
      </a>
    `

    const root = document.getElementById('root')
    const entries = collectSharedElementEntries(root, descriptor)

    expect(entries.map(([, name]) => name)).toContain(containerName)
    expect(entries.find(([, name]) => name === containerName)?.[0]).toBe(root)
  })
})

describe('shared element handoff state', () => {
  it('merges handoff state into an existing navigation state object', () => {
    const state = withSharedElementHandoffState(
      { source: 'dashboard' },
      {
        family: 'changes',
        entityId: 'extract-layout',
        title: 'Extract layout',
        subtitle: 'proposal',
      }
    )

    expect(state).toMatchObject({
      source: 'dashboard',
      __vtHandoff: {
        family: 'changes',
        entityId: 'extract-layout',
        title: 'Extract layout',
        subtitle: 'proposal',
      },
    })
  })

  it('reads back a valid handoff payload and drops invalid fields', () => {
    const handoff = readSharedElementHandoffState({
      __vtHandoff: {
        family: 'changes',
        entityId: 'extract-layout',
        title: 'Extract layout',
        subtitle: 42,
      },
    })

    expect(handoff).toEqual({
      family: 'changes',
      entityId: 'extract-layout',
      title: 'Extract layout',
      subtitle: undefined,
    })
  })

  it('drops blank Git binding provenance instead of accepting an unusable token', () => {
    expect(
      readSharedElementHandoffState({
        __vtHandoff: {
          family: 'git',
          entityId: 'abc12345',
          bindingToken: '   ',
        },
      })
    ).toMatchObject({ family: 'git', entityId: 'abc12345', bindingToken: undefined })
  })

  it('preserves valid Git binding provenance', () => {
    expect(
      readSharedElementHandoffState({
        __vtHandoff: {
          family: 'git',
          entityId: 'abc12345',
          bindingToken: 'planning-binding-a',
        },
      })
    ).toMatchObject({
      family: 'git',
      entityId: 'abc12345',
      bindingToken: 'planning-binding-a',
    })
  })

  it('accepts a Git handoff only when selector, entity, and origin token all match', () => {
    const selector: GitEntrySelector = { type: 'commit', hash: 'abc12345' }
    const state = {
      __vtHandoff: {
        family: 'git',
        entityId: 'abc12345',
        bindingToken: 'planning-binding-a',
        title: 'Commit A',
        subtitle: 'A subtitle',
      },
    }

    expect(readGitSharedElementHandoffState(state, selector, 'planning-binding-a')).toEqual({
      family: 'git',
      entityId: 'abc12345',
      bindingToken: 'planning-binding-a',
      title: 'Commit A',
      subtitle: 'A subtitle',
    })
  })

  it.each([
    ['wrong entity', { entityId: 'def67890', bindingToken: 'planning-binding-a' }],
    ['blank token', { entityId: 'abc12345', bindingToken: '   ' }],
    ['wrong token', { entityId: 'abc12345', bindingToken: 'planning-binding-b' }],
    ['malformed entity', { entityId: '', bindingToken: 'planning-binding-a' }],
  ])('rejects Git handoff with %s', (_reason, handoff) => {
    const selector: GitEntrySelector = { type: 'commit', hash: 'abc12345' }
    expect(
      readGitSharedElementHandoffState(
        { __vtHandoff: { family: 'git', ...handoff } },
        selector,
        'planning-binding-a'
      )
    ).toBeNull()
  })

  it('rejects selector-derived empty entity ids before validating handoff state', () => {
    expect(
      readGitSharedElementHandoffState(
        {
          __vtHandoff: {
            family: 'git',
            entityId: '',
            bindingToken: 'planning-binding-a',
          },
        },
        { type: 'commit', hash: '   ' },
        'planning-binding-a'
      )
    ).toBeNull()
  })

  it('rejects malformed uncommitted entity provenance', () => {
    expect(
      readGitSharedElementHandoffState(
        {
          __vtHandoff: {
            family: 'git',
            entityId: '   ',
            bindingToken: 'planning-binding-a',
          },
        },
        { type: 'uncommitted' },
        'planning-binding-a'
      )
    ).toBeNull()
  })

  it('keeps non-Git handoffs valid without inventing binding provenance', () => {
    expect(
      readSharedElementHandoffState({
        __vtHandoff: {
          family: 'changes',
          entityId: 'change-a',
          title: 'Change A',
        },
      })
    ).toEqual({
      family: 'changes',
      entityId: 'change-a',
      title: 'Change A',
      subtitle: undefined,
      bindingToken: undefined,
    })
  })

  it('returns null for invalid handoff payloads', () => {
    expect(readSharedElementHandoffState(null)).toBeNull()
    expect(readSharedElementHandoffState({ __vtHandoff: { family: 'changes' } })).toBeNull()
  })
})

function toDataAttribute(props: ReturnType<typeof getSharedElementBinding>): string {
  return `data-vt-shared="${props['data-vt-shared']}"`
}
