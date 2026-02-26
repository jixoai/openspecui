import { ButtonGroup } from '@/components/button-group'
import { CliTerminal } from '@/components/cli-terminal'
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
import { navController } from '@/lib/nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import { useTerminalContext } from '@/lib/terminal-context'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useCliRunner, type CliRunnerLine } from '@/lib/use-cli-runner'
import {
  useOpsxConfigBundleSubscription,
  useOpsxProjectConfigSubscription,
  useOpsxSchemaFilesSubscription,
  useOpsxTemplateContentsSubscription,
  useOpsxTemplatesSubscription,
} from '@/lib/use-opsx'
import { toOpsxDisplayPath } from '@openspecui/core/opsx-display-path'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Check,
  Edit2,
  EllipsisVertical,
  FilePlus,
  FileText,
  FolderPlus,
  Info,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  TerminalSquare,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parse as parseYaml } from 'yaml'

type ConfigTab = 'project-config' | 'global-config' | `schema:${string}`
type SchemaMode = 'read' | 'preview' | 'edit'
type SchemaCreateMode = 'init' | 'fork'
type ProfileEditMode = 'both' | 'delivery' | 'workflows'
type DeliveryMode = 'both' | 'skills' | 'commands'
type GlobalConfigTab = 'preview' | 'editor' | 'profile'

const DEFAULT_CONFIG_TEMPLATE = `schema: spec-driven\n\ncontext: |\n  \n\nrules:\n  proposal:\n    - \n`
const CORE_WORKFLOWS = ['propose', 'explore', 'apply', 'archive'] as const
const ALL_WORKFLOWS = [
  'propose',
  'explore',
  'new',
  'continue',
  'apply',
  'ff',
  'sync',
  'archive',
  'bulk-archive',
  'verify',
  'onboard',
] as const
const WORKFLOW_LABELS: Record<string, string> = {
  propose: 'Propose change',
  explore: 'Explore ideas',
  new: 'New change',
  continue: 'Continue change',
  apply: 'Apply tasks',
  ff: 'Fast-forward',
  sync: 'Sync specs',
  archive: 'Archive change',
  'bulk-archive': 'Bulk archive',
  verify: 'Verify change',
  onboard: 'Onboard',
}

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

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeWorkflowList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function isCoreWorkflowSelection(workflows: readonly string[]): boolean {
  return (
    workflows.length === CORE_WORKFLOWS.length &&
    CORE_WORKFLOWS.every((workflow) => workflows.includes(workflow))
  )
}

