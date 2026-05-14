import { AudioCueEngine } from './audio-cue-engine'

export class TerminalBellSoundEngine extends AudioCueEngine {
  constructor() {
    super('bell')
  }
}
