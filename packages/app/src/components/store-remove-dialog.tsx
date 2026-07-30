/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Confirm Store unregister/remove with explicit Environment and checkout identity.
 * 2. Distinguish registry-only unregister from destructive checkout removal.
 * 3. Keep the dialog bound to the full Environment source identity/generation that opened it.
 * 4. Close only from the matching Server-ledger succeeded record; retain rejection/failure evidence.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 */
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import { Dialog } from '@openspecui/web-src/components/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { BackendStoreMutationRecord } from '../lib/backend-client'
import type { EnvironmentActionAuthority } from '../lib/environment-authority'
import { MutationStatusBadge } from './mutation-status'

const CLEANUP_STORE_FORM_ID = 'cleanup-store-form'

export type StoreCleanupKind = 'unregister' | 'remove'

/**
 * Store cleanup 确认对话框（7.12）。
 *
 * 操作门槛：必须命名 Environment、host、Store、checkout path，并要求显式确认。
 * 复用 web 共享 Dialog（focus trap / ESC / backdrop / @starting-style 过渡动画）。
 *
 * 关键约束（AGENTS.md）：
 *  - unregister/remove 都是 backend-owned 操作；前端只发请求，不修改注册表或文件。
 *  - 客户端断开只 detach 观察；不杀 CLI。丢失结果为 indeterminate，不伪造为失败/取消。
 *
 * HTTP 仅返回 admission/rejoin 证据；关闭动作由 matching Server-ledger succeeded record 驱动。
 * 环境身份（envUri）由当前选中环境提供，不是前端构造。
 */
export function StoreCleanupDialog({
  kind,
  store,
  envUri,
  authority,
  authorityCurrent = false,
  cleanupStore,
  mutationRecords = [],
  onCleaned,
  onClose,
}: {
  kind: StoreCleanupKind
  store: StoreDoctorStore
  /** Opaque environment identity from the active backend (display-only; never dereferenced). */
  envUri?: string
  /** Exact selected-tab/generation authority evaluated in the submit turn. */
  authority?: EnvironmentActionAuthority | null
  /** Whether the captured origin still equals the route's current authority. */
  authorityCurrent?: boolean
  /** Route-owned mutation operation; it performs the final production authority check. */
  cleanupStore: (
    authority: EnvironmentActionAuthority | null,
    requestId: string,
    storeId: string
  ) => Promise<BackendStoreMutationRecord | null>
  /** Server-owned ledger records for the dialog's captured locator. */
  mutationRecords?: readonly StoreMutationEnvelope[]
  onCleaned?: (storeId: string) => void
  onClose: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const expected = store.id ?? ''
  const removesFiles = kind === 'remove'
  const actionLabel = removesFiles ? 'Remove Store' : 'Unregister Store'
  const confirmRef = useRef<HTMLInputElement>(null)
  const hasConfirmation = confirmText === expected && expected.length > 0 && !submitting
  const canSubmit = hasConfirmation && Boolean(authority) && authorityCurrent
  const expectedEnvUri = envUri ?? authority?.envUri
  const observedMutation = requestId
    ? (mutationRecords.find(
        (record) =>
          record.requestId === requestId &&
          record.kind === kind &&
          record.storeId === expected &&
          record.envUri === expectedEnvUri
      ) ?? null)
    : null

  useEffect(() => {
    // Dialog 打开后聚焦确认输入，便于键盘操作。
    const timer = setTimeout(() => confirmRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])

  const submit = useCallback(() => {
    const storeId = store.id
    if (!hasConfirmation || !storeId) return
    setSubmitting(true)
    setError(null)
    const requestId = `${kind}:${storeId}:${Date.now()}`
    cleanupStore(authority ?? null, requestId, storeId)
      .then((mutation) => {
        if (!mutation) {
          setError('The Environment authority changed before Store cleanup was admitted.')
          setSubmitting(false)
          return
        }
        setRequestId(mutation.requestId)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setSubmitting(false)
      })
  }, [authority, cleanupStore, hasConfirmation, kind, store.id])

  useEffect(() => {
    if (!observedMutation) return
    if (observedMutation.status === 'succeeded') {
      onCleaned?.(store.id ?? '')
      onClose()
      return
    }
    if (observedMutation.status === 'failed' || observedMutation.status === 'indeterminate') {
      setError(observedMutation.result.stderr ?? `Store ${kind} ${observedMutation.status}.`)
      setSubmitting(false)
    }
  }, [kind, observedMutation, onCleaned, onClose, store.id])

  return (
    <Dialog
      open
      onClose={() => {
        if (!submitting) onClose()
      }}
      borderVariant="error"
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
          <span className="text-lg font-semibold">
            {removesFiles ? 'Remove Store files' : 'Unregister Store'}
          </span>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="hover:bg-muted rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={CLEANUP_STORE_FORM_ID}
            disabled={!canSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {actionLabel}
          </button>
        </>
      }
    >
      <form
        id={CLEANUP_STORE_FORM_ID}
        aria-label={removesFiles ? 'Remove Store files' : 'Unregister Store'}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <p className="text-muted-foreground text-sm">
          {removesFiles
            ? 'This forgets the registration and deletes the Store checkout on the backend host.'
            : 'This forgets the Store registration but keeps its checkout files on disk.'}{' '}
          The mutation is backend-owned and survives disconnects.
        </p>

        <dl className="bg-muted/40 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-md p-3 text-xs">
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="break-all font-mono">
            {envUri ?? authority?.apiBaseUrl ?? 'selected environment'}
          </dd>
          <dt className="text-muted-foreground">Host</dt>
          {/* host identity 不通过 envUri 暴露原始值；展示 backend 实例定位符。 */}
          <dd className="break-all font-mono">{authority?.apiBaseUrl ?? 'backend host'}</dd>
          <dt className="text-muted-foreground">Store</dt>
          <dd className="font-mono">{store.id ?? '—'}</dd>
          <dt className="text-muted-foreground">Checkout</dt>
          <dd className="break-all font-mono">{store.root ?? '—'}</dd>
        </dl>

        {authority && !authorityCurrent ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            The environment refreshed after this dialog opened. Close and reopen it before changing
            this Store registration.
          </p>
        ) : null}

        {error ? (
          <p className="border-destructive/40 text-destructive bg-destructive/5 rounded-md border px-3 py-2 text-xs">
            {error}
          </p>
        ) : null}

        {observedMutation ? (
          <div className="flex items-center justify-between gap-3 text-xs" role="status">
            <span className="text-muted-foreground font-mono">{observedMutation.requestId}</span>
            <MutationStatusBadge status={observedMutation.status} />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="remove-confirm" className="text-sm font-medium">
            Type the Store id to confirm
          </label>
          <input
            id="remove-confirm"
            ref={confirmRef}
            type="text"
            placeholder={expected}
            disabled={submitting}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="border-border bg-background focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none"
          />
        </div>
      </form>
    </Dialog>
  )
}
