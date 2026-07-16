/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Own lexical and existing-ancestor physical confinement for Planning-root writes.
 * 2. Create missing parent directories and write bytes only after symlink checks pass.
 * 3. Settle reactive file state after disk success and before returning to callers.
 *
 * Original request (2026-07-16): "建立唯一的 physical/reactive entity-write owner。"
 */
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { settleReactiveFileWrite } from './reactive-fs/index.js'

export interface PhysicalReactiveFileWrite {
  /** Existing Planning root that owns the write. The root itself may be a symlink. */
  rootPath: string
  /** Root-relative target path; absolute and parent-traversal paths are rejected. */
  relativePath: string
  /** UTF-8 content written to disk and then published to reactive readers. */
  content: string
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function ensureContained(rootPath: string, candidatePath: string, boundary: string): void {
  const childPath = relative(rootPath, candidatePath)
  if (childPath === '..' || childPath.startsWith(`..${sep}`) || isAbsolute(childPath)) {
    throw new Error(`Write target escaped the ${boundary} root.`)
  }
}

async function readLstat(path: string) {
  try {
    return await lstat(path)
  } catch (error) {
    if (isMissingPath(error)) return null
    throw error
  }
}

async function assertNearestExistingAncestor(
  lexicalRoot: string,
  physicalRoot: string,
  candidatePath: string
): Promise<void> {
  let currentPath = candidatePath
  while (true) {
    const info = await readLstat(currentPath)
    if (info) {
      let physicalPath: string
      try {
        physicalPath = await realpath(currentPath)
      } catch (error) {
        throw new Error('Write target could not be resolved inside the physical root.', {
          cause: error,
        })
      }
      ensureContained(physicalRoot, physicalPath, 'physical')
      return
    }

    if (currentPath === lexicalRoot) {
      throw new Error('Write root no longer exists.')
    }
    const parentPath = dirname(currentPath)
    ensureContained(lexicalRoot, parentPath, 'lexical')
    currentPath = parentPath
  }
}

/**
 * Write one UTF-8 file inside an existing physical root and synchronously settle reactive readers.
 *
 * Existing ancestors and the final target are resolved immediately before the write. This rejects
 * observed symlink escapes but cannot make path checks race-free against concurrent filesystem
 * replacement on platforms without a directory-handle-relative write primitive.
 */
export async function writePhysicalReactiveFile(input: PhysicalReactiveFileWrite): Promise<void> {
  if (!input.relativePath || isAbsolute(input.relativePath)) {
    throw new Error('Write target must be a non-empty root-relative path.')
  }

  const lexicalRoot = resolve(input.rootPath)
  const targetPath = resolve(lexicalRoot, input.relativePath)
  ensureContained(lexicalRoot, targetPath, 'lexical')

  const physicalRoot = await realpath(lexicalRoot)
  await assertNearestExistingAncestor(lexicalRoot, physicalRoot, targetPath)

  await mkdir(dirname(targetPath), { recursive: true })
  await assertNearestExistingAncestor(lexicalRoot, physicalRoot, targetPath)
  const targetInfo = await readLstat(targetPath)
  if (targetInfo?.isSymbolicLink()) {
    throw new Error('Write target escaped the physical root through a symbolic link.')
  }

  await writeFile(targetPath, input.content, 'utf8')
  await settleReactiveFileWrite(targetPath, input.content)
}
