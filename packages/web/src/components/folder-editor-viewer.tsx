import { Button } from '@/components/button'
import { ButtonGroup } from '@/components/button-group'
import { Dialog } from '@/components/dialog'
import {
  FileExplorer,
  FileExplorerCodeEditor,
  type FileExplorerEntry,
} from '@/components/file-explorer'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { useViewportConstrainedHeight } from '@/components/scroll-spy'
import {
  prepareEntityFilePreview,
  writeEntityFile,
  type PreparedFilePreview,
} from '@/lib/file-preview'
import { isStaticMode } from '@/lib/static-mode'
import { useDarkMode } from '@/lib/use-dark-mode'
import { useArchiveFilesSubscription, useChangeFilesSubscription } from '@/lib/use-subscription'
import type { ChangeFile } from '@openspecui/core'
import {
  Check,
  Download,
  Expand,
  Loader2,
  Minimize,
  RefreshCw,
  Save,
  Share2,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type FolderMode = 'read' | 'edit' | 'preview'

type FolderFileEntry = FileExplorerEntry &
  Partial<Pick<ChangeFile, 'mime' | 'previewKind' | 'size'>> & { type: 'file' }

function isFileEntry(
  file: FileExplorerEntry | ChangeFile | undefined | null
): file is FolderFileEntry {
  return file?.type === 'file'
}

function isTextLikeFile(
  file: FileExplorerEntry | ChangeFile | undefined | null
): file is FolderFileEntry & { content: string } {
  return isFileEntry(file) && file.content !== undefined && file.content !== null
}

function normalizeExplorerFile(file: FolderFileEntry) {
  return {
    ...file,
    content: file.content ?? undefined,
  }
}

function canPreviewInline(file: FileExplorerEntry | ChangeFile | undefined | null): boolean {
  return isFileEntry(file) && file.previewKind === 'markdown'
}

function canPreviewRemote(file: FileExplorerEntry | ChangeFile | undefined | null): boolean {
  return (
    isFileEntry(file) && ['html', 'image', 'audio', 'video', 'pdf'].includes(file.previewKind ?? '')
  )
}

function canPreviewFile(file: FileExplorerEntry | ChangeFile | undefined | null): boolean {
  return canPreviewInline(file) || canPreviewRemote(file)
}

function isPreviewOnlyFile(file: FileExplorerEntry | ChangeFile | undefined | null): boolean {
  return isFileEntry(file) && ['image', 'audio', 'video', 'pdf'].includes(file.previewKind ?? '')
}

function resolveDefaultMode(
  file: FileExplorerEntry | ChangeFile | undefined | null,
  inStaticMode: boolean
): FolderMode {
  if (!file) return 'read'
  if (!inStaticMode && isPreviewOnlyFile(file)) {
    return 'preview'
  }
  return 'read'
}

function clampPreviewHeight(viewportHeight: number | null): number {
  if (viewportHeight == null) return 480
  return Math.max(320, Math.min(viewportHeight - 112, 920))
}

function resolveRemotePreviewFrameStyle(frameHeight?: number) {
  if (frameHeight == null) return undefined
  return {
    minHeight: 'min(320px, 100%)',
    height: '100%',
    maxHeight: `${frameHeight}px`,
  }
}

function canSaveDraft(
  file: FolderFileEntry | null,
  hasDirtyDraft: boolean,
  savingPath: string | null
): file is FolderFileEntry & { content: string } {
  return !!file && hasDirtyDraft && savingPath !== file.path
}

function appendPreviewTheme(url: string, isDarkMode: boolean): string {
  const nextUrl = new URL(url, window.location.href)
  nextUrl.searchParams.set('theme', isDarkMode ? 'dark' : 'light')
  return nextUrl.toString()
}

function resolvePreviewFrameUrl(preview: PreparedFilePreview, isDarkMode: boolean): string {
  return preview.previewKind === 'html' ? preview.urlPath : appendPreviewTheme(preview.urlPath, isDarkMode)
}

function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noreferrer noopener'
  anchor.click()
}

