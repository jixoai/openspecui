import { z } from 'zod'
import { parse } from 'yaml'
import { SchemaDetailSchema, type SchemaDetail } from '@openspecui/core'

const SchemaYamlArtifactSchema = z.object({
  id: z.string(),
  generates: z.string(),
  description: z.string().optional(),
  template: z.string().optional(),
  instruction: z.string().optional(),
  requires: z.array(z.string()).optional(),
})

const SchemaYamlSchema = z.object({
  name: z.string(),
  version: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
  artifacts: z.array(SchemaYamlArtifactSchema),
  apply: z
    .object({
      requires: z.array(z.string()).optional(),
      tracks: z.string().optional(),
      instruction: z.string().optional(),
    })
    .optional(),
})

export function parseSchemaYaml(content: string): SchemaDetail {
  const raw = parse(content) as unknown
  const parsed = SchemaYamlSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid schema.yaml: ${parsed.error.message}`)
  }

  const { artifacts, apply, name, description, version } = parsed.data
  const detail: SchemaDetail = {
    name,
    description,
    version,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      outputPath: artifact.generates,
      description: artifact.description,
      template: artifact.template,
      instruction: artifact.instruction,
      requires: artifact.requires ?? [],
    })),
    applyRequires: apply?.requires ?? [],
    applyTracks: apply?.tracks,
    applyInstruction: apply?.instruction,
  }

  const validated = SchemaDetailSchema.safeParse(detail)
  if (!validated.success) {
    throw new Error(`Invalid schema detail: ${validated.error.message}`)
  }

  return validated.data
}
