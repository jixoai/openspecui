import { DEFAULT_BELL_SOUND_ID, SoundConfigIdSchema, type SoundId } from './sounds.js'

export const TERMINAL_BELL_SOUND_VALUES = ['silent', 'bell', 'soft', 'clear', 'pulse'] as const
export const TerminalBellSoundSchema = SoundConfigIdSchema
export type TerminalBellSound = SoundId

export const TERMINAL_BELL_SOUND_OPTIONS: readonly {
  id: TerminalBellSound
  label: string
}[] = [
  { id: DEFAULT_BELL_SOUND_ID, label: 'Tink' },
  { id: 'silent', label: 'Silent' },
]
