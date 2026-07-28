/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Own the shared Apply and Archive launch boundary for Change surfaces.
 * 2. Recheck current Root authority at invocation time before opening an Operator.
 *
 * Original request (2026-07-28): Board and Change Detail must use the same production Operator owners.
 */
import { useArchiveModal } from '@/lib/archive-modal-context'
import { buildOpsxComposeHref } from '@/lib/opsx-compose'
import { useRootActionState } from '@/lib/use-root-action-state'
import { vtNavController } from '@/lib/view-transitions/navigation'
import { useCallback, useRef } from 'react'

export interface ChangeOperatorTarget {
  changeId: string
  changeName: string
}

/** Caller-owned projection authority checked again when an Operator is requested. */
export interface ChangeOperatorInvocationGate {
  applyCurrent?: boolean
  archiveCurrent?: boolean
}

/** Launch the production Change Operators without duplicating their mutation behavior. */
export function useChangeOperatorLauncher({
  applyCurrent = true,
  archiveCurrent = true,
}: ChangeOperatorInvocationGate = {}) {
  const rootAction = useRootActionState()
  const invocationGateRef = useRef({ rootAction, applyCurrent, archiveCurrent })
  invocationGateRef.current = { rootAction, applyCurrent, archiveCurrent }
  const { openArchiveModal } = useArchiveModal()

  const launchApply = useCallback((target: ChangeOperatorTarget): boolean => {
    const gate = invocationGateRef.current
    if (gate.rootAction.status !== 'ready' || !gate.applyCurrent) return false
    vtNavController.activatePop(
      buildOpsxComposeHref({ action: 'apply', changeId: target.changeId })
    )
    return true
  }, [])

  const launchArchive = useCallback(
    (target: ChangeOperatorTarget): boolean => {
      const gate = invocationGateRef.current
      if (gate.rootAction.status !== 'ready' || !gate.archiveCurrent) return false
      openArchiveModal(target.changeId, target.changeName)
      return true
    },
    [openArchiveModal]
  )

  return {
    rootAction,
    disabled: rootAction.disabled,
    launchApply,
    launchArchive,
  }
}
