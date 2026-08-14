/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Split subprocess file arguments beneath a caller-owned command-line budget.
 * 2. Preserve argument order and keep every non-empty argument in exactly one batch.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
export function splitArgumentsByLength(
  command: string,
  fixedArgs: readonly string[],
  values: readonly string[],
  limit: number
): string[][] {
  if (limit <= 0) throw new RangeError('Argument length limit must be positive.')

  const baseLength =
    command.length + fixedArgs.reduce((length, argument) => length + argument.length + 1, 0)
  const batches: string[][] = []
  let batch: string[] = []
  let length = baseLength

  for (const value of values) {
    const nextLength = length + value.length + 1
    if (batch.length > 0 && nextLength > limit) {
      batches.push(batch)
      batch = []
      length = baseLength
    }

    batch.push(value)
    length += value.length + 1
  }

  if (batch.length > 0) batches.push(batch)
  return batches
}
