import {
  DEFAULT_BELL_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  SILENT_SOUND_ID,
  customHashFromSoundId,
  getBuiltinSoundUrl,
  type SoundId,
} from '@openspecui/core/sounds'
import { getApiBaseUrl } from './api-config'

type AudioContextConstructor = typeof AudioContext
export type AudioCueFallback = 'bell' | 'notification'
export type AudioCueSound = SoundId
export type AudioCueVolume = number

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? window.webkitAudioContext ?? null
}

export class AudioCueEngine {
  private readonly fallbackSound: SoundId
  private unlocked = false
  private unlockPromise: Promise<void> | null = null
  private audioContext: AudioContext | null = null
  private silentAudio: HTMLAudioElement | null = null
  private readonly activeAudios = new Set<HTMLAudioElement>()

  constructor(fallback: AudioCueFallback) {
    this.fallbackSound = fallback === 'bell' ? DEFAULT_BELL_SOUND_ID : DEFAULT_NOTIFICATION_SOUND_ID
  }

  init(): void {
    if (typeof window === 'undefined') return
    const unlock = () => {
      void this.unlock()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return
    if (this.unlockPromise) return this.unlockPromise

    this.unlockPromise = this.unlockAudioContext().finally(() => {
      this.unlockPromise = null
    })
    return this.unlockPromise
  }

  async play(sound: AudioCueSound, volume = 1): Promise<void> {
    if (sound === SILENT_SOUND_ID) return

    await this.unlock().catch(() => {})
    await this.playAudio(sound, volume)
  }

  private async unlockAudioContext(): Promise<void> {
    const AudioContextCtor = getAudioContextConstructor()
    if (!AudioContextCtor) {
      this.unlocked = true
      return
    }

    const context = this.audioContext ?? new AudioContextCtor()
    this.audioContext = context

    this.silentAudio ??= new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
    )
    this.silentAudio.volume = 0
    await this.silentAudio.play().catch(() => {})

    if (context.state === 'suspended') {
      await context.resume()
    }
    this.unlocked = true
  }

  private async playAudio(sound: SoundId, volume: number): Promise<void> {
    const url = this.getSoundUrl(sound) ?? this.getSoundUrl(this.fallbackSound)
    if (!url) return

    const audio = this.createManagedAudio(url, volume)
    await audio.play().catch(async (error) => {
      if (sound === this.fallbackSound) return
      if (await this.isMissingSound(url)) {
        const fallbackUrl = this.getSoundUrl(this.fallbackSound)
        if (fallbackUrl) {
          await this.createManagedAudio(fallbackUrl, volume)
            .play()
            .catch(() => {})
        }
        return
      }
      throw error
    })
  }

  private getSoundUrl(sound: SoundId): string | null {
    const builtinUrl = getBuiltinSoundUrl(sound)
    if (builtinUrl) return builtinUrl

    const customHash = customHashFromSoundId(sound)
    if (!customHash) return null
    const baseUrl = getApiBaseUrl()
    const path = `/api/sounds/custom/${customHash}`
    return baseUrl ? `${baseUrl}${path}` : path
  }

  private async isMissingSound(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.status === 404
    } catch {
      return false
    }
  }

  private createManagedAudio(url: string, volume: number): HTMLAudioElement {
    const audio = new Audio(url)
    audio.volume = clampAudioVolume(volume)
    this.activeAudios.add(audio)
    const release = () => {
      audio.removeEventListener('ended', release)
      audio.removeEventListener('error', release)
      this.activeAudios.delete(audio)
    }
    audio.addEventListener('ended', release, { once: true })
    audio.addEventListener('error', release, { once: true })
    return audio
  }
}

function clampAudioVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1
  return Math.min(1, Math.max(0, volume))
}
