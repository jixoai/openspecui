import type {
  HostedAppChannelManifest,
  HostedAppCompatibilityEntry,
  HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'
import type { HostedChannelPlanEntry } from './channel-plan'

export function createHostedAppManifest(options: {
  channels: readonly HostedChannelPlanEntry[]
  generatedAt?: string
}): HostedAppVersionManifest {
  const channels = options.channels.reduce<Record<string, HostedAppChannelManifest>>(
    (acc, channel) => {
      acc[channel.id] = {
        id: channel.id,
        kind: channel.kind,
        selector: channel.selector,
        resolvedVersion: channel.resolvedVersion,
        rootPath: `/versions/${channel.id}/`,
        shellPath: `/versions/${channel.id}/index.html`,
        major: channel.major,
        minor: channel.minor,
      }
      return acc
    },
    {}
  )

  const compatibility: HostedAppCompatibilityEntry[] = options.channels
    .filter((channel) => channel.kind === 'minor' && typeof channel.minor === 'number')
    .map((channel) => ({
      range: `~${channel.major}.${channel.minor}.0`,
      channel: channel.id,
    }))
    .sort((left, right) => left.range.localeCompare(right.range))

  return {
    packageName: 'openspecui',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    defaultChannel: channels.latest ? 'latest' : (options.channels[0]?.id ?? 'latest'),
    channels,
    compatibility,
  }
}
