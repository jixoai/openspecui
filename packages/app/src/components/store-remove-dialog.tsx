/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Confirm destructive Store removal with explicit environment and checkout identity.
 * 2. Submit through the route-owned Store mutation boundary without browser-side deletion.
 * 3. Keep the dialog bound to the full tab identity/generation that opened it.
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
import type { StoreActionAuthority } from '../lib/store-action'
import { MutationStatusBadge } from './mutation-status'

const REMOVE_STORE_FORM_ID = 'remove-store-form'

/**
 * Store Remove 确认对话框（9.9）。
 *
 * 破坏性操作门槛：必须命名 environment、host、Store、checkout path，并要求显式确认。
 * 复用 web 共享 Dialog（focus trap / ESC / backdrop / @starting-style 过渡动画）。
 *
 * 关键约束（AGENTS.md）：
 *  - remove 是 stores.mutate 能力的 backend-owned 操作；前端只发请求，不删文件。
 *  - 客户端断开只 detach 观察；不杀 CLI。丢失结果为 indeterminate，不伪造为失败/取消。
 *
 * HTTP 仅返回 admission/rejoin 证据；关闭动作由 matching Server-ledger succeeded record 驱动。
 * 环境身份（envUri）由当前选中环境提供，不是前端构造。
 */
export function StoreRemoveDialog({
  store,
  envUri,
  authority,
  authorityCurrent = false,
  removeStore,
  mutationRecords = [],
  onRemoved,
  onClose,
}: {
  store: StoreDoctorStore
  /** Opaque environment identity from the active backend (display-only; never dereferenced). */
  envUri?: string
  /** Exact selected-tab/generation authority evaluated in the submit turn. */
  authority?: StoreActionAuthority | null
  /** Whether the captured origin still equals the route's current authority. */
  authorityCurrent?: boolean
  /** Route-owned mutation operation; it performs the final production authority check. */
  removeStore: (
    authority: StoreActionAuthority | null,
    requestId: string,
    storeId: string
  ) => Promise<BackendStoreMutationRecord | null>
  /** Server-owned ledger records for the dialog's captured locator. */
  mutationRecords?: readonly StoreMutationEnvelope[]
  onRemoved?: (storeId: string) => void
  onClose: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const expected = store.id ?? ''
  const confirmRef = useRef<HTMLInputElement>(null)
  const hasConfirmation = confirmText === expected && expected.length > 0 && !submitting
  const canSubmit = hasConfirmation && Boolean(authority) && authorityCurrent
  const observedMutation = requestId
    ? (mutationRecords.find((record) => record.requestId === requestId) ?? null)
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
    const requestId = `remove:${storeId}:${Date.now()}`
    removeStore(authority ?? null, requestId, storeId)
      .then((mutation) => {
        if (!mutation) {
          setSubmitting(false)
          return
        }
        setRequestId(mutation.requestId)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setSubmitting(false)
      })
  }, [hasConfirmation, authority, removeStore, store.id])

  useEffect(() => {
    if (!observedMutation) return
    if (observedMutation.status === 'succeeded') {
      onRemoved?.(store.id ?? '')
      onClose()
      return
    }
    if (observedMutation.status === 'failed' || observedMutation.status === 'indeterminate') {
      setError(observedMutation.result.stderr ?? `Store remove ${observedMutation.status}.`)
      setSubmitting(false)
    }
  }, [observedMutation, onClose, onRemoved, store.id])

  return (
    <Dialog
      open
      onClose={onClose}
      borderVariant="error"
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
          <span className="text-lg font-semibold">Remove Store files</span>
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
            form={REMOVE_STORE_FORM_ID}
            disabled={!canSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove Store
          </button>
        </>
      }
    >
      <form
        id={REMOVE_STORE_FORM_ID}
        aria-label="Remove Store files"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <p className="text-muted-foreground text-sm">
          This deletes the Store checkout on the backend host. The mutation is backend-owned and
          survives disconnects.
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
            The environment refreshed after this dialog opened. Close and reopen it before removing
            files.
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
