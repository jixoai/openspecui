import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { createHostedAppManifest } from './lib/manifest'
import { materializeHostedChannels } from './lib/npm-registry'

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
      await mkdir(outDir, { recursive: true })
      await writeFile(
        join(outDir, 'version.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
      )
    },
  }
}
