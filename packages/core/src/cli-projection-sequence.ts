/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Submit aggregate CLI projection entities lazily while preserving source order.
 * 2. Prevent one aggregate read from pre-filling the shared buffered CLI admission queue.
 * 3. Document that the capability-gated OpenSpec 1.11 batch status command satisfies the
 *    same one-admission-slot constraint by construction: it is exactly one spawn, so the
 *    status-list aggregates never need a per-entity series for transport admission.
 *
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */

/**
 * Map CLI-backed projection entities in order, admitting only the current entity.
 *
 * A capability-gated single-spawn batch command (see `OpsxKernel`'s `status --all`
 * transport) is its own serial admission unit and bypasses this helper legitimately;
 * every transport that still spawns per entity must keep submitting through it.
 */
export async function mapCliProjectionSeries<TInput, TOutput>(
  inputs: readonly TInput[],
  project: (input: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const outputs: TOutput[] = []
  for (const [index, input] of inputs.entries()) {
    outputs.push(await project(input, index))
  }
  return outputs
}