async function sharePreview(input: { url: string; title: string }): Promise<boolean> {
  if (navigator.share) {
    await navigator.share({
      title: input.title,
      url: input.url,
    })
    return true
  }

  await navigator.clipboard.writeText(input.url)
  return false
}

function PreviewPane({
  file,
  preview,
  loading,
  error,
  className = '',
  frameHeight,
  isDarkMode,
}: {
  file: FolderFileEntry
  preview: PreparedFilePreview | null
  loading: boolean
  error: string | null
  className?: string
  frameHeight?: number
  isDarkMode: boolean
}) {
  if (file.previewKind === 'markdown') {
    return (
      <div className={`min-h-0 h-full flex-1 overflow-hidden ${className}`}>
        <MarkdownViewer markdown={file.content ?? ''} path={file.path} className="h-full" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing preview...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive flex h-full items-center justify-center px-4 text-sm">
        {error}
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-sm">
        Preview unavailable.
      </div>
    )
  }

  return (
    <div
      className={`bg-background min-h-0 h-full overflow-hidden ${className}`}
      style={resolveRemotePreviewFrameStyle(frameHeight)}
    >
      <iframe
        key={`${resolvePreviewFrameUrl(preview, isDarkMode)}:${isDarkMode ? 'dark' : 'light'}`}
        src={resolvePreviewFrameUrl(preview, isDarkMode)}
        title={`Preview ${file.path}`}
        className="block h-full w-full border-0"
      />
    </div>
  )
}

