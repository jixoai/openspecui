import { AudioCueEngine } from '@/lib/audio-cue-engine'

export class NotificationSoundEngine extends AudioCueEngine {
  constructor() {
    super('notification')
  }
}
