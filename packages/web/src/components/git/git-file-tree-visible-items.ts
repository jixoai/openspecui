import type {
  GitFileTreeDirectoryNode,
  GitFileTreeFileNode,
  GitFileTreeNode,
} from './git-file-tree-model'

export interface GitFileTreeVisibleItemBase {
  key: string
  level: number
  parentKey: string | null
  posInSet: number
  setSize: number
  isLastSibling: boolean
  /**
   * One guide slot per indentation level. The last slot is the current elbow column.
   */
  guideMask: boolean[]
}

export interface GitFileTreeVisibleDirectoryItem extends GitFileTreeVisibleItemBase {
  kind: 'directory'
  node: GitFileTreeDirectoryNode
  expanded: boolean
  firstChildKey: string | null
  visibilityRatio: number
}

export interface GitFileTreeVisibleFileItem extends GitFileTreeVisibleItemBase {
  kind: 'file'
  node: GitFileTreeFileNode
  visibilityRatio: number
}

export type GitFileTreeVisibleItem = GitFileTreeVisibleDirectoryItem | GitFileTreeVisibleFileItem

export interface GitFileTreeVisibleModel {
  items: GitFileTreeVisibleItem[]
  itemsByKey: Map<string, GitFileTreeVisibleItem>
  directoryKeys: Set<string>
  parentByKey: Map<string, string | null>
  keyByFileId: Map<string, string>
}

function collectNodeMetadata(
  nodes: GitFileTreeNode[],
  parentKey: string | null,
  parentByKey: Map<string, string | null>,
  directoryKeys: Set<string>,
  keyByFileId: Map<string, string>
): void {
  for (const node of nodes) {
    parentByKey.set(node.key, parentKey)

    if (node.kind === 'directory') {
      directoryKeys.add(node.key)
      collectNodeMetadata(node.children, node.key, parentByKey, directoryKeys, keyByFileId)
      continue
    }

    keyByFileId.set(node.file.fileId, node.key)
  }
}

function collectVisibilityRatios(
  nodes: GitFileTreeNode[],
  visibilityRatioByFileId: ReadonlyMap<string, number>,
  visibilityRatioByKey: Map<string, number>
): number {
  let maxVisibilityRatio = 0

  for (const node of nodes) {
    if (node.kind === 'directory') {
      const ratio = collectVisibilityRatios(
        node.children,
        visibilityRatioByFileId,
        visibilityRatioByKey
      )
      visibilityRatioByKey.set(node.key, ratio)
      maxVisibilityRatio = Math.max(maxVisibilityRatio, ratio)
      continue
    }

    const ratio = visibilityRatioByFileId.get(node.file.fileId) ?? 0
    visibilityRatioByKey.set(node.key, ratio)
    maxVisibilityRatio = Math.max(maxVisibilityRatio, ratio)
  }

  return maxVisibilityRatio
}

function collectVisibleItems(
  nodes: GitFileTreeNode[],
  collapsedKeys: ReadonlySet<string>,
  visibilityRatioByKey: ReadonlyMap<string, number>,
  level: number,
  parentKey: string | null,
  guideMask: boolean[],
  items: GitFileTreeVisibleItem[]
): void {
  const setSize = nodes.length

  nodes.forEach((node, index) => {
    const isLastSibling = index === setSize - 1

    if (node.kind === 'directory') {
      const expanded = !collapsedKeys.has(node.key)

      items.push({
        key: node.key,
        kind: 'directory',
        node,
        level,
        parentKey,
        posInSet: index + 1,
        setSize,
        isLastSibling,
        guideMask,
        expanded,
        firstChildKey: node.children[0]?.key ?? null,
        visibilityRatio: visibilityRatioByKey.get(node.key) ?? 0,
      })

      if (expanded && node.children.length > 0) {
        collectVisibleItems(
          node.children,
          collapsedKeys,
          visibilityRatioByKey,
          level + 1,
          node.key,
          [...guideMask, !isLastSibling],
          items
        )
      }

      return
    }

    items.push({
      key: node.key,
      kind: 'file',
      node,
      level,
      parentKey,
      posInSet: index + 1,
      setSize,
      isLastSibling,
      guideMask,
      visibilityRatio: visibilityRatioByKey.get(node.key) ?? 0,
    })
  })
}

export function buildGitFileTreeVisibleModel(
  nodes: GitFileTreeNode[],
  collapsedKeys: ReadonlySet<string>,
  visibilityRatioByFileId: ReadonlyMap<string, number> = new Map()
): GitFileTreeVisibleModel {
  const parentByKey = new Map<string, string | null>()
  const directoryKeys = new Set<string>()
  const keyByFileId = new Map<string, string>()
  const items: GitFileTreeVisibleItem[] = []
  const visibilityRatioByKey = new Map<string, number>()

  collectNodeMetadata(nodes, null, parentByKey, directoryKeys, keyByFileId)
  collectVisibilityRatios(nodes, visibilityRatioByFileId, visibilityRatioByKey)
  collectVisibleItems(nodes, collapsedKeys, visibilityRatioByKey, 1, null, [], items)

  return {
    items,
    itemsByKey: new Map(items.map((item) => [item.key, item])),
    directoryKeys,
    parentByKey,
    keyByFileId,
  }
}
