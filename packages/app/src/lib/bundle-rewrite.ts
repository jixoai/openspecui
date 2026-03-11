import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const TEXT_FILE_EXTENSIONS = new Set(['.html', '.js', '.css'])

export function getHostedBundlePathReplacements(
  channelId: string
): readonly (readonly [string, string])[] {
  return [
    [
      "window.__OPENSPEC_BASE_PATH__ = '/'",
      `window.__OPENSPEC_BASE_PATH__ = '/versions/${channelId}/'`,
    ],
    ['/assets/', `/versions/${channelId}/assets/`],
    ['/logo.svg', `/versions/${channelId}/logo.svg`],
    ['/openspec_pixel_dark.svg', `/versions/${channelId}/openspec_pixel_dark.svg`],
    ['/openspec_pixel_light.svg', `/versions/${channelId}/openspec_pixel_light.svg`],
  ] as const
}

export function rewriteHostedBundleText(content: string, channelId: string): string {
  return getHostedBundlePathReplacements(channelId).reduce(
    (current, [from, to]) => current.split(from).join(to),
    content
  )
}

export async function rewriteHostedBundlePaths(
  bundleDir: string,
  channelId: string
): Promise<void> {
  async function visit(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath)
        continue
      }
      const extension = absolutePath.slice(absolutePath.lastIndexOf('.'))
      if (!TEXT_FILE_EXTENSIONS.has(extension)) continue
      const original = await readFile(absolutePath, 'utf8')
      const rewritten = rewriteHostedBundleText(original, channelId)
      if (rewritten !== original) {
        await writeFile(absolutePath, rewritten, 'utf8')
      }
    }
  }

  const info = await stat(bundleDir)
  if (!info.isDirectory()) {
    throw new Error(`Hosted bundle directory does not exist: ${bundleDir}`)
  }
  await visit(bundleDir)
}
