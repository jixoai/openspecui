/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Submit aggregate CLI projection entities lazily while preserving source order.
 * 2. Prevent one aggregate read from pre-filling the shared buffered CLI admission queue.
 * 3. Document that the capability-gated single-spawn commands (the batch status transport
 *    and the OpenSpec 1.12 `validate --report findings` evidence fetch) satisfy the same
 *    one-admission-slot constraint by construction: each is exactly one spawn, so neither
 *    aggregate ever needs a per-entity series for transport admission.
 *
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */

/**
 * Map CLI-backed projection entities in order, admitting only the current entity.
 *
 * A capability-gated single-spawn command (see `OpsxKernel`'s `status --all` transport
 * and its findings evidence fetch) is its own serial admission unit and bypasses this
 * helper legitimately; every transport that still spawns per entity must keep submitting
 * through it.
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
