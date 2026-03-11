import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import * as tar from 'tar'
import { rewriteHostedBundlePaths } from './bundle-rewrite'
import type { HostedChannelPlanEntry } from './channel-plan'
import { buildHostedChannelPlan } from './channel-plan'

export interface RegistryVersionRecord {
  version: string
  tarballUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function encodePackageName(packageName: string): string {
  return packageName.replace('/', '%2f')
}

export async function fetchRegistryVersions(
  packageName = 'openspecui'
): Promise<RegistryVersionRecord[]> {
  const response = await fetch(`https://registry.npmjs.org/${encodePackageName(packageName)}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch registry metadata for ${packageName}: ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!isRecord(payload) || !isRecord(payload.versions)) {
    throw new Error(`Invalid registry payload for ${packageName}`)
  }

  return Object.entries(payload.versions)
    .map(([version, raw]) => {
      if (!isRecord(raw) || !isRecord(raw.dist) || typeof raw.dist.tarball !== 'string') {
        return null
      }
      return { version, tarballUrl: raw.dist.tarball }
    })
    .filter((entry): entry is RegistryVersionRecord => entry !== null)
}

async function downloadTarball(tarballUrl: string, targetPath: string): Promise<void> {
  const response = await fetch(tarballUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to download ${tarballUrl}: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, buffer)
}

async function extractWebBundle(tarballPath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true })
  await tar.x({
    file: tarballPath,
    cwd: outputDir,
    strip: 2,
    filter: (entryPath: string) => entryPath.startsWith('package/web/'),
  })
}

export async function materializeHostedChannels(options: {
  outDir: string
  packageName?: string
}): Promise<HostedChannelPlanEntry[]> {
  const registryVersions = await fetchRegistryVersions(options.packageName)
  const tarballByVersion = new Map(
    registryVersions.map((entry) => [entry.version, entry.tarballUrl])
  )
  const plan = buildHostedChannelPlan(registryVersions.map((entry) => entry.version))
  if (plan.length === 0) {
    throw new Error('No supported openspecui versions were found in the npm registry')
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'openspecui-app-'))
  const extractedByVersion = new Map<string, string>()

  try {
    for (const channel of plan) {
      if (extractedByVersion.has(channel.resolvedVersion)) continue
      const tarballUrl = tarballByVersion.get(channel.resolvedVersion)
      if (!tarballUrl) {
        throw new Error(`Missing tarball URL for openspecui@${channel.resolvedVersion}`)
      }
      const tarballPath = join(tempRoot, `${channel.resolvedVersion}.tgz`)
      const rawOutputDir = join(tempRoot, 'raw', channel.resolvedVersion)
      await downloadTarball(tarballUrl, tarballPath)
      await extractWebBundle(tarballPath, rawOutputDir)
      extractedByVersion.set(channel.resolvedVersion, rawOutputDir)
    }

    for (const channel of plan) {
      const sourceDir = extractedByVersion.get(channel.resolvedVersion)
      if (!sourceDir) {
        throw new Error(`Missing extracted bundle for openspecui@${channel.resolvedVersion}`)
      }
      const targetDir = join(options.outDir, 'versions', channel.id)
      await rm(targetDir, { recursive: true, force: true })
      await cp(sourceDir, targetDir, { recursive: true })
      await rewriteHostedBundlePaths(targetDir, channel.id)
    }

    return plan
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}
