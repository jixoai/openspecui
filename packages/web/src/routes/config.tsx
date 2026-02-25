import { ButtonGroup } from '@/components/button-group'
import { CodeEditor } from '@/components/code-editor'
import {
  ContextMenu,
  ContextMenuTargeter,
  ContextMenuWrapper,
  type ContextMenuAnchor,
  type ContextMenuItem,
} from '@/components/context-menu'
import { Dialog } from '@/components/dialog'
import {
  FileExplorer,
  FileExplorerCodeEditor,
  type FileExplorerEntry,
} from '@/components/file-explorer'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import {
  useOpsxChangeListSubscription,
  useOpsxChangeMetadataSubscription,
  useOpsxConfigBundleSubscription,
  useOpsxProjectConfigSubscription,
  useOpsxSchemaFilesSubscription,
  useOpsxTemplateContentsSubscription,
  useOpsxTemplatesSubscription,
} from '@/lib/use-opsx'
import { toOpsxDisplayPath } from '@openspecui/core/opsx-display-path'
import { useMutation } from '@tanstack/react-query'
import {
  Edit2,
  EllipsisVertical,
  FilePlus,
  FileText,
  FolderPlus,
  GitBranch,
  Info,
  Layers,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parse as parseYaml } from 'yaml'

type ConfigTab = 'config' | 'changes' | `schema:${string}`
type SchemaMode = 'read' | 'preview' | 'edit'
type SchemaCreateMode = 'init' | 'fork'

const DEFAULT_CONFIG_TEMPLATE = `schema: spec-driven\n\ncontext: |\n  \n\nrules:\n  proposal:\n    - \n`

const PATH_KEYS = new Set(['generates', 'template', 'path', 'outputPath'])
const TAG_KEYS = new Set(['requires', 'tags'])
const KNOWN_ARTIFACT_KEYS = new Set([
  'id',
  'generates',
  'description',
  'template',
  'instruction',
  'requires',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeParseYaml(content: string): { data: Record<string, unknown> | null; error?: string } {
  if (!content) return { data: null }
  try {
    const parsed = parseYaml(content) as unknown
    if (!isRecord(parsed)) return { data: null }
    return { data: parsed }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) }
  }
}

function getParentPath(path: string): string | null {
  const parts = path.split('/')
  if (parts.length <= 1) return null
  parts.pop()
  const parent = parts.join('/')
  return parent.length > 0 ? parent : null
}

