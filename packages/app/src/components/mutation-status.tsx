import { CheckCircle2, CircleSlash, Loader2, Timer, XCircle } from 'lucide-react'
import type { StoreMutationStatus } from '../types/store-mutation'

const STATUS_META: Record<
  StoreMutationStatus,
  { label: string; className: string; icon: typeof Loader2 }
> = {
  accepted: {
    label: 'Queued',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    icon: Timer,
  },
  running: {
    label: 'Running',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    icon: Loader2,
  },
  succeeded: {
    label: 'Succeeded',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/15 text-destructive',
    icon: XCircle,
  },
  indeterminate: {
    label: 'Indeterminate',
    className: 'bg-muted text-muted-foreground',
    icon: CircleSlash,
  },
}

/**
 * Store 变更生命周期徽章（9.10）。
 *
 * 关键不变式（AGENTS.md）：
 *  - 生命周期 accepted -> running -> succeeded | failed；丢失不可恢复的终端结果为 indeterminate，
 *    绝不伪造为失败或取消。断线只 detach 观察，不杀 CLI。
 *  - V1 无 Cancel、无自动重试。
 */
export function MutationStatusBadge({ status }: { status: StoreMutationStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {meta.label}
    </span>
  )
}

export function getStatusLabel(status: StoreMutationStatus): string {
  return STATUS_META[status].label
}
