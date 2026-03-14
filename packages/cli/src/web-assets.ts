import { join } from 'node:path'

export function getWebAssetsDirCandidates(runtimeDir: string): string[] {
  const prodPath = join(runtimeDir, '..', 'web')
  const devPath = join(runtimeDir, '..', '..', 'web', 'dist')

  return [prodPath, devPath]
}
