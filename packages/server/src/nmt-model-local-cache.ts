import { stat } from 'node:fs/promises'
import { join } from 'node:path'

export function getTransformersLocalModelPath(cacheDir: string, modelId: string): string {
  return join(cacheDir, 'models', modelId)
}

export function getTransformersFileCacheModelPath(cacheDir: string, modelId: string): string {
  return join(cacheDir, modelId)
}

export async function readLocalNmtModelFileStatus(input: {
  cacheDir: string
  modelId: string
  files: ReadonlyArray<string>
}): Promise<{ allCached: boolean; files: Array<{ file: string; cached: boolean }> }> {
  const files = await Promise.all(
    input.files.map(async (file) => ({
      file,
      cached:
        (await pathExists(
          join(getTransformersLocalModelPath(input.cacheDir, input.modelId), file)
        )) ||
        (await pathExists(
          join(getTransformersFileCacheModelPath(input.cacheDir, input.modelId), file)
        )),
    }))
  )
  return { allCached: files.length > 0 && files.every((file) => file.cached), files }
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}
