import { Select, type SelectOption, type SelectOptionGroup } from '@/components/select'
import { SoundInlineVolumeControl } from '@/components/sound-inline-volume-control'
import { getApiBaseUrl } from '@/lib/api-config'
import { trpc, trpcClient } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import {
  BUILTIN_SOUND_OPTIONS,
  CUSTOM_SOUND_ADD_VALUE,
  DEFAULT_NOTIFICATION_SOUND_ID,
  SILENT_SOUND_ID,
  customHashFromSoundId,
  soundIdFromCustomHash,
  type CustomSoundId,
  type CustomSoundMetadata,
  type SoundId,
} from '@openspecui/core/sounds'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FileUp, Play, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type SoundPickerValue = SoundId | typeof CUSTOM_SOUND_ADD_VALUE

interface SoundSettingControlProps {
  value: SoundId
  defaultValue?: SoundId
  onValueChange: (value: SoundId) => void
  onPreview: (value?: SoundId) => void
  ariaLabel: string
  disabled?: boolean
  previewDisabled?: boolean
  volume?: number
  onVolumeChange?: (volume: number) => void
  className?: string
}

const BUILTIN_GROUP: SelectOptionGroup<SoundPickerValue> = {
  label: 'System Sounds',
  options: [
    ...BUILTIN_SOUND_OPTIONS.map(
      (item): SelectOption<SoundPickerValue> => ({
        value: item.id,
        label: item.label,
      })
    ),
    { value: SILENT_SOUND_ID, label: 'Silent' },
  ],
}

