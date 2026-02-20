export const CHANGE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface NewChangeFormState {
  changeName: string
  schema: string
  description: string
  extraArgs: string[]
}

export function buildNewChangeArgs(input: NewChangeFormState): string[] {
  const args = ['new', 'change', input.changeName.trim()]

  const schema = input.schema.trim()
  if (schema.length > 0) {
    args.push('--schema', schema)
  }

  const description = input.description.trim()
  if (description.length > 0) {
    args.push('--description', description)
  }

  for (const token of input.extraArgs) {
    const trimmed = token.trim()
    if (trimmed.length > 0) {
      args.push(trimmed)
    }
  }

  return args
}

export function quoteShellToken(token: string): string {
  return /\s/.test(token) ? JSON.stringify(token) : token
}
