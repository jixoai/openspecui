import { FileExplorer, FileExplorerCodeEditor } from '@/components/file-explorer'
import { useArchiveFilesSubscription, useChangeFilesSubscription } from '@/lib/use-subscription'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
    return [...files]
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

  return (
    <FileExplorer
      entries={sortedEntries}
      selectedPath={selectedPath}
      onSelect={setSelectedPath}
      emptyState={<span>No files found for this change.</span>}
      renderEditor={(activeFile) =>
        activeFile ? (
          <FileExplorerCodeEditor file={activeFile} value={activeFile.content ?? ''} readOnly />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            Select a file to view
          </div>
        )
      }
    />
  )
}
