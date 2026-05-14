import { Button } from '@/components/button'
import { SoundSettingControl } from '@/components/sound-setting-control'
import { useNotifications } from '@/lib/notifications/context'
import { trpcClient } from '@/lib/trpc'
import type { NotificationSound } from '@openspecui/core/notifications'
import { DEFAULT_NOTIFICATION_SOUND_ID, type SoundId } from '@openspecui/core/sounds'
import { useMutation } from '@tanstack/react-query'
import { Bell, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NotificationSettingsProps {
  sound: NotificationSound
  volume: number
  systemNotificationsEnabled: boolean
}

export function NotificationSettings({
  sound,
  volume,
  systemNotificationsEnabled,
}: NotificationSettingsProps) {
  const { browserSupported, browserPermission, requestBrowserPermission, previewSound } =
    useNotifications()
  const [draftVolume, setDraftVolume] = useState(volume)
  const saveMutation = useMutation({
    mutationFn: (next: {
      sound?: NotificationSound
      volume?: number
      systemNotificationsEnabled?: boolean
    }) => trpcClient.config.update.mutate({ notifications: next }),
  })

  useEffect(() => {
    setDraftVolume(volume)
  }, [volume])

  const permissionLabel =
    browserPermission === 'unsupported'
      ? 'Unsupported'
      : browserPermission === 'granted'
        ? 'Granted'
        : browserPermission === 'denied'
          ? 'Denied'
          : 'Not requested'

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="h-5 w-5" />
        Notifications
      </h2>
      <div className="border-border space-y-4 rounded-lg border p-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Notification Sound</label>
          <div className="flex flex-wrap items-center gap-2">
            <SoundSettingControl
              value={sound}
              defaultValue={DEFAULT_NOTIFICATION_SOUND_ID}
              onValueChange={(nextSound) => saveMutation.mutate({ sound: nextSound })}
              onPreview={(nextSound?: SoundId) => void previewSound(nextSound, draftVolume)}
              ariaLabel="Notification Sound"
              previewDisabled={sound === 'silent' || draftVolume === 0}
              volume={draftVolume}
              onVolumeChange={(nextVolume) => {
                setDraftVolume(nextVolume)
                saveMutation.mutate({ volume: nextVolume })
              }}
            />
            {saveMutation.isPending && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
          </div>
        </div>

        <div className="border-border border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-sm font-medium">Enable System Notifications</label>
              <p className="text-muted-foreground mt-1 text-xs">
                Browser support: {browserSupported ? 'available' : 'unavailable'} · Permission:{' '}
                {permissionLabel}
              </p>
            </div>
            <Button
              onClick={() => void requestBrowserPermission()}
              disabled={!browserSupported || browserPermission === 'denied'}
              activity={browserPermission === 'granted' && systemNotificationsEnabled}
            >
              {browserPermission === 'granted' && systemNotificationsEnabled
                ? 'Enabled'
                : 'Request permission'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
