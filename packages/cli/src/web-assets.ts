import { join } from 'node:path'

export function getWebAssetsDirCandidates(runtimeDir: string): string[] {
  const prodPath = join(runtimeDir, '..', 'web')
  const devPath = join(runtimeDir, '..', '..', 'web', 'dist')

  // In the monorepo, prefer the freshly built web/dist over the copied cli/web snapshot.
  // In published packages, web/dist does not exist, so cli/web remains the effective asset dir.
  return [devPath, prodPath]
}
