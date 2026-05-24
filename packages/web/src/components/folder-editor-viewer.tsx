import { Button } from '@/components/button'
import { ButtonGroup } from '@/components/button-group'
import { Dialog } from '@/components/dialog'
import {
  FileExplorer,
  FileExplorerCodeEditor,
  type FileExplorerEntry,
} from '@/components/file-explorer'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Tooltip } from '@/components/tooltip'
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
  Eye,
  FilePenLine,
  Loader2,
  Minimize,
  RefreshCw,
  Save,
  ScrollText,
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
  if (!inStaticMode && isFileEntry(file) && file.previewKind === 'html') {
    return 'preview'
  }
  if (!inStaticMode && isPreviewOnlyFile(file)) {
    return 'preview'
  }
  return 'read'
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
  return preview.previewKind === 'html'
    ? preview.urlPath
    : appendPreviewTheme(preview.urlPath, isDarkMode)
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
      <div className={`h-full min-h-0 flex-1 overflow-hidden ${className}`}>
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
      className={`bg-background h-full min-h-0 overflow-hidden ${className}`}
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
  const [mode, setMode] = useState<FolderMode>('read')
  const [draftContent, setDraftContent] = useState<Record<string, string>>({})
  const [savingPath, setSavingPath] = useState<string | null>(null)
  const [previewByPath, setPreviewByPath] = useState<Record<string, PreparedFilePreview | null>>({})
  const [previewLoadingPath, setPreviewLoadingPath] = useState<string | null>(null)
  const [previewErrorByPath, setPreviewErrorByPath] = useState<Record<string, string | null>>({})
  const [previewMaximized, setPreviewMaximized] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<'shared' | 'copied' | null>(null)

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
      if (currentMode === 'read' && nextDefaultMode === 'preview') {
        return nextDefaultMode
      }
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
  const previewError = activeFile ? (previewErrorByPath[activeFile.path] ?? null) : null
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
    <section data-tab-scroll-root="true" className="min-h-0 flex-1 overflow-hidden">
      <div className="h-full min-h-0 pr-1">
        <div data-folder-viewport="" className="flex h-full min-h-0 flex-col overflow-hidden">
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
                  <div
                    data-folder-toolbar=""
                    className="border-border/60 bg-muted/20 flex flex-wrap items-center gap-3 border-b px-3 py-2"
                  >
                    <ButtonGroup<FolderMode>
                      value={mode}
                      onChange={setMode}
                      presentation="icon-only"
                      className="min-w-0"
                      options={[
                        {
                          value: 'read',
                          label: 'Read',
                          icon: <ScrollText className="h-3.5 w-3.5" />,
                          ariaLabel: 'Read',
                          tooltip: 'Read',
                          disabled: !readEnabled,
                        },
                        {
                          value: 'edit',
                          label: 'Edit',
                          icon: <FilePenLine className="h-3.5 w-3.5" />,
                          ariaLabel: 'Edit',
                          tooltip: 'Edit',
                          disabled: !editEnabled,
                        },
                        {
                          value: 'preview',
                          label: 'Preview',
                          icon: <Eye className="h-3.5 w-3.5" />,
                          ariaLabel: 'Preview',
                          tooltip: 'Preview',
                          disabled: !previewEnabled,
                        },
                      ]}
                    />
                    <div
                      data-folder-toolbar-actions=""
                      className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2"
                    >
                      {mode === 'edit' ? (
                        <>
                          <Tooltip content="Revert" delay={0}>
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label="Revert"
                              title="Revert"
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
                            </Button>
                          </Tooltip>
                          <Tooltip content="Save" delay={0}>
                            <Button
                              variant="primary"
                              size="icon-sm"
                              aria-label="Save"
                              title="Save"
                              disabled={!hasDirtyDraft || savingPath === currentFile.path}
                              onClick={saveActiveDraft}
                            >
                              {savingPath === currentFile.path ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </Tooltip>
                        </>
                      ) : mode === 'preview' && canPreviewRemote(activeFile) ? (
                        <>
                          <Tooltip content="Refresh" delay={0}>
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label="Refresh"
                              title="Refresh"
                              onClick={() => {
                                setPreviewByPath((current) => {
                                  const next = { ...current }
                                  delete next[currentFile.path]
                                  return next
                                })
                              }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </Tooltip>
                          <Tooltip
                            content={previewMaximized ? 'Exit maximize' : 'Maximize'}
                            delay={0}
                          >
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label={previewMaximized ? 'Exit maximize' : 'Maximize'}
                              title={previewMaximized ? 'Exit maximize' : 'Maximize'}
                              onClick={() => {
                                setPreviewMaximized((current) => !current)
                              }}
                            >
                              {previewMaximized ? (
                                <Minimize className="h-3.5 w-3.5" />
                              ) : (
                                <Expand className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </Tooltip>
                          <Tooltip content="Download" delay={0}>
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label="Download"
                              title="Download"
                              disabled={!previewDownloadUrl}
                              onClick={() => {
                                if (!previewDownloadUrl) return
                                triggerDownload(
                                  previewDownloadUrl,
                                  currentFile.path.split('/').pop() ?? 'preview'
                                )
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </Tooltip>
                          <Tooltip
                            content={
                              shareFeedback === 'shared'
                                ? 'Shared'
                                : shareFeedback === 'copied'
                                  ? 'Copied'
                                  : 'Share'
                            }
                            delay={0}
                          >
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label={
                                shareFeedback === 'shared'
                                  ? 'Shared'
                                  : shareFeedback === 'copied'
                                    ? 'Copied'
                                    : 'Share'
                              }
                              title={
                                shareFeedback === 'shared'
                                  ? 'Shared'
                                  : shareFeedback === 'copied'
                                    ? 'Copied'
                                    : 'Share'
                              }
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
                            </Button>
                          </Tooltip>
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
          <div className="flex h-[80vh] max-h-[88vh] min-h-[420px] min-w-0 flex-col overflow-hidden">
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
