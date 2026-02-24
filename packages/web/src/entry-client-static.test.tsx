import { beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => {
  const render = vi.fn()
  return {
    createRoot: vi.fn(() => ({ render })),
    hydrateRoot: vi.fn(),
    render,
    setStaticMode: vi.fn(),
  }
})

vi.mock('react-dom/client', () => ({
  createRoot: spies.createRoot,
  hydrateRoot: spies.hydrateRoot,
}))

vi.mock('./App.static', () => ({
  AppStatic: () => null,
}))

vi.mock('./lib/static-mode', () => ({
  setStaticMode: spies.setStaticMode,
}))

describe('entry-client-static bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('uses client render even when prerendered content exists', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    root.innerHTML = '<div>prerendered</div>'
    document.body.appendChild(root)

    await import('./entry-client-static')

    expect(spies.setStaticMode).toHaveBeenCalledWith(true)
    expect(spies.createRoot).toHaveBeenCalledTimes(1)
    expect(spies.createRoot).toHaveBeenCalledWith(root)
    expect(spies.render).toHaveBeenCalledTimes(1)
    expect(spies.hydrateRoot).not.toHaveBeenCalled()
    expect(root.innerHTML).toBe('')
  })

  it('noops when root container is missing', async () => {
    await import('./entry-client-static')

    expect(spies.setStaticMode).not.toHaveBeenCalled()
    expect(spies.createRoot).not.toHaveBeenCalled()
    expect(spies.render).not.toHaveBeenCalled()
  })
})
