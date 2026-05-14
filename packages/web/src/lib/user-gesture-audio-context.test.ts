import { afterEach, describe, expect, it, vi } from 'vitest'

class MockAudioContext {
  static constructorCalls = 0
  state: AudioContextState = 'suspended'
  resume = vi.fn(async () => {
    this.state = 'running'
  })

  constructor() {
    MockAudioContext.constructorCalls += 1
  }
}

function stubAudioContext(): void {
  vi.stubGlobal('AudioContext', MockAudioContext as unknown as typeof AudioContext)
}

function stubUserActivation(userActivation: UserActivation): void {
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    value: userActivation,
  })
}

async function loadAudioContextModule() {
  vi.resetModules()
  return import('./user-gesture-audio-context')
}

describe('createAudioContextAfterUserGesture', () => {
  afterEach(() => {
    MockAudioContext.constructorCalls = 0
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: undefined,
    })
  })

  it('waits for a user gesture before constructing AudioContext', async () => {
    stubAudioContext()
    const { createAudioContextAfterUserGesture } = await loadAudioContextModule()

    const contextPromise = createAudioContextAfterUserGesture()
    await Promise.resolve()

    expect(MockAudioContext.constructorCalls).toBe(0)

    window.dispatchEvent(new PointerEvent('pointerdown'))

    await expect(contextPromise).resolves.toBeInstanceOf(MockAudioContext)
    expect(MockAudioContext.constructorCalls).toBe(1)
  })

  it('constructs immediately after the page already has user activation', async () => {
    stubAudioContext()
    stubUserActivation({ hasBeenActive: true, isActive: false })
    const { createAudioContextAfterUserGesture } = await loadAudioContextModule()

    await expect(createAudioContextAfterUserGesture()).resolves.toBeInstanceOf(MockAudioContext)

    expect(MockAudioContext.constructorCalls).toBe(1)
  })

  it('reuses the same AudioContext across callers', async () => {
    stubAudioContext()
    stubUserActivation({ hasBeenActive: true, isActive: false })
    const { createAudioContextAfterUserGesture } = await loadAudioContextModule()

    const first = await createAudioContextAfterUserGesture()
    const second = await createAudioContextAfterUserGesture()

    expect(first).toBe(second)
    expect(MockAudioContext.constructorCalls).toBe(1)
  })

  it('returns null immediately when AudioContext is unsupported', async () => {
    const { createAudioContextAfterUserGesture } = await loadAudioContextModule()

    await expect(createAudioContextAfterUserGesture()).resolves.toBeNull()
  })

  it('remembers gestures registered by prepare without constructing AudioContext', async () => {
    stubAudioContext()
    const { createAudioContextAfterUserGesture, prepareAudioContextAfterUserGesture } =
      await loadAudioContextModule()

    prepareAudioContextAfterUserGesture()
    window.dispatchEvent(new PointerEvent('pointerdown'))

    expect(MockAudioContext.constructorCalls).toBe(0)

    await expect(createAudioContextAfterUserGesture()).resolves.toBeInstanceOf(MockAudioContext)
    expect(MockAudioContext.constructorCalls).toBe(1)
  })
})
