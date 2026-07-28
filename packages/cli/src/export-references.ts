/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Resolve direct Reference Specs through official pinned-CLI list/show with Store selection.
 * 2. Enforce complete-or-fail atomicity: any Reference failure aborts before publishing a snapshot.
 * 3. Project Reference policy and per-Store provenance without transitive enumeration.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Section 7.3-7.7: `--references=include|omit`, direct materialization, atomic failure, no transitivity.
 */
import type {
  CliDoctor,
  CliDoctorReferenceEntry,
  CliShowSpecDocument,
  CliSpecList,
  ExportReferencePolicy,
  ExportSnapshot,
  OpenSpecCliContractExecutor,
} from '@openspecui/core'

type SnapshotSpec = ExportSnapshot['specs'][number]
type SnapshotRequirement = SnapshotSpec['requirements'][number]
type SnapshotScenario = SnapshotRequirement['scenarios'][number]

/** Type guard narrowing the `show --json` union to the success document variant. */
function isShowSpecDocument(payload: unknown): payload is CliShowSpecDocument {
  return typeof payload === 'object' && payload !== null && 'id' in payload && 'title' in payload
}

/** Convert a `show --json` requirement to the snapshot requirement body shape. */
function toSnapshotRequirement(
  requirement: CliShowSpecDocument['requirements'][number],
  index: number
): SnapshotRequirement {
  const text = requirement.text ?? ''
  const firstLine = text.split('\n')[0]?.trim() ?? ''
  const title = firstLine || `Requirement ${index + 1}`
  const bodyMarkdown = text
  const scenarios: SnapshotScenario[] = (requirement.scenarios ?? []).map((scenario) => {
    const rawText = scenario.rawText ?? ''
    const scenarioTitle =
      rawText
        .split('\n')[0]
        ?.replace(/^#+\s*/, '')
        .trim() || 'Scenario'
    return {
      title: scenarioTitle,
      bodyMarkdown: rawText,
      rawText,
    }
  })
  return {
    id: `req-${index + 1}`,
    title,
    bodyMarkdown,
    text,
    scenarios,
  }
}

/** Result of materializing direct Reference Specs for one snapshot. */
export interface MaterializedReferences {
  policy: Extract<ExportReferencePolicy, { kind: 'include' }>
  referencedSpecs: SnapshotSpec[]
}

function requireDoctorData(result: {
  success: boolean
  data: CliDoctor | null
  exitCode: number | null
  stderr: string
}): CliDoctor {
  if (!result.success || !result.data) {
    throw new Error(
      `Reference enumeration failed: openspec doctor exited ${result.exitCode ?? 'null'}${
        result.stderr ? `: ${result.stderr.trim()}` : ''
      }`
    )
  }
  return result.data
}

function requireSpecList(
  result: {
    success: boolean
    data: CliSpecList | null
    exitCode: number | null
    stderr: string
  },
  storeId: string
): CliSpecList {
  if (!result.success || !result.data) {
    throw new Error(
      `Reference Store '${storeId}' Spec enumeration failed (exit ${
        result.exitCode ?? 'null'
      })${result.stderr ? `: ${result.stderr.trim()}` : ''}`
    )
  }
  return result.data
}

/**
 * Materialize every direct Reference Spec declared by the planning root's Doctor projection.
 *
 * Contract (Section 7.4-7.6):
 * - Enumerates only direct References from `doctor --json`; never walks transitive References.
 * - For each Reference Store, lists Specs via `list --specs --store --json` and shows each body via
 *   `show <id> --type spec --store --json`.
 * - Any list/show failure is fatal and throws before the caller can publish a partial snapshot.
 * - Never serializes referenced changes, archives, config, Git, registry, or unrelated Stores.
 */
export async function materializeReferences(
  contracts: OpenSpecCliContractExecutor
): Promise<MaterializedReferences> {
  const doctor = requireDoctorData(await contracts.doctorRoot())
  const references: CliDoctorReferenceEntry[] = doctor.references ?? []
  const referenceSources: Array<{ storeId: string; state: 'ready' | 'error'; specCount: number }> =
    []
  const referencedSpecs: SnapshotSpec[] = []

  for (const reference of references) {
    const storeId = reference.store_id
    const errorMessages = (reference.status ?? [])
      .filter((diag) => diag.severity === 'error')
      .map((diag) => diag.message)
    if (errorMessages.length > 0) {
      throw new Error(
        `Reference Store '${storeId}' is unresolved and cannot be materialized for static export: ${
          errorMessages.join('; ') || 'unresolved reference'
        }`
      )
    }

    const specList = requireSpecList(await contracts.listSpecs({ store: storeId }), storeId)
    let materializedCount = 0
    for (const entry of specList.specs ?? []) {
      const showResult = await contracts.showSpec(entry.id, { store: storeId })
      const payload = showResult.success ? showResult.data : null
      if (!payload || !isShowSpecDocument(payload)) {
        throw new Error(
          `Reference Spec '${entry.id}' from Store '${storeId}' could not be materialized (exit ${
            showResult.exitCode ?? 'null'
          })${showResult.stderr ? `: ${showResult.stderr.trim()}` : ''}`
        )
      }
      const document = payload
      referencedSpecs.push({
        identity: { kind: 'referenced', storeId, specId: document.id },
        source: 'referenced',
        readOnly: true,
        storeId,
        id: document.id,
        name: document.title || document.id,
        content: document.overview || '',
        overview: document.overview || '',
        requirements: (document.requirements ?? []).map(toSnapshotRequirement),
        createdAt: 0,
        updatedAt: 0,
      })
      materializedCount += 1
    }

    referenceSources.push({ storeId, state: 'ready', specCount: materializedCount })
  }

  return {
    policy: { kind: 'include', referenceSources },
    referencedSpecs,
  }
}

/** Build the `omit` policy provenance, recording the observed Reference source count without bodies. */
export async function resolveOmitPolicy(
  contracts: OpenSpecCliContractExecutor
): Promise<{
  policy: Extract<ExportReferencePolicy, { kind: 'omit' }>
  referenceSourceCount: number
}> {
  const doctorResult = await contracts.doctorRoot()
  if (!doctorResult.success || !doctorResult.data) {
    return { policy: { kind: 'omit', referenceSourceCount: 0 }, referenceSourceCount: 0 }
  }
  const count = (doctorResult.data.references ?? []).length
  return { policy: { kind: 'omit', referenceSourceCount: count }, referenceSourceCount: count }
}

/** Detect whether the planning root declares any direct References. */
export async function hasEffectiveReferences(
  contracts: OpenSpecCliContractExecutor
): Promise<boolean> {
  const doctorResult = await contracts.doctorRoot()
  if (!doctorResult.success || !doctorResult.data) return false
  return (doctorResult.data.references ?? []).length > 0
}