export function Config() {
  const isStatic = isStaticMode()
  const [activeTab, setActiveTab] = useState<ConfigTab>('config')
  const [schemaMode, setSchemaMode] = useState<SchemaMode>('read')
  const [schemaActionError, setSchemaActionError] = useState<string | null>(null)
  const [schemaEntryError, setSchemaEntryError] = useState<string | null>(null)
  const [isAddSchemaOpen, setIsAddSchemaOpen] = useState(false)
  const [isDeleteSchemaOpen, setIsDeleteSchemaOpen] = useState(false)
  const [isCreateEntryOpen, setIsCreateEntryOpen] = useState(false)
  const [isDeleteEntryOpen, setIsDeleteEntryOpen] = useState(false)
  const [isEntryInfoOpen, setIsEntryInfoOpen] = useState(false)
  const [createEntryType, setCreateEntryType] = useState<'file' | 'directory'>('file')
  const [createEntryParent, setCreateEntryParent] = useState<string | null>(null)
  const [createEntryName, setCreateEntryName] = useState('')
  const [activeEntry, setActiveEntry] = useState<FileExplorerEntry | null>(null)
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<ContextMenuAnchor | null>(null)
  const [fileMenuAnchor, setFileMenuAnchor] = useState<ContextMenuAnchor | null>(null)
  const [viewMenuAnchor, setViewMenuAnchor] = useState<ContextMenuAnchor | null>(null)
  const schemaMenuWrapperRef = useRef<HTMLDivElement | null>(null)
  const [schemaEditorWrap, setSchemaEditorWrap] = useState(true)
  const [newSchemaName, setNewSchemaName] = useState('')
  const [newSchemaMode, setNewSchemaMode] = useState<SchemaCreateMode>('init')
  const [newSchemaSource, setNewSchemaSource] = useState('spec-driven')

  const { data: configYaml, isLoading: configLoading } = useOpsxProjectConfigSubscription()
  const {
    data: configBundle,
    isLoading: schemasLoading,
    error: schemasError,
  } = useOpsxConfigBundleSubscription()
  const schemas = configBundle?.schemas
  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(undefined)

  const schemaDetail = selectedSchema ? (configBundle?.schemaDetails[selectedSchema] ?? null) : null
  const schemaResolution = selectedSchema
    ? (configBundle?.schemaResolutions[selectedSchema] ?? null)
    : null
  const { data: schemaFiles, error: schemaFilesError } =
    useOpsxSchemaFilesSubscription(selectedSchema)
  const { data: templates } = useOpsxTemplatesSubscription(selectedSchema)
  const { data: templateContents } = useOpsxTemplateContentsSubscription(selectedSchema)

  const { data: changeIds } = useOpsxChangeListSubscription()
  const [selectedChange, setSelectedChange] = useState<string | undefined>(undefined)
  const { data: changeMeta } = useOpsxChangeMetadataSubscription(selectedChange)

  const [isConfigEditing, setIsConfigEditing] = useState(false)
  const [configDraft, setConfigDraft] = useState('')
  const [configDirty, setConfigDirty] = useState(false)

  const [selectedSchemaPath, setSelectedSchemaPath] = useState<string | null>(null)
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({})
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({})

  const schemaCanEdit =
    !isStatic && schemaResolution?.source !== undefined && schemaResolution.source !== 'package'
  const canManageEntries = schemaCanEdit && !isStatic

  useEffect(() => {
    if (!schemas || schemas.length === 0) {
      setSelectedSchema(undefined)
      return
    }
    if (!selectedSchema || !schemas.some((schema) => schema.name === selectedSchema)) {
      setSelectedSchema(schemas[0].name)
    }
  }, [schemas, selectedSchema])

  useEffect(() => {
    if (!activeTab.startsWith('schema:')) return
    const name = activeTab.slice('schema:'.length)
    if (name && name !== selectedSchema) {
      setSelectedSchema(name)
    }
  }, [activeTab, selectedSchema])

  useEffect(() => {
    if (!schemas || schemas.length === 0) return
    if (!activeTab.startsWith('schema:')) return
    const name = activeTab.slice('schema:'.length)
    if (schemas.some((schema) => schema.name === name)) return
    const fallback = schemas[0]?.name
    setActiveTab(fallback ? `schema:${fallback}` : 'config')
  }, [activeTab, schemas])

  useEffect(() => {
    if (!selectedSchema) return
    if (activeTab.startsWith('schema:') && activeTab !== `schema:${selectedSchema}`) {
      setActiveTab(`schema:${selectedSchema}`)
    }
  }, [activeTab, selectedSchema])

  useEffect(() => {
    if (!selectedChange && changeIds && changeIds.length > 0) {
      setSelectedChange(changeIds[0])
    }
  }, [changeIds, selectedChange])

  useEffect(() => {
    if (isConfigEditing) return
    setConfigDraft(configYaml ?? '')
    setConfigDirty(false)
  }, [configYaml, isConfigEditing])

  useEffect(() => {
    if (schemaMode === 'edit' && !schemaCanEdit) {
      setSchemaMode('read')
    }
  }, [schemaCanEdit, schemaMode])

  useEffect(() => {
    setSchemaMode('read')
    setSelectedSchemaPath(null)
    setFileDrafts({})
    setDirtyFiles({})
    setSchemaEntryError(null)
    setActiveEntry(null)
    setHeaderMenuAnchor(null)
    setFileMenuAnchor(null)
    setViewMenuAnchor(null)
  }, [selectedSchema])

  useEffect(() => {
    if (!schemaFiles || schemaFiles.length === 0) {
      setSelectedSchemaPath(null)
      return
    }
    const fileEntries = schemaFiles.filter((entry) => entry.type === 'file')
    if (fileEntries.length === 0) {
      setSelectedSchemaPath(null)
      return
    }
    if (!selectedSchemaPath || !fileEntries.some((entry) => entry.path === selectedSchemaPath)) {
      const schemaFile = fileEntries.find((entry) => entry.path === 'schema.yaml')
      setSelectedSchemaPath(schemaFile?.path ?? fileEntries[0].path)
    }
  }, [schemaFiles, selectedSchemaPath])

  const schemaEntries = useMemo(() => (schemaFiles ?? []) as FileExplorerEntry[], [schemaFiles])

  const activeSchemaFile = useMemo(() => {
    if (!schemaEntries.length || !selectedSchemaPath) return null
    return (
      schemaEntries.find((entry) => entry.path === selectedSchemaPath && entry.type === 'file') ??
      null
    )
  }, [schemaEntries, selectedSchemaPath])

  const activeSchemaDraft = activeSchemaFile ? fileDrafts[activeSchemaFile.path] : undefined
  const activeSchemaDirty = activeSchemaFile ? !!dirtyFiles[activeSchemaFile.path] : false

  useEffect(() => {
    if (!activeSchemaFile) return
    if (dirtyFiles[activeSchemaFile.path]) return
    const nextValue = activeSchemaFile.content ?? ''
    setFileDrafts((prev) => {
      if (prev[activeSchemaFile.path] === nextValue) return prev
      return { ...prev, [activeSchemaFile.path]: nextValue }
    })
  }, [activeSchemaFile, dirtyFiles])

  const selectedSchemaInfo = useMemo(
    () => schemas?.find((schema) => schema.name === selectedSchema),
    [schemas, selectedSchema]
  )

  const schemaPreviewSource = useMemo(() => {
    const schemaPath = 'schema.yaml'
    const schemaEntry = schemaEntries.find((entry) => entry.path === schemaPath)
    const draft = fileDrafts[schemaPath]
    if (dirtyFiles[schemaPath] && draft !== undefined) return draft
    return schemaEntry?.content ?? ''
  }, [dirtyFiles, fileDrafts, schemaEntries])
  const schemaPreview = useMemo(() => safeParseYaml(schemaPreviewSource), [schemaPreviewSource])
  const rawSchema = schemaPreview.data
  const rawArtifacts = useMemo(() => {
    if (!rawSchema) return []
    const artifacts = rawSchema.artifacts
    return Array.isArray(artifacts) ? artifacts.filter(isRecord) : []
  }, [rawSchema])
  const rawArtifactMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    for (const artifact of rawArtifacts) {
      const id = typeof artifact.id === 'string' ? artifact.id : undefined
      if (id) {
        map.set(id, artifact)
      }
    }
    return map
  }, [rawArtifacts])

  const previewArtifacts = useMemo(() => {
    if (schemaDetail?.artifacts?.length) {
      return schemaDetail.artifacts
    }
    return rawArtifacts.map((artifact, index) => {
      const id = typeof artifact.id === 'string' ? artifact.id : `artifact-${index + 1}`
      const outputPath = typeof artifact.generates === 'string' ? artifact.generates : ''
      const description =
        typeof artifact.description === 'string' ? artifact.description : undefined
      const requires = Array.isArray(artifact.requires)
        ? artifact.requires.filter((value): value is string => typeof value === 'string')
        : []
      return { id, outputPath, description, requires }
    })
  }, [rawArtifacts, schemaDetail?.artifacts])

  const draftByPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const [path, isDirty] of Object.entries(dirtyFiles)) {
      if (!isDirty) continue
      const draft = fileDrafts[path]
      if (draft !== undefined) {
        map.set(path, draft)
      }
    }
    return map
  }, [dirtyFiles, fileDrafts])

  const hasDirtyDrafts = useMemo(() => Object.values(dirtyFiles).some(Boolean), [dirtyFiles])

  const activeEntryInfo = useMemo(() => {
    if (!activeEntry) return null
    const isFile = activeEntry.type === 'file'
    const encoder = new TextEncoder()
    const sizeBytes = isFile ? encoder.encode(activeEntry.content ?? '').length : undefined
    const isRoot = activeEntry.path === '/'
    const childCount =
      activeEntry.type === 'directory'
        ? isRoot
          ? schemaEntries.length
          : schemaEntries.filter((entry) => entry.path.startsWith(activeEntry.path + '/')).length
        : undefined
    return {
      path: isRoot
        ? (schemaResolution?.displayPath ?? schemaResolution?.path ?? '/')
        : activeEntry.path,
      type: activeEntry.type,
      source: schemaResolution?.source ?? 'unknown',
      sizeBytes,
      childCount,
    }
  }, [activeEntry, schemaEntries, schemaResolution])

  const schemaRootLabel = useMemo(() => {
    if (schemaResolution?.displayPath) return schemaResolution.displayPath
    if (schemaResolution?.path) {
      return toOpsxDisplayPath(schemaResolution.path, { source: schemaResolution.source })
    }
    return 'project:openspec/schemas'
  }, [schemaResolution])
  const schemaRootEntry = useMemo<FileExplorerEntry>(() => ({ path: '/', type: 'directory' }), [])

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      await trpcClient.opsx.writeProjectConfig.mutate({ content: configDraft })
    },
    onSuccess: () => {
      setIsConfigEditing(false)
      setConfigDirty(false)
    },
  })

  const saveSchemaFileMutation = useMutation({
    mutationFn: async (payload: { path: string; content: string }) => {
      if (!selectedSchema) return
      await trpcClient.opsx.writeSchemaFile.mutate({
        schema: selectedSchema,
        path: payload.path,
        content: payload.content,
      })
    },
    onSuccess: (_data, payload) => {
      setDirtyFiles((prev) => ({ ...prev, [payload.path]: false }))
      setSchemaEntryError(null)
    },
    onError: (error) => {
      setSchemaEntryError(error instanceof Error ? error.message : String(error))
    },
  })

  const createSchemaFileMutation = useMutation({
    mutationFn: async (payload: { path: string; content: string }) => {
      if (!selectedSchema) return
      await trpcClient.opsx.createSchemaFile.mutate({
        schema: selectedSchema,
        path: payload.path,
        content: payload.content,
      })
    },
    onSuccess: (_data, payload) => {
      setSchemaEntryError(null)
      setIsCreateEntryOpen(false)
      setCreateEntryName('')
      setSelectedSchemaPath(payload.path)
    },
    onError: (error) => {
      setSchemaEntryError(error instanceof Error ? error.message : String(error))
    },
  })

  const createSchemaDirectoryMutation = useMutation({
    mutationFn: async (payload: { path: string }) => {
      if (!selectedSchema) return
      await trpcClient.opsx.createSchemaDirectory.mutate({
        schema: selectedSchema,
        path: payload.path,
      })
    },
    onSuccess: () => {
      setSchemaEntryError(null)
      setIsCreateEntryOpen(false)
      setCreateEntryName('')
    },
    onError: (error) => {
      setSchemaEntryError(error instanceof Error ? error.message : String(error))
    },
  })

  const deleteSchemaEntryMutation = useMutation({
    mutationFn: async (payload: { path: string }) => {
      if (!selectedSchema) return
      await trpcClient.opsx.deleteSchemaEntry.mutate({
        schema: selectedSchema,
        path: payload.path,
      })
    },
    onSuccess: (_data, payload) => {
      setSchemaEntryError(null)
      setIsDeleteEntryOpen(false)
      setActiveEntry(null)
      setDirtyFiles((prev) => {
        const next = { ...prev }
        delete next[payload.path]
        return next
      })
      setFileDrafts((prev) => {
        const next = { ...prev }
        delete next[payload.path]
        return next
      })
    },
    onError: (error) => {
      setSchemaEntryError(error instanceof Error ? error.message : String(error))
    },
  })

  const createSchemaMutation = useMutation({
    mutationFn: async (args: string[]) => {
      return trpcClient.cli.execute.mutate({ args })
    },
    onSuccess: () => {
      setSchemaActionError(null)
    },
    onError: (error) => {
      setSchemaActionError(error instanceof Error ? error.message : String(error))
    },
  })

  const deleteSchemaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSchema) return
      await trpcClient.opsx.deleteSchema.mutate({ name: selectedSchema })
    },
    onSuccess: () => {
      setSchemaActionError(null)
    },
    onError: (error) => {
      setSchemaActionError(error instanceof Error ? error.message : String(error))
    },
  })

  const handleConfigEdit = useCallback(() => {
    setConfigDraft(configYaml ?? DEFAULT_CONFIG_TEMPLATE)
    setConfigDirty(!configYaml)
    setIsConfigEditing(true)
  }, [configYaml])

  const handleConfigCancel = useCallback(() => {
    setConfigDraft(configYaml ?? '')
    setConfigDirty(false)
    setIsConfigEditing(false)
  }, [configYaml])

  const handleSchemaModeChange = useCallback(
    (mode: SchemaMode) => {
      if (mode === 'edit' && !schemaCanEdit) return
      setSchemaMode(mode)
    },
    [schemaCanEdit]
  )

  const handleFileChange = useCallback(
    (value: string) => {
      if (!activeSchemaFile) return
      setFileDrafts((prev) => ({ ...prev, [activeSchemaFile.path]: value }))
      setDirtyFiles((prev) => ({ ...prev, [activeSchemaFile.path]: true }))
    },
    [activeSchemaFile]
  )

  const handleFileCancel = useCallback(() => {
    if (!activeSchemaFile) return
    setFileDrafts((prev) => ({
      ...prev,
      [activeSchemaFile.path]: activeSchemaFile.content ?? '',
    }))
    setDirtyFiles((prev) => ({ ...prev, [activeSchemaFile.path]: false }))
  }, [activeSchemaFile])

  const handleFileSave = useCallback(() => {
    if (!activeSchemaFile) return
    const content = activeSchemaDraft ?? activeSchemaFile.content ?? ''
    saveSchemaFileMutation.mutate({ path: activeSchemaFile.path, content })
  }, [activeSchemaDraft, activeSchemaFile, saveSchemaFileMutation])

  const normalizeEntryPath = useCallback((parent: string | null, name: string) => {
    const trimmed = name.trim().replace(/^\/+/, '')
    const base = parent ? parent.replace(/\/+$/, '') : ''
    return base ? `${base}/${trimmed}` : trimmed
  }, [])

  const handleOpenCreateEntry = useCallback(
    (type: 'file' | 'directory', parent: string | null) => {
      if (!schemaCanEdit || isStatic) return
      setSchemaEntryError(null)
      setCreateEntryType(type)
      setCreateEntryParent(parent)
      setCreateEntryName('')
      setIsCreateEntryOpen(true)
    },
    [isStatic, schemaCanEdit]
  )

  const handleConfirmCreateEntry = useCallback(() => {
    const trimmed = createEntryName.trim()
    if (!trimmed) {
      setSchemaEntryError('Name is required.')
      return
    }
    if (trimmed.includes('..')) {
      setSchemaEntryError('Name cannot include "..".')
      return
    }
    const path = normalizeEntryPath(createEntryParent, trimmed)
    if (!path) {
      setSchemaEntryError('Invalid path.')
      return
    }
    if (createEntryType === 'file') {
      createSchemaFileMutation.mutate({ path, content: '' })
      return
    }
    createSchemaDirectoryMutation.mutate({ path })
  }, [
    createEntryName,
    createEntryParent,
    createEntryType,
    createSchemaDirectoryMutation,
    createSchemaFileMutation,
    normalizeEntryPath,
  ])

  const handleOpenDeleteEntry = useCallback((entry: FileExplorerEntry) => {
    setSchemaEntryError(null)
    setActiveEntry(entry)
    setIsDeleteEntryOpen(true)
  }, [])

  const handleConfirmDeleteEntry = useCallback(() => {
    if (!activeEntry) return
    deleteSchemaEntryMutation.mutate({ path: activeEntry.path })
  }, [activeEntry, deleteSchemaEntryMutation])

  const handleOpenEntryInfo = useCallback((entry: FileExplorerEntry) => {
    setActiveEntry(entry)
    setIsEntryInfoOpen(true)
  }, [])

  const headerMenuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = []
    if (canManageEntries) {
      items.push(
        {
          id: 'new-file-root',
          label: 'New file',
          icon: <FilePlus className="h-3.5 w-3.5" />,
          onSelect: () => handleOpenCreateEntry('file', null),
        },
        {
          id: 'new-folder-root',
          label: 'New folder',
          icon: <FolderPlus className="h-3.5 w-3.5" />,
          onSelect: () => handleOpenCreateEntry('directory', null),
        }
      )
    }
    items.push({
      id: 'root-properties',
      label: 'Properties',
      icon: <Info className="h-3.5 w-3.5" />,
      onSelect: () => handleOpenEntryInfo(schemaRootEntry),
    })
    return items
  }, [canManageEntries, handleOpenCreateEntry, handleOpenEntryInfo, schemaRootEntry])

  const fileMenuItems = useMemo<ContextMenuItem[]>(() => {
    return [
      {
        id: 'file-save',
        label: 'Save',
        icon: <Save className="h-3.5 w-3.5" />,
        disabled: !schemaCanEdit || !activeSchemaDirty,
        onSelect: () => handleFileSave(),
      },
      {
        id: 'file-revert',
        label: 'Revert',
        icon: <X className="h-3.5 w-3.5" />,
        disabled: !schemaCanEdit || !activeSchemaDirty,
        onSelect: () => handleFileCancel(),
      },
    ]
  }, [activeSchemaDirty, handleFileCancel, handleFileSave, schemaCanEdit])

  const viewMenuItems = useMemo<ContextMenuItem[]>(() => {
    return [
      {
        id: 'view-wrap',
        label: schemaEditorWrap ? 'Disable line wrap' : 'Enable line wrap',
        onSelect: () => setSchemaEditorWrap((prev) => !prev),
      },
    ]
  }, [schemaEditorWrap])

  const handleAddSchema = useCallback(() => {
    if (isStatic) return
    setSchemaActionError(null)
    setNewSchemaName('')
    setNewSchemaMode('init')
    setNewSchemaSource(selectedSchema ?? 'spec-driven')
    setIsAddSchemaOpen(true)
  }, [isStatic, selectedSchema])

  const handleDeleteSchema = useCallback(() => {
    if (!selectedSchema || !schemaCanEdit) return
    setSchemaActionError(null)
    setIsDeleteSchemaOpen(true)
  }, [schemaCanEdit, selectedSchema])

  const handleConfirmAddSchema = useCallback(() => {
    const normalizedName = newSchemaName.trim()
    if (!normalizedName) {
      setSchemaActionError('Schema name is required.')
      return
    }
    const args: string[] =
      newSchemaMode === 'fork'
        ? ['schema', 'fork', newSchemaSource.trim() || 'spec-driven', normalizedName]
        : ['schema', 'init', normalizedName]
    createSchemaMutation.mutate(args, {
      onSuccess: () => {
        setIsAddSchemaOpen(false)
        setSelectedSchema(normalizedName)
        setActiveTab(`schema:${normalizedName}`)
      },
    })
  }, [createSchemaMutation, newSchemaMode, newSchemaName, newSchemaSource])

  const handleConfirmDeleteSchema = useCallback(() => {
    deleteSchemaMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleteSchemaOpen(false)
      },
    })
  }, [deleteSchemaMutation])

  const renderFieldValue = useCallback((key: string, value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">—</span>
      }
      const stringItems = value.filter((item): item is string => typeof item === 'string')
      if (TAG_KEYS.has(key) && stringItems.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            {stringItems.map((item) => (
              <span key={item} className="bg-muted rounded px-2 py-0.5 text-[10px]">
                {item}
              </span>
            ))}
          </div>
        )
      }
      if (stringItems.length === value.length) {
        return (
          <div className="flex flex-wrap gap-1">
            {stringItems.map((item) => (
              <span key={item} className="bg-muted rounded px-2 py-0.5 text-[10px]">
                {item}
              </span>
            ))}
          </div>
        )
      }
      return (
        <CodeEditor value={JSON.stringify(value, null, 2)} readOnly language="json" lineWrapping />
      )
    }
    if (isRecord(value)) {
      return (
        <CodeEditor value={JSON.stringify(value, null, 2)} readOnly language="json" lineWrapping />
      )
    }
    if (typeof value === 'string') {
      if (key === 'instruction') {
        return (
          <div className="bg-muted/30 rounded-lg p-4 [zoom:0.92]">
            <MarkdownViewer markdown={value} collectToc={false} />
          </div>
        )
      }
      if (value.includes('\n')) {
        return <CodeEditor value={value} readOnly filename={`${key}.md`} lineWrapping />
      }
      if (
        PATH_KEYS.has(key) ||
        value.includes('/') ||
        value.endsWith('.md') ||
        value.endsWith('.yaml')
      ) {
        return <code className="bg-muted rounded px-1">{value}</code>
      }
      return <span>{value}</span>
    }
    return <span>{String(value)}</span>
  }, [])

  const schemaTabContent = (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonGroup<SchemaMode>
          value={schemaMode}
          onChange={handleSchemaModeChange}
          options={[
            { value: 'read', label: 'Read' },
            { value: 'preview', label: 'Preview' },
            { value: 'edit', label: 'Edit', disabled: !schemaCanEdit },
          ]}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddSchema}
            disabled={isStatic || createSchemaMutation.isPending}
            className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={handleDeleteSchema}
            disabled={!schemaCanEdit || deleteSchemaMutation.isPending}
            className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {schemaActionError && <div className="text-destructive text-xs">{schemaActionError}</div>}
      {schemaEntryError && <div className="text-destructive text-xs">{schemaEntryError}</div>}
      {schemasError && (
        <div className="text-destructive text-sm">
          Failed to load schemas: {schemasError.message}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {schemasLoading && (!schemas || schemas.length === 0) && (
          <div className="text-muted-foreground mb-3 text-sm">Loading schemas…</div>
        )}
        {schemas && schemas.length === 0 && (
          <div className="text-muted-foreground mb-3 text-sm">No schemas available.</div>
        )}
        {selectedSchemaInfo ? (
          schemaMode === 'preview' ? (
            <MarkdownViewer
              className="min-h-0 flex-1"
              markdown={({ H1, H2, H3, Section }) => {
                const anchorBase = `schema-${selectedSchemaInfo.name}`
                const schemaAnchor = (suffix: string) => `${anchorBase}-${suffix}`

                return (
                  <div className="space-y-6">
                    <Section>
                      <H1 id={anchorBase}>{selectedSchemaInfo.name}</H1>
                      {selectedSchemaInfo.description && (
                        <p className="text-muted-foreground">{selectedSchemaInfo.description}</p>
                      )}
                    </Section>

                    {schemaResolution && (
                      <Section>
                        <H2 id={schemaAnchor('resolution')}>Resolution</H2>
                        <div className="text-muted-foreground mt-2 space-y-1 pl-4 text-sm">
                          <div>Source: {schemaResolution.source}</div>
                          <div className="truncate">
                            Path: {schemaResolution.displayPath ?? schemaResolution.path}
                          </div>
                          {schemaResolution.shadows.length > 0 && (
                            <div>
                              Shadows:{' '}
                              {schemaResolution.shadows
                                .map((s) => `${s.source}(${s.displayPath ?? s.path})`)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </Section>
                    )}

                    {schemaPreview.error && (
                      <Section>
                        <H2 id={schemaAnchor('schema-errors')}>Schema errors</H2>
                        <div className="border-destructive/40 bg-destructive/10 text-destructive mt-2 rounded-md border px-3 py-2 text-sm">
                          schema.yaml parse error: {schemaPreview.error}
                        </div>
                      </Section>
                    )}

                    <Section>
                      <H2 id={schemaAnchor('artifacts')}>Artifacts</H2>
                      {previewArtifacts.length > 0 ? (
                        <div className="mt-3 space-y-6">
                          {previewArtifacts.map((artifact) => {
                            const rawArtifact = rawArtifactMap.get(artifact.id)
                            const templateInfo =
                              templateContents?.[artifact.id] ??
                              (templates?.[artifact.id]
                                ? { ...templates[artifact.id], content: null }
                                : null)
                            const templatePath =
                              templateInfo?.path ??
                              (typeof rawArtifact?.template === 'string'
                                ? rawArtifact.template
                                : undefined)
                            const templateDisplayPath =
                              templateInfo?.displayPath ?? templatePath ?? null
                            const draftTemplateContent =
                              templatePath !== undefined ? draftByPath.get(templatePath) : undefined
                            const templateBody =
                              draftTemplateContent !== undefined
                                ? draftTemplateContent
                                : templateInfo
                                  ? templateInfo.content
                                  : null
                            const rawKnownFields = [
                              ['id', rawArtifact?.id ?? artifact.id],
                              ['generates', rawArtifact?.generates ?? artifact.outputPath],
                              ['description', rawArtifact?.description ?? artifact.description],
                              ['instruction', rawArtifact?.instruction],
                              ['requires', rawArtifact?.requires ?? artifact.requires],
                            ] as Array<[string, unknown]>
                            const knownFields = rawKnownFields.filter(
                              (entry): entry is [string, unknown] => entry[1] !== undefined
                            )
                            const unknownEntries = rawArtifact
                              ? (Object.entries(rawArtifact) as [string, unknown][]).filter(
                                  ([key]) => !KNOWN_ARTIFACT_KEYS.has(key)
                                )
                              : []

                            return (
                              <Section key={artifact.id} className="space-y-3">
                                <H3 id={schemaAnchor(`artifact-${artifact.id}`)}>{artifact.id}</H3>
                                <div className="border-border space-y-4 rounded-lg border px-4 py-4 text-sm">
                                  <div className="space-y-3">
                                    {knownFields.map(([key, value]) => {
                                      const isRequires = key === 'requires'
                                      const requires = isRequires
                                        ? Array.isArray(value)
                                          ? value.filter(
                                              (item): item is string => typeof item === 'string'
                                            )
                                          : []
                                        : []

                                      return (
                                        <div key={key} className="space-y-2">
                                          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                            {key}
                                          </div>
                                          <div className="pl-4 text-sm leading-6">
                                            {isRequires ? (
                                              requires.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                  {requires.map((requiredArtifactId) => {
                                                    const exists = previewArtifacts.some(
                                                      (candidate) =>
                                                        candidate.id === requiredArtifactId
                                                    )
                                                    if (!exists) {
                                                      return (
                                                        <span
                                                          key={requiredArtifactId}
                                                          className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs"
                                                        >
                                                          {requiredArtifactId}
                                                        </span>
                                                      )
                                                    }

                                                    const targetAnchor = schemaAnchor(
                                                      `artifact-${requiredArtifactId}`
                                                    )
                                                    return (
                                                      <a
                                                        key={requiredArtifactId}
                                                        href={`#${targetAnchor}`}
                                                        className="bg-primary hover:bg-primary/80 text-primary-foreground rounded-md px-2 py-0.5 text-xs transition-colors"
                                                      >
                                                        {requiredArtifactId}
                                                      </a>
                                                    )
                                                  })}
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">—</span>
                                              )
                                            ) : (
                                              renderFieldValue(key, value)
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {templatePath && (
                                    <div className="space-y-2">
                                      <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                        Template
                                      </div>
                                      <div className="text-muted-foreground pl-4 text-xs">
                                        <span className="mr-1">Template:</span>
                                        <code className="bg-muted rounded px-1">
                                          {templateDisplayPath}
                                        </code>
                                        {templateInfo?.source ? ` (${templateInfo.source})` : null}
                                      </div>
                                      {templateBody !== null && templateBody !== undefined ? (
                                        <div className="pl-4">
                                          <div className="bg-muted/30 rounded-lg p-4 [zoom:0.86]">
                                            <MarkdownViewer
                                              markdown={templateBody}
                                              collectToc={false}
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-muted-foreground pl-4 text-sm">
                                          Template content unavailable.
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {unknownEntries.length > 0 && (
                                    <div className="space-y-3">
                                      <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                        Extra fields
                                      </div>
                                      {unknownEntries.map(([key, value]) => (
                                        <div key={key} className="space-y-2">
                                          <div className="text-muted-foreground text-xs">{key}</div>
                                          <div className="pl-4 text-sm leading-6">
                                            {renderFieldValue(key, value)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </Section>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm">
                          Select a schema to view details.
                        </div>
                      )}
                      {schemaDetail?.applyRequires?.length ? (
                        <div className="text-muted-foreground mt-3 text-xs">
                          Apply requires: {schemaDetail.applyRequires.join(', ')}
                        </div>
                      ) : null}
                    </Section>

                    {hasDirtyDrafts && (
                      <div className="text-muted-foreground text-xs">
                        Preview is rendering draft content. Save to persist changes.
                      </div>
                    )}
                  </div>
                )
              }}
            />
          ) : (
            <ContextMenuWrapper ref={schemaMenuWrapperRef} className="h-full space-y-4">
              {schemaFilesError && (
                <div className="text-destructive text-xs">
                  Failed to load schema files: {schemaFilesError.message}
                </div>
              )}
              <FileExplorer
                entries={schemaEntries}
                selectedPath={selectedSchemaPath}
                onSelect={setSelectedSchemaPath}
                breadcrumbRoot={schemaRootLabel}
                headerLabel={
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="uppercase tracking-wide">Files</span>
                    <span
                      className="text-muted-foreground/80 truncate text-[10px] normal-case"
                      title={schemaRootLabel}
                    >
                      {schemaRootLabel}
                    </span>
                  </span>
                }
                headerActions={
                  headerMenuItems.length > 0 ? (
                    <ContextMenuTargeter>
                      <button
                        type="button"
                        onClick={(event) => {
                          setFileMenuAnchor(null)
                          setViewMenuAnchor(null)
                          setHeaderMenuAnchor({
                            type: 'target',
                            element: event.currentTarget,
                            placement: 'bottom-end',
                          })
                        }}
                        className="hover:bg-muted rounded-md p-1"
                        aria-label="Schema menu"
                      >
                        <EllipsisVertical className="h-4 w-4" />
                      </button>
                    </ContextMenuTargeter>
                  ) : undefined
                }
                entryActions={(entry) => {
                  const propertiesAction = {
                    id: 'properties',
                    label: 'Properties',
                    icon: <Info className="h-3.5 w-3.5" />,
                    onSelect: () => handleOpenEntryInfo(entry),
                  }

                  if (schemaMode !== 'edit' || !canManageEntries) {
                    return [propertiesAction]
                  }

                  const parent = entry.type === 'directory' ? entry.path : getParentPath(entry.path)
                  const isDirectory = entry.type === 'directory'
                  return [
                    {
                      id: 'new-file',
                      label: isDirectory ? 'New file inside' : 'New sibling file',
                      icon: <FilePlus className="h-3.5 w-3.5" />,
                      onSelect: () => handleOpenCreateEntry('file', parent),
                    },
                    {
                      id: 'new-folder',
                      label: isDirectory ? 'New folder inside' : 'New sibling folder',
                      icon: <FolderPlus className="h-3.5 w-3.5" />,
                      onSelect: () => handleOpenCreateEntry('directory', parent),
                    },
                    propertiesAction,
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: <Trash2 className="h-3.5 w-3.5" />,
                      tone: 'destructive',
                      onSelect: () => handleOpenDeleteEntry(entry),
                    },
                  ]
                }}
                emptyState={<span>No files found for this schema.</span>}
                renderEditor={(activeFile) =>
                  activeFile ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                      {schemaMode === 'edit' && (
                        <div className="border-border/50 flex items-center justify-between border-b px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <ContextMenuTargeter>
                              <button
                                type="button"
                                onClick={(event) => {
                                  setHeaderMenuAnchor(null)
                                  setViewMenuAnchor(null)
                                  setFileMenuAnchor({
                                    type: 'target',
                                    element: event.currentTarget,
                                    placement: 'bottom-start',
                                  })
                                }}
                                className="hover:bg-muted rounded-md px-2 py-1 text-xs font-semibold"
                              >
                                File
                              </button>
                            </ContextMenuTargeter>
                            <ContextMenuTargeter>
                              <button
                                type="button"
                                onClick={(event) => {
                                  setHeaderMenuAnchor(null)
                                  setFileMenuAnchor(null)
                                  setViewMenuAnchor({
                                    type: 'target',
                                    element: event.currentTarget,
                                    placement: 'bottom-start',
                                  })
                                }}
                                className="hover:bg-muted rounded-md px-2 py-1 text-xs font-semibold"
                              >
                                View
                              </button>
                            </ContextMenuTargeter>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleFileCancel}
                              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleFileSave}
                              disabled={
                                !activeSchemaDirty ||
                                saveSchemaFileMutation.isPending ||
                                !schemaCanEdit
                              }
                              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {saveSchemaFileMutation.isPending ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                      <FileExplorerCodeEditor
                        file={activeFile}
                        value={
                          schemaMode === 'edit'
                            ? (activeSchemaDraft ?? activeFile.content ?? '')
                            : (activeFile.content ?? '')
                        }
                        readOnly={schemaMode !== 'edit' || !schemaCanEdit}
                        onChange={schemaMode === 'edit' ? handleFileChange : undefined}
                        lineWrapping={schemaEditorWrap}
                      />
                      {schemaResolution?.source === 'package' && (
                        <div className="text-muted-foreground border-border/50 border-t px-3 py-2 text-xs">
                          Package-provided schemas are read-only.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      Select a file to view
                    </div>
                  )
                }
              />
              <ContextMenu
                open={!!headerMenuAnchor}
                items={headerMenuItems}
                anchor={headerMenuAnchor}
                boundaryElement={schemaMenuWrapperRef.current}
                onClose={() => setHeaderMenuAnchor(null)}
              />
              <ContextMenu
                open={!!fileMenuAnchor}
                items={fileMenuItems}
                anchor={fileMenuAnchor}
                boundaryElement={schemaMenuWrapperRef.current}
                onClose={() => setFileMenuAnchor(null)}
              />
              <ContextMenu
                open={!!viewMenuAnchor}
                items={viewMenuItems}
                anchor={viewMenuAnchor}
                boundaryElement={schemaMenuWrapperRef.current}
                onClose={() => setViewMenuAnchor(null)}
              />
            </ContextMenuWrapper>
          )
        ) : (
          <div className="text-muted-foreground text-sm">Select a schema to view details.</div>
        )}
      </div>
    </section>
  )

  const schemaTabs: Tab[] = (schemas ?? []).map((schema) => ({
    id: `schema:${schema.name}`,
    label: `Schema(${schema.name})`,
    icon: <Layers className="h-4 w-4" />,
    content: schemaTabContent,
  }))

  const tabs: Tab[] = [
    {
      id: 'config',
      label: 'Config',
      icon: <FileText className="h-4 w-4" />,
      content: (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">OpenSpec Config</h2>
            {!isStatic && configYaml && !isConfigEditing && (
              <button
                type="button"
                onClick={handleConfigEdit}
                className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {isConfigEditing && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfigCancel}
                  className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveConfigMutation.mutate()}
                  disabled={!configDirty || saveConfigMutation.isPending}
                  className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveConfigMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {configYaml || isConfigEditing ? (
            <CodeEditor
              value={configDraft}
              onChange={(value) => {
                setConfigDraft(value)
                setConfigDirty(true)
              }}
              readOnly={!isConfigEditing}
              filename="config.yaml"
            />
          ) : configLoading ? (
            <div className="route-loading animate-pulse">Loading config…</div>
          ) : (
            <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              <p className="mb-3">openspec/config.yaml not found.</p>
              {!isStatic && (
                <button
                  type="button"
                  onClick={handleConfigEdit}
                  className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium"
                >
                  Create config.yaml
                </button>
              )}
            </div>
          )}
        </section>
      ),
    },
    ...schemaTabs,
    {
      id: 'changes',
      label: 'Changes',
      icon: <GitBranch className="h-4 w-4" />,
      content: (
        <section className="space-y-4">
          <div className="text-muted-foreground text-sm">
            Change metadata is stored in{' '}
            <code className="bg-muted rounded px-1">.openspec.yaml</code> inside each change folder.
            It is created when a change is scaffolded (recommended start workflow:{' '}
            <code className="bg-muted rounded px-1">/opsx:propose</code>; advanced form:{' '}
            <code className="bg-muted rounded px-1">/opsx:new</code>) and binds schema selection for
            the change.
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Change Metadata</h2>
            {changeIds && changeIds.length > 0 && (
              <select
                value={selectedChange}
                onChange={(e) => setSelectedChange(e.target.value)}
                className="border-border bg-card rounded-md border px-2 py-1 text-xs"
              >
                {changeIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedChange && changeMeta ? (
            <CodeEditor value={changeMeta} readOnly filename=".openspec.yaml" />
          ) : (
            <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              {selectedChange
                ? 'No metadata file found for this change. It should live at openspec/changes/<change>/.openspec.yaml.'
                : 'No changes available.'}
            </div>
          )}
        </section>
      ),
    },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <Dialog
        open={isAddSchemaOpen}
        onClose={() => setIsAddSchemaOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="text-sm font-semibold">Add schema</span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddSchemaOpen(false)}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAddSchema}
              disabled={!newSchemaName.trim() || createSchemaMutation.isPending}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {createSchemaMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <label className="space-y-1">
            <div className="text-xs font-medium">Schema name</div>
            <input
              value={newSchemaName}
              onChange={(event) => {
                setNewSchemaName(event.target.value)
                setSchemaActionError(null)
              }}
              placeholder="schema-name"
              className="border-border bg-card w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-2">
            <div className="text-xs font-medium">Create mode</div>
            <ButtonGroup<SchemaCreateMode>
              value={newSchemaMode}
              onChange={setNewSchemaMode}
              options={[
                { value: 'init', label: 'Init' },
                { value: 'fork', label: 'Fork' },
              ]}
            />
          </div>

          {newSchemaMode === 'fork' && (
            <label className="space-y-1">
              <div className="text-xs font-medium">Fork from</div>
              <select
                value={newSchemaSource}
                onChange={(event) => setNewSchemaSource(event.target.value)}
                className="border-border bg-card w-full rounded-md border px-3 py-2 text-sm"
              >
                {schemas?.map((schema) => (
                  <option key={schema.name} value={schema.name}>
                    {schema.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {schemaActionError && <div className="text-destructive text-xs">{schemaActionError}</div>}
        </div>
      </Dialog>

      <Dialog
        open={isDeleteSchemaOpen}
        onClose={() => setIsDeleteSchemaOpen(false)}
        borderVariant="error"
        title={
          <div className="flex items-center gap-2">
            <Trash2 className="text-destructive h-4 w-4" />
            <span className="text-sm font-semibold">Delete schema</span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDeleteSchemaOpen(false)}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteSchema}
              disabled={deleteSchemaMutation.isPending}
              className="bg-destructive text-destructive-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteSchemaMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>
            This will permanently delete{' '}
            <code className="bg-muted rounded px-1">{selectedSchema}</code> and all of its template
            files.
          </p>
          <p className="text-muted-foreground text-xs">This action cannot be undone.</p>
          {schemaActionError && <div className="text-destructive text-xs">{schemaActionError}</div>}
        </div>
      </Dialog>

      <Dialog
        open={isCreateEntryOpen}
        onClose={() => {
          setIsCreateEntryOpen(false)
          setSchemaEntryError(null)
        }}
        title={
          <div className="flex items-center gap-2">
            {createEntryType === 'file' ? (
              <FilePlus className="h-4 w-4" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">
              {createEntryType === 'file' ? 'New file' : 'New folder'}
            </span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateEntryOpen(false)}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmCreateEntry}
              disabled={
                !createEntryName.trim() ||
                createSchemaFileMutation.isPending ||
                createSchemaDirectoryMutation.isPending
              }
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createEntryType === 'file' ? (
                <FilePlus className="h-3.5 w-3.5" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5" />
              )}
              {createSchemaFileMutation.isPending || createSchemaDirectoryMutation.isPending
                ? 'Creating…'
                : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="text-muted-foreground text-xs">
            Parent: <code className="bg-muted rounded px-1">{createEntryParent ?? '/'}</code>
          </div>
          <label className="space-y-1">
            <div className="text-xs font-medium">
              {createEntryType === 'file' ? 'File name' : 'Folder name'}
            </div>
            <input
              value={createEntryName}
              onChange={(event) => {
                setCreateEntryName(event.target.value)
                setSchemaEntryError(null)
              }}
              placeholder={createEntryType === 'file' ? 'new-file.md' : 'new-folder'}
              className="border-border bg-card w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          {schemaEntryError && <div className="text-destructive text-xs">{schemaEntryError}</div>}
        </div>
      </Dialog>

      <Dialog
        open={isDeleteEntryOpen}
        onClose={() => {
          setIsDeleteEntryOpen(false)
          setActiveEntry(null)
        }}
        borderVariant="error"
        title={
          <div className="flex items-center gap-2">
            <Trash2 className="text-destructive h-4 w-4" />
            <span className="text-sm font-semibold">Delete entry</span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDeleteEntryOpen(false)}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteEntry}
              disabled={!activeEntry || deleteSchemaEntryMutation.isPending}
              className="bg-destructive text-destructive-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteSchemaEntryMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>
            This will permanently delete{' '}
            <code className="bg-muted rounded px-1">{activeEntry?.path ?? 'selected entry'}</code>.
          </p>
          <p className="text-muted-foreground text-xs">This action cannot be undone.</p>
          {schemaEntryError && <div className="text-destructive text-xs">{schemaEntryError}</div>}
        </div>
      </Dialog>

      <Dialog
        open={isEntryInfoOpen}
        onClose={() => {
          setIsEntryInfoOpen(false)
          setActiveEntry(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span className="text-sm font-semibold">Entry properties</span>
          </div>
        }
        footer={
          <button
            type="button"
            onClick={() => setIsEntryInfoOpen(false)}
            className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Close
          </button>
        }
      >
        <div className="space-y-2 text-sm">
          {activeEntryInfo ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Path</span>
                <code className="bg-muted rounded px-1">{activeEntryInfo.path}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{activeEntryInfo.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{activeEntryInfo.source}</span>
              </div>
              {activeEntryInfo.sizeBytes !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span>{activeEntryInfo.sizeBytes} bytes</span>
                </div>
              )}
              {activeEntryInfo.childCount !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span>{activeEntryInfo.childCount}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-sm">No entry selected.</div>
          )}
        </div>
      </Dialog>

      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <SlidersHorizontal className="h-6 w-6 shrink-0" />
        Config
      </h1>

      <Tabs
        tabs={tabs}
        selectedTab={activeTab}
        onTabChange={(id) => {
          const next = id as ConfigTab
          setActiveTab(next)
          if (typeof id === 'string' && id.startsWith('schema:')) {
            setSelectedSchema(id.slice('schema:'.length))
          }
        }}
        className="min-h-0 flex-1 gap-4"
      />
    </div>
  )
}
