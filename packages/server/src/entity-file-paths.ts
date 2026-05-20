import {
  getOpsxEntityRootRelativePath,
  normalizeOpsxEntityPath,
  type OpsxEntityStage,
} from '@openspecui/core'
import { resolve } from 'node:path'

function ensureInsideRoot(rootPath: string, candidatePath: string): void {
  if (candidatePath === rootPath) return
  if (!candidatePath.startsWith(rootPath + '/')) {
    throw new Error('Resolved path escaped entity root.')
  }
}

export function getEntityRootPath(
  projectDir: string,
  stage: OpsxEntityStage,
  changeId: string
): string {
  return resolve(projectDir, getOpsxEntityRootRelativePath(stage, changeId))
}

export function resolveEntityEntryPath(input: {
  projectDir: string
  stage: OpsxEntityStage
  changeId: string
  path: string
}): {
  entityRoot: string
  relativePath: string
  absolutePath: string
} {
  const relativePath = normalizeOpsxEntityPath(input.path)
  if (!relativePath) {
    throw new Error('path is required')
  }

  const entityRoot = getEntityRootPath(input.projectDir, input.stage, input.changeId)
  const absolutePath = resolve(entityRoot, relativePath)
  ensureInsideRoot(entityRoot, absolutePath)

  return {
    entityRoot,
    relativePath,
    absolutePath,
  }
}