export function FolderEditorViewer({
  changeId,
  archived = false,
  files: providedFiles,
}: {
  changeId: string
  archived?: boolean
  files?: ChangeFile[]
}) {
  const inStaticMode = isStaticMode()
  const isDarkMode = useDarkMode()
  const {
    data: files,
    isLoading,
    error,
  } = archived ? useArchiveFilesSubscription(changeId) : useChangeFilesSubscription(changeId)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<FolderMode>('read')
  const [draftContent, setDraftContent] = useState<Record<string, string>>({})
  const [savingPath, setSavingPath] = useState<string | null>(null)
  const [previewByPath, setPreviewByPath] = useState<Record<string, PreparedFilePreview | null>>({})
  const [previewLoadingPath, setPreviewLoadingPath] = useState<string | null>(null)
  const [previewErrorByPath, setPreviewErrorByPath] = useState<Record<string, string | null>>({})
  const [previewMaximized, setPreviewMaximized] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<'shared' | 'copied' | null>(null)
  const viewportHeight = useViewportConstrainedHeight({
    target: viewportNode,
    enabled: viewportNode !== null,
  })

  const sortedEntries = useMemo(() => {
    if (providedFiles) return [...providedFiles]
    if (!files) return []
    return [...files]
  }, [files, providedFiles])

  const activeFile = useMemo(() => {
    if (!selectedPath) return null
    const entry = sortedEntries.find((item) => item.path === selectedPath)
    return isFileEntry(entry) ? entry : null
  }, [selectedPath, sortedEntries])

  const activeDraft = activeFile ? (draftContent[activeFile.path] ?? activeFile.content ?? '') : ''
  const editEnabled = !inStaticMode && isTextLikeFile(activeFile) && !isPreviewOnlyFile(activeFile)
  const readEnabled = !isPreviewOnlyFile(activeFile)
  const previewEnabled = !inStaticMode && canPreviewFile(activeFile)
  const hasDirtyDraft =
    !!activeFile && isTextLikeFile(activeFile) && activeDraft !== (activeFile.content ?? '')
  const remotePreviewHeight = clampPreviewHeight(viewportHeight)

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

  useEffect(() => {
    const nextDefaultMode = resolveDefaultMode(activeFile, inStaticMode)
    if (mode === 'edit' && !editEnabled) {
      setMode(nextDefaultMode)
      return
    }
    if (mode === 'preview' && !previewEnabled) {
      setMode(nextDefaultMode)
      return
    }
    if (mode === 'read' && !readEnabled) {
      setMode(nextDefaultMode)
    }
  }, [activeFile, editEnabled, inStaticMode, mode, previewEnabled, readEnabled])

  useEffect(() => {
    const nextDefaultMode = resolveDefaultMode(activeFile, inStaticMode)
    setMode((currentMode) => {
      if (currentMode === nextDefaultMode) return currentMode
      if (currentMode === 'edit' && editEnabled) return currentMode
      if (currentMode === 'preview' && previewEnabled) return currentMode
      if (currentMode === 'read' && readEnabled) return currentMode
      return nextDefaultMode
    })
  }, [activeFile?.path, editEnabled, inStaticMode, previewEnabled, readEnabled])

  useEffect(() => {
    if (!canPreviewRemote(activeFile) || mode !== 'preview') {
      setPreviewMaximized(false)
    }
  }, [activeFile, mode])

  useEffect(() => {
    if (shareFeedback === null) return
    const timer = window.setTimeout(() => {
      setShareFeedback(null)
    }, 1800)
    return () => {
      window.clearTimeout(timer)
    }
  }, [shareFeedback])

  useEffect(() => {
    if (!activeFile || mode !== 'preview' || !canPreviewRemote(activeFile)) {
      return
    }
    if (previewByPath[activeFile.path] !== undefined) {
      return
    }

    let cancelled = false
    setPreviewLoadingPath(activeFile.path)
    setPreviewErrorByPath((current) => ({ ...current, [activeFile.path]: null }))
    void prepareEntityFilePreview({
      changeId,
      archived,
      path: activeFile.path,
    })
      .then((preview) => {
        if (cancelled) return
        setPreviewByPath((current) => ({ ...current, [activeFile.path]: preview }))
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setPreviewErrorByPath((current) => ({
          ...current,
          [activeFile.path]: cause instanceof Error ? cause.message : String(cause),
        }))
        setPreviewByPath((current) => ({ ...current, [activeFile.path]: null }))
      })
      .finally(() => {
        if (cancelled) return
        setPreviewLoadingPath((current) => (current === activeFile.path ? null : current))
      })

    return () => {
      cancelled = true
    }
  }, [activeFile, archived, changeId, mode, previewByPath])

  if (!providedFiles && isLoading) {
    return (
      <div className="bg-muted/20 flex h-[400px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 text-sm">
        Failed to load files: {error.message}
      </div>
    )
  }

  const preview = activeFile ? (previewByPath[activeFile.path] ?? null) : null
  const previewError = activeFile ? previewErrorByPath[activeFile.path] ?? null : null
  const previewDownloadUrl =
    activeFile && preview
      ? activeFile.previewKind === 'html'
        ? preview.entryPathname
        : preview.resourcePathname
      : null
  const previewShareUrl =
    activeFile && preview && canPreviewRemote(activeFile)
      ? resolvePreviewFrameUrl(preview, isDarkMode)
      : null
  const saveActiveDraft = () => {
    if (!isTextLikeFile(activeFile)) return
    if (!canSaveDraft(activeFile, hasDirtyDraft, savingPath)) return
    setSavingPath(activeFile.path)
    void writeEntityFile({
      changeId,
      archived,
      path: activeFile.path,
      content: activeDraft,
    }).finally(() => {
      setSavingPath((current) => (current === activeFile.path ? null : current))
    })
  }

  return (
    <section
      data-tab-scroll-root="true"
      className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-auto"
    >
      <div className="pr-1">
        <div
          ref={setViewportNode}
          className="flex min-h-0 flex-col"
          style={viewportHeight != null ? { height: `${viewportHeight}px` } : undefined}
        >
          <FileExplorer
            entries={sortedEntries}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            emptyState={<span>No files found for this change.</span>}
            renderEditor={(currentFile) => {
              if (!isFileEntry(currentFile)) {
                return (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    Select a file to view
                  </div>
                )
              }

              return (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                    <ButtonGroup<FolderMode>
                      value={mode}
                      onChange={setMode}
                      options={[
                        { value: 'read', label: 'Read', disabled: !readEnabled },
                        { value: 'edit', label: 'Edit', disabled: !editEnabled },
                        { value: 'preview', label: 'Preview', disabled: !previewEnabled },
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      {mode === 'edit' ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!hasDirtyDraft}
                            onClick={() => {
                              if (!isTextLikeFile(activeFile)) return
                              setDraftContent((current) => ({
                                ...current,
                                [activeFile.path]: activeFile.content ?? '',
                              }))
                            }}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Revert
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={!hasDirtyDraft || savingPath === currentFile.path}
                            onClick={saveActiveDraft}
                          >
                            {savingPath === currentFile.path ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Save
                          </Button>
                        </>
                      ) : mode === 'preview' && canPreviewRemote(activeFile) ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setPreviewByPath((current) => {
                                const next = { ...current }
                                delete next[currentFile.path]
                                return next
                              })
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setPreviewMaximized((current) => !current)
                            }}
                          >
                            {previewMaximized ? (
                              <Minimize className="h-3.5 w-3.5" />
                            ) : (
                              <Expand className="h-3.5 w-3.5" />
                            )}
                            {previewMaximized ? 'Exit Maximize' : 'Maximize'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!previewDownloadUrl}
                            onClick={() => {
                              if (!previewDownloadUrl) return
                              triggerDownload(previewDownloadUrl, currentFile.path.split('/').pop() ?? 'preview')
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!previewShareUrl}
                            onClick={() => {
                              if (!previewShareUrl) return
                              void sharePreview({
                                url: previewShareUrl,
                                title: currentFile.path,
                              }).then((shared) => {
                                setShareFeedback(shared ? 'shared' : 'copied')
                              })
                            }}
                          >
                            {shareFeedback === 'shared' || shareFeedback === 'copied' ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                            {shareFeedback === 'shared'
                              ? 'Shared'
                              : shareFeedback === 'copied'
                                ? 'Copied'
                                : 'Share'}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {!readEnabled && !editEnabled && !previewEnabled ? (
                    <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center px-4 text-sm">
                      Preview for this file type is only available in live mode.
                    </div>
                  ) : mode === 'preview' ? (
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <PreviewPane
                        file={currentFile}
                        preview={preview}
                        loading={previewLoadingPath === currentFile.path}
                        error={previewError}
                        frameHeight={canPreviewRemote(currentFile) ? remotePreviewHeight : undefined}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  ) : (
                    <FileExplorerCodeEditor
                      file={normalizeExplorerFile(currentFile)}
                      value={mode === 'edit' ? activeDraft : (currentFile.content ?? '')}
                      readOnly={mode !== 'edit'}
                      editorMinHeight="0px"
                      onSaveShortcut={mode === 'edit' ? saveActiveDraft : undefined}
                      onChange={
                        mode === 'edit'
                          ? (value) => {
                              setDraftContent((current) => ({
                                ...current,
                                [currentFile.path]: value,
                              }))
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              )
            }}
          />
        </div>
      </div>
      {activeFile && canPreviewRemote(activeFile) && (
        <Dialog
          open={previewMaximized}
          title={<span className="text-sm font-medium">{activeFile.path}</span>}
          onClose={() => setPreviewMaximized(false)}
          className="max-w-6xl rounded-none border-0 shadow-none [--openspec-dialog-radius:0px]"
          bodyClassName="p-0"
          contentClassName="px-3 py-3"
          maxHeight="96vh"
        >
          <div className="flex h-[80vh] min-h-[420px] max-h-[88vh] min-w-0 flex-col overflow-hidden">
            <PreviewPane
              file={activeFile}
              preview={preview}
              loading={previewLoadingPath === activeFile.path}
              error={previewError}
              className="rounded-none"
              isDarkMode={isDarkMode}
            />
          </div>
        </Dialog>
      )}
    </section>
  )
}
