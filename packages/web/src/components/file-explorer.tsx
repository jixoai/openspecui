import { CodeEditor } from '@/components/code-editor'
import { ContextMenu, type ContextMenuItem } from '@/components/context-menu'
import { ChevronRight, EllipsisVertical, File, FileText, Folder } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

export interface FileExplorerEntry {
  path: string
  type: 'file' | 'directory'
  content?: string | null
}

export interface FileExplorerAction {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  tone?: 'default' | 'destructive'
  onSelect: () => void
}

const css = String.raw
const layoutStyles = css`
  /* 窄屏：单列布局 */
  .fev-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0.75rem;
  }
  .fev-sidebar-tabs {
    flex-shrink: 0;
  }
  .fev-sidebar-tree {
    display: none;
  }
  .fev-editor-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 320px;
  }

  /* 宽屏：grid 布局，文件列表在右侧 */
  @container (min-width: 768px) {
    .fev-layout {
      display: grid;
      grid-template-columns: 1fr 240px;
      gap: 1rem;
    }
    .fev-sidebar-tabs {
      display: none;
    }
    .fev-sidebar-tree {
      display: block;
      order: 2;
    }
    .fev-editor-wrapper {
      order: 1;
      min-height: 480px;
    }
  }
  .CodeMirror {
    line-height: 21px;
  }
`

/**
 * 排序文件条目，确保子项紧跟在父目录后面
 * 规则：同一目录下，文件夹优先于文件，同类型按字母排序
 */
function compareEntries(a: FileExplorerEntry, b: FileExplorerEntry): number {
  const aParts = a.path.split('/')
  const bParts = b.path.split('/')

  const minLen = Math.min(aParts.length, bParts.length)
  for (let i = 0; i < minLen; i++) {
    const aIsLast = i === aParts.length - 1
    const bIsLast = i === bParts.length - 1

    if (aParts[i] !== bParts[i]) {
      if (aIsLast && bIsLast) {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      } else if (aIsLast && !bIsLast) {
        if (a.type === 'directory') return aParts[i].localeCompare(bParts[i])
        return 1
      } else if (!aIsLast && bIsLast) {
        if (b.type === 'directory') return aParts[i].localeCompare(bParts[i])
        return -1
      }
      return aParts[i].localeCompare(bParts[i])
    }
  }

  return aParts.length - bParts.length
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path
}

function getParentPath(path: string): string {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
}

