/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Project the completed Web build into the CLI package with platform-neutral filesystem APIs.
 * 2. Commit the projection through the shared bounded directory-swap owner.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectDirectoryAtomically } from '../../../scripts/lib/atomic-directory-projection'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(packageDir, '../web/dist')
const targetDir = resolve(packageDir, 'web')

await projectDirectoryAtomically(sourceDir, targetDir)
