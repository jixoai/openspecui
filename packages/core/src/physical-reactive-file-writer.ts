/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Own lexical and existing-ancestor physical confinement for root-scoped mutations.
 * 2. Execute direct or atomic UTF-8 write, directory-create, remove, and guarded external mutations.
 * 3. Settle overlapping reactive projections before returning any terminal outcome.
 * 4. Keep TOCTOU and hard-link alias limitations explicit at the mutation seam.
 *
 * Original request (2026-07-16): "建立唯一的 physical/reactive entity-write owner。"
 * Original request (2026-07-16): "Schema/Template mutations must reject symlink escape and settle reactive projections before success."
 * Derived requirement (2026-08-02): "Raw Active Root YAML uses same-directory atomic replacement before reactive settlement."
 */
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { settleReactiveFileWrite, settleReactivePathMutation } from './reactive-fs/index.js'

/** One non-root path selected relative to an existing physical ownership root. */
export interface PhysicalReactivePathTarget {
  /** Existing ownership root. The root itself may be reached through a symlink. */
  rootPath: string
  /** Root-relative target; absolute, parent-traversal, NUL, and root-self paths are rejected. */
  relativePath: string
}

/** Input for one Planning-root-confined UTF-8 write with post-commit reactive settlement. */
export interface PhysicalReactiveFileWrite extends PhysicalReactivePathTarget {
  /** UTF-8 content written to disk and then published to reactive readers. */
  content: string
}

/** Input for one byte-compared atomic UTF-8 replacement. */
export interface PhysicalReactiveFileCompareWrite extends PhysicalReactiveFileWrite {
  /** Exact current UTF-8 source observed by the caller; null means the file was absent. */
  expectedContent: string | null
}

/** Physical compare-and-write result returned after reactive settlement. */
export type PhysicalReactiveFileCompareWriteResult =
  | { state: 'written' }
  | { state: 'conflict'; content: string | null }

interface ResolvedMutationTarget {
  lexicalRoot: string
  physicalRoot: string
  targetPath: string
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
    throw new Error(`Mutation target escaped the ${boundary} root.`)
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
        throw new Error('Mutation target could not be resolved inside the physical root.', {
          cause: error,
        })
      }
      ensureContained(physicalRoot, physicalPath, 'physical')
      return
    }

    if (currentPath === lexicalRoot) {
      throw new Error('Mutation root no longer exists.')
    }
    const parentPath = dirname(currentPath)
    ensureContained(lexicalRoot, parentPath, 'lexical')
    currentPath = parentPath
  }
}

async function resolveMutationTarget(
  input: PhysicalReactivePathTarget
): Promise<ResolvedMutationTarget> {
  const normalizedRelativePath = input.relativePath.replace(/\\/g, '/')
  if (
    !normalizedRelativePath ||
    normalizedRelativePath.includes('\0') ||
    isAbsolute(normalizedRelativePath) ||
    /^[A-Za-z]:\//.test(normalizedRelativePath) ||
    normalizedRelativePath.split('/').includes('..')
  ) {
    throw new Error('Mutation target must be a non-empty root-relative path.')
  }

  const lexicalRoot = resolve(input.rootPath)
  const targetPath = resolve(lexicalRoot, normalizedRelativePath)
  ensureContained(lexicalRoot, targetPath, 'lexical')
  if (targetPath === lexicalRoot) {
    throw new Error('Mutation target cannot be the ownership root.')
  }

  const physicalRoot = await realpath(lexicalRoot)
  return { lexicalRoot, physicalRoot, targetPath }
}

async function assertMutationTarget(target: ResolvedMutationTarget): Promise<void> {
  await assertNearestExistingAncestor(target.lexicalRoot, target.physicalRoot, target.targetPath)
  const targetInfo = await readLstat(target.targetPath)
  if (targetInfo?.isSymbolicLink()) {
    throw new Error('Mutation target escaped the physical root through a symbolic link.')
  }
}

async function runResolvedPhysicalReactivePathMutation<T>(
  input: PhysicalReactivePathTarget,
  mutation: (target: ResolvedMutationTarget) => Promise<T>,
  settle: (targetPath: string) => Promise<void> = settleReactivePathMutation
): Promise<T> {
  const target = await resolveMutationTarget(input)
  await assertMutationTarget(target)

  const outcome = await mutation(target).then(
    (value) => ({ success: true as const, value }),
    (error: unknown) => ({ success: false as const, error })
  )
  const finalizationFailures: unknown[] = []
  await assertMutationTarget(target).catch((error: unknown) => finalizationFailures.push(error))
  await settle(target.targetPath).catch((error: unknown) => finalizationFailures.push(error))

  if (!outcome.success) {
    if (finalizationFailures.length > 0) {
      throw new AggregateError(
        [outcome.error, ...finalizationFailures],
        'Physical/reactive mutation and settlement failed.'
      )
    }
    throw outcome.error
  }
  if (finalizationFailures.length > 0) {
    throw new AggregateError(finalizationFailures, 'Physical/reactive mutation settlement failed.')
  }
  return outcome.value
}

/**
 * Write one UTF-8 file inside an existing physical root and synchronously settle reactive readers.
 *
 * Existing ancestors and the final target are resolved immediately before the write. This rejects
 * observed symlink escapes but cannot make path checks race-free against concurrent filesystem
 * replacement on platforms without a directory-handle-relative write primitive.
 */