function createRunnerLineId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function JsonStructuredValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-muted-foreground font-mono text-xs">null</span>
  }
  if (typeof value === 'string') {
    return <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{value}</code>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-xs">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground text-xs">[]</span>
    }
    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={`json-array-${index}`} className="border-border/60 rounded-md border px-2 py-1">
            <div className="text-muted-foreground mb-1 font-mono text-[10px]">[{index}]</div>
            <JsonStructuredValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  if (isRecordObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return <span className="text-muted-foreground text-xs">{'{}'}</span>
    }
    return (
      <div className="space-y-1.5">
        {entries.map(([key, item]) => (
          <div key={`json-object-${key}`} className="border-border/60 rounded-md border px-2 py-1">
            <div className="mb-1 font-mono text-[10px] font-semibold">{key}</div>
            <JsonStructuredValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  return <span className="font-mono text-xs">{String(value)}</span>
}

export function Config() {
  const isStatic = isStaticMode()
  const [activeTab, setActiveTab] = useState<ConfigTab>('project-config')
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

  const [isConfigEditing, setIsConfigEditing] = useState(false)
  const [configDraft, setConfigDraft] = useState('')
  const [configDirty, setConfigDirty] = useState(false)
  const [autoUpdateAfterProfileChange, setAutoUpdateAfterProfileChange] = useState(true)
  const [profileEditMode, setProfileEditMode] = useState<ProfileEditMode>('both')
  const [profileDelivery, setProfileDelivery] = useState<DeliveryMode>('both')
  const [profileWorkflows, setProfileWorkflows] = useState<string[]>([...CORE_WORKFLOWS])
  const [globalConfigTab, setGlobalConfigTab] = useState<GlobalConfigTab>('preview')
  const [globalConfigDraft, setGlobalConfigDraft] = useState('{}')
  const [globalConfigDraftDirty, setGlobalConfigDraftDirty] = useState(false)
  const [globalConfigError, setGlobalConfigError] = useState<string | null>(null)
  const [isRefreshingGlobalConfig, setIsRefreshingGlobalConfig] = useState(false)
  const [shouldScrollRunner, setShouldScrollRunner] = useState(false)
  const runnerOutputRef = useRef<HTMLDivElement | null>(null)
  const [pendingCommandKind, setPendingCommandKind] = useState<'apply' | 'update' | null>(null)
  const [isExecutingPendingCommand, setIsExecutingPendingCommand] = useState(false)
  const [applyRunnerLines, setApplyRunnerLines] = useState<CliRunnerLine[]>([])

  const { createDedicatedSession } = useTerminalContext()

  const configRunner = useCliRunner()

  const {
    lines: configRunnerLines,
    status: configRunnerStatus,
    commands: configRunnerCommands,
    reset: resetConfigRunner,
  } = configRunner

  const {
    data: opsxProfileState,
    isLoading: isLoadingOpsxProfileState,
    refetch: refetchOpsxProfileState,
  } = useQuery({
    ...trpc.cli.getProfileState.queryOptions(),
    enabled: !isStatic,
  })
  const {
    data: globalConfigData,
    isLoading: isLoadingGlobalConfig,
    error: globalConfigQueryError,
    refetch: refetchGlobalConfig,
  } = useQuery({
    ...trpc.cli.getGlobalConfig.queryOptions(),
    enabled: !isStatic,
  })
  const { data: globalConfigPathData, refetch: refetchGlobalConfigPath } = useQuery({
    ...trpc.cli.getGlobalConfigPath.queryOptions(),
    enabled: !isStatic,
  })

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
    setActiveTab(fallback ? `schema:${fallback}` : 'project-config')
  }, [activeTab, schemas])

  useEffect(() => {
    if (!selectedSchema) return
    if (activeTab.startsWith('schema:') && activeTab !== `schema:${selectedSchema}`) {
      setActiveTab(`schema:${selectedSchema}`)
    }
  }, [activeTab, selectedSchema])

  useEffect(() => {
    if (isConfigEditing) return
    setConfigDraft(configYaml ?? '')
    setConfigDirty(false)
  }, [configYaml, isConfigEditing])

  useEffect(() => {
    if (!isRecordObject(globalConfigData)) return
    const nextDelivery = globalConfigData.delivery
    setProfileDelivery(
      nextDelivery === 'skills' || nextDelivery === 'commands' || nextDelivery === 'both'
        ? nextDelivery
        : 'both'
    )
    setProfileWorkflows(normalizeWorkflowList(globalConfigData.workflows))
  }, [globalConfigData])

  useEffect(() => {
    if (!isRecordObject(globalConfigData)) return
    if (globalConfigDraftDirty) return
    setGlobalConfigDraft(JSON.stringify(globalConfigData, null, 2))
  }, [globalConfigData, globalConfigDraftDirty])

  useEffect(() => {
    if (!shouldScrollRunner) return
    if (configRunnerStatus !== 'running' && configRunnerLines.length === 0) return
    const raf = window.requestAnimationFrame(() => {
      runnerOutputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    setShouldScrollRunner(false)
    return () => window.cancelAnimationFrame(raf)
  }, [configRunnerLines.length, configRunnerStatus, shouldScrollRunner])

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
  const saveGlobalConfigMutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      await trpcClient.cli.setGlobalConfig.mutate({ config })
    },
    onSuccess: async () => {
      setGlobalConfigDraftDirty(false)
      setGlobalConfigError(null)
      await Promise.allSettled([
        queryClient.invalidateQueries(trpc.cli.getGlobalConfig.queryFilter()),
        queryClient.invalidateQueries(trpc.cli.getProfileState.queryFilter()),
        queryClient.invalidateQueries(trpc.cli.getGlobalConfigPath.queryFilter()),
      ])
      await Promise.allSettled([
        refetchGlobalConfig(),
        refetchOpsxProfileState(),
        refetchGlobalConfigPath(),
      ])
    },
    onError: (error) => {
      setGlobalConfigError(error instanceof Error ? error.message : String(error))
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

  const runConfigCommands = useCallback(
    (commands: Array<{ command: string; args: string[] }>) => {
      if (isStatic) return
      setShouldScrollRunner(true)
      configRunnerCommands.replaceAll(commands)
      void configRunnerCommands.runAll()
    },
    [configRunnerCommands, isStatic]
  )

  const handleRefreshGlobalConfig = useCallback(async () => {
    if (isStatic) return
    setIsRefreshingGlobalConfig(true)
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries(trpc.cli.getGlobalConfig.queryFilter()),
        queryClient.invalidateQueries(trpc.cli.getGlobalConfigPath.queryFilter()),
        queryClient.invalidateQueries(trpc.cli.getProfileState.queryFilter()),
      ])
      await Promise.allSettled([
        refetchGlobalConfig(),
        refetchGlobalConfigPath(),
        refetchOpsxProfileState(),
      ])
    } finally {
      setIsRefreshingGlobalConfig(false)
    }
  }, [isStatic, refetchGlobalConfig, refetchGlobalConfigPath, refetchOpsxProfileState])

  const handleLaunchInteractiveProfile = useCallback(() => {
    createDedicatedSession('openspec', ['config', 'profile'])
    const terminalArea = navController.getAreaForPath('/terminal')
    navController.push(terminalArea, '/terminal', null)
  }, [createDedicatedSession])

  const executeApplyProfile = useCallback(async () => {
    if (!isRecordObject(globalConfigData)) return
    const nextConfig = JSON.parse(JSON.stringify(globalConfigData)) as Record<string, unknown>

    if (profileEditMode === 'both' || profileEditMode === 'delivery') {
      nextConfig.delivery = profileDelivery
    }
    if (profileEditMode === 'both' || profileEditMode === 'workflows') {
      nextConfig.workflows = [...profileWorkflows]
      nextConfig.profile = isCoreWorkflowSelection(profileWorkflows) ? 'core' : 'custom'
    }

    setGlobalConfigError(null)
    setApplyRunnerLines((previous) => [
      ...previous,
      {
        id: createRunnerLineId(),
        kind: 'ascii',
        text: 'Applying profile settings to global config...',
      },
    ])
    try {
      await saveGlobalConfigMutation.mutateAsync(nextConfig)
      setApplyRunnerLines((previous) => [
        ...previous,
        {
          id: createRunnerLineId(),
          kind: 'ascii',
          text: 'Profile settings applied successfully.',
          tone: 'success',
        },
      ])
      if (autoUpdateAfterProfileChange) {
        setApplyRunnerLines((previous) => [
          ...previous,
          {
            id: createRunnerLineId(),
            kind: 'ascii',
            text: 'Starting openspec update...',
          },
        ])
        runConfigCommands([{ command: 'openspec', args: ['update'] }])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setApplyRunnerLines((previous) => [
        ...previous,
        {
          id: createRunnerLineId(),
          kind: 'ascii',
          text: `Apply failed: ${message}`,
          tone: 'error',
        },
      ])
      throw error
    }
  }, [
    autoUpdateAfterProfileChange,
    globalConfigData,
    profileDelivery,
    profileEditMode,
    profileWorkflows,
    runConfigCommands,
    saveGlobalConfigMutation,
  ])

  const handleApplyProfile = useCallback(() => {
    setGlobalConfigError(null)
    resetConfigRunner()
    setApplyRunnerLines([])
    setPendingCommandKind('apply')
  }, [resetConfigRunner])

  const handleRunUpdate = useCallback(() => {
    resetConfigRunner()
    setApplyRunnerLines([])
    setPendingCommandKind('update')
  }, [resetConfigRunner])

  const handleConfirmPendingCommand = useCallback(async () => {
    if (!pendingCommandKind) return
    setIsExecutingPendingCommand(true)
    setShouldScrollRunner(true)
    try {
      if (pendingCommandKind === 'apply') {
        await executeApplyProfile()
      } else {
        runConfigCommands([{ command: 'openspec', args: ['update'] }])
      }
    } catch {
      // errors are already surfaced via mutation state and terminal lines
    } finally {
      setIsExecutingPendingCommand(false)
    }
  }, [executeApplyProfile, pendingCommandKind, runConfigCommands])

  const handleSaveGlobalConfigEditor = useCallback(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(globalConfigDraft)
    } catch (error) {
      setGlobalConfigError(error instanceof Error ? error.message : String(error))
      return
    }
    if (!isRecordObject(parsed)) {
      setGlobalConfigError('Global config must be a JSON object.')
      return
    }
    setGlobalConfigError(null)
    saveGlobalConfigMutation.mutate(parsed, {
      onSuccess: async () => {
        setGlobalConfigTab('preview')
        await handleRefreshGlobalConfig()
      },
    })
  }, [globalConfigDraft, handleRefreshGlobalConfig, saveGlobalConfigMutation])

  useEffect(() => {
    if (configRunnerStatus !== 'success') return
    void handleRefreshGlobalConfig()
  }, [configRunnerStatus, handleRefreshGlobalConfig])

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

  const globalConfigOtherFields = useMemo(() => {
    if (!isRecordObject(globalConfigData)) return {}
    const entries = Object.entries(globalConfigData).filter(
      ([key]) => !['profile', 'delivery', 'workflows', 'featureFlags', 'telemetry'].includes(key)
    )
    return Object.fromEntries(entries)
  }, [globalConfigData])

  const selectedWorkflowSet = useMemo(() => new Set(profileWorkflows), [profileWorkflows])
  const activeWorkflowSet = useMemo(() => {
    if (!isRecordObject(globalConfigData)) return new Set<string>()
    return new Set(normalizeWorkflowList(globalConfigData.workflows))
  }, [globalConfigData])
  const selectedWorkflowList = useMemo(
    () => ALL_WORKFLOWS.filter((workflow) => selectedWorkflowSet.has(workflow)),
    [selectedWorkflowSet]
  )
  const unselectedWorkflowList = useMemo(
    () => ALL_WORKFLOWS.filter((workflow) => !selectedWorkflowSet.has(workflow)),
    [selectedWorkflowSet]
  )
  const profileRequiresWorkflowSelection =
    profileEditMode === 'both' || profileEditMode === 'workflows'
  const canApplyProfile =
    isRecordObject(globalConfigData) &&
    !saveGlobalConfigMutation.isPending &&
    (!profileRequiresWorkflowSelection || profileWorkflows.length > 0)
  const canSaveGlobalConfigEditor = !saveGlobalConfigMutation.isPending && globalConfigDraftDirty
  const pendingCommandLines = useMemo(() => {
    if (pendingCommandKind === 'update') {
      return ['openspec update']
    }
    if (pendingCommandKind === 'apply') {
      const lines = ['apply profile settings to global config']
      if (autoUpdateAfterProfileChange) lines.push('openspec update')
      return lines
    }
    return []
  }, [autoUpdateAfterProfileChange, pendingCommandKind])
  const pendingCommandOutputLines = useMemo(
    () =>
      pendingCommandKind === 'apply'
        ? [...applyRunnerLines, ...configRunnerLines]
        : configRunnerLines,
    [applyRunnerLines, configRunnerLines, pendingCommandKind]
  )
  const isPendingCommandRunning = isExecutingPendingCommand || configRunnerStatus === 'running'
  const pendingCommandTitle = pendingCommandKind === 'apply' ? 'Apply profile' : 'Run update'
  const pendingCommandActionLabel = pendingCommandKind === 'apply' ? 'Apply profile' : 'Run command'
  const handleClosePendingCommandDialog = useCallback(() => {
    if (isPendingCommandRunning) return
    setPendingCommandKind(null)
  }, [isPendingCommandRunning])

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

  const projectConfigTabContent = (
    <section className="space-y-4">
      <section className="border-border bg-card space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">OpenSpec Project Config</h2>
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
    </section>
  )

  const globalConfigTabContent = isStatic ? (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">OpenSpec Global Config</h2>
      <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        Global config commands are unavailable in static export mode.
      </div>
    </section>
  ) : (
    <section className="space-y-4">
      <section className="border-border bg-card space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">OpenSpec Global Config</h2>
            <div className="text-muted-foreground mt-1 text-xs">
              <span className="mr-1">Path:</span>
              <code className="bg-muted rounded px-1">
                {globalConfigPathData?.path ?? 'Unavailable'}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLaunchInteractiveProfile}
              className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Interactive
            </button>
            <button
              type="button"
              onClick={handleRefreshGlobalConfig}
              disabled={isRefreshingGlobalConfig}
              className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
            >
              {isRefreshingGlobalConfig ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="text-muted-foreground text-xs">
          Reads from <code>openspec config list --json</code> and writes to the global config file.
        </div>

        <ButtonGroup<GlobalConfigTab>
          value={globalConfigTab}
          onChange={setGlobalConfigTab}
          options={[
            { value: 'preview', label: 'Preview' },
            { value: 'editor', label: 'Editor' },
            { value: 'profile', label: 'Profile' },
          ]}
        />

        {(globalConfigQueryError || globalConfigError) && (
          <div className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-xs">
            {globalConfigQueryError?.message ?? globalConfigError}
          </div>
        )}

        {globalConfigTab === 'preview' ? (
          isLoadingGlobalConfig ? (
            <div className="text-muted-foreground text-sm">Loading global config…</div>
          ) : isRecordObject(globalConfigData) ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">profile</div>
                  <div className="mt-1 font-medium">
                    {typeof globalConfigData.profile === 'string'
                      ? globalConfigData.profile
                      : 'N/A'}
                  </div>
                </div>
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">delivery</div>
                  <div className="mt-1 font-medium">
                    {typeof globalConfigData.delivery === 'string'
                      ? globalConfigData.delivery
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">workflows</div>
                {normalizeWorkflowList(globalConfigData.workflows).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {normalizeWorkflowList(globalConfigData.workflows).map((workflow) => (
                      <span key={workflow} className="bg-muted rounded px-2 py-0.5 text-[10px]">
                        {workflow}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">—</div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">featureFlags</div>
                <JsonStructuredValue value={globalConfigData.featureFlags ?? {}} />
              </div>

              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">telemetry</div>
                <JsonStructuredValue value={globalConfigData.telemetry ?? {}} />
              </div>

              {Object.keys(globalConfigOtherFields).length > 0 && (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-xs">other fields</div>
                  <JsonStructuredValue value={globalConfigOtherFields} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Global config unavailable.</div>
          )
        ) : globalConfigTab === 'editor' ? (
          <div className="space-y-2">
            <CodeEditor
              value={globalConfigDraft}
              onChange={(value) => {
                setGlobalConfigDraft(value)
                setGlobalConfigDraftDirty(true)
                setGlobalConfigError(null)
              }}
              readOnly={saveGlobalConfigMutation.isPending}
              filename="openspec.global.config.json"
              language="json"
              editorMinHeight="260px"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isRecordObject(globalConfigData)) return
                  setGlobalConfigDraft(JSON.stringify(globalConfigData, null, 2))
                  setGlobalConfigDraftDirty(false)
                  setGlobalConfigError(null)
                }}
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
              >
                Revert
              </button>
              <button
                type="button"
                disabled={!canSaveGlobalConfigEditor}
                onClick={handleSaveGlobalConfigEditor}
                className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
            <section className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Profile</div>
                  <div className="mt-1 font-medium">
                    {isLoadingOpsxProfileState ? 'Loading…' : (opsxProfileState?.profile ?? 'N/A')}
                  </div>
                </div>
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Delivery</div>
                  <div className="mt-1 font-medium">
                    {isLoadingOpsxProfileState ? 'Loading…' : (opsxProfileState?.delivery ?? 'N/A')}
                  </div>
                </div>
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Drift</div>
                  <div className="mt-1 font-medium">
                    {isLoadingOpsxProfileState
                      ? 'Loading…'
                      : (opsxProfileState?.driftStatus ?? 'unknown')}
                  </div>
                </div>
              </div>

              {opsxProfileState?.warningText && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  {opsxProfileState.warningText}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-muted-foreground text-xs">Apply mode</div>
                  <ButtonGroup<ProfileEditMode>
                    value={profileEditMode}
                    onChange={setProfileEditMode}
                    options={[
                      { value: 'both', label: 'Delivery + Workflows' },
                      { value: 'delivery', label: 'Delivery only' },
                      { value: 'workflows', label: 'Workflows only' },
                    ]}
                  />
                </div>

                {(profileEditMode === 'both' || profileEditMode === 'delivery') && (
                  <label className="space-y-1">
                    <div className="text-muted-foreground text-xs">Delivery</div>
                    <select
                      value={profileDelivery}
                      onChange={(event) => setProfileDelivery(event.target.value as DeliveryMode)}
                      className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="both">both</option>
                      <option value="skills">skills</option>
                      <option value="commands">commands</option>
                    </select>
                  </label>
                )}

                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={autoUpdateAfterProfileChange}
                    onChange={(event) => setAutoUpdateAfterProfileChange(event.target.checked)}
                  />
                  Run <code>openspec update</code> automatically after apply
                </label>
              </div>
            </section>

            <section className="space-y-3">
              {profileEditMode === 'both' || profileEditMode === 'workflows' ? (
                <>
                  <div className="text-muted-foreground text-xs">Workflows</div>
                  <div className="border-border/70 bg-muted/20 rounded-md border border-dashed px-3 py-2">
                    <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
                      Reference
                    </div>
                    <div className="text-muted-foreground space-y-0.5 font-mono text-[11px] leading-relaxed">
                      <div>selected: [{selectedWorkflowList.join(', ')}]</div>
                      <div>unselected: [{unselectedWorkflowList.join(', ')}]</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2">
                    {ALL_WORKFLOWS.map((workflow) => {
                      const isSelected = selectedWorkflowSet.has(workflow)
                      const isActive = activeWorkflowSet.has(workflow)
                      const isDirty = isSelected !== isActive
                      return (
                        <button
                          type="button"
                          key={workflow}
                          onClick={() =>
                            setProfileWorkflows((previous) =>
                              previous.includes(workflow)
                                ? previous.filter((item) => item !== workflow)
                                : [...previous, workflow]
                            )
                          }
                          className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left text-xs transition-colors ${
                            isSelected && !isDirty
                              ? 'border-primary bg-primary/10 text-primary'
                              : !isSelected && !isDirty
                                ? 'border-border hover:bg-muted'
                                : isSelected
                                  ? 'rounded border border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-200'
                                  : 'rounded border border-amber-500/50 bg-amber-500/5 text-amber-700/90 dark:text-amber-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isSelected && <Check className="h-3 w-3 shrink-0" />}
                            <span>{WORKFLOW_LABELS[workflow] ?? workflow}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-xs">
                  Switch apply mode to include workflows to edit the workflow set.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!canApplyProfile}
                  onClick={handleApplyProfile}
                  className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={handleRunUpdate}
                  className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Run update
                </button>
                {saveGlobalConfigMutation.isPending && (
                  <span className="text-muted-foreground text-xs">Saving…</span>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </section>
  )

  const tabs: Tab[] = [
    {
      id: 'project-config',
      label: 'Project Config',
      icon: <FileText className="h-4 w-4" />,
      content: projectConfigTabContent,
    },
    {
      id: 'global-config',
      label: 'Global Config',
      icon: <SlidersHorizontal className="h-4 w-4" />,
      content: globalConfigTabContent,
    },
    ...schemaTabs,
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

      <Dialog
        open={pendingCommandKind !== null}
        onClose={handleClosePendingCommandDialog}
        bodyClassName="space-y-3"
        title={
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4" />
            <span className="text-sm font-semibold">{pendingCommandTitle}</span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={handleClosePendingCommandDialog}
              disabled={isPendingCommandRunning}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isPendingCommandRunning || !pendingCommandKind}
              onClick={() => void handleConfirmPendingCommand()}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPendingCommandRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {isPendingCommandRunning ? 'Running…' : pendingCommandActionLabel}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground mb-1 text-xs">Command plan</div>
            <div className="bg-muted rounded-md px-3 py-2">
              {pendingCommandLines.map((line, index) => (
                <div key={`${line}-${index}`} className="font-mono text-xs">
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div ref={runnerOutputRef}>
            <CliTerminal lines={pendingCommandOutputLines} maxHeight="42vh" />
          </div>
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
