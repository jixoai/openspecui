/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Strip machine-sensitive absolute paths and remote/host identity from a published snapshot.
 * 2. Preserve display-safe relative paths and human-readable labels.
 * 3. Gate repository remote URLs behind the explicit `include` Reference policy.
 * 4. Own the single publication redaction boundary for static export privacy.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Section 7.8: snapshots must remove absolute project/Store paths, data-home/registry paths,
 * remotes, `envUri`, host identity, and raw path-bearing diagnostics.
 */
import type { ExportSnapshot } from './export-types.js'

function isAbsoluteFsPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)
}

/**
 * Redact an absolute path to a display-safe relative fragment. Absolute filesystem locations must
 * never survive into a published snapshot; only the trailing relative segment is retained so a reader
 * still understands the artifact's repository-relative location.
 */
function redactPath(raw: string): string {
  if (!raw) return raw
  const normalized = raw.replace(/\\/g, '/')
  if (!isAbsoluteFsPath(normalized)) return normalized
  const segments = normalized.split('/')
  return segments.filter(Boolean).slice(-2).join('/')
}

/** Deep-clone helper that preserves JSON-serializable snapshot shape without mutating input. */
function cloneSnapshot(snapshot: ExportSnapshot): ExportSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ExportSnapshot
}

/**
 * Produce a publication-safe copy of `snapshot`. Removes absolute project/Store/data-home/registry
 * paths, host identity, and raw path-bearing diagnostics, and clears the Git remote URL unless the
 * Reference export policy is explicitly `include`. Display-safe relative paths (`displayPath`,
 * repository-relative fragments) and human-readable labels are preserved.
 *
 * This is the single redaction boundary for static export privacy (Section 7.8). Callers must run it
 * immediately before serializing the published `data.json` / SSG site.
 */
export function redactSnapshotForPublication(snapshot: ExportSnapshot): ExportSnapshot {
  const redacted = cloneSnapshot(snapshot)

  // meta: keep timestamp/observedAt/version/projectName; provenance path is redacted to relative.
  const root = redacted.meta.root
  if (root && root.planningRootPath) {
    root.planningRootPath = redactPath(root.planningRootPath)
  }

  // Git remote URL is a host/repository identity leak; retain only under explicit include policy.
  if (redacted.git && redacted.meta.referencePolicy?.kind !== 'include') {
    redacted.git.repositoryUrl = null
  }

  // OPSX paths: keep displayPath (relative), redact absolute `path` fields.
  const opsx = redacted.opsx
  if (opsx) {
    for (const resolution of Object.values(opsx.schemaResolutions)) {
      if (typeof resolution.path === 'string') resolution.path = redactPath(resolution.path)
      for (const shadow of resolution.shadows ?? []) {
        if (typeof shadow.path === 'string') shadow.path = redactPath(shadow.path)
      }
    }
    for (const artifactMap of Object.values(opsx.templates)) {
      for (const info of Object.values(artifactMap)) {
        if (typeof info.path === 'string') info.path = redactPath(info.path)
      }
    }
    if (opsx.templateContents) {
      for (const artifactMap of Object.values(opsx.templateContents)) {
        for (const entry of Object.values(artifactMap)) {
          if (typeof entry.path === 'string') entry.path = redactPath(entry.path)
        }
      }
    }
  }

  // changeMetadata YAML may embed absolute paths in diagnostics; redaction is best-effort by stripping
  // absolute path tokens from raw strings. This keeps schema metadata while removing filesystem leaks.
  if (opsx?.changeMetadata) {
    for (const [id, raw] of Object.entries(opsx.changeMetadata)) {
      if (typeof raw === 'string') {
        opsx.changeMetadata[id] = raw.replace(/(?:\/[\w.\-@]+){2,}(?=\s|"|$)/g, (match) =>
          redactPath(match)
        )
      }
    }
  }

  return redacted
}

/** True when any string field in the snapshot still carries an absolute filesystem path. */
export function snapshotHasAbsolutePath(snapshot: ExportSnapshot): boolean {
  const text = JSON.stringify(snapshot)
  return /\b(?:\/[\w.\-@]+){2,}/.test(text) || /[A-Za-z]:\//.test(text)
}
