import { z } from 'zod'

export const SILENT_SOUND_ID = 'silent'
export const DEFAULT_BELL_SOUND_ID = 'builtin:Tink'
export const DEFAULT_NOTIFICATION_SOUND_ID = 'builtin:Blow'
export const DEFAULT_SOUND_VOLUME = 1
export const CUSTOM_SOUND_ADD_VALUE = 'custom:add'

export const BUILTIN_SOUND_IDS = [
  'builtin:Basso',
  'builtin:Blow',
  'builtin:Bottle',
  'builtin:Frog',
  'builtin:Funk',
  'builtin:Glass',
  'builtin:Hero',
  'builtin:Morse',
  'builtin:Ping',
  'builtin:Pop',
  'builtin:Purr',
  'builtin:Sosumi',
  'builtin:Submarine',
  'builtin:Tink',
] as const

export const BuiltinSoundIdSchema = z.enum(BUILTIN_SOUND_IDS)
export type BuiltinSoundId = z.infer<typeof BuiltinSoundIdSchema>

export const CustomSoundHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export type CustomSoundHash = z.infer<typeof CustomSoundHashSchema>

export const CustomSoundIdSchema = z.custom<`custom:${CustomSoundHash}`>(
  (value) => typeof value === 'string' && /^custom:[a-f0-9]{64}$/.test(value)
)
export type CustomSoundId = z.infer<typeof CustomSoundIdSchema>

export const SoundIdSchema = z.union([
  z.literal(SILENT_SOUND_ID),
  BuiltinSoundIdSchema,
  CustomSoundIdSchema,
])
export type SoundId = z.infer<typeof SoundIdSchema>

export const LEGACY_SOUND_ID_MAP = {
  silent: SILENT_SOUND_ID,
  bell: DEFAULT_BELL_SOUND_ID,
  soft: DEFAULT_NOTIFICATION_SOUND_ID,
  clear: 'builtin:Glass',
  pulse: 'builtin:Tink',
} as const satisfies Record<string, SoundId>

export function normalizeLegacySoundId(value: unknown): unknown {
  if (typeof value !== 'string') return value
  if (Object.prototype.hasOwnProperty.call(LEGACY_SOUND_ID_MAP, value)) {
    return LEGACY_SOUND_ID_MAP[value as keyof typeof LEGACY_SOUND_ID_MAP]
  }
  return value
}

export const SoundConfigIdSchema = z.preprocess(normalizeLegacySoundId, SoundIdSchema)
export const SoundVolumeSchema = z.number().min(0).max(1).default(DEFAULT_SOUND_VOLUME)
export type SoundVolume = z.infer<typeof SoundVolumeSchema>

export interface BuiltinSoundOption {
  id: BuiltinSoundId
  label: string
  filename: string
  mime: string
}

export const BUILTIN_SOUND_OPTIONS: readonly BuiltinSoundOption[] = [
  { id: 'builtin:Basso', label: 'Basso', filename: 'Basso.wav', mime: 'audio/wav' },
  { id: 'builtin:Blow', label: 'Blow', filename: 'Blow.wav', mime: 'audio/wav' },
  { id: 'builtin:Bottle', label: 'Bottle', filename: 'Bottle.wav', mime: 'audio/wav' },
  { id: 'builtin:Frog', label: 'Frog', filename: 'Frog.wav', mime: 'audio/wav' },
  { id: 'builtin:Funk', label: 'Funk', filename: 'Funk.wav', mime: 'audio/wav' },
  { id: 'builtin:Glass', label: 'Glass', filename: 'Glass.wav', mime: 'audio/wav' },
  { id: 'builtin:Hero', label: 'Hero', filename: 'Hero.wav', mime: 'audio/wav' },
  { id: 'builtin:Morse', label: 'Morse', filename: 'Morse.wav', mime: 'audio/wav' },
  { id: 'builtin:Ping', label: 'Ping', filename: 'Ping.wav', mime: 'audio/wav' },
  { id: 'builtin:Pop', label: 'Pop', filename: 'Pop.wav', mime: 'audio/wav' },
  { id: 'builtin:Purr', label: 'Purr', filename: 'Purr.wav', mime: 'audio/wav' },
  { id: 'builtin:Sosumi', label: 'Sosumi', filename: 'Sosumi.wav', mime: 'audio/wav' },
  { id: 'builtin:Submarine', label: 'Submarine', filename: 'Submarine.wav', mime: 'audio/wav' },
  { id: 'builtin:Tink', label: 'Tink', filename: 'Tink.wav', mime: 'audio/wav' },
]

export const CustomSoundMetadataSchema = z.object({
  id: CustomSoundHashSchema,
  name: z.string().min(1),
  mime: z.string().regex(/^audio\//),
  size: z.number().int().nonnegative(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})
export type CustomSoundMetadata = z.infer<typeof CustomSoundMetadataSchema>

export const CustomSoundMetadataFileSchema = z.record(
  CustomSoundHashSchema,
  CustomSoundMetadataSchema
)
export type CustomSoundMetadataFile = z.infer<typeof CustomSoundMetadataFileSchema>

export function soundIdFromCustomHash(hash: CustomSoundHash): CustomSoundId {
  return `custom:${hash}`
}

export function customHashFromSoundId(soundId: SoundId): CustomSoundHash | null {
  if (!soundId.startsWith('custom:')) return null
  const hash = soundId.slice('custom:'.length)
  const parsed = CustomSoundHashSchema.safeParse(hash)
  return parsed.success ? parsed.data : null
}

export function getBuiltinSoundUrl(soundId: SoundId): string | null {
  if (soundId === SILENT_SOUND_ID || !soundId.startsWith('builtin:')) return null
  const option = BUILTIN_SOUND_OPTIONS.find((item) => item.id === soundId)
  return option ? `/sounds/${option.filename}` : null
}