export async function writePhysicalReactiveFile(input: PhysicalReactiveFileWrite): Promise<void> {
  await runResolvedPhysicalReactivePathMutation(
    input,
    async (target) => {
      await mkdir(dirname(target.targetPath), { recursive: true })
      await assertMutationTarget(target)
      await writeFile(target.targetPath, input.content, 'utf8')
    },
    (targetPath) => settleReactiveFileWrite(targetPath, input.content)
  )
}

/**
 * Atomically replace one UTF-8 file inside an existing physical root, then settle reactive readers.
 *
 * The temporary file is created exclusively in the target directory, flushed, and renamed over the
 * destination. Existing permission bits are retained where available. Crash-durable directory fsync is
 * intentionally outside this cross-platform contract; successful callers observe one complete replacement.
 */
export async function writeAtomicPhysicalReactiveFile(
  input: PhysicalReactiveFileWrite
): Promise<void> {
  await runResolvedPhysicalReactivePathMutation(
    input,
    async (target) => {
      const targetDirectory = dirname(target.targetPath)
      await mkdir(targetDirectory, { recursive: true })
      await assertMutationTarget(target)
      const targetInfo = await readLstat(target.targetPath)
      const temporaryPath = join(
        targetDirectory,
        `.${basename(target.targetPath)}.${randomUUID()}.tmp`
      )
      let temporaryFile: Awaited<ReturnType<typeof open>> | null = null
      try {
        temporaryFile = await open(
          temporaryPath,
          'wx',
          targetInfo ? targetInfo.mode & 0o777 : 0o666
        )
        await temporaryFile.writeFile(input.content, 'utf8')
        await temporaryFile.sync()
        await temporaryFile.close()
        temporaryFile = null
        await assertMutationTarget(target)
        await rename(temporaryPath, target.targetPath)
      } finally {
        await temporaryFile?.close().catch(() => undefined)
        await rm(temporaryPath, { force: true }).catch(() => undefined)
      }
    },
    (targetPath) => settleReactiveFileWrite(targetPath, input.content)
  )
}

async function readPhysicalUtf8(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isMissingPath(error)) return null
    throw error
  }
}

/**
 * Compare current physical bytes immediately before atomic replacement and settle either outcome.
 *
 * This closes stale in-process writers through their serialized caller and detects observed external
 * replacement after the temporary file is ready. Platforms expose no path-level atomic compare-and-swap,
 * so an external process can still race in the final compare-to-rename interval.
 */
export async function compareAndWriteAtomicPhysicalReactiveFile(
  input: PhysicalReactiveFileCompareWrite
): Promise<PhysicalReactiveFileCompareWriteResult> {
  let committed = false
  return runResolvedPhysicalReactivePathMutation(
    input,
    async (target) => {
      const targetDirectory = dirname(target.targetPath)
      await mkdir(targetDirectory, { recursive: true })
      await assertMutationTarget(target)
      const targetInfo = await readLstat(target.targetPath)
      const temporaryPath = join(
        targetDirectory,
        `.${basename(target.targetPath)}.${randomUUID()}.tmp`
      )
      let temporaryFile: Awaited<ReturnType<typeof open>> | null = null
      try {
        temporaryFile = await open(
          temporaryPath,
          'wx',
          targetInfo ? targetInfo.mode & 0o777 : 0o666
        )
        await temporaryFile.writeFile(input.content, 'utf8')
        await temporaryFile.sync()
        await temporaryFile.close()
        temporaryFile = null
        await assertMutationTarget(target)
        const currentContent = await readPhysicalUtf8(target.targetPath)
        if (currentContent !== input.expectedContent) {
          return { state: 'conflict' as const, content: currentContent }
        }
        await rename(temporaryPath, target.targetPath)
        committed = true
        return { state: 'written' as const }
      } finally {
        await temporaryFile?.close().catch(() => undefined)
        await rm(temporaryPath, { force: true }).catch(() => undefined)
      }
    },
    (targetPath) =>
      committed
        ? settleReactiveFileWrite(targetPath, input.content)
        : settleReactivePathMutation(targetPath)
  )
}

/** Create one root-confined directory and synchronously settle overlapping reactive readers. */
export async function createPhysicalReactiveDirectory(
  input: PhysicalReactivePathTarget
): Promise<void> {
  await runResolvedPhysicalReactivePathMutation(input, async (target) => {
    await mkdir(target.targetPath, { recursive: true })
  })
}

/** Remove one root-confined file or directory and synchronously settle descendant projections. */
export async function removePhysicalReactivePath(input: PhysicalReactivePathTarget): Promise<void> {
  await runResolvedPhysicalReactivePathMutation(input, async (target) => {
    await rm(target.targetPath, { recursive: true, force: true })
  })
}

/**
 * Guard and settle a mutation performed by an external owner such as the OpenSpec CLI.
 *
 * The pre/post checks reject observed symlink escape, but cannot close replacement races between
 * checks and the external process. Hard-link aliases are likewise not identifiable from the path.
 */
export async function runPhysicalReactivePathMutation<T>(
  input: PhysicalReactivePathTarget,
  mutation: () => Promise<T>
): Promise<T> {
  return runResolvedPhysicalReactivePathMutation(input, () => mutation())
}
