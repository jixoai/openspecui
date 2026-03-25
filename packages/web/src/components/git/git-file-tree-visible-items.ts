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
}

export interface GitFileTreeVisibleFileItem extends GitFileTreeVisibleItemBase {
  kind: 'file'
  node: GitFileTreeFileNode
  selected: boolean
}

export type GitFileTreeVisibleItem = GitFileTreeVisibleDirectoryItem | GitFileTreeVisibleFileItem

export interface GitFileTreeVisibleModel {
  items: GitFileTreeVisibleItem[]
  itemsByKey: Map<string, GitFileTreeVisibleItem>
  directoryKeys: Set<string>
  parentByKey: Map<string, string | null>
}

function collectNodeMetadata(
  nodes: GitFileTreeNode[],
  parentKey: string | null,
  parentByKey: Map<string, string | null>,
  directoryKeys: Set<string>
): void {
  for (const node of nodes) {
    parentByKey.set(node.key, parentKey)

    if (node.kind === 'directory') {
      directoryKeys.add(node.key)
      collectNodeMetadata(node.children, node.key, parentByKey, directoryKeys)
    }
  }
}

function collectVisibleItems(
  nodes: GitFileTreeNode[],
  collapsedKeys: ReadonlySet<string>,
  activeFileId: string | null,
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
      })

      if (expanded && node.children.length > 0) {
        collectVisibleItems(
          node.children,
          collapsedKeys,
          activeFileId,
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
      selected: node.file.fileId === activeFileId,
    })
  })
}

export function buildGitFileTreeVisibleModel(
  nodes: GitFileTreeNode[],
  collapsedKeys: ReadonlySet<string>,
  activeFileId: string | null
): GitFileTreeVisibleModel {
  const parentByKey = new Map<string, string | null>()
  const directoryKeys = new Set<string>()
  const items: GitFileTreeVisibleItem[] = []

  collectNodeMetadata(nodes, null, parentByKey, directoryKeys)
  collectVisibleItems(nodes, collapsedKeys, activeFileId, 1, null, [], items)

  return {
    items,
    itemsByKey: new Map(items.map((item) => [item.key, item])),
    directoryKeys,
    parentByKey,
  }
}
