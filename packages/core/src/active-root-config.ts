/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Expose the typed Active Root contract and YAML operations through one browser-safe subpath.
 *
 * Original request (2026-08-01): preserve both official structured editing and complete raw YAML ownership.
 */
export {
  ActiveRootMutationSchema,
  ActiveRootOfficialConfigSchema,
  ActiveRootRevisionSchema,
  ActiveRootStructuredUpdateSchema,
  MAX_ACTIVE_ROOT_CONTEXT_BYTES,
  type ActiveRootConfig,
  type ActiveRootConfigDiagnostic,
  type ActiveRootConfigFile,
  type ActiveRootConfigInspection,
  type ActiveRootMutation,
  type ActiveRootMutationResult,
  type ActiveRootOfficialConfig,
  type ActiveRootRawValidation,
  type ActiveRootRevision,
  type ActiveRootStructuredUpdate,
} from './active-root-config-contract.js'
export {
  inspectActiveRootOfficialConfig,
  patchActiveRootOfficialFields,
  validateActiveRootRawYaml,
} from './active-root-config-yaml.js'
