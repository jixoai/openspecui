import {
  getOpsxEntityRootRelativePath,
  requireCanonicalOpenSpecEntityId,
  requireOpenSpecEntityRelativePath,
  type OpsxEntityStage,
} from '@openspecui/core'
import { isAbsolute, relative, resolve, sep } from 'node:path'

function ensureInsideRoot(rootPath: string, candidatePath: string): void {
  const relativePath = relative(rootPath, candidatePath)
  if (relativePath === '') return
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error('Resolved path escaped entity root.')
  }
}

export function getEntityRootPath(
  projectDir: string,
  stage: OpsxEntityStage,
  changeId: string
): string {
  const normalizedChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
  const stageRoot = resolve(projectDir, getOpsxEntityRootRelativePath(stage, ''))
  const entityRoot = resolve(projectDir, getOpsxEntityRootRelativePath(stage, normalizedChangeId))
  ensureInsideRoot(stageRoot, entityRoot)
  return entityRoot
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
  const relativePath = requireOpenSpecEntityRelativePath(input.path, 'path')

  const entityRoot = getEntityRootPath(input.projectDir, input.stage, input.changeId)
  const absolutePath = resolve(entityRoot, relativePath)
  ensureInsideRoot(entityRoot, absolutePath)

  return {
    entityRoot,
    relativePath,
    absolutePath,
  }
}