function buildCustomSoundUrl(metadata: CustomSoundMetadata): string {
  const path = `/api/sounds/custom/${metadata.id}`
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}${path}` : path
}

function buildCustomOption(metadata: CustomSoundMetadata): SelectOption<SoundPickerValue> {
  return {
    value: soundIdFromCustomHash(metadata.id),
    label: metadata.name,
  }
}

export function SoundSettingControl({
  value,
  defaultValue = DEFAULT_NOTIFICATION_SOUND_ID,
  onValueChange,
  onPreview,
  ariaLabel,
  disabled,
  previewDisabled,
  volume,
  onVolumeChange,
  className = '',
}: SoundSettingControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingSound, setUploadingSound] = useState(false)
  const [addingSound, setAddingSound] = useState(false)
  const [draftName, setDraftName] = useState('')
  const customSoundsQuery = useQuery(trpc.sounds.listCustom.queryOptions(undefined))
  const customSounds = customSoundsQuery.data ?? []
  const selectedCustomHash = customHashFromSoundId(value)
  const selectedCustomSound = selectedCustomHash
    ? customSounds.find((item) => item.id === selectedCustomHash)
    : undefined
  const selectedCustomMissing = Boolean(selectedCustomHash && !selectedCustomSound)
  const selectValue: SoundPickerValue =
    addingSound || selectedCustomMissing ? CUSTOM_SOUND_ADD_VALUE : value
  const customGroup = useMemo<SelectOptionGroup<SoundPickerValue>>(
    () => ({
      label: 'Custom Sounds',
      options: [
        { value: CUSTOM_SOUND_ADD_VALUE, label: 'Add sound...' },
        ...customSounds.map(buildCustomOption),
      ],
    }),
    [customSounds]
  )
  const groups = useMemo<readonly SelectOptionGroup<SoundPickerValue>[]>(
    () => [BUILTIN_GROUP, customGroup],
    [customGroup]
  )

  const renameMutation = useMutation({
    mutationFn: (input: { id: CustomSoundId; name: string }) =>
      trpcClient.sounds.renameCustom.mutate(input),
    onSuccess: async () => {
      await customSoundsQuery.refetch()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: CustomSoundId) => trpcClient.sounds.deleteCustom.mutate({ id }),
    onSuccess: async () => {
      onValueChange(defaultValue)
      await customSoundsQuery.refetch()
    },
  })

  useEffect(() => {
    if (!addingSound) {
      setDraftName(selectedCustomSound?.name ?? '')
    }
  }, [addingSound, selectedCustomSound?.name])

  useEffect(() => {
    if (selectedCustomMissing) {
      onValueChange(defaultValue)
    }
  }, [defaultValue, onValueChange, selectedCustomMissing])

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.set('file', file)
    formData.set('name', draftName.trim() || file.name.replace(/\.[^.]*$/, ''))
    setUploadingSound(true)
    try {
      const baseUrl = getApiBaseUrl()
      const uploadUrl = baseUrl ? `${baseUrl}/api/sounds/custom` : '/api/sounds/custom'
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        throw new Error(`Failed to upload sound: ${response.status}`)
      }
      const metadata = (await response.json()) as CustomSoundMetadata
      await customSoundsQuery.refetch()
      onValueChange(soundIdFromCustomHash(metadata.id))
      setAddingSound(false)
      setDraftName(metadata.name)
    } finally {
      setUploadingSound(false)
    }
  }

  const handleSelect = (nextValue: SoundPickerValue) => {
    if (nextValue === CUSTOM_SOUND_ADD_VALUE) {
      setAddingSound(true)
      setDraftName('')
      return
    }
    setAddingSound(false)
    onValueChange(nextValue)
  }

  const handleRename = () => {
    if (!selectedCustomSound) return
    const nextName = draftName.trim()
    if (!nextName || nextName === selectedCustomSound.name) return
    renameMutation.mutate({ id: soundIdFromCustomHash(selectedCustomSound.id), name: nextName })
  }

  const showFileInputButton = addingSound || uploadingSound
  const showNameInput = showFileInputButton || Boolean(selectedCustomSound)
  const activeCustomSoundUrl = selectedCustomSound ? buildCustomSoundUrl(selectedCustomSound) : null
  const showVolumeControl = volume !== undefined && onVolumeChange !== undefined

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="border-border bg-background inline-flex min-w-0 items-stretch overflow-hidden rounded-md border">
        <Select
          value={selectValue}
          groups={groups}
          onValueChange={handleSelect}
          ariaLabel={ariaLabel}
          disabled={disabled}
          className="h-9 w-56 rounded-none border-0"
          popupClassName="min-w-56"
        />
        {showFileInputButton && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploadingSound}
            className="border-border text-foreground hover:bg-muted/30 inline-flex h-9 w-9 shrink-0 items-center justify-center border-l transition disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Upload ${ariaLabel}`}
            title={`Upload ${ariaLabel}`}
          >
            <FileUp className="h-4 w-4" />
          </button>
        )}
        {showNameInput && (
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={handleRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
            disabled={disabled || uploadingSound || (!selectedCustomSound && !addingSound)}
            placeholder="Sound name"
            className="border-border text-foreground focus-visible:ring-primary h-9 w-40 min-w-0 border-l px-2 text-sm outline-none transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${ariaLabel} name`}
          />
        )}
        <button
          type="button"
          onClick={() => onPreview()}
          disabled={disabled || previewDisabled || uploadingSound || value === SILENT_SOUND_ID}
          className={cn(
            'bg-primary text-primary-foreground hover:bg-primary/90 border-border inline-flex h-9 w-9 shrink-0 items-center justify-center border-l transition disabled:cursor-not-allowed disabled:opacity-50'
          )}
          aria-label={`Preview ${ariaLabel}`}
          title={`Preview ${ariaLabel}`}
          data-sound-url={activeCustomSoundUrl ?? undefined}
        >
          <Play className="h-4 w-4" />
        </button>
        {showVolumeControl && (
          <SoundInlineVolumeControl
            label={ariaLabel}
            value={volume}
            onChange={onVolumeChange}
            disabled={disabled || uploadingSound}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) {
              void uploadFile(file)
            }
          }}
        />
      </div>
      {selectedCustomSound && (
        <button
          type="button"
          onClick={() => deleteMutation.mutate(soundIdFromCustomHash(selectedCustomSound.id))}
          disabled={disabled || deleteMutation.isPending}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Remove ${ariaLabel}`}
          title={`Remove ${ariaLabel}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
