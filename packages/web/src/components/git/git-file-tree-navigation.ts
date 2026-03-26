import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'

import type { GitFileTreeVisibleItem } from './git-file-tree-visible-items'

function resolveFocusableKey(options: {
  currentKey: string | null
  visibleKeySet: ReadonlySet<string>
  parentByKey: ReadonlyMap<string, string | null>
  firstItemKey: string | null
}): string | null {
  const { currentKey, visibleKeySet, parentByKey, firstItemKey } = options

  if (currentKey && visibleKeySet.has(currentKey)) {
    return currentKey
  }

  let ancestorKey = currentKey ? (parentByKey.get(currentKey) ?? null) : null
  while (ancestorKey) {
    if (visibleKeySet.has(ancestorKey)) {
      return ancestorKey
    }
    ancestorKey = parentByKey.get(ancestorKey) ?? null
  }

  return firstItemKey
}

export function useGitFileTreeNavigation({
  items,
  itemsByKey,
  parentByKey,
  treeRef,
  onToggleDirectory,
  onSelectFile,
}: {
  items: readonly GitFileTreeVisibleItem[]
  itemsByKey: ReadonlyMap<string, GitFileTreeVisibleItem>
  parentByKey: ReadonlyMap<string, string | null>
  treeRef: RefObject<HTMLDivElement | null>
  onToggleDirectory: (key: string) => void
  onSelectFile: (fileId: string) => void
}) {
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [focusedKey, setFocusedKey] = useState<string | null>(null)

  const visibleKeySet = useMemo(() => new Set(items.map((item) => item.key)), [items])
  const visibleIndexByKey = useMemo(
    () => new Map(items.map((item, index) => [item.key, index])),
    [items]
  )
  const firstItemKey = items[0]?.key ?? null

  const effectiveFocusedKey = resolveFocusableKey({
    currentKey: focusedKey,
    visibleKeySet,
    parentByKey,
    firstItemKey,
  })

  const moveFocus = useCallback((key: string | null) => {
    if (!key) return

    setFocusedKey(key)
    itemRefs.current.get(key)?.focus()
  }, [])

  useEffect(() => {
    if (effectiveFocusedKey === focusedKey) {
      return
    }

    setFocusedKey(effectiveFocusedKey)

    if (
      effectiveFocusedKey &&
      treeRef.current &&
      treeRef.current.contains(document.activeElement)
    ) {
      itemRefs.current.get(effectiveFocusedKey)?.focus()
    }
  }, [effectiveFocusedKey, focusedKey, treeRef])

  const handleItemFocus = useCallback((key: string) => {
    setFocusedKey(key)
  }, [])

  const handleItemClick = useCallback(
    (key: string) => {
      const item = itemsByKey.get(key)
      if (!item) return

      setFocusedKey(key)

      if (item.kind === 'directory') {
        onToggleDirectory(key)
        return
      }

      onSelectFile(item.node.file.fileId)
    },
    [itemsByKey, onSelectFile, onToggleDirectory]
  )

  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, key: string) => {
      const item = itemsByKey.get(key)
      if (!item) return

      const index = visibleIndexByKey.get(key)
      if (index == null) return

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          moveFocus(items[index + 1]?.key ?? null)
          return
        }
        case 'ArrowUp': {
          event.preventDefault()
          moveFocus(items[index - 1]?.key ?? null)
          return
        }
        case 'Home': {
          event.preventDefault()
          moveFocus(items[0]?.key ?? null)
          return
        }
        case 'End': {
          event.preventDefault()
          moveFocus(items.at(-1)?.key ?? null)
          return
        }
        case 'ArrowRight': {
          if (item.kind !== 'directory') return

          if (!item.expanded && item.firstChildKey) {
            event.preventDefault()
            onToggleDirectory(item.key)
            return
          }

          if (item.expanded && item.firstChildKey) {
            event.preventDefault()
            moveFocus(item.firstChildKey)
          }

          return
        }
        case 'ArrowLeft': {
          if (item.kind === 'directory' && item.expanded && item.firstChildKey) {
            event.preventDefault()
            onToggleDirectory(item.key)
            return
          }

          const parentKey = parentByKey.get(item.key) ?? null
          if (parentKey) {
            event.preventDefault()
            moveFocus(parentKey)
          }
          return
        }
        case 'Enter':
        case ' ': {
          event.preventDefault()

          if (item.kind === 'directory') {
            onToggleDirectory(item.key)
            return
          }

          onSelectFile(item.node.file.fileId)
          return
        }
        default:
          return
      }
    },
    [items, itemsByKey, moveFocus, onSelectFile, onToggleDirectory, parentByKey, visibleIndexByKey]
  )

  const registerItemRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (!node) {
        itemRefs.current.delete(key)
        return
      }

      itemRefs.current.set(key, node)
    },
    []
  )

  return {
    focusedKey: effectiveFocusedKey,
    handleItemClick,
    handleItemFocus,
    handleItemKeyDown,
    registerItemRef,
  }
}
