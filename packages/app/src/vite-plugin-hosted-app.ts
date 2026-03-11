import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { createHostedAppManifest } from './lib/manifest'
import { materializeHostedChannels } from './lib/npm-registry'
import { createHostedAppPwaManifest } from './lib/pwa-manifest'

export function hostedAppPlugin(): Plugin {
  let config: ResolvedConfig | null = null

  return {
    name: 'openspecui-hosted-app',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    async closeBundle() {
      if (!config) return

      const outDir = resolve(config.root, config.build.outDir)
      const channels = await materializeHostedChannels({ outDir })
      const manifest = createHostedAppManifest({ channels })
      const pwaManifest = createHostedAppPwaManifest()
      await mkdir(outDir, { recursive: true })
      await writeFile(
        join(outDir, 'version.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
      )
      await writeFile(
        join(outDir, 'manifest.webmanifest'),
        `${JSON.stringify(pwaManifest, null, 2)}\n`,
        'utf8'
      )
    },
  }
}
