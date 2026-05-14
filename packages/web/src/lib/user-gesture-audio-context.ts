type AudioContextConstructor = typeof AudioContext

let audioContext: AudioContext | null = null
let audioContextPromise: Promise<AudioContext | null> | null = null
let userGesturePromise: Promise<void> | null = null
let resolveUserGesturePromise: (() => void) | null = null
let userGestureResolved = false
let userGestureListenersActive = false

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? window.webkitAudioContext ?? null
}

function hasUserActivation(): boolean {
  if (userGestureResolved) return true
  if (typeof navigator === 'undefined') return false
  return (
    navigator.userActivation?.hasBeenActive === true || navigator.userActivation?.isActive === true
  )
}

function removeUserGestureListeners(): void {
  if (typeof window === 'undefined' || !userGestureListenersActive) return
  window.removeEventListener('pointerdown', resolveUserGesture, true)
  window.removeEventListener('keydown', resolveUserGesture, true)
  userGestureListenersActive = false
}

function resolveUserGesture(): void {
  userGestureResolved = true
  removeUserGestureListeners()
  resolveUserGesturePromise?.()
  resolveUserGesturePromise = null
  userGesturePromise = null
}

function addUserGestureListeners(): void {
  if (typeof window === 'undefined' || userGestureListenersActive || hasUserActivation()) return
  window.addEventListener('pointerdown', resolveUserGesture, {
    capture: true,
    once: true,
    passive: true,
  })
  window.addEventListener('keydown', resolveUserGesture, { capture: true, once: true })
  userGestureListenersActive = true
}

export function prepareAudioContextAfterUserGesture(): void {
  addUserGestureListeners()
}

function waitForUserGesture(): Promise<void> {
  if (typeof window === 'undefined' || hasUserActivation()) {
    return Promise.resolve()
  }

  if (userGesturePromise) return userGesturePromise

  userGesturePromise = new Promise<void>((resolve) => {
    resolveUserGesturePromise = resolve
    addUserGestureListeners()
  })

  return userGesturePromise
}

export async function createAudioContextAfterUserGesture(): Promise<AudioContext | null> {
  if (audioContext) return audioContext
  if (audioContextPromise) return audioContextPromise

  if (!getAudioContextConstructor()) return null

  audioContextPromise = waitForUserGesture()
    .then(async () => {
      const AudioContextCtor = getAudioContextConstructor()
      if (!AudioContextCtor) return null

      const context = audioContext ?? new AudioContextCtor()
      audioContext = context

      if (context.state === 'suspended') {
        await context.resume()
      }

      return context
    })
    .finally(() => {
      audioContextPromise = null
    })

  return audioContextPromise
}