/** 面包屑路径导航 */
function Breadcrumb({
  path,
  entries,
  onNavigate,
}: {
  path: string
  entries: FileExplorerEntry[]
  onNavigate: (path: string) => void
}) {
  const parts = path.split('/')
  const isMarkdown = path.endsWith('.md')

  const segments: { name: string; path: string; isFile: boolean }[] = []
  for (let i = 0; i < parts.length; i++) {
    const segmentPath = parts.slice(0, i + 1).join('/')
    const isFile = i === parts.length - 1
    segments.push({ name: parts[i], path: segmentPath, isFile })
  }

  return (
    <div className="border-border/50 bg-muted/20 flex items-center gap-1 overflow-x-auto border-b px-3 py-2 text-xs">
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1
        const canNavigate =
          !isLast && entries.some((e) => e.type === 'file' && e.path.startsWith(segment.path + '/'))

        return (
          <span key={segment.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="text-muted-foreground/50 h-3 w-3" />}
            {isLast ? (
              <span className="text-foreground flex items-center gap-1.5">
                {segment.isFile ? (
                  isMarkdown ? (
                    <FileText className="h-3.5 w-3.5" />
                  ) : (
                    <File className="h-3.5 w-3.5" />
                  )
                ) : (
                  <Folder className="h-3.5 w-3.5" />
                )}
                {segment.name}
              </span>
            ) : canNavigate ? (
              <button
                onClick={() => {
                  const firstFile = entries.find(
                    (e) => e.type === 'file' && e.path.startsWith(segment.path + '/')
                  )
                  if (firstFile) onNavigate(firstFile.path)
                }}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <Folder className="h-3.5 w-3.5" />
                {segment.name}
              </button>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5" />
                {segment.name}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/** 窄屏下的文件标签栏 */
function FileTabs({
  entries,
  selectedPath,
  onSelect,
}: {
  entries: FileExplorerEntry[]
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const files = entries.filter((e) => e.type === 'file')

  return (
    <div className="scrollbar-thin scrollbar-track-transparent border-border bg-muted/30 flex gap-1 overflow-x-auto rounded-md border p-1">
      {files.map((entry) => {
        const isActive = entry.path === selectedPath
        const isMarkdown = entry.path.endsWith('.md')

        return (
          <button
            key={entry.path}
            onClick={() => onSelect(entry.path)}
            title={entry.path}
            className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            }`}
          >
            {isMarkdown ? <FileText className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
            <span className="max-w-[120px] truncate">{getFileName(entry.path)}</span>
          </button>
        )
      })}
    </div>
  )
}

function FileTree({
  entries,
  selectedPath,
  onSelect,
  headerLabel,
  headerActions,
  entryActions,
}: {
  entries: FileExplorerEntry[]
  selectedPath: string | null
  onSelect: (path: string) => void
  headerLabel: ReactNode
  headerActions?: ReactNode
  entryActions?: (entry: FileExplorerEntry) => FileExplorerAction[]
}) {
  const [menuState, setMenuState] = useState<{
    entry: FileExplorerEntry
    items: ContextMenuItem[]
    position: { x: number; y: number }
  } | null>(null)

  const getIndentLevel = (entry: FileExplorerEntry): number => {
    const parentPath = getParentPath(entry.path)
    if (!parentPath) return 0
    const parentExists = entries.some((e) => e.type === 'directory' && e.path === parentPath)
    if (parentExists) {
      const parentEntry = entries.find((e) => e.path === parentPath)!
      return getIndentLevel(parentEntry) + 1
    }
    return entry.path.split('/').length - 1
  }

  const openMenu = (
    entry: FileExplorerEntry,
    position: { x: number; y: number },
    items: FileExplorerAction[]
  ) => {
    const mapped: ContextMenuItem[] = items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
      tone: item.tone,
      onSelect: item.onSelect,
    }))
    if (mapped.length === 0) return
    setMenuState({ entry, items: mapped, position })
  }

  const closeMenu = () => setMenuState(null)

  return (
    <div className="border-border bg-muted/30 flex h-full flex-col rounded-md border">
      <div className="border-border/50 text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs font-medium">
        <span className="min-w-0 truncate">{headerLabel}</span>
        {headerActions}
      </div>
      <div className="scrollbar-thin scrollbar-track-transparent flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-muted-foreground px-3 py-2 text-xs">No files yet.</div>
        ) : (
          entries.map((entry) => {
            const depth = getIndentLevel(entry)
            const isActive = entry.path === selectedPath
            const isFile = entry.type === 'file'
            const actions = entryActions ? entryActions(entry) : []
            const showActions = actions.length > 0

            const icon = isFile ? (
              entry.path.endsWith('.md') ? (
                <FileText className="h-4 w-4 shrink-0" />
              ) : (
                <File className="h-4 w-4 shrink-0" />
              )
            ) : (
              <Folder className="h-4 w-4 shrink-0" />
            )

            return (
              <div
                key={entry.path}
                className={`group flex w-full items-center gap-2 px-2 py-1 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : isFile
                      ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      : 'text-muted-foreground'
                }`}
                onContextMenu={(event) => {
                  if (!showActions) return
                  event.preventDefault()
                  if (isFile) onSelect(entry.path)
                  openMenu(entry, { x: event.clientX, y: event.clientY }, actions)
                }}
              >
                <button
                  type="button"
                  disabled={!isFile}
                  onClick={() => isFile && onSelect(entry.path)}
                  className={`flex flex-1 items-center gap-2 text-left ${
                    !isFile ? 'cursor-default' : ''
                  }`}
                  style={{ paddingLeft: 4 + depth * 14 }}
                >
                  {icon}
                  <span className={`truncate ${!isFile ? 'text-foreground font-medium' : ''}`}>
                    {getFileName(entry.path)}
                  </span>
                </button>
                {showActions && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      openMenu(entry, { x: rect.right, y: rect.bottom }, actions)
                    }}
                    className="hover:bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-md"
                    aria-label="File actions"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <ContextMenu
        open={!!menuState}
        items={menuState?.items ?? []}
        position={menuState?.position ?? null}
        onClose={closeMenu}
      />
    </div>
  )
}

export function FileExplorer({
  entries,
  selectedPath,
  onSelect,
  headerLabel = 'Files',
  headerActions,
  entryActions,
  renderEditor,
  emptyState,
}: {
  entries: FileExplorerEntry[]
  selectedPath: string | null
  onSelect: (path: string) => void
  headerLabel?: ReactNode
  headerActions?: ReactNode
  entryActions?: (entry: FileExplorerEntry) => FileExplorerAction[]
  renderEditor: (activeFile: FileExplorerEntry | null) => ReactNode
  emptyState?: ReactNode
}) {
  const sortedEntries = useMemo(() => [...entries].sort(compareEntries), [entries])

  const activeFile = useMemo(() => {
    if (!sortedEntries.length || !selectedPath) return null
    return (
      sortedEntries.find((entry) => entry.path === selectedPath && entry.type === 'file') ?? null
    )
  }, [sortedEntries, selectedPath])

  return (
    <div className="@container-[size] h-full">
      <style>{layoutStyles}</style>
      <div className="fev-layout">
        <div className="fev-sidebar-tabs">
          <FileTabs entries={sortedEntries} selectedPath={selectedPath} onSelect={onSelect} />
        </div>

        <div className="fev-sidebar-tree">
          <FileTree
            entries={sortedEntries}
            selectedPath={selectedPath}
            onSelect={onSelect}
            headerLabel={headerLabel}
            headerActions={headerActions}
            entryActions={entryActions}
          />
        </div>

        <div className="fev-editor-wrapper border-border bg-background overflow-hidden rounded-md border shadow-sm">
          {activeFile ? (
            <>
              <Breadcrumb path={activeFile.path} entries={sortedEntries} onNavigate={onSelect} />
              {renderEditor(activeFile)}
            </>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              {sortedEntries.length > 0
                ? 'Select a file to view'
                : (emptyState ?? 'No files found.')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FileExplorerCodeEditor({
  file,
  value,
  readOnly = true,
  onChange,
  lineWrapping,
}: {
  file: FileExplorerEntry
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
  lineWrapping?: boolean
}) {
  return (
    <CodeEditor
      key={file.path}
      value={value}
      filename={file.path}
      readOnly={readOnly}
      lineWrapping={lineWrapping}
      className="min-h-0 flex-1"
      onChange={onChange}
    />
  )
}
