import { z } from 'zod'

/** Check if an outputPath contains glob pattern characters */
export function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

export const ArtifactStatusSchema = z.object({
  id: z.string(),
  outputPath: z.string(),
  status: z.enum(['done', 'ready', 'blocked']),
  missingDeps: z.array(z.string()).optional(),
  relativePath: z.string().optional(),
})

export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>

export const ChangeStatusSchema = z.object({
  changeName: z.string(),
  schemaName: z.string(),
  isComplete: z.boolean(),
  applyRequires: z.array(z.string()),
  artifacts: z.array(ArtifactStatusSchema),
})

export type ChangeStatus = z.infer<typeof ChangeStatusSchema>

export const DependencyInfoSchema = z.object({
  id: z.string(),
  done: z.boolean(),
  path: z.string(),
  description: z.string(),
})

export type DependencyInfo = z.infer<typeof DependencyInfoSchema>

export const ApplyTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  done: z.boolean(),
})

export type ApplyTask = z.infer<typeof ApplyTaskSchema>

export const ApplyInstructionsSchema = z.object({
  changeName: z.string(),
  changeDir: z.string(),
  schemaName: z.string(),
  contextFiles: z.record(z.string()),
  progress: z.object({
    total: z.number(),
    complete: z.number(),
    remaining: z.number(),
  }),
  tasks: z.array(ApplyTaskSchema),
  state: z.enum(['blocked', 'all_done', 'ready']),
  missingArtifacts: z.array(z.string()).optional(),
  instruction: z.string(),
})

export type ApplyInstructions = z.infer<typeof ApplyInstructionsSchema>

const NullableString = z.string().nullable().optional()

export const ArtifactInstructionsSchema = z.object({
  changeName: z.string(),
  artifactId: z.string(),
  schemaName: z.string(),
  changeDir: z.string(),
  outputPath: z.string(),
  description: z.string(),
  instruction: NullableString,
  context: NullableString,
  rules: z.array(z.string()).optional().nullable(),
  template: z.string(),
  dependencies: z.array(DependencyInfoSchema),
  unlocks: z.array(z.string()),
})

export type ArtifactInstructions = z.infer<typeof ArtifactInstructionsSchema>

export const SchemaInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  artifacts: z.array(z.string()),
  source: z.enum(['project', 'user', 'package']),
})

export type SchemaInfo = z.infer<typeof SchemaInfoSchema>

export const SchemaResolutionSchema = z.object({
  name: z.string(),
  source: z.enum(['project', 'user', 'package']),
  path: z.string(),
  shadows: z.array(
    z.object({
      source: z.enum(['project', 'user', 'package']),
      path: z.string(),
    })
  ),
})

export type SchemaResolution = z.infer<typeof SchemaResolutionSchema>

export const TemplatesSchema = z.record(
  z.object({
    path: z.string(),
    source: z.enum(['project', 'user', 'package']),
  })
)

export type TemplatesMap = z.infer<typeof TemplatesSchema>

export const SchemaArtifactSchema = z.object({
  id: z.string(),
  outputPath: z.string(),
  description: z.string().optional(),
  template: z.string().optional(),
  instruction: z.string().optional(),
  requires: z.array(z.string()),
})

export type SchemaArtifact = z.infer<typeof SchemaArtifactSchema>

export const SchemaDetailSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  artifacts: z.array(SchemaArtifactSchema),
  applyRequires: z.array(z.string()),
  applyTracks: z.string().optional(),
  applyInstruction: z.string().optional(),
})

export type SchemaDetail = z.infer<typeof SchemaDetailSchema>
