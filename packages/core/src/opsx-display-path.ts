export const VIRTUAL_PROJECT_DIRNAME = 'project'

const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:\//

function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/g, '')
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || WINDOWS_DRIVE_PREFIX.test(path)
}

function stripRelativePrefix(path: string): string {
  return path.replace(/^\.?\//, '')
}

function splitSegments(path: string): string[] {
  return normalizeFsPath(path).split('/').filter(Boolean)
}

function toNpmSpecifier(path: string): string | null {
  const normalized = normalizeFsPath(path)
  const match =
    /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(@[^/]+\/[^/]+|[^/]+)(\/.*)?/.exec(
      normalized
    )
  const pkgName = match?.[1]
  if (!pkgName) return null
  const rest = match[2] ?? ''
  return `npm:${pkgName}${rest}`
}

function toVirtualProjectPath(path: string): string {
  const normalized = stripRelativePrefix(path)
  return `${VIRTUAL_PROJECT_DIRNAME}:${normalized}`
}

function isPathInside(root: string, target: string): boolean {
  const normalizedRoot = normalizeFsPath(root)
  const normalizedTarget = normalizeFsPath(target)
  const rootLower = normalizedRoot.toLowerCase()
  const targetLower = normalizedTarget.toLowerCase()
  return targetLower === rootLower || targetLower.startsWith(`${rootLower}/`)
}

function toRelativeFromRoot(root: string, target: string): string {
  const rootSegments = splitSegments(root)
  const targetSegments = splitSegments(target)
  let index = 0
  while (index < rootSegments.length && index < targetSegments.length) {
    if (rootSegments[index]?.toLowerCase() !== targetSegments[index]?.toLowerCase()) {
      break
    }
    index += 1
  }
  return targetSegments.slice(index).join('/')
}

function findOpspecSlice(path: string): string | null {
  const segments = splitSegments(path)
  const idx = segments.lastIndexOf('openspec')
  if (idx < 0) return null
  return segments.slice(idx).join('/')
}

export function toOpsxDisplayPath(
  absoluteOrRelativePath: string,
  options?: {
    source?: 'project' | 'user' | 'package'
    projectDir?: string
  }
): string {
  const normalized = normalizeFsPath(absoluteOrRelativePath)
  const npmSpecifier = toNpmSpecifier(normalized)
  if (options?.source === 'package' || npmSpecifier) {
    if (npmSpecifier) return npmSpecifier
  }

  if (!isAbsolutePath(normalized)) {
    return toVirtualProjectPath(normalized)
  }

  if (options?.projectDir && isPathInside(options.projectDir, normalized)) {
    const relativePath = toRelativeFromRoot(options.projectDir, normalized)
    return toVirtualProjectPath(relativePath)
  }

  const openspecSlice = findOpspecSlice(normalized)
  if (openspecSlice) {
    return toVirtualProjectPath(openspecSlice)
  }

  const segments = splitSegments(normalized)
  const tail = segments.slice(-4).join('/')
  return toVirtualProjectPath(tail)
}
