/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Home and Task Manager subscribers consume one same-document directory catalog snapshot.
 * 2. Prove favorite actions can admit a current canonical backend path without runtime authority leakage.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。"
 */
// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getWorkspaceDirectoryCatalogActions,
  useWorkspaceDirectoryCatalog,
} from './use-workspace-directory-catalog'
import { getWorkspaceDirectoryCatalogStorageKey } from './workspace-directory-catalog'

function CatalogProbe({ name }: { readonly name: string }) {
  const catalog = useWorkspaceDirectoryCatalog()
  return <output aria-label={name}>{JSON.stringify(catalog)}</output>
}

describe('Workspace directory catalog owner', () => {
  beforeEach(() => {
    localStorage.removeItem(getWorkspaceDirectoryCatalogStorageKey())
  })

  afterEach(() => cleanup())

  it('publishes successful admission and favorite changes to every mounted consumer', () => {
    render(
      <>
        <CatalogProbe name="home catalog" />
        <CatalogProbe name="task manager catalog" />
      </>
    )
    const actions = getWorkspaceDirectoryCatalogActions()

    act(() => {
      actions.recordSuccessfulOpen('/projects/team')
      actions.setFavorite('/projects/team', true)
    })

    for (const name of ['home catalog', 'task manager catalog']) {
      expect(JSON.parse(screen.getByLabelText(name).textContent ?? '{}')).toMatchObject({
        version: 1,
        entries: [{ canonicalPath: '/projects/team', favorite: true }],
      })
    }
  })

  it('admits a current backend path when Task Manager favorites it before Home history exists', () => {
    render(<CatalogProbe name="catalog" />)

    act(() => {
      getWorkspaceDirectoryCatalogActions().setFavorite('/projects/external', true)
    })

    expect(JSON.parse(screen.getByLabelText('catalog').textContent ?? '{}')).toMatchObject({
      entries: [{ canonicalPath: '/projects/external', favorite: true }],
    })
  })
})
