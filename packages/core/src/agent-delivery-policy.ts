/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Define the structured Agent profile, delivery, and workflow mutation contract.
 * 2. Normalize Core versus Custom workflow semantics exactly once.
 * 3. Preserve unknown environment-global JSON fields while updating official Agent policy keys.
 *
 * Original request (2026-08-01): keep raw environment config authoring while moving official Agent controls to Config.
 */

import { z } from 'zod'
import type { CliJsonValue } from './cli-contracts/command-result.js'
import { OPSX_ALL_WORKFLOWS, OPSX_CORE_PROFILE_WORKFLOWS } from './opsx-workflows.js'

export const AgentDeliveryProfileSchema = z.enum(['core', 'custom'])
export const AgentDeliveryModeSchema = z.enum(['both', 'skills', 'commands'])
export const AgentDeliveryWorkflowSchema = z.enum(OPSX_ALL_WORKFLOWS)

export const AgentDeliveryPolicyUpdateSchema = z
  .object({
    profile: AgentDeliveryProfileSchema,
    delivery: AgentDeliveryModeSchema,
    workflows: z.array(AgentDeliveryWorkflowSchema),
  })
  .superRefine((value, context) => {
    if (new Set(value.workflows).size !== value.workflows.length) {
      context.addIssue({ code: 'custom', message: 'Agent workflows must be unique.' })
    }
  })

export type AgentDeliveryProfile = z.infer<typeof AgentDeliveryProfileSchema>
export type AgentDeliveryMode = z.infer<typeof AgentDeliveryModeSchema>
export type AgentDeliveryPolicyUpdate = z.infer<typeof AgentDeliveryPolicyUpdateSchema>

export interface AgentDeliveryPolicy {
  profile: AgentDeliveryProfile
  delivery: AgentDeliveryMode
  workflows: (typeof OPSX_ALL_WORKFLOWS)[number][]
}

/** Normalize authored policy through official omitted-value defaults and Core workflow semantics. */
export function normalizeAgentDeliveryPolicy(input: {
  profile?: string | null
  delivery?: string | null
  workflows?: readonly string[] | null
}): AgentDeliveryPolicy {
  const profile: AgentDeliveryProfile = input.profile === 'custom' ? 'custom' : 'core'
  const delivery: AgentDeliveryMode =
    input.delivery === 'skills' || input.delivery === 'commands' ? input.delivery : 'both'
  const workflows =
    profile === 'core'
      ? [...OPSX_CORE_PROFILE_WORKFLOWS]
      : OPSX_ALL_WORKFLOWS.filter((workflow) => input.workflows?.includes(workflow))
  return { profile, delivery, workflows }
}

/** Update only official Agent policy keys while retaining every team-authored extension field. */
export function applyAgentDeliveryPolicy(
  config: Readonly<Record<string, CliJsonValue>> | null,
  update: AgentDeliveryPolicyUpdate
): Record<string, CliJsonValue> {
  const policy = normalizeAgentDeliveryPolicy(update)
  return {
    ...config,
    profile: policy.profile,
    delivery: policy.delivery,
    workflows: policy.workflows,
  }
}
