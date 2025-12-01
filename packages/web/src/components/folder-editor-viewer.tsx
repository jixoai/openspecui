import { markdownPreview } from '@/lib/codemirror-markdown-preview'
import { useArchiveFilesSubscription, useChangeFilesSubscription } from '@/lib/use-subscription'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { languages } from '@codemirror/language-data'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { ChevronRight, File, FileText, Folder, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

/** 根据文件路径返回对应的 CodeMirror 语言扩展 */
function getLanguageExtension(path: string | null): Extension[] {
  if (!path) return []
  if (path.endsWith('.md'))
    return [markdown({ base: markdownLanguage, codeLanguages: languages }), markdownPreview()]
  if (path.endsWith('.ts') || path.endsWith('.tsx'))
    return [javascript({ typescript: true, jsx: path.endsWith('.tsx') })]
  if (path.endsWith('.js') || path.endsWith('.jsx'))
    return [javascript({ jsx: path.endsWith('.jsx') })]
  if (path.endsWith('.json')) return [json()]
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return [yaml()]
  return []
}

/**
 * 排序文件条目，确保子项紧跟在父目录后面
 * 规则：同一目录下，文件夹优先于文件，同类型按字母排序
 */
function compareEntries(
  a: { path: string; type: 'file' | 'directory' },
  b: { path: string; type: 'file' | 'directory' }
): number {
  const aParts = a.path.split('/')
  const bParts = b.path.split('/')

  // 逐级比较路径
  const minLen = Math.min(aParts.length, bParts.length)
  for (let i = 0; i < minLen; i++) {
    const aIsLast = i === aParts.length - 1
    const bIsLast = i === bParts.length - 1

    // 如果当前层级的名称不同
    if (aParts[i] !== bParts[i]) {
      // 如果都是最后一级，比较类型（文件夹优先）
      if (aIsLast && bIsLast) {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      }
      // 如果只有一个是最后一级，另一个还有子级（说明是文件夹）
      else if (aIsLast && !bIsLast) {
        // a 是当前级的项，b 还有子级（b 的当前级是文件夹）
        if (a.type === 'directory') {
          // 都是文件夹，按字母排序
          return aParts[i].localeCompare(bParts[i])
        }
        // a 是文件，b 是文件夹，文件夹优先
        return 1
      } else if (!aIsLast && bIsLast) {
        if (b.type === 'directory') {
          return aParts[i].localeCompare(bParts[i])
        }
        return -1
      }
      // 都不是最后一级，直接按字母排序
      return aParts[i].localeCompare(bParts[i])
    }

    // 名称相同，继续比较下一级
  }

  // 路径前缀相同，短的在前（父目录在子项之前）
  return aParts.length - bParts.length
}

/** 获取文件名（不含路径） */
function getFileName(path: string): string {
  return path.split('/').pop() ?? path
}

/** 获取父目录路径 */
function getParentPath(path: string): string {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
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
      grid-template-columns: 1fr 220px;
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

interface FileEntry {
  path: string
  type: 'file' | 'directory'
  content?: string | null
}

/** 面包屑路径导航 */
function Breadcrumb({
  path,
  entries,
  onNavigate,
}: {
  path: string
  entries: FileEntry[]
  onNavigate: (path: string) => void
}) {
  const parts = path.split('/')
  const isMarkdown = path.endsWith('.md')

  // 构建可点击的路径段
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
                  // 找到该目录下的第一个文件
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
  entries: FileEntry[]
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

/** 宽屏下的文件树列表 */
function FileTree({
  entries,
  selectedPath,
  onSelect,
}: {
  entries: FileEntry[]
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  // 计算每个条目相对于其父目录的缩进级别
  const getIndentLevel = (entry: FileEntry): number => {
    const parentPath = getParentPath(entry.path)
    if (!parentPath) return 0

    // 找到直接父目录
    const parentExists = entries.some((e) => e.type === 'directory' && e.path === parentPath)
    if (parentExists) {
      const parentEntry = entries.find((e) => e.path === parentPath)!
      return getIndentLevel(parentEntry) + 1
    }
    // 父目录不存在于列表中，计算路径深度
    return entry.path.split('/').length - 1
  }

  return (
    <div className="border-border bg-muted/30 flex h-full flex-col rounded-md border">
      <div className="border-border/50 text-muted-foreground border-b px-3 py-2 text-xs font-medium uppercase">
        Files
      </div>
      <div className="scrollbar-thin scrollbar-track-transparent flex-1 overflow-y-auto">
        {entries.map((entry) => {
          const depth = getIndentLevel(entry)
          const isActive = entry.path === selectedPath
          const isFile = entry.type === 'file'

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
            <button
              key={entry.path}
              disabled={!isFile}
              onClick={() => isFile && onSelect(entry.path)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-foreground'
                  : isFile
                    ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    : 'text-muted-foreground cursor-default'
              }`}
              style={{ paddingLeft: 12 + depth * 14 }}
            >
              {icon}
              <span className={`truncate ${!isFile ? 'text-foreground font-medium' : ''}`}>
                {getFileName(entry.path)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FolderEditorViewer({
  changeId,
  archived = false,
}: {
  changeId: string
  archived?: boolean
}) {
  const {
    data: files,
    isLoading,
    error,
  } = archived ? useArchiveFilesSubscription(changeId) : useChangeFilesSubscription(changeId)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const sortedEntries = useMemo(() => {
    if (!files) return []
    return [...files].sort(compareEntries)
  }, [files])

  useEffect(() => {
    if (!sortedEntries.length) {
      setSelectedPath(null)
      return
    }
    const current = sortedEntries.find(
      (entry) => entry.path === selectedPath && entry.type === 'file'
    )
    if (!current) {
      const firstFile = sortedEntries.find((entry) => entry.type === 'file')
      setSelectedPath(firstFile?.path ?? null)
    }
  }, [sortedEntries, selectedPath])

  const activeFile = useMemo(() => {
    if (!sortedEntries.length || !selectedPath) return null
    return (
      sortedEntries.find((entry) => entry.path === selectedPath && entry.type === 'file') ?? null
    )
  }, [sortedEntries, selectedPath])

  if (isLoading) {
    return (
      <div className="border-border bg-muted/20 flex h-[400px] items-center justify-center rounded-md border">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        Failed to load files: {error.message}
      </div>
    )
  }

  if (!sortedEntries.length) {
    return (
      <div className="bg-muted/20 text-muted-foreground rounded-md p-4 text-sm">
        No files found for this change.
      </div>
    )
  }

  return (
    <div className="@container-[size] h-full">
      <style>{layoutStyles}</style>
      <div className="fev-layout">
        {/* 窄屏：文件标签栏 */}
        <div className="fev-sidebar-tabs">
          <FileTabs
            entries={sortedEntries}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        </div>

        {/* 宽屏：文件树 */}
        <div className="fev-sidebar-tree">
          <FileTree
            entries={sortedEntries}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        </div>

        {/* 编辑器区域：面包屑 + CodeMirror */}
        <div className="fev-editor-wrapper border-border bg-background overflow-hidden rounded-md border shadow-sm">
          {activeFile ? (
            <>
              <Breadcrumb
                path={activeFile.path}
                entries={sortedEntries}
                onNavigate={setSelectedPath}
              />
              <CodeMirror
                className="scrollbar-thin scrollbar-track-transparent **:[.cm-line]:leading-6 min-h-0 flex-1 overflow-auto *:bg-sky-50"
                key={activeFile.path}
                value={activeFile.content ?? ''}
                readOnly
                editable={false}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  highlightActiveLine: false,
                }}
                extensions={[...getLanguageExtension(activeFile.path), EditorView.lineWrapping]}
                style={{ fontSize: 13, lineHeight: 21 }}
              />
            </>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
