import type { GitEntryFileDiff, GitEntryFileSummary } from '@openspecui/core'

export type GitFileTreeNode = GitFileTreeDirectoryNode | GitFileTreeFileNode

const WINDOWS_DRIVE_ROOT = /^[A-Za-z]:\/$/

export interface GitFileTreeDirectoryNode {
  kind: 'directory'
  key: string
  name: string
  diff: GitEntryFileDiff
  children: GitFileTreeNode[]
}

export interface GitFileTreeFileNode {
  kind: 'file'
  key: string
  name: string
  diff: GitEntryFileDiff
  file: GitEntryFileSummary
}

interface BuildGitFileTreeModelOptions {
  projectDir?: string | null
}

function normalizeFsPath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (normalized === '/' || WINDOWS_DRIVE_ROOT.test(normalized)) {
    return normalized
  }
  return normalized.replace(/\/+$/g, '')
}

function splitPathSegments(path: string): string[] {
  return normalizeFsPath(path).split('/').filter(Boolean)
}

function findCommonDirectorySegments(files: readonly GitEntryFileSummary[]): string[] {
  const directorySegmentsList = files
    .map((file) => splitPathSegments(file.path).slice(0, -1))
    .filter((segments) => segments.length > 0)

  const [first, ...rest] = directorySegmentsList
  if (!first) {
    return []
  }

  let prefixLength = first.length

  for (const segments of rest) {
    prefixLength = Math.min(prefixLength, segments.length)

    let index = 0
    while (index < prefixLength && first[index] === segments[index]) {
      index += 1
    }
    prefixLength = index

    if (prefixLength === 0) {
      return []
    }
  }

  return first.slice(0, prefixLength)
}

function sortNodes(nodes: GitFileTreeNode[]): GitFileTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name)
  })
}

function aggregateDiffs(diffs: GitEntryFileDiff[]): GitEntryFileDiff {
  const files = diffs.reduce((total, diff) => total + diff.files, 0)

  if (diffs.some((diff) => diff.state === 'loading')) {
    return { state: 'loading', files }
  }

  if (diffs.every((diff) => diff.state === 'ready')) {
    return {
      state: 'ready',
      files,
      insertions: diffs.reduce((total, diff) => total + diff.insertions, 0),
      deletions: diffs.reduce((total, diff) => total + diff.deletions, 0),
    }
  }

  return { state: 'unavailable', files }
}

function createFileNode(file: GitEntryFileSummary, name: string): GitFileTreeFileNode {
  return {
    kind: 'file',
    key: file.fileId,
    name,
    diff: file.diff,
    file,
  }
}

function createDirectoryNode(key: string, name: string): GitFileTreeDirectoryNode {
  return {
    kind: 'directory',
    key,
    name,
    diff: { state: 'unavailable', files: 0 },
    children: [],
  }
}

function insertNode(
  bucket: Map<string, GitFileTreeNode>,
  file: GitEntryFileSummary,
  segments: string[],
  depth: number,
  currentPath: string
): void {
  const segment = segments[depth]
  if (!segment) return

  const nextPath = currentPath ? `${currentPath}/${segment}` : segment
  const isLeaf = depth === segments.length - 1

  if (isLeaf) {
    bucket.set(nextPath, createFileNode(file, segment))
    return
  }

  const existing = bucket.get(nextPath)
  const directoryNode =
    existing?.kind === 'directory' ? existing : createDirectoryNode(nextPath, segment)

  bucket.set(nextPath, directoryNode)

  const childBucket = new Map(directoryNode.children.map((child) => [child.key, child]))
  insertNode(childBucket, file, segments, depth + 1, nextPath)
  directoryNode.children = [...childBucket.values()]
}

function compressDirectoryNode(node: GitFileTreeDirectoryNode): GitFileTreeDirectoryNode {
  let current = node
  const labels = [node.name]

  while (current.children.length === 1 && current.children[0]?.kind === 'directory') {
    current = current.children[0]
    labels.push(current.name)
  }

  const children = sortNodes(
    current.children.map((child) =>
      child.kind === 'directory' ? compressDirectoryNode(child) : child
    )
  )

  return {
    ...current,
    name: labels.join('/'),
    diff: aggregateDiffs(children.map((child) => child.diff)),
    children,
  }
}

export function buildGitFileTreeModel(
  files: GitEntryFileSummary[],
  options: BuildGitFileTreeModelOptions = {}
): GitFileTreeNode[] {
  const projectDir = options.projectDir ? normalizeFsPath(options.projectDir) : null
  const commonDirectorySegments = projectDir ? [] : findCommonDirectorySegments(files)
  const commonDirectoryPath = commonDirectorySegments.join('/')
  const root = new Map<string, GitFileTreeNode>()

  for (const file of files) {
    const segments = splitPathSegments(file.path).slice(commonDirectorySegments.length)
    if (segments.length === 0) continue
    insertNode(root, file, segments, 0, '')
  }

  const children = sortNodes(
    [...root.values()].map((node) =>
      node.kind === 'directory' ? compressDirectoryNode(node) : node
    )
  )

  if (projectDir) {
    return [
      {
        kind: 'directory',
        key: projectDir,
        name: projectDir,
        diff: aggregateDiffs(children.map((child) => child.diff)),
        children,
      },
    ]
  }

  if (commonDirectoryPath.length === 0) {
    return children
  }

  return [
    {
      kind: 'directory',
      key: commonDirectoryPath,
      name: commonDirectoryPath,
      diff: aggregateDiffs(children.map((child) => child.diff)),
      children,
    },
  ]
}
